// Server Actions del módulo Becas contra la base real, con la sesión
// simulada: programas sugeridos, importación (vista previa, alta, reimportar
// sin duplicar, conflictos por incompatibilidad), entregas y permisos.
//
// Requiere Postgres con las migraciones aplicadas (ver rls-aislamiento.test.ts).

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql } from '@/lib/db';

let sesionActual: { user: { id: string; rol: string } } | null = null;
vi.mock('@/auth', () => ({ auth: async () => sesionActual }));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

const acciones = await import('@/app/(app)/becas/actions');

type ConId = { id: string };

const fila = (dni: string, apellido: string, extra: Record<string, unknown> = {}) => ({
  fila: 2,
  dni,
  apellido,
  nombre: 'Nombre',
  legajo: null,
  carrera: null,
  email: null,
  telefono: null,
  condicion: null,
  estado: 'activa',
  area: null,
  departamento: null,
  tutor: null,
  modulos: null,
  ...extra,
});

describe('Becas: Server Actions', () => {
  const sufijo = randomUUID().slice(0, 8);
  let org: ConId;
  let otraOrg: ConId;
  let admin: ConId;
  let miembro: ConId;
  let programaAjeno: ConId;
  let belgrano: string;
  let iys: string;

  const como = (usuario: ConId, rol: string) => {
    sesionActual = { user: { id: usuario.id, rol } };
  };

  beforeAll(async () => {
    [org] = await sql<ConId[]>`
      insert into organizacion (nombre, slug) values (${'Becas acc ' + sufijo}, ${'becas-acc-' + sufijo}) returning id
    `;
    [otraOrg] = await sql<ConId[]>`
      insert into organizacion (nombre, slug) values (${'Becas otra ' + sufijo}, ${'becas-otra-' + sufijo}) returning id
    `;
    [admin] = await sql<ConId[]>`
      insert into usuario (organizacion_id, nombre, email, password_hash, rol, estado)
      values (${org.id}, 'Admin', ${`becas-acc-admin-${sufijo}@test.local`}, 'x', 'administrador', 'activo') returning id
    `;
    [miembro] = await sql<ConId[]>`
      insert into usuario (organizacion_id, nombre, email, password_hash, rol, estado)
      values (${org.id}, 'Miembro', ${`becas-acc-miembro-${sufijo}@test.local`}, 'x', 'miembro', 'activo') returning id
    `;
    [programaAjeno] = await sql<ConId[]>`
      insert into beca_programa (organizacion_id, nombre) values (${otraOrg.id}, 'Ajeno') returning id
    `;
  });

  afterAll(async () => {
    await sql`delete from estudiante where organizacion_id in (${org.id}, ${otraOrg.id})`;
    await sql`delete from beca_area where organizacion_id in (${org.id}, ${otraOrg.id})`;
    await sql`delete from beca_programa where organizacion_id in (${org.id}, ${otraOrg.id})`;
    await sql`delete from usuario where organizacion_id in (${org.id}, ${otraOrg.id})`;
    await sql`delete from organizacion where id in (${org.id}, ${otraOrg.id})`;
    await sql.end();
  });

  it('con la sección desactivada (así arranca) las acciones se rechazan', async () => {
    como(admin, 'administrador');
    await expect(acciones.cargarProgramasSugeridos()).rejects.toThrow(/no está disponible/);
    await sql`update organizacion set becas_habilitado = true where id = ${org.id}`;
  });

  it('solo un administrador carga los programas; quedan con sus incompatibilidades', async () => {
    como(miembro, 'miembro');
    await expect(acciones.cargarProgramasSugeridos()).rejects.toThrow(/administrador/);

    como(admin, 'administrador');
    expect(await acciones.cargarProgramasSugeridos()).toEqual({ ok: true });
    // Correrlo dos veces no duplica nada.
    expect(await acciones.cargarProgramasSugeridos()).toEqual({ ok: true });

    const programas = await sql<{ id: string; nombre: string }[]>`
      select id, nombre from beca_programa where organizacion_id = ${org.id}
    `;
    expect(programas.map((p) => p.nombre).sort()).toEqual(
      ['BASE', 'Investigación y Servicio', 'Manuel Belgrano', 'Progresar'],
    );
    belgrano = programas.find((p) => p.nombre === 'Manuel Belgrano')!.id;
    iys = programas.find((p) => p.nombre === 'Investigación y Servicio')!.id;
    const [{ pares }] = await sql<{ pares: number }[]>`
      select count(*)::int as pares from beca_incompatibilidad i
      join beca_programa p on p.id = i.programa_a where p.organizacion_id = ${org.id}
    `;
    expect(pares).toBe(3);
  });

  it('importa un listado: da de alta estudiantes y becas, y reimportar no duplica', async () => {
    como(miembro, 'miembro');
    const listado = [
      fila('41000001', 'Uno', { condicion: 'Renovante', email: 'uno@test.local' }),
      fila('41000002', 'Dos', { condicion: 'Nuevo' }),
      fila('41000003', 'Tres', { estado: 'rechazada' }),
    ];
    const vista = await acciones.previsualizarImportacion(belgrano, 2025, listado);
    if ('error' in vista) throw new Error(vista.error);
    expect(vista.filas.map((f) => f.situacion)).toEqual(['nuevo', 'nuevo', 'nuevo']);

    const r = await acciones.aplicarImportacion(belgrano, 2025, listado);
    expect(r).toEqual({ ok: true, estudiantesNuevos: 3, becasNuevas: 3, becasYaExistentes: 0, areasCreadas: 0 });

    // Segunda vez, con un dato nuevo (legajo) y uno vacío (mail): completa
    // el legajo, no borra el mail, no duplica nada.
    const otraVez = await acciones.aplicarImportacion(belgrano, 2025, [
      fila('41000001', 'Uno', { legajo: '15000', email: null }),
    ]);
    expect(otraVez).toEqual({ ok: true, estudiantesNuevos: 0, becasNuevas: 0, becasYaExistentes: 1, areasCreadas: 0 });
    const [uno] = await sql<{ legajo: string; email: string }[]>`
      select legajo, email from estudiante where organizacion_id = ${org.id} and dni = '41000001'
    `;
    expect(uno).toEqual({ legajo: '15000', email: 'uno@test.local' });
    const [{ becas }] = await sql<{ becas: number }[]>`
      select count(*)::int as becas from beca_asignacion where organizacion_id = ${org.id}
    `;
    expect(becas).toBe(3);
  });

  it('avisa los conflictos antes de importar una beca incompatible, y crea las áreas del listado', async () => {
    como(miembro, 'miembro');
    const listado = [
      // Tiene Manuel Belgrano activa: conflicto.
      fila('41000001', 'Uno', { area: 'CICOM', tutor: 'Ing. Tutor', modulos: 2 }),
      // Su Belgrano está rechazada: no choca.
      fila('41000003', 'Tres', { area: 'cicom', modulos: 1 }),
      fila('41000004', 'Cuatro', { area: 'Laboratorio', modulos: 1 }),
    ];
    const vista = await acciones.previsualizarImportacion(iys, 2025, listado);
    if ('error' in vista) throw new Error(vista.error);
    expect(vista.filas.map((f) => f.situacion)).toEqual(['conflicto', 'existente', 'nuevo']);
    expect(vista.filas[0].choca_con).toEqual(['Manuel Belgrano']);
    expect(vista.areasNuevas.sort()).toEqual(['CICOM', 'Laboratorio', 'cicom'].sort());

    const r = await acciones.aplicarImportacion(iys, 2025, listado);
    // "CICOM" y "cicom" son la misma área.
    expect(r).toEqual({ ok: true, estudiantesNuevos: 1, becasNuevas: 3, becasYaExistentes: 0, areasCreadas: 2 });
    const areas = await sql<{ nombre: string; tutor_nombre: string | null; becarios: number }[]>`
      select a.nombre, a.tutor_nombre, count(b.id)::int as becarios
      from beca_area a left join beca_asignacion b on b.area_id = a.id
      where a.organizacion_id = ${org.id} and a.anio = 2025
      group by a.id order by a.nombre
    `;
    expect(areas).toEqual([
      { nombre: 'CICOM', tutor_nombre: 'Ing. Tutor', becarios: 2 },
      { nombre: 'Laboratorio', tutor_nombre: null, becarios: 1 },
    ]);
  });

  it('no importa en un programa de otra organización ni acepta filas sin DNI', async () => {
    como(miembro, 'miembro');
    expect(await acciones.aplicarImportacion(programaAjeno.id, 2025, [fila('41000009', 'Colado')])).toEqual({
      error: 'El programa no existe.',
    });
    expect(await acciones.aplicarImportacion(belgrano, 2025, [{ dni: 'x', apellido: 'Sin DNI' }, 'basura'])).toEqual({
      error: 'No se encontró ninguna fila con DNI y apellido.',
    });
    const [{ colados }] = await sql<{ colados: number }[]>`
      select count(*)::int as colados from estudiante where dni = '41000009'
    `;
    expect(colados).toBe(0);
  });

  it('las entregas las define un administrador y las marca cualquiera, solo sobre su programa', async () => {
    como(miembro, 'miembro');
    await expect(
      acciones.guardarEntrega(null, { programa_id: iys, anio: 2025, nombre: 'Informe', vence_el: null, a_cargo: 'becario' }),
    ).rejects.toThrow(/administrador/);

    como(admin, 'administrador');
    expect(
      await acciones.guardarEntrega(null, {
        programa_id: iys, anio: 2025, nombre: 'Informe septiembre', vence_el: '2025-09-12', a_cargo: 'becario',
      }),
    ).toEqual({ ok: true });
    const [entrega] = await sql<ConId[]>`select id from beca_entrega where organizacion_id = ${org.id}`;
    const becas = await sql<{ id: string; programa_id: string }[]>`
      select a.id, a.programa_id from beca_asignacion a
      join estudiante e on e.id = a.estudiante_id
      where a.organizacion_id = ${org.id} and e.dni = '41000001'
    `;
    const becaIys = becas.find((b) => b.programa_id === iys)!;
    const becaBelgrano = becas.find((b) => b.programa_id === belgrano)!;

    como(miembro, 'miembro');
    expect(await acciones.marcarEntrega(becaIys.id, entrega.id, 'observada', 'Falta la firma')).toEqual({ ok: true });
    expect(await acciones.marcarEntrega(becaIys.id, entrega.id, 'recibida', null)).toEqual({ ok: true });
    let marcadas = await sql`select estado, observacion from beca_entrega_estado where entrega_id = ${entrega.id}`;
    expect([...marcadas]).toEqual([{ estado: 'recibida', observacion: null }]);

    // La entrega es de IyS: no se puede marcar sobre la beca Belgrano.
    expect(await acciones.marcarEntrega(becaBelgrano.id, entrega.id, 'recibida', null)).toEqual({
      error: 'Esa entrega no corresponde a esa beca.',
    });

    expect(await acciones.marcarEntrega(becaIys.id, entrega.id, 'pendiente', null)).toEqual({ ok: true });
    marcadas = await sql`select 1 from beca_entrega_estado where entrega_id = ${entrega.id}`;
    expect(marcadas).toHaveLength(0);
  });

  it('dar de baja una de las dos becas resuelve el conflicto, y el historial la conserva', async () => {
    como(miembro, 'miembro');
    const [est] = await sql<ConId[]>`select id from estudiante where organizacion_id = ${org.id} and dni = '41000001'`;
    const [beca] = await sql<ConId[]>`
      select id from beca_asignacion where estudiante_id = ${est.id} and programa_id = ${iys}
    `;
    expect(await acciones.cambiarEstadoAsignacion(beca.id, 'baja')).toEqual({ ok: true });
    const historial = await acciones.obtenerHistorial(est.id);
    expect(historial.map((h) => [h.programa, h.estado]).sort()).toEqual([
      ['Investigación y Servicio', 'baja'],
      ['Manuel Belgrano', 'activa'],
    ]);
    // Ya no figura como incompatible al volver a revisar el listado.
    const vista = await acciones.previsualizarImportacion(belgrano, 2025, [fila('41000001', 'Uno')]);
    if ('error' in vista) throw new Error(vista.error);
    expect(vista.filas[0].situacion).toBe('ya_tiene');
  });

  it('un DNI repetido al cargar a mano devuelve un error legible; borrar es de administrador', async () => {
    como(miembro, 'miembro');
    const datos = {
      dni: '41.000.002', apellido: 'Repetido', nombre: '', legajo: null, carrera: null,
      email: null, telefono: null, notas: null,
    };
    expect(await acciones.guardarEstudiante(null, datos)).toEqual({
      error: 'Ya hay un estudiante cargado con ese DNI.',
    });
    const [est] = await sql<ConId[]>`select id from estudiante where organizacion_id = ${org.id} and dni = '41000002'`;
    await expect(acciones.eliminarEstudiante(est.id)).rejects.toThrow(/administrador/);
    como(admin, 'administrador');
    expect(await acciones.eliminarEstudiante(est.id)).toEqual({ ok: true });
  });
});
