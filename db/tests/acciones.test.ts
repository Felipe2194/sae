// Pruebas de Server Actions contra la base real, con la sesión y los headers
// de Next simulados: la inscripción pública a un viaje (cupo bajo
// concurrencia, validaciones) y el cambio de contraseña propio.
//
// Requiere Postgres con las migraciones aplicadas (ver rls-aislamiento.test.ts).

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { sql, withUser } from '@/lib/db';

// Cada test usa su propia "IP" para no chocar con el rate limit de otro.
let ipActual = '10.0.0.1';
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': ipActual }),
}));

let sesionActual: { user: { id: string; rol?: string } } | null = null;
vi.mock('@/auth', () => ({ auth: async () => sesionActual }));

vi.mock('next/cache', () => ({ revalidatePath: () => {}, refresh: () => {} }));

const { inscribirseViaje } = await import('@/app/inscripcion-viaje/[codigo]/actions');
const { cambiarPassword } = await import('@/app/(app)/perfil/actions');
const { crearTurno } = await import('@/app/(app)/cronograma/actions');
const { borrarDatosPersonalesInscriptos } = await import('@/app/(app)/viajes/[viajeId]/actions');

type ConId = { id: string };

function formulario(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

describe('Server Actions', () => {
  const sufijo = randomUUID().slice(0, 8);
  const codigo = ('T' + sufijo).toUpperCase();
  let org: ConId;
  let usuario: ConId;
  let viaje: ConId;

  beforeAll(async () => {
    [org] = await sql<ConId[]>`
      insert into organizacion (nombre, slug)
      values (${'Test Acciones ' + sufijo}, ${'test-acciones-' + sufijo})
      returning id
    `;
    [usuario] = await sql<ConId[]>`
      insert into usuario (organizacion_id, nombre, email, password_hash, rol, estado)
      values (
        ${org.id}, 'Persona de prueba', ${`acc-${sufijo}@test.local`},
        ${await bcrypt.hash('clave-original', 4)}, 'miembro', 'activo'
      )
      returning id
    `;
    // Solo nombre/apellido/DNI obligatorios, para no repetir el resto en cada test.
    [viaje] = await sql<ConId[]>`
      insert into viaje (
        organizacion_id, nombre, destino, fecha_inicio, cupo_maximo, estado,
        codigo_publico, creada_por, campos_formulario
      )
      values (
        ${org.id}, 'Viaje de prueba', 'Córdoba', current_date + 30, 3,
        'inscripciones_abiertas', ${codigo}, ${usuario.id},
        ${sql.json({ legajo: 'oculto', carrera: 'oculto', anio_cursada: 'oculto', email: 'opcional', telefono: 'opcional' })}
      )
      returning id
    `;
  });

  afterAll(async () => {
    await sql`delete from intento_auth where clave like 'viaje-inscripcion:ip:10.0.%' or clave = ${'password:usuario:' + usuario.id}`;
    await sql`delete from auditoria where organizacion_id = ${org.id}`;
    await sql`delete from viaje where id = ${viaje.id}`;
    await sql`delete from turno where organizacion_id = ${org.id}`;
    await sql`delete from usuario where id = ${usuario.id}`;
    await sql`delete from organizacion where id = ${org.id}`;
    await sql.end();
  });

  describe('inscripción pública a un viaje', () => {
    it('rechaza datos inválidos sin inscribir a nadie', async () => {
      ipActual = '10.0.1.1';
      const casos: [Record<string, string>, RegExp][] = [
        [{ nombre: 'Ana', apellido: 'Paz', dni: '' }, /Completá/],
        [{ nombre: 'Ana', apellido: 'Paz', dni: '12.345.678' }, /DNI/],
        [{ nombre: 'Ana', apellido: 'Paz', dni: '1'.repeat(30) }, /DNI/],
        [{ nombre: 'Ana', apellido: 'Paz', dni: '30111222', email: 'no-es-un-mail' }, /email/],
        [{ nombre: 'Ana', apellido: 'Paz', dni: '30111222', telefono: '9'.repeat(40) }, /teléfono/],
      ];
      for (const [campos, esperado] of casos) {
        const r = await inscribirseViaje(codigo, null, formulario(campos));
        expect(r?.success).toBe(false);
        expect(r?.error).toMatch(esperado);
      }
      const [{ n }] = await sql<[{ n: number }]>`
        select count(*)::int as n from viaje_integrante where viaje_id = ${viaje.id}
      `;
      expect(n).toBe(0);
    });

    it('un código que no existe no acepta inscripciones', async () => {
      ipActual = '10.0.1.2';
      const r = await inscribirseViaje('NOEXISTE', null, formulario({ nombre: 'Ana', apellido: 'Paz', dni: '30111222' }));
      expect(r?.success).toBe(false);
    });

    it('con 10 inscripciones simultáneas y cupo 3, entran exactamente 3', async () => {
      const resultados = await Promise.all(
        Array.from({ length: 10 }, (_, i) => {
          ipActual = `10.0.2.${i + 1}`;
          return inscribirseViaje(
            codigo,
            null,
            formulario({ nombre: 'Est', apellido: `Numero ${i}`, dni: String(40000000 + i) }),
          );
        }),
      );
      expect(resultados.every((r) => r?.success)).toBe(true);

      const filas = await sql<{ estado: string; n: number }[]>`
        select estado::text, count(*)::int as n from viaje_integrante
        where viaje_id = ${viaje.id} group by estado
      `;
      const porEstado = Object.fromEntries(filas.map((f) => [f.estado, f.n]));
      expect(porEstado.pendiente).toBe(3);
      expect(porEstado.lista_espera).toBe(7);
    });

    it('el mismo DNI no se puede anotar dos veces', async () => {
      ipActual = '10.0.3.1';
      const r = await inscribirseViaje(codigo, null, formulario({ nombre: 'Est', apellido: 'Repetido', dni: '40000000' }));
      expect(r?.success).toBe(false);
      expect(r?.error).toMatch(/Ya te anotaste/);
    });

    it('60 inscripciones desde la misma IP pasan el límite; la 61 no', async () => {
      ipActual = '10.0.4.1';
      await sql`
        insert into intento_auth (clave)
        select 'viaje-inscripcion:ip:10.0.4.1' from generate_series(1, 59)
      `;
      const r60 = await inscribirseViaje(codigo, null, formulario({ nombre: 'Est', apellido: 'Sesenta', dni: '41000060' }));
      expect(r60?.success).toBe(true);
      const r61 = await inscribirseViaje(codigo, null, formulario({ nombre: 'Est', apellido: 'Sesentayuno', dni: '41000061' }));
      expect(r61?.success).toBe(false);
      expect(r61?.error).toMatch(/Demasiados intentos/);
    });
  });

  describe('cambio de contraseña propio', () => {
    const cambiar = (actual: string, nueva: string, confirmar = nueva) =>
      cambiarPassword(
        null,
        formulario({ password_actual: actual, password_nueva: nueva, password_confirmar: confirmar }),
      );

    it('sin sesión no hace nada', async () => {
      sesionActual = null;
      expect((await cambiar('clave-original', 'otra-clave-123')).ok).toBe(false);
    });

    it('valida largo, confirmación y que la nueva sea distinta', async () => {
      sesionActual = { user: { id: usuario.id } };
      expect((await cambiar('clave-original', 'corta')).error).toMatch(/8 caracteres/);
      expect((await cambiar('clave-original', 'otra-clave-123', 'no-coincide-1')).error).toMatch(/no coinciden/);
      expect((await cambiar('clave-original', 'clave-original')).error).toMatch(/distinta/);
    });

    it('con la contraseña actual incorrecta no cambia nada', async () => {
      sesionActual = { user: { id: usuario.id } };
      const r = await cambiar('no-es-esta', 'otra-clave-123');
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/actual no es correcta/);
      const [{ password_hash }] = await sql<[{ password_hash: string }]>`
        select password_hash from usuario where id = ${usuario.id}
      `;
      expect(await bcrypt.compare('clave-original', password_hash)).toBe(true);
    });

    it('con la actual correcta la cambia y lo deja en auditoría', async () => {
      sesionActual = { user: { id: usuario.id } };
      const r = await cambiar('clave-original', 'otra-clave-123');
      expect(r).toEqual({ error: null, ok: true });

      const [{ password_hash }] = await sql<[{ password_hash: string }]>`
        select password_hash from usuario where id = ${usuario.id}
      `;
      expect(await bcrypt.compare('otra-clave-123', password_hash)).toBe(true);
      expect(await bcrypt.compare('clave-original', password_hash)).toBe(false);

      const auditoria = await sql`
        select campo from auditoria where usuario_id = ${usuario.id} and entidad = 'usuario'
      `;
      expect(auditoria.map((a) => a.campo)).toContain('(contraseña cambiada)');
    });

    it('la cuenta de oficina no puede cambiar su contraseña desde acá', async () => {
      await sql`update usuario set es_cuenta_generica = true where id = ${usuario.id}`;
      sesionActual = { user: { id: usuario.id } };
      const r = await cambiar('otra-clave-123', 'una-tercera-clave');
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/cuenta de oficina/);
      await sql`update usuario set es_cuenta_generica = false where id = ${usuario.id}`;
    });
  });

  // Las páginas ya redirigen con la sección apagada; esto cubre la acción,
  // que es un endpoint aparte (lib/sesion.ts → requireSeccion).
  describe('acciones de una sección opcional', () => {
    const turno = () =>
      crearTurno({
        usuario_id: usuario.id,
        dia_semana: 1,
        hora_inicio: '09:00',
        hora_fin: '11:00',
        vigente_desde: '2026-01-01',
        vigente_hasta: null,
      });
    const turnos = async () => {
      const [{ n }] = await sql<[{ n: number }]>`
        select count(*)::int as n from turno where organizacion_id = ${org.id}
      `;
      return n;
    };

    afterAll(async () => {
      await sql`delete from turno where organizacion_id = ${org.id}`;
      await sql`
        update organizacion set cronograma_habilitado = true, secciones_solo_admin = '{}'
        where id = ${org.id}
      `;
      await sql`update usuario set rol = 'miembro' where id = ${usuario.id}`;
    });

    it('con la sección desactivada la acción no escribe', async () => {
      sesionActual = { user: { id: usuario.id, rol: 'miembro' } };
      await sql`update organizacion set cronograma_habilitado = false where id = ${org.id}`;
      await expect(turno()).rejects.toThrow(/no está disponible/);
      expect(await turnos()).toBe(0);
    });

    it('"solo administradores" frena al equipo y deja pasar a quien administra', async () => {
      await sql`
        update organizacion set cronograma_habilitado = true, secciones_solo_admin = '{cronograma}'
        where id = ${org.id}
      `;
      sesionActual = { user: { id: usuario.id, rol: 'miembro' } };
      await expect(turno()).rejects.toThrow(/no está disponible/);
      expect(await turnos()).toBe(0);

      await sql`update usuario set rol = 'administrador' where id = ${usuario.id}`;
      sesionActual = { user: { id: usuario.id, rol: 'administrador' } };
      await turno();
      expect(await turnos()).toBe(1);
    });

    it('con la sección activa para todos, el equipo la usa normalmente', async () => {
      await sql`update organizacion set secciones_solo_admin = '{}' where id = ${org.id}`;
      await sql`update usuario set rol = 'miembro' where id = ${usuario.id}`;
      sesionActual = { user: { id: usuario.id, rol: 'miembro' } };
      await turno();
      expect(await turnos()).toBe(2);
    });
  });

  // Retención de datos personales (migración 054). Usa los inscriptos que
  // dejó el test de cupo de más arriba.
  describe('borrar datos personales de inscriptos', () => {
    type Fila = {
      id: string;
      nombre: string;
      apellido: string;
      dni: string;
      legajo: string | null;
      email: string | null;
      telefono: string | null;
      notas_internas: string | null;
      carrera: string | null;
      anonimizado_en: Date | null;
    };
    const filas = () => sql<Fila[]>`
      select id, nombre, apellido, dni, legajo, email, telefono, notas_internas, carrera, anonimizado_en
      from viaje_integrante where viaje_id = ${viaje.id} order by creado_en, id
    `;
    const comoAdmin = async () => {
      await sql`update usuario set rol = 'administrador' where id = ${usuario.id}`;
      sesionActual = { user: { id: usuario.id, rol: 'administrador' } };
    };

    beforeAll(async () => {
      await sql`
        update viaje_integrante
        set email = 'alguien@test.local', telefono = '3534000000', legajo = '12345',
            carrera = 'Ing. en Sistemas', notas_internas = 'celíaco'
        where viaje_id = ${viaje.id}
      `;
      const [primero] = await filas();
      await sql`
        insert into viaje_pago (viaje_integrante_id, monto, medio_pago, comprobante_url, registrado_por)
        values (${primero.id}, 1500, 'efectivo', 'https://ejemplo.invalid/comprobante.pdf', ${usuario.id})
      `;
      await sql`
        insert into auditoria (organizacion_id, usuario_id, entidad, entidad_id, entidad_nombre, campo, valor_antes, valor_despues)
        values (${org.id}, ${usuario.id}, 'viaje_integrante', ${primero.id}, ${primero.nombre + ' ' + primero.apellido}, 'estado', 'pendiente', 'confirmado')
      `;
    });

    afterAll(async () => {
      await sql`update usuario set rol = 'miembro' where id = ${usuario.id}`;
    });

    it('quien no administra no puede, ni por la acción ni llamando a la función', async () => {
      await sql`update viaje set estado = 'realizado' where id = ${viaje.id}`;
      sesionActual = { user: { id: usuario.id, rol: 'miembro' } };
      await expect(borrarDatosPersonalesInscriptos(viaje.id)).rejects.toThrow(/administrador/);
      await expect(
        withUser(usuario.id, (tx) => tx`select anonimizar_inscriptos_viaje(${viaje.id})`),
      ).rejects.toThrow(/administrador/);
      expect((await filas()).every((f) => f.anonimizado_en === null && f.email !== null)).toBe(true);
    });

    it('con el viaje todavía abierto no borra nada', async () => {
      await sql`update viaje set estado = 'inscripciones_abiertas' where id = ${viaje.id}`;
      await comoAdmin();
      await expect(borrarDatosPersonalesInscriptos(viaje.id)).rejects.toThrow(/realizado o cancelado/);
      await expect(
        withUser(usuario.id, (tx) => tx`select anonimizar_inscriptos_viaje(${viaje.id})`),
      ).rejects.toThrow(/realizado o cancelado/);
      expect((await filas()).every((f) => f.anonimizado_en === null)).toBe(true);
    });

    it('en un viaje realizado deja a cada inscripto sin nada que lo identifique', async () => {
      await sql`update viaje set estado = 'realizado' where id = ${viaje.id}`;
      await comoAdmin();
      const antes = await filas();
      const r = await borrarDatosPersonalesInscriptos(viaje.id);
      expect(r.cantidad).toBe(antes.length);
      expect(r.integrantes).toHaveLength(antes.length);

      const despues = await filas();
      despues.forEach((f, i) => {
        expect(f.id).toBe(antes[i].id);
        expect(f.nombre).toBe('Inscripto');
        expect(f.apellido).toBe(String(i + 1));
        expect(f.dni).toBe('borrado-' + (i + 1));
        expect(f.legajo).toBeNull();
        expect(f.email).toBeNull();
        expect(f.telefono).toBeNull();
        expect(f.notas_internas).toBeNull();
        expect(f.carrera).toBe('Ing. en Sistemas');
        expect(f.anonimizado_en).not.toBeNull();
      });

      // El pago queda (monto y medio), sin el comprobante.
      const pagos = await sql`
        select vp.monto::float8 as monto, vp.medio_pago, vp.comprobante_url
        from viaje_pago vp join viaje_integrante vi on vi.id = vp.viaje_integrante_id
        where vi.viaje_id = ${viaje.id}
      `;
      expect(pagos).toHaveLength(1);
      expect(pagos[0]).toMatchObject({ monto: 1500, medio_pago: 'efectivo', comprobante_url: null });

      // La auditoría vieja ya no nombra a la persona, y queda registro del borrado.
      const rastros = await sql`
        select entidad, entidad_nombre, campo, valor_despues from auditoria
        where organizacion_id = ${org.id} and entidad in ('viaje_integrante', 'viaje')
      `;
      const deIntegrante = rastros.filter((a) => a.entidad === 'viaje_integrante');
      expect(deIntegrante).toHaveLength(1);
      expect(deIntegrante[0].entidad_nombre).toBe('Inscripto 1');
      const delViaje = rastros.filter((a) => a.campo === '(datos personales de inscriptos borrados)');
      expect(delViaje).toHaveLength(1);
      expect(delViaje[0].valor_despues).toBe(String(antes.length));

      // Ningún dato original sobrevive en la tabla.
      const [{ n }] = await sql<[{ n: number }]>`
        select count(*)::int as n from viaje_integrante
        where viaje_id = ${viaje.id}
          and (dni = any(${antes.map((f) => f.dni)}) or apellido = any(${antes.map((f) => f.apellido)}))
      `;
      expect(n).toBe(0);
    });

    it('correrlo de nuevo no toca nada ni duplica el registro', async () => {
      await comoAdmin();
      const r = await borrarDatosPersonalesInscriptos(viaje.id);
      expect(r.cantidad).toBe(0);
      const [{ n }] = await sql<[{ n: number }]>`
        select count(*)::int as n from auditoria
        where organizacion_id = ${org.id} and campo = '(datos personales de inscriptos borrados)'
      `;
      expect(n).toBe(1);
    });

    it('si después se suma alguien, solo se anonimiza a esa persona y no pisa números', async () => {
      await sql`
        insert into viaje_integrante (viaje_id, nombre, apellido, dni, email)
        values (${viaje.id}, 'Tardía', 'Gómez', '40999888', 'tardia@test.local')
      `;
      await comoAdmin();
      const r = await borrarDatosPersonalesInscriptos(viaje.id);
      expect(r.cantidad).toBe(1);
      const todas = await filas();
      expect(new Set(todas.map((f) => f.dni)).size).toBe(todas.length);
      expect(todas.every((f) => f.nombre === 'Inscripto' && f.email === null)).toBe(true);
    });
  });
});
