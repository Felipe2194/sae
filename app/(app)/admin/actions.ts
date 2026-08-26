"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { withUser, sql } from "@/lib/db";
import { generarPasswordTemporal } from "@/lib/passwords";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");
  if ((session.user as { rol: string }).rol !== "administrador") {
    throw new Error("Se requiere rol administrador");
  }
  return session;
}

// ── Usuarios ──────────────────────────────────────────────────────────────────

export async function cambiarEstadoUsuario(
  userId: string,
  estado: "activo" | "inactivo",
) {
  const session = await requireAdmin();
  if (userId === session.user.id)
    throw new Error("No podés cambiar tu propio estado");
  await withUser(session.user.id, async (tx) => {
    await tx`
      update usuario
      set estado = ${estado}::estado_usuario
      where id = ${userId}
        and organizacion_id = mi_organizacion_id()
    `;
  });
  revalidatePath("/admin");
}

export async function cambiarRolUsuario(userId: string, rol: string) {
  const session = await requireAdmin();
  if (userId === session.user.id)
    throw new Error("No podés cambiar tu propio rol");
  // Solo dos roles posibles — se valida acá además de en el check
  // constraint de la base (usuario_rol_sin_coordinador) para dar un error
  // claro en vez de que explote el ::rol_usuario de abajo.
  if (rol !== "miembro" && rol !== "administrador") {
    throw new Error("Rol inválido");
  }
  await withUser(session.user.id, async (tx) => {
    await tx`
      update usuario
      set rol = ${rol}::rol_usuario
      where id = ${userId}
        and organizacion_id = mi_organizacion_id()
    `;
  });
  revalidatePath("/admin");
}

export async function marcarCuentaGenerica(userId: string, valor: boolean) {
  const session = await requireAdmin();
  if (userId === session.user.id)
    throw new Error("No podés marcar tu propia cuenta como genérica");
  await withUser(session.user.id, async (tx) => {
    await tx`
      update usuario
      set es_cuenta_generica = ${valor}
      where id = ${userId}
        and organizacion_id = mi_organizacion_id()
    `;
  });
  revalidatePath("/admin");
}

export async function resetearPassword(
  userId: string,
): Promise<{ passwordTemporal: string }> {
  const session = await requireAdmin();
  if (userId === session.user.id)
    throw new Error("No podés resetear tu propia contraseña");

  const passwordTemporal = generarPasswordTemporal();
  const passwordHash = await bcrypt.hash(passwordTemporal, 10);

  await withUser(session.user.id, async (tx) => {
    await tx`
      update usuario
      set password_hash = ${passwordHash}
      where id = ${userId}
        and organizacion_id = mi_organizacion_id()
    `;
  });
  revalidatePath("/admin");
  return { passwordTemporal };
}

// ── Tareas ────────────────────────────────────────────────────────────────────

export async function asignarTarea(tareaId: string, usuarioId: string | null) {
  const session = await requireAdmin();
  await withUser(session.user.id, async (tx) => {
    await tx`
      update tarea
      set responsable_id = ${usuarioId}
      where id = ${tareaId}
        and organizacion_id = mi_organizacion_id()
    `;
  });
  revalidatePath("/admin");
  revalidatePath("/tablero");
}

// ── Organización ──────────────────────────────────────────────────────────────

export async function actualizarOrganizacion(data: {
  nombre: string;
  logo_url: string | null;
  color_principal: string | null;
  zona_horaria: string;
}) {
  const session = await requireAdmin();
  await withUser(session.user.id, async (tx) => {
    await tx`
      update organizacion
      set nombre = ${data.nombre},
        logo_url = ${data.logo_url},
        color_principal = ${data.color_principal},
        zona_horaria = ${data.zona_horaria}
      where id = mi_organizacion_id()
    `;
  });
  revalidatePath("/admin");
  revalidatePath("/", "layout");
}

// ── Accesos rápidos ───────────────────────────────────────────────────────────

export async function crearAcceso(formData: FormData) {
  const session = await requireAdmin();
  const etiqueta = (formData.get("etiqueta") as string).trim();
  const url = (formData.get("url") as string).trim();
  if (!etiqueta || !url) return;

  await withUser(session.user.id, async (tx) => {
    const [{ max_orden }] = await tx<[{ max_orden: number | null }]>`
      select max(orden) as max_orden
      from acceso_rapido
      where organizacion_id = mi_organizacion_id()
    `;
    await tx`
      insert into acceso_rapido (organizacion_id, etiqueta, url, orden)
      values (mi_organizacion_id(), ${etiqueta}, ${url}, ${(max_orden ?? -1) + 1})
    `;
  });
  revalidatePath("/admin");
  revalidatePath("/hoy");
}

export async function eliminarAcceso(accesoId: string) {
  const session = await requireAdmin();
  await withUser(session.user.id, async (tx) => {
    await tx`
      delete from acceso_rapido
      where id = ${accesoId}
        and organizacion_id = mi_organizacion_id()
    `;
  });
  revalidatePath("/admin");
  revalidatePath("/hoy");
}
