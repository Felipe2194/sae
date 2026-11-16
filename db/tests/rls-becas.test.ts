// RLS del módulo Becas (055_becas.sql): aislamiento entre organizaciones y
// qué queda reservado a administradores. Son datos personales de
// estudiantes, así que vale la pena tenerlo probado aparte.
//
// Requiere Postgres local con las migraciones aplicadas (ver
// rls-aislamiento.test.ts) y se ejecuta con: npm test

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql, withUser } from '@/lib/db';

type ConId = { id: string };

describe('Becas: RLS', () => {
  const sufijo = randomUUID().slice(0, 8);

  let orgA: ConId;
  let orgB: ConId;
  let adminA: ConId;
  let miembroA: ConId;
  let miembroB: ConId;
  let programaA: ConId;
  let programaA2: ConId;
  let programaB: ConId;
  let estudianteA: ConId;
  let estudianteB: ConId;
  let becaA: ConId;
  let becaB: ConId;
  let entregaA: ConId;
  let entregaB: ConId;

  beforeAll(async () => {
    [orgA] = await sql<ConId[]>`
      insert into organizacion (nombre, slug) values (${'Becas A ' + sufijo}, ${'becas-a-' + sufijo}) returning id
    `;
    [orgB] = await sql<ConId[]>`
      insert into organizacion (nombre, slug) values (${'Becas B ' + sufijo}, ${'becas-b-' + sufijo}) returning id
    `;
    const usuario = async (org: ConId, apodo: string, rol: string) => {
      const [u] = await sql<ConId[]>`
        insert into usuario (organizacion_id, nombre, email, password_hash, rol, estado)
        values (${org.id}, ${apodo}, ${`becas-${apodo}-${sufijo}@test.local`}, 'x', ${rol}::rol_usuario, 'activo')
        returning id
      `;
      return u;
    };
    adminA = await usuario(orgA, 'admin-a', 'administrador');
    miembroA = await usuario(orgA, 'miembro-a', 'miembro');
    miembroB = await usuario(orgB, 'miembro-b', 'miembro');

    const programa = async (org: ConId, nombre: string) => {
      const [p] = await sql<ConId[]>`
        insert into beca_programa (organizacion_id, nombre) values (${org.id}, ${nombre}) returning id
      `;
      return p;
    };
    programaA = await programa(orgA, 'Programa A');
    programaA2 = await programa(orgA, 'Programa A2');
    programaB = await programa(orgB, 'Programa B');

    [estudianteA] = await sql<ConId[]>`
      insert into estudiante (organizacion_id, dni, apellido) values (${orgA.id}, '40000001', 'De A') returning id
    `;
    // Mismo DNI en las dos organizaciones: el unique es por organización.
    [estudianteB] = await sql<ConId[]>`
      insert into estudiante (organizacion_id, dni, apellido) values (${orgB.id}, '40000001', 'De B') returning id
    `;
    [becaA] = await sql<ConId[]>`
      insert into beca_asignacion (organizacion_id, estudiante_id, programa_id, anio)
      values (${orgA.id}, ${estudianteA.id}, ${programaA.id}, 2025) returning id
    `;
    [becaB] = await sql<ConId[]>`
      insert into beca_asignacion (organizacion_id, estudiante_id, programa_id, anio)
      values (${orgB.id}, ${estudianteB.id}, ${programaB.id}, 2025) returning id
    `;
    [entregaA] = await sql<ConId[]>`
      insert into beca_entrega (organizacion_id, programa_id, anio, nombre)
      values (${orgA.id}, ${programaA.id}, 2025, 'Informe A') returning id
    `;
    [entregaB] = await sql<ConId[]>`
      insert into beca_entrega (organizacion_id, programa_id, anio, nombre)
      values (${orgB.id}, ${programaB.id}, 2025, 'Informe B') returning id
    `;
  });

  afterAll(async () => {
    // estudiante → asignaciones → entregas marcadas caen en cascada.
    await sql`delete from estudiante where organizacion_id in (${orgA.id}, ${orgB.id})`;
    await sql`delete from beca_area where organizacion_id in (${orgA.id}, ${orgB.id})`;
    await sql`delete from beca_programa where organizacion_id in (${orgA.id}, ${orgB.id})`;
    await sql`delete from usuario where organizacion_id in (${orgA.id}, ${orgB.id})`;
    await sql`delete from organizacion where id in (${orgA.id}, ${orgB.id})`;
    await sql.end();
  });

  it('cada organización ve solo sus estudiantes, becas y programas', async () => {
    const visto = await withUser(miembroA.id, async (tx) => ({
      estudiantes: (await tx<ConId[]>`select id from estudiante`).map((f) => f.id),
      becas: (await tx<ConId[]>`select id from beca_asignacion`).map((f) => f.id),
      programas: (await tx<ConId[]>`select id from beca_programa`).map((f) => f.id),
      entregas: (await tx<ConId[]>`select id from beca_entrega`).map((f) => f.id),
    }));
    expect(visto.estudiantes).toEqual([estudianteA.id]);
    expect(visto.becas).toEqual([becaA.id]);
    expect(visto.programas.sort()).toEqual([programaA.id, programaA2.id].sort());
    expect(visto.entregas).toEqual([entregaA.id]);
  });

  it('no se puede modificar ni borrar un estudiante de otra organización', async () => {
    const actualizadas = await withUser(
      miembroA.id,
      (tx) => tx`update estudiante set apellido = 'hackeado' where id = ${estudianteB.id}`,
    );
    expect(actualizadas.count).toBe(0);
    const borradas = await withUser(adminA.id, (tx) => tx`delete from estudiante where id = ${estudianteB.id}`);
    expect(borradas.count).toBe(0);
    const [intacto] = await sql<{ apellido: string }[]>`select apellido from estudiante where id = ${estudianteB.id}`;
    expect(intacto.apellido).toBe('De B');
  });

  it('no se puede dar de alta un estudiante en otra organización', async () => {
    await expect(
      withUser(
        miembroA.id,
        (tx) => tx`insert into estudiante (organizacion_id, dni, apellido) values (${orgB.id}, '40000002', 'Colado')`,
      ),
    ).rejects.toThrow();
  });

  it('un miembro carga estudiantes y becas, pero no borra estudiantes', async () => {
    const [nuevo] = await withUser(
      miembroA.id,
      (tx) => tx<ConId[]>`
        insert into estudiante (organizacion_id, dni, apellido)
        values (mi_organizacion_id(), '40000003', 'Cargado por miembro') returning id
      `,
    );
    expect(nuevo.id).toBeDefined();
    const borradas = await withUser(miembroA.id, (tx) => tx`delete from estudiante where id = ${nuevo.id}`);
    expect(borradas.count).toBe(0);
    const borradasAdmin = await withUser(adminA.id, (tx) => tx`delete from estudiante where id = ${nuevo.id}`);
    expect(borradasAdmin.count).toBe(1);
  });

  it('programas, incompatibilidades y entregas son solo de administrador', async () => {
    await expect(
      withUser(
        miembroA.id,
        (tx) => tx`insert into beca_programa (organizacion_id, nombre) values (mi_organizacion_id(), 'De miembro')`,
      ),
    ).rejects.toThrow();
    await expect(
      withUser(
        miembroA.id,
        (tx) => tx`
          insert into beca_incompatibilidad (programa_a, programa_b)
          values (least(${programaA.id}::uuid, ${programaA2.id}::uuid), greatest(${programaA.id}::uuid, ${programaA2.id}::uuid))
        `,
      ),
    ).rejects.toThrow();
    await expect(
      withUser(
        miembroA.id,
        (tx) => tx`
          insert into beca_entrega (organizacion_id, programa_id, anio, nombre)
          values (mi_organizacion_id(), ${programaA.id}, 2025, 'De miembro')
        `,
      ),
    ).rejects.toThrow();

    // El administrador sí, y el miembro lo ve.
    await withUser(
      adminA.id,
      (tx) => tx`
        insert into beca_incompatibilidad (programa_a, programa_b)
        values (least(${programaA.id}::uuid, ${programaA2.id}::uuid), greatest(${programaA.id}::uuid, ${programaA2.id}::uuid))
      `,
    );
    const pares = await withUser(miembroA.id, (tx) => tx`select 1 from beca_incompatibilidad`);
    expect(pares).toHaveLength(1);
    const paresB = await withUser(miembroB.id, (tx) => tx`select 1 from beca_incompatibilidad`);
    expect(paresB).toHaveLength(0);
  });

  it('un administrador no puede marcar incompatible un programa de otra organización', async () => {
    await expect(
      withUser(
        adminA.id,
        (tx) => tx`
          insert into beca_incompatibilidad (programa_a, programa_b)
          values (least(${programaA.id}::uuid, ${programaB.id}::uuid), greatest(${programaA.id}::uuid, ${programaB.id}::uuid))
        `,
      ),
    ).rejects.toThrow();
  });

  it('las entregas se marcan solo sobre becas y entregas de la propia organización', async () => {
    await withUser(
      miembroA.id,
      (tx) => tx`
        insert into beca_entrega_estado (asignacion_id, entrega_id, estado, marcada_por)
        values (${becaA.id}, ${entregaA.id}, 'recibida', mi_usuario_id())
      `,
    );
    // Beca ajena.
    await expect(
      withUser(
        miembroA.id,
        (tx) => tx`
          insert into beca_entrega_estado (asignacion_id, entrega_id, estado)
          values (${becaB.id}, ${entregaB.id}, 'recibida')
        `,
      ),
    ).rejects.toThrow();
    // Beca propia con entrega ajena.
    await expect(
      withUser(
        miembroA.id,
        (tx) => tx`
          insert into beca_entrega_estado (asignacion_id, entrega_id, estado)
          values (${becaA.id}, ${entregaB.id}, 'recibida')
        `,
      ),
    ).rejects.toThrow();
    const vistasPorB = await withUser(miembroB.id, (tx) => tx`select 1 from beca_entrega_estado`);
    expect(vistasPorB).toHaveLength(0);
  });
});
