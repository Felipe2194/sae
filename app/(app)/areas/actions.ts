'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { withUser } from '@/lib/db';

async function requireCoord() {
  const session = await auth();
  if (!session?.user) throw new Error('No autenticado');
  const rol = (session.user as { rol: string }).rol;
  if (rol !== 'coordinador' && rol !== 'administrador') {
    throw new Error('Se requiere rol coordinador o administrador');
  }
  return session;
}

export async function crearArea(data: {
  nombre: string;
  descripcion: string;
  color: string;
  responsable_id: string | null;
}) {
  const session = await requireCoord();
  await withUser(session.user.id, async (tx) => {
    await tx`
      insert into area (organizacion_id, nombre, descripcion, color, responsable_id)
      values (mi_organizacion_id(), ${data.nombre}, ${data.descripcion || null}, ${data.color}, ${data.responsable_id})
    `;
  });
  revalidatePath('/areas');
  revalidatePath('/coordinacion');
}

export async function actualizarArea(
  areaId: string,
  data: {
    nombre: string;
    descripcion: string | null;
    color: string;
    responsable_id: string | null;
  },
) {
  const session = await requireCoord();
  await withUser(session.user.id, async (tx) => {
    await tx`
      update area set
        nombre        = ${data.nombre},
        descripcion   = ${data.descripcion},
        color         = ${data.color},
        responsable_id = ${data.responsable_id}
      where id = ${areaId}
        and organizacion_id = mi_organizacion_id()
    `;
  });
  revalidatePath('/areas');
  revalidatePath(`/areas/${areaId}`);
  revalidatePath('/coordinacion');
}
