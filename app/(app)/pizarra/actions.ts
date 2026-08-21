'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { withUser } from '@/lib/db';

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error('No autenticado');
  return session;
}

export type NotaRow = {
  id: string;
  contenido: string;
  color: string;
  pos_x: number;
  pos_y: number;
  z_index: number;
  autor_id: string;
  autor_nombre: string;
  autor_avatar_color: string | null;
  creada_en: string;
  actualizada_en: string;
};

// Solo lectura — se usa tanto para el render inicial de la página como para
// el polling del cliente (igual patrón que fetchNotificaciones).
export async function fetchNotas(): Promise<NotaRow[]> {
  const session = await requireAuth();
  return withUser(session.user.id, async (tx) => {
    const rows = await tx<NotaRow[]>`
      select
        n.id, n.contenido, n.color, n.pos_x, n.pos_y, n.z_index,
        n.autor_id, u.nombre as autor_nombre, u.avatar_color as autor_avatar_color,
        n.creada_en::text, n.actualizada_en::text
      from pizarra_nota n
      join usuario u on u.id = n.autor_id
      where n.organizacion_id = mi_organizacion_id()
      order by n.creada_en asc
    `;
    return [...rows];
  });
}

export async function crearNota(
  contenido: string,
  color: string,
  pos_x: number,
  pos_y: number,
): Promise<NotaRow> {
  const session = await requireAuth();
  const nota = await withUser(session.user.id, async (tx) => {
    const [{ id }] = await tx<[{ id: string }]>`
      insert into pizarra_nota (organizacion_id, autor_id, contenido, color, pos_x, pos_y)
      values (mi_organizacion_id(), mi_usuario_id(), ${contenido}, ${color}, ${pos_x}, ${pos_y})
      returning id
    `;
    const [row] = await tx<NotaRow[]>`
      select
        n.id, n.contenido, n.color, n.pos_x, n.pos_y, n.z_index,
        n.autor_id, u.nombre as autor_nombre, u.avatar_color as autor_avatar_color,
        n.creada_en::text, n.actualizada_en::text
      from pizarra_nota n
      join usuario u on u.id = n.autor_id
      where n.id = ${id}
    `;
    return row;
  });
  revalidatePath('/pizarra');
  return nota;
}

export async function moverNota(id: string, pos_x: number, pos_y: number, z_index: number) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await tx`
      update pizarra_nota set pos_x = ${pos_x}, pos_y = ${pos_y}, z_index = ${z_index}
      where id = ${id}
    `;
  });
  revalidatePath('/pizarra');
}

export async function editarNota(id: string, contenido: string) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await tx`
      update pizarra_nota set contenido = ${contenido}, actualizada_en = now()
      where id = ${id}
    `;
  });
  revalidatePath('/pizarra');
}

export async function eliminarNota(id: string) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await tx`delete from pizarra_nota where id = ${id}`;
  });
  revalidatePath('/pizarra');
}
