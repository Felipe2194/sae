'use server';

import { signOut as authSignOut } from '@/auth';
import { revalidatePath } from 'next/cache';

export async function signOut() {
  // Mismo motivo que en login/cambiar-perfil: evita que el Router Cache le
  // sirva al próximo login el HTML de la sesión que se está cerrando.
  revalidatePath('/', 'layout');
  await authSignOut({ redirectTo: '/login' });
}
