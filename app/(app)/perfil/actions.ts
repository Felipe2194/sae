'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { withUser } from '@/lib/db';

export async function actualizarNombre(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error('No autenticado');

  const nombre = (formData.get('nombre') as string).trim();
  if (!nombre) return;

  await withUser(session.user.id, async (tx) => {
    await tx`
      update usuario
      set nombre = ${nombre}
      where id = mi_usuario_id()
    `;
  });

  revalidatePath('/perfil');
}
