'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { withUser, sql } from '@/lib/db';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error('No autenticado');
  if ((session.user as { rol: string }).rol !== 'administrador') {
    throw new Error('Se requiere rol administrador');
  }
  return session;
}

// ── Tareas ────────────────────────────────────────────────────────────────────

export async function asignarTarea(tareaId: string, usuarioId: string | null) {
  const session = await requireAdmin();
  await withUser(session.user.id, async (tx) => {
    await tx`
      update tarea
      set responsable_id = ${usuarioId}
      where id = ${tareaId}
        and organizacion_id = mi_organizacion_id()
    `;
  });
  revalidatePath('/admin');
  revalidatePath('/tablero');
}

// ── Accesos rápidos ───────────────────────────────────────────────────────────

export async function crearAcceso(formData: FormData) {
  const session = await requireAdmin();
  const etiqueta = (formData.get('etiqueta') as string).trim();
  const url = (formData.get('url') as string).trim();
  if (!etiqueta || !url) return;

  await withUser(session.user.id, async (tx) => {
    const [{ max_orden }] = await tx<[{ max_orden: number | null }]>`
      select max(orden) as max_orden
      from acceso_rapido
      where organizacion_id = mi_organizacion_id()
    `;
    await tx`
      insert into acceso_rapido (organizacion_id, etiqueta, url, orden)
      values (mi_organizacion_id(), ${etiqueta}, ${url}, ${(max_orden ?? -1) + 1})
    `;
  });
  revalidatePath('/admin');
  revalidatePath('/hoy');
}

export async function eliminarAcceso(accesoId: string) {
  const session = await requireAdmin();
  await withUser(session.user.id, async (tx) => {
    await tx`
      delete from acceso_rapido
      where id = ${accesoId}
        and organizacion_id = mi_organizacion_id()
    `;
  });
  revalidatePath('/admin');
  revalidatePath('/hoy');
}
