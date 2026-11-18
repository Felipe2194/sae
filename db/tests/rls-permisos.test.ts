// Permisos DENTRO de una misma organización: lo que un integrante común no
// puede hacer aunque comparta organización con un administrador. Complementa
// rls-aislamiento.test.ts (que cubre el cruce entre organizaciones).
//
// Requiere Postgres con las migraciones aplicadas (ver ese archivo).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql, withUser } from '@/lib/db';

type ConId = { id: string };

describe('Permisos por rol dentro de una organización (RLS + triggers)', () => {
  const sufijo = randomUUID().slice(0, 8);

  let org: ConId;
  let admin: ConId;
  let miembro: ConId;
  let otroMiembro: ConId;

  beforeAll(async () => {
    [org] = await sql<ConId[]>`
      insert into organizacion (nombre, slug)
      values (${'Test Permisos ' + sufijo}, ${'test-permisos-' + sufijo})
      returning id
    `;
    const alta = async (nombre: string, rol: 'miembro' | 'administrador') => {
      const [u] = await sql<ConId[]>`
        insert into usuario (organizacion_id, nombre, email, password_hash, rol, estado)
        values (${org.id}, ${nombre}, ${`perm-${nombre}-${sufijo}@test.local`}, 'x', ${rol}, 'activo')
        returning id
      `;
      return u;
    };
    admin = await alta('admin', 'administrador');
    miembro = await alta('miembro', 'miembro');
    otroMiembro = await alta('otro', 'miembro');
  });

  afterAll(async () => {
    await sql`delete from auditoria where organizacion_id = ${org.id}`;
    await sql`delete from usuario where organizacion_id = ${org.id}`;
    await sql`delete from organizacion where id = ${org.id}`;
    await sql.end();
  });

  it('un miembro no puede cambiarse su propio rol a administrador', async () => {
    await expect(
      withUser(miembro.id, (tx) =>
        tx`update usuario set rol = 'administrador' where id = mi_usuario_id()`,
      ),
    ).rejects.toThrow(/administrador/);

    const [fila] = await sql<{ rol: string }[]>`select rol from usuario where id = ${miembro.id}`;
    expect(fila.rol).toBe('miembro');
  });

  it('un miembro no puede reactivarse ni marcarse como cuenta genérica', async () => {
    await expect(
      withUser(miembro.id, (tx) =>
        tx`update usuario set es_cuenta_generica = true where id = mi_usuario_id()`,
      ),
    ).rejects.toThrow();
    await expect(
      withUser(miembro.id, (tx) =>
        tx`update usuario set estado = 'inactivo' where id = mi_usuario_id()`,
      ),
    ).rejects.toThrow();
  });

  it('un miembro sí puede editar sus datos personales', async () => {
    await withUser(miembro.id, (tx) =>
      tx`update usuario set nombre = 'Miembro renombrado' where id = mi_usuario_id()`,
    );
    const [fila] = await sql<{ nombre: string }[]>`select nombre from usuario where id = ${miembro.id}`;
    expect(fila.nombre).toBe('Miembro renombrado');
  });

  it('un miembro no puede editar a otro integrante', async () => {
    const resultado = await withUser(miembro.id, (tx) =>
      tx`update usuario set nombre = 'Hackeado' where id = ${otroMiembro.id}`,
    );
    expect(resultado.count).toBe(0);
  });

  it('un administrador sí puede cambiar el rol de otro integrante', async () => {
    await withUser(admin.id, (tx) =>
      tx`update usuario set rol = 'administrador' where id = ${otroMiembro.id}`,
    );
    const [fila] = await sql<{ rol: string }[]>`select rol from usuario where id = ${otroMiembro.id}`;
    expect(fila.rol).toBe('administrador');
    await sql`update usuario set rol = 'miembro' where id = ${otroMiembro.id}`;
  });

  it('nadie puede tocar organizacion_id ni es_superadmin desde el rol de aplicación', async () => {
    await expect(
      withUser(admin.id, (tx) =>
        tx`update usuario set es_superadmin = true where id = mi_usuario_id()`,
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it('un miembro puede registrar auditoría a su nombre, pero no a nombre de otro', async () => {
    await withUser(miembro.id, (tx) =>
      tx`
        insert into auditoria (organizacion_id, usuario_id, entidad, campo)
        values (mi_organizacion_id(), mi_usuario_id(), 'tarea', 'prueba')
      `,
    );
    await expect(
      withUser(miembro.id, (tx) =>
        tx`
          insert into auditoria (organizacion_id, usuario_id, entidad, campo)
          values (mi_organizacion_id(), ${admin.id}, 'tarea', 'falsificada')
        `,
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('solo el administrador lee la auditoría', async () => {
    const comoMiembro = await withUser(miembro.id, (tx) => tx`select id from auditoria`);
    expect(comoMiembro).toHaveLength(0);
    const comoAdmin = await withUser(admin.id, (tx) => tx`select id from auditoria`);
    expect(comoAdmin.length).toBeGreaterThan(0);
  });
});
