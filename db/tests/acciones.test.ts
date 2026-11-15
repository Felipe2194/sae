// Pruebas de Server Actions contra la base real, con la sesión y los headers
// de Next simulados: la inscripción pública a un viaje (cupo bajo
// concurrencia, validaciones) y el cambio de contraseña propio.
//
// Requiere Postgres con las migraciones aplicadas (ver rls-aislamiento.test.ts).

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';

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
});
