"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { hashToken } from "@/lib/invitaciones";
import { obtenerIp, registrarIntento, verificarLimiteIntentos } from "@/lib/rate-limit";

export type CompletarInvitacionState = { error: string } | null;

// Ruta pública sin sesión: `sql` directo (superuser), mismo criterio que
// /registro y /inscripcion-viaje — la policy `usuario_update_propio` exige
// mi_usuario_id(), que acá no existe (nadie logueado todavía).
export async function completarInvitacion(
  token: string,
  _prevState: CompletarInvitacionState,
  formData: FormData,
): Promise<CompletarInvitacionState> {
  const ip = obtenerIp(await headers());
  const claveIp = `invitacion:ip:${ip}`;
  if (!(await verificarLimiteIntentos(claveIp, 10, 60 * 60 * 1000))) {
    return { error: "Demasiados intentos desde esta conexión. Probá de nuevo más tarde." };
  }
  await registrarIntento(claveIp);

  const email = (formData.get("email") as string | null)?.trim().toLowerCase() ?? "";
  const password = (formData.get("password") as string | null) ?? "";
  const passwordConfirmar = (formData.get("password_confirmar") as string | null) ?? "";

  if (!email || !password) {
    return { error: "Completá todos los campos." };
  }
  if (email.length > 254) {
    return { error: "El email no puede superar los 254 caracteres." };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (password.length > 72) {
    return { error: "La contraseña no puede superar los 72 caracteres." };
  }
  if (password !== passwordConfirmar) {
    return { error: "Las contraseñas no coinciden." };
  }

  const [usuario] = await sql<[{ id: string; token_invitacion_expira: string } | undefined]>`
    select id, token_invitacion_expira::text
    from usuario where token_invitacion_hash = ${hashToken(token)}
  `;
  if (!usuario || new Date(usuario.token_invitacion_expira) <= new Date()) {
    return { error: "Este link ya no es válido. Pedile uno nuevo a un administrador." };
  }

  const [existente] = await sql`
    select id from usuario where email = ${email} and id != ${usuario.id} limit 1
  `;
  if (existente) {
    return { error: "Ya existe una cuenta con ese email." };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await sql`
    update usuario
    set email = ${email},
      password_hash = ${passwordHash},
      token_invitacion_hash = null,
      token_invitacion_expira = null
    where id = ${usuario.id}
  `;

  redirect("/login?invitacion=completada");
}
