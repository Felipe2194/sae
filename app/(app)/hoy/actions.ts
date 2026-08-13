'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { withUser } from '@/lib/db';

export async function toggleTarea(tareaId: string, estadoActual: string) {
  const session = await auth();
  if (!session?.user) throw new Error('No autenticado');

  const nuevoEstado = estadoActual === 'hecha' ? 'por_hacer' : 'hecha';
  const completadaEn = nuevoEstado === 'hecha' ? new Date() : null;

  await withUser(session.user.id, async (tx) => {
    await tx`
      update tarea
      set estado = ${nuevoEstado},
          completada_en = ${completadaEn}
      where id = ${tareaId}
        and organizacion_id = mi_organizacion_id()
    `;
  });

  revalidatePath('/hoy');
}

export async function guardarBitacora(input: {
  hecho: string;
  pendiente: string;
  observaciones: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error('No autenticado');

  await withUser(session.user.id, async (tx) => {
    await tx`
      insert into bitacora_diaria (organizacion_id, usuario_id, fecha, hecho, pendiente, observaciones)
      values (
        mi_organizacion_id(), mi_usuario_id(), current_date,
        ${input.hecho || null}, ${input.pendiente || null}, ${input.observaciones || null}
      )
      on conflict (usuario_id, fecha) do update
      set hecho = excluded.hecho,
          pendiente = excluded.pendiente,
          observaciones = excluded.observaciones
    `;
  });

  revalidatePath('/hoy');
}
