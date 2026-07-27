'use server';

import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

export async function login(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  try {
    await signIn('credentials', {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      redirectTo: '/hoy',
    });
    return null;
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'Email o contraseña incorrectos.' };
    }
    throw error; // re-lanzar el NEXT_REDIRECT de signIn
  }
}
