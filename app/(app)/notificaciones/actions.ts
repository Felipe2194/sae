'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { withUser } from '@/lib/db';

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error('No autenticado');
  return session;
}

export type NotificacionRow = {
  id: string;
  tipo: string;
  titulo: string;
  cuerpo: string | null;
  href: string | null;
  leida: boolean;
  creada_en: string;
};

export async function fetchNotificaciones(): Promise<{
  items: NotificacionRow[];
  noLeidas: number;
}> {
  const session = await requireAuth();
  return withUser(session.user.id, async (tx) => {
    const items = await tx<NotificacionRow[]>`
      select id, tipo, titulo, cuerpo, href, leida, creada_en::text
      from notificacion
      where usuario_id = mi_usuario_id()
      order by creada_en desc
      limit 30
    `;
    const noLeidas = items.filter((n) => !n.leida).length;
    return { items: [...items], noLeidas };
  });
}

export async function marcarLeida(notificacionId: string) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await tx`
      update notificacion
      set leida = true
      where id = ${notificacionId} and usuario_id = mi_usuario_id()
    `;
  });
  revalidatePath('/');
}

export async function marcarTodasLeidas() {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await tx`
      update notificacion
      set leida = true
      where usuario_id = mi_usuario_id() and leida = false
    `;
  });
  revalidatePath('/');
}
