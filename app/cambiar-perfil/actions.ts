'use server';

import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export async function cambiarPerfil(usuarioId: string) {
  try {
    // Sin esto, el Router Cache del navegador puede reusar el HTML ya
    // renderizado para el perfil anterior (tareas, playlist, etc. de quien
    // estaba antes elegido) en vez de pedir de nuevo con la sesión nueva.
    revalidatePath('/', 'layout');
    await signIn('quick-switch', { usuarioId, redirectTo: '/hoy' });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect('/cambiar-perfil');
    }
    throw error; // re-lanzar el NEXT_REDIRECT de signIn
  }
}

// Perfiles administradores: el cambio rápido pide la contraseña de ese
// perfil (ver authorize() de quick-switch en auth.ts).
export async function cambiarPerfilProtegido(
  usuarioId: string,
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const password = (formData.get('password') as string | null) ?? '';
  if (!password) return { error: 'Ingresá la contraseña de ese perfil.' };
  try {
    revalidatePath('/', 'layout');
    await signIn('quick-switch', { usuarioId, password, redirectTo: '/hoy' });
    return null;
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error: 'Contraseña incorrecta, o demasiados intentos. Probá de nuevo en unos minutos.',
      };
    }
    throw error; // re-lanzar el NEXT_REDIRECT de signIn
  }
}
