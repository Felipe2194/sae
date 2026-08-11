'use server';

import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import { headers } from 'next/headers';
import { obtenerIp, registrarIntento, verificarLimiteIntentos } from '@/lib/rate-limit';

const VENTANA_MS = 15 * 60 * 1000;

export async function login(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const email = ((formData.get('email') as string | null) ?? '').trim().toLowerCase();
  const ip = obtenerIp(await headers());
  const claveIp = `login:ip:${ip}`;
  const claveEmail = `login:email:${email}`;

  const [okIp, okEmail] = await Promise.all([
    verificarLimiteIntentos(claveIp, 20, VENTANA_MS),
    verificarLimiteIntentos(claveEmail, 6, VENTANA_MS),
  ]);
  if (!okIp || !okEmail) {
    return { error: 'Demasiados intentos. Esperá unos minutos y volvé a intentar.' };
  }

  try {
    await signIn('credentials', {
      email,
      password: formData.get('password') as string,
      redirectTo: '/hoy',
    });
    return null;
  } catch (error) {
    if (error instanceof AuthError) {
      await Promise.all([registrarIntento(claveIp), registrarIntento(claveEmail)]);
      return { error: 'Email o contraseña incorrectos.' };
    }
    throw error; // re-lanzar el NEXT_REDIRECT de signIn
  }
}

export async function loginWithGoogle(): Promise<void> {
  await signIn('google', { redirectTo: '/hoy' });
}
