"use server";

import bcrypt from "bcryptjs";
import { revalidatePath, updateTag } from "next/cache";
import { auth } from "@/auth";
import { withUser, sql } from "@/lib/db";
import { generarPasswordTemporal } from "@/lib/passwords";
import { crearEventoCalendar } from "@/lib/google/calendar";

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

// ── Reuniones ─────────────────────────────────────────────────────────────────
// Se crean como una tarea normal (tipo = 'reunion', visible en el Tablero
// como cualquier otra) y, si hay credenciales de escritura configuradas
// (GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL/_KEY), además como evento real en el
// Google Calendar compartido de la organización — ver lib/google/calendar.ts.
// La duración reusa duracion_estimada_hs en vez de sumar una columna nueva.

export type ReunionInput = {
  titulo: string;
  descripcion: string;
  fecha: string; // YYYY-MM-DD
  horaInicio: string; // HH:MM
  horaFin: string; // HH:MM
  responsableId: string | null;
};

export async function crearReunion(
  input: ReunionInput,
): Promise<{ sincronizada: boolean; error: string | null }> {
  const session = await requireAdmin();

  if (input.horaFin <= input.horaInicio) {
    throw new Error("La hora de fin debe ser posterior a la hora de inicio.");
  }
  const [hIni, mIni] = input.horaInicio.split(":").map(Number);
  const [hFin, mFin] = input.horaFin.split(":").map(Number);
  const duracionHoras = (hFin * 60 + mFin - (hIni * 60 + mIni)) / 60;

  const { tareaId, zonaHoraria } = await withUser(
    session.user.id,
    async (tx) => {
      const [{ id }] = await tx<[{ id: string }]>`
        insert into tarea (
          organizacion_id, titulo, descripcion, tipo, prioridad,
          responsable_id, fecha_vencimiento, hora_inicio, duracion_estimada_hs,
          estado, creada_por, orden
        )
        values (
          mi_organizacion_id(), ${input.titulo}, ${input.descripcion || null},
          'reunion'::tipo_tarea, 'media'::prioridad_tarea,
          ${input.responsableId}, ${input.fecha}, ${input.horaInicio}::time,
          ${duracionHoras}, 'por_hacer', mi_usuario_id(), 0
        )
        returning id
      `;
      const [org] = await tx<[{ zona_horaria: string }]>`
        select zona_horaria from organizacion where id = mi_organizacion_id()
      `;
      return { tareaId: id, zonaHoraria: org.zona_horaria };
    },
  );
  revalidatePath("/admin");
  revalidatePath("/tablero");
  revalidatePath("/hoy");
  revalidatePath("/calendario");

  let sincronizada = false;
  let error: string | null = null;
  try {
    const eventId = await crearEventoCalendar({
      titulo: input.titulo,
      descripcion: input.descripcion || null,
      fecha: input.fecha,
      horaInicio: input.horaInicio,
      horaFin: input.horaFin,
      timeZone: zonaHoraria,
    });
    if (eventId) {
      await withUser(session.user.id, async (tx) => {
        await tx`
          update tarea set google_event_id = ${eventId}
          where id = ${tareaId} and organizacion_id = mi_organizacion_id()
        `;
      });
      sincronizada = true;
      revalidatePath("/calendario");
      // La lista de eventos de Google se pide desde el cliente a
      // /api/calendar/events, que cachea la respuesta de Google 5 minutos
      // (ver esa ruta) — sin esto, la reunión recién creada no aparecía en
      // /calendario hasta que venciera ese caché. updateTag (no
      // revalidateTag) porque esto corre dentro de un Server Action y
      // queremos que la próxima visita ya traiga datos frescos, no
      // stale-while-revalidate.
      updateTag("calendar-events");
    }
  } catch (e) {
    error =
      e instanceof Error
        ? e.message
        : "No se pudo sincronizar con Google Calendar.";
  }

  return { sincronizada, error };
}
