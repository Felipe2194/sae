'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { sql } from '@/lib/db';
import { generarPasswordTemporal } from '@/lib/passwords';

// Acciones de plataforma: cruzan organizaciones, así que no pueden pasar por
// withUser()/RLS (todo ahí está scopeado a mi_organizacion_id()). Usan la
// conexión superuser directamente — mismo patrón que el alta automática de
// usuarios por Google en auth.ts — y se gatean a mano acá.
async function requireSuperadmin() {
  const session = await auth();
  if (!session?.user) throw new Error('No autenticado');
  if (!session.user.esSuperadmin) throw new Error('Se requiere ser superadmin de plataforma');
  return session;
}

export async function crearOrganizacion(data: {
  nombre: string;
  slug: string;
  adminNombre: string;
  adminEmail: string;
}): Promise<{ passwordTemporal: string }> {
  await requireSuperadmin();

  const nombre = data.nombre.trim();
  const slug = data.slug.trim().toLowerCase();
  const adminNombre = data.adminNombre.trim();
  const adminEmail = data.adminEmail.trim().toLowerCase();
  if (!nombre || !slug || !adminNombre || !adminEmail) {
    throw new Error('Faltan datos');
  }

  const [slugExistente] = await sql`select id from organizacion where slug = ${slug} limit 1`;
  if (slugExistente) throw new Error(`Ya existe una organización con el slug "${slug}"`);

  const [emailExistente] = await sql`select id from usuario where email = ${adminEmail} limit 1`;
  if (emailExistente) throw new Error(`Ya existe un usuario con el email "${adminEmail}"`);

  const passwordTemporal = generarPasswordTemporal();
  const passwordHash = await bcrypt.hash(passwordTemporal, 10);

  await sql.begin(async (tx) => {
    const [org] = await tx`
      insert into organizacion (nombre, slug)
      values (${nombre}, ${slug})
      returning id
    `;
    // Cuenta genérica de oficina: quien la reciba entra directo a /configuracion de
    // su organización y desde ahí da de alta a su equipo (mismo patrón que
    // ya usa cada secretaría hoy — ver comentario en app/(app)/layout.tsx).
    await tx`
      insert into usuario (organizacion_id, nombre, email, password_hash, rol, estado, es_cuenta_generica)
      values (${org.id}, ${adminNombre}, ${adminEmail}, ${passwordHash}, 'administrador', 'activo', true)
    `;
  });

  revalidatePath('/plataforma');
  return { passwordTemporal };
}

// Resetea la contraseña de la cuenta genérica (administradora) de una
// organización — la única forma de recuperar el acceso si esa contraseña se
// perdió, ya que solo se muestra una vez al crear la organización y hasta
// ahora no había ninguna otra vía. `password` opcional, mismo criterio que
// crearUsuario/resetearPassword en Configuración.
export async function resetearPasswordCuentaGenerica(
  usuarioId: string,
  password?: string,
): Promise<{ passwordTemporal: string | null }> {
  await requireSuperadmin();
  if (password && password.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres.');
  }

  const passwordTemporal = password ? null : generarPasswordTemporal();
  const passwordHash = await bcrypt.hash(password || passwordTemporal!, 10);

  const [usuario] = await sql`
    update usuario
    set password_hash = ${passwordHash}
    where id = ${usuarioId} and es_cuenta_generica = true
    returning id
  `;
  if (!usuario) throw new Error('No se encontró esa cuenta genérica.');

  return { passwordTemporal };
}
