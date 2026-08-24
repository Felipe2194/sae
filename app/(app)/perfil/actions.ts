'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { withUser } from '@/lib/db';

export async function actualizarNombre(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error('No autenticado');

  const nombre = (formData.get('nombre') as string).trim();
  if (!nombre) return;

  const playlistRaw = ((formData.get('playlist_url') as string | null) ?? '').trim();
  let playlistUrl: string | null = null;
  if (playlistRaw) {
    try {
      new URL(playlistRaw);
      playlistUrl = playlistRaw;
    } catch {
      throw new Error('El link de la playlist no es una URL válida');
    }
  }

  const avatarColorRaw = ((formData.get('avatar_color') as string | null) ?? '').trim();
  let avatarColor: string | null = null;
  if (avatarColorRaw) {
    if (!/^#[0-9a-fA-F]{6}$/.test(avatarColorRaw)) {
      throw new Error('Color de avatar inválido');
    }
    avatarColor = avatarColorRaw;
  }

  const fondoTipoRaw = (formData.get('fondo_tipo') as string | null) ?? '';
  let fondoTipo: 'gradiente' | 'imagen' | null = null;
  if (fondoTipoRaw === 'gradiente' || fondoTipoRaw === 'imagen') {
    fondoTipo = fondoTipoRaw;
  }

  const fondoValorRaw = ((formData.get('fondo_valor') as string | null) ?? '').trim();
  let fondoValor: string | null = fondoValorRaw || null;
  if (fondoTipo === 'imagen' && fondoValor) {
    try {
      new URL(fondoValor);
    } catch {
      throw new Error('La URL del fondo no es válida');
    }
  }
  // Sin tipo elegido, o sin valor cargado para ese tipo (ej. "Gradiente" sin
  // tocar ningún swatch todavía) -> sin fondo, no un tipo huérfano sin valor.
  if (!fondoTipo || !fondoValor) {
    fondoTipo = null;
    fondoValor = null;
  }

  await withUser(session.user.id, async (tx) => {
    await tx`
      update usuario
      set nombre = ${nombre},
        playlist_url = ${playlistUrl},
        avatar_color = ${avatarColor},
        fondo_tipo = ${fondoTipo},
        fondo_valor = ${fondoValor}
      where id = mi_usuario_id()
    `;
  });

  revalidatePath('/perfil');
  revalidatePath('/hoy');
  revalidatePath('/', 'layout');
}
