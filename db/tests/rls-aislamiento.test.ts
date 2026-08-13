// Prueba de aislamiento multi-organización (M0.3, paso 0.3.8 del plan de
// construcción — nunca se había validado en la práctica).
//
// Crea dos organizaciones de prueba con su propio usuario, área y tarea, y
// verifica que un usuario de la organización A nunca pueda leer ni modificar
// datos de la organización B a través de `withUser()` (RLS + rol `sae_app`).
//
// Requiere Postgres corriendo con las migraciones aplicadas:
//   docker compose up -d && npm run db:migrate
// y se ejecuta con: npm test

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql, withUser } from '@/lib/db';

type ConId = { id: string };

describe('Aislamiento multi-organización (RLS)', () => {
  const sufijo = randomUUID().slice(0, 8);

  let orgA: ConId;
  let orgB: ConId;
  let usuarioA: ConId;
  let usuarioB: ConId;
  let areaA: ConId;
  let areaB: ConId;
  let tareaA: ConId;
  let tareaB: ConId;

  beforeAll(async () => {
    [orgA] = await sql<ConId[]>`
      insert into organizacion (nombre, slug)
      values (${'Test Org A ' + sufijo}, ${'test-org-a-' + sufijo})
      returning id
    `;
    [orgB] = await sql<ConId[]>`
      insert into organizacion (nombre, slug)
      values (${'Test Org B ' + sufijo}, ${'test-org-b-' + sufijo})
      returning id
    `;

    [usuarioA] = await sql<ConId[]>`
      insert into usuario (organizacion_id, nombre, email, password_hash, rol, estado)
      values (${orgA.id}, 'Usuario A', ${'rls-a-' + sufijo + '@test.local'}, 'x', 'miembro', 'activo')
      returning id
    `;
    [usuarioB] = await sql<ConId[]>`
      insert into usuario (organizacion_id, nombre, email, password_hash, rol, estado)
      values (${orgB.id}, 'Usuario B', ${'rls-b-' + sufijo + '@test.local'}, 'x', 'miembro', 'activo')
      returning id
    `;

    [areaA] = await sql<ConId[]>`
      insert into area (organizacion_id, nombre, color)
      values (${orgA.id}, 'Área A', '#ff0000') returning id
    `;
    [areaB] = await sql<ConId[]>`
      insert into area (organizacion_id, nombre, color)
      values (${orgB.id}, 'Área B', '#00ff00') returning id
    `;

    [tareaA] = await sql<ConId[]>`
      insert into tarea (organizacion_id, area_id, titulo, creada_por)
      values (${orgA.id}, ${areaA.id}, 'Tarea secreta de A', ${usuarioA.id})
      returning id
    `;
    [tareaB] = await sql<ConId[]>`
      insert into tarea (organizacion_id, area_id, titulo, creada_por)
      values (${orgB.id}, ${areaB.id}, 'Tarea secreta de B', ${usuarioB.id})
      returning id
    `;
  });

  afterAll(async () => {
    // Orden: hijos antes que padres — no hay ON DELETE CASCADE desde organizacion.
    await sql`delete from tarea where id in (${tareaA.id}, ${tareaB.id})`;
    await sql`delete from area where id in (${areaA.id}, ${areaB.id})`;
    await sql`delete from usuario where id in (${usuarioA.id}, ${usuarioB.id})`;
    await sql`delete from organizacion where id in (${orgA.id}, ${orgB.id})`;
    await sql.end();
  });

  it('mi_organizacion_id() devuelve la organización de la sesión activa', async () => {
    const orgId = await withUser(usuarioA.id, async (tx) => {
      const [row] = await tx<ConId[]>`select mi_organizacion_id() as id`;
      return row.id;
    });
    expect(orgId).toBe(orgA.id);
  });

  it('un usuario no ve tareas de otra organización', async () => {
    const tareas = await withUser(usuarioA.id, (tx) => tx<ConId[]>`select id from tarea`);
    const ids = tareas.map((t) => t.id);
    expect(ids).toContain(tareaA.id);
    expect(ids).not.toContain(tareaB.id);
  });

  it('un usuario no ve usuarios de otra organización', async () => {
    const usuarios = await withUser(usuarioA.id, (tx) => tx<ConId[]>`select id from usuario`);
    const ids = usuarios.map((u) => u.id);
    expect(ids).toContain(usuarioA.id);
    expect(ids).not.toContain(usuarioB.id);
  });

  it('un usuario no puede leer una tarea de otra organización por id directo', async () => {
    const tareas = await withUser(
      usuarioA.id,
      (tx) => tx<ConId[]>`select id from tarea where id = ${tareaB.id}`,
    );
    expect(tareas).toHaveLength(0);
  });

  it('un usuario no puede modificar una tarea de otra organización (RLS bloquea el UPDATE)', async () => {
    const resultado = await withUser(
      usuarioA.id,
      (tx) => tx`update tarea set titulo = 'hackeada' where id = ${tareaB.id}`,
    );
    expect(resultado.count).toBe(0);

    const [intacta] = await sql<{ titulo: string }[]>`
      select titulo from tarea where id = ${tareaB.id}
    `;
    expect(intacta.titulo).toBe('Tarea secreta de B');
  });

  it('un usuario no puede borrar un área de otra organización (RLS bloquea el DELETE)', async () => {
    const resultado = await withUser(
      usuarioA.id,
      (tx) => tx`delete from area where id = ${areaB.id}`,
    );
    expect(resultado.count).toBe(0);

    const [sigueExistiendo] = await sql<ConId[]>`select id from area where id = ${areaB.id}`;
    expect(sigueExistiendo).toBeDefined();
  });
});
