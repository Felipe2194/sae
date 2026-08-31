'use server';

import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { headers } from 'next/headers';
import { sql } from '@/lib/db';
import { obtenerIp, registrarIntento, verificarLimiteIntentos } from '@/lib/rate-limit';

export async function registrar(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const ip = obtenerIp(await headers());
  const claveIp = `registro:ip:${ip}`;
  if (!(await verificarLimiteIntentos(claveIp, 5, 60 * 60 * 1000))) {
    return { error: 'Demasiados registros desde esta conexión. Probá de nuevo más tarde.' };
  }
  await registrarIntento(claveIp);

  const nombre = (formData.get('nombre') as string | null)?.trim() ?? '';
  const email = (formData.get('email') as string | null)?.trim().toLowerCase() ?? '';
  const password = (formData.get('password') as string | null) ?? '';

  if (!nombre || !email || !password) {
    return { error: 'Completá todos los campos.' };
  }
  if (password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres.' };
  }
  // Mismos límites que el maxLength del form — se repiten acá porque ese
  // atributo se puede saltear. 72 en password porque bcrypt ignora todo lo
  // que pase ese largo (no tiene sentido aceptar más).
  if (nombre.length > 100) {
    return { error: 'El nombre no puede superar los 100 caracteres.' };
  }
  if (email.length > 254) {
    return { error: 'El email no puede superar los 254 caracteres.' };
  }
  if (password.length > 72) {
    return { error: 'La contraseña no puede superar los 72 caracteres.' };
  }

  // Verificar si el email ya está registrado
  const [existente] = await sql`
    select id from usuario where email = ${email} limit 1
  `;
  if (existente) {
    return { error: 'Ya existe una cuenta con ese email.' };
  }

  // Obtener la organización por defecto (SAE FRVM)
  const [org] = await sql`
    select id from organizacion where slug = 'sae-frvm' limit 1
  `;
  if (!org) {
    return { error: 'No se encontró la organización. Contactá al administrador.' };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await sql`
    insert into usuario (organizacion_id, nombre, email, password_hash, rol, estado)
    values (${org.id}, ${nombre}, ${email}, ${passwordHash}, 'miembro', 'pendiente')
  `;

  redirect('/pendiente-de-aprobacion');
}
