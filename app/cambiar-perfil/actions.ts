'use server';

import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';

export async function cambiarPerfil(usuarioId: string) {
  try {
    await signIn('quick-switch', { usuarioId, redirectTo: '/hoy' });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect('/cambiar-perfil');
    }
    throw error; // re-lanzar el NEXT_REDIRECT de signIn
  }
}
