"use server";

import bcrypt from "bcryptjs";
import { revalidatePath, updateTag } from "next/cache";
import { auth } from "@/auth";
import { withUser, sql } from "@/lib/db";
import { generarPasswordTemporal } from "@/lib/passwords";
import { crearEventoCalendar, extraerCalendarId } from "@/lib/google/calendar";
import type { SeccionesHabilitadas } from "@/lib/secciones";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");
  if ((session.user as { rol: string }).rol !== "administrador") {
    throw new Error("Se requiere rol administrador");
  }
  return session;
}

// ── Usuarios ──────────────────────────────────────────────────────────────────

// Alta directa desde Configuración — a diferencia de /registro, entra ya
// 'activo' (sin pasar por la aprobación de pendientes) porque quien la crea
// ya es un administrador dando de alta a su propio equipo. `password` es
// opcional: si el admin no elige una, se genera una temporal (se muestra una
// sola vez, mismo patrón que resetearPassword) — sin esto, la única forma de
// recuperar el acceso si esa contraseña se perdía era que otro admin la
// reseteara desde la tabla de usuarios.
//
// Usa `sql` directo (superuser), no `withUser()`: no hay policy de INSERT
// para `usuario` bajo el rol sae_app (ver comentario en db/migrations/002_rls.sql
// — "INSERT: solo superuser"), mismo criterio que ya usan /registro y
// crearOrganizacion en /plataforma. `organizacion_id` sale de la sesión en
// vez de mi_organizacion_id() porque esa función depende del contexto que
// solo setea withUser().
export async function crearUsuario(data: {
  nombre: string;
  email: string;
  rol: "miembro" | "administrador";
  password?: string;
}): Promise<{ passwordTemporal: string | null }> {
  const session = await requireAdmin();
  if (data.password && data.password.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres.");
  }
  const passwordTemporal = data.password ? null : generarPasswordTemporal();
  const passwordHash = await bcrypt.hash(data.password || passwordTemporal!, 10);

  try {
    await sql`
      insert into usuario (organizacion_id, nombre, email, password_hash, rol, estado)
      values (
        ${session.user.organizacion_id}, ${data.nombre}, ${data.email}, ${passwordHash},
        ${data.rol}::rol_usuario, 'activo'
      )
    `;
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "23505") {
      throw new Error("Ya existe una cuenta con ese email.");
    }
    throw e;
  }
  revalidatePath("/configuracion");
  return { passwordTemporal };
}

export async function cambiarEstadoUsuario(
  userId: string,
  estado: "activo" | "inactivo",
) {
  const session = await requireAdmin();
  if (userId === session.user.id)
    throw new Error("No podés cambiar tu propio estado");
  await withUser(session.user.id, async (tx) => {
    const [antes] = await tx<[{ nombre: string; estado: string } | undefined]>`
      select nombre, estado::text from usuario
      where id = ${userId} and organizacion_id = mi_organizacion_id()
    `;
    await tx`
      update usuario
      set estado = ${estado}::estado_usuario
      where id = ${userId}
        and organizacion_id = mi_organizacion_id()
    `;
    if (antes && antes.estado !== estado) {
      await tx`
        insert into auditoria (organizacion_id, usuario_id, entidad, entidad_id, entidad_nombre, campo, valor_antes, valor_despues)
        values (mi_organizacion_id(), mi_usuario_id(), 'usuario', ${userId}, ${antes.nombre}, 'estado', ${antes.estado}, ${estado})
      `;
    }
  });
  revalidatePath("/configuracion");
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
    const [antes] = await tx<[{ nombre: string; rol: string } | undefined]>`
      select nombre, rol::text from usuario
      where id = ${userId} and organizacion_id = mi_organizacion_id()
    `;
    await tx`
      update usuario
      set rol = ${rol}::rol_usuario
      where id = ${userId}
        and organizacion_id = mi_organizacion_id()
    `;
    if (antes && antes.rol !== rol) {
      await tx`
        insert into auditoria (organizacion_id, usuario_id, entidad, entidad_id, entidad_nombre, campo, valor_antes, valor_despues)
        values (mi_organizacion_id(), mi_usuario_id(), 'usuario', ${userId}, ${antes.nombre}, 'rol', ${antes.rol}, ${rol})
      `;
    }
  });
  revalidatePath("/configuracion");
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
  revalidatePath("/configuracion");
}

// Borrado definitivo — solo permitido sobre cuentas ya inactivas (que un
// admin desactivó a mano antes). No se puede deshacer, a diferencia de
// desactivar. Si el usuario tiene actividad asociada (tareas creadas,
// comentarios, visitas, archivos subidos, etc. — hay ~15 tablas con FK a
// usuario sin ON DELETE CASCADE, ver db/migrations) Postgres rechaza el
// borrado con una violación de foreign key (23503): se traduce a un mensaje
// claro en vez de dejar pasar el error crudo, y dejarla inactiva sigue
// siendo la opción para ese caso.
export async function eliminarUsuario(userId: string): Promise<void> {
  const session = await requireAdmin();
  if (userId === session.user.id)
    throw new Error("No podés eliminar tu propia cuenta");

  try {
    await withUser(session.user.id, async (tx) => {
      const [usuario] = await tx<[{ nombre: string; estado: string } | undefined]>`
        select nombre, estado from usuario
        where id = ${userId} and organizacion_id = mi_organizacion_id()
      `;
      if (!usuario) throw new Error("El usuario no existe.");
      if (usuario.estado !== "inactivo") {
        throw new Error("Solo se pueden eliminar cuentas inactivas.");
      }
      await tx`
        delete from usuario
        where id = ${userId} and organizacion_id = mi_organizacion_id()
      `;
      await tx`
        insert into auditoria (organizacion_id, usuario_id, entidad, entidad_id, entidad_nombre, campo, valor_antes, valor_despues)
        values (mi_organizacion_id(), mi_usuario_id(), 'usuario', ${userId}, ${usuario.nombre}, '(eliminado)', ${usuario.nombre}, null)
      `;
    });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "23503") {
      throw new Error(
        "No se puede eliminar: tiene actividad asociada en el sistema (tareas, comentarios, visitas, etc.). Dejala inactiva en vez de borrarla.",
      );
    }
    throw e;
  }
  revalidatePath("/configuracion");
}

// `password` opcional, mismo criterio que crearUsuario: si el admin elige la
// suya no hace falta mostrarla ni copiarla después, solo confirmar que se
// guardó.
export async function resetearPassword(
  userId: string,
  password?: string,
): Promise<{ passwordTemporal: string | null }> {
  const session = await requireAdmin();
  if (userId === session.user.id)
    throw new Error("No podés resetear tu propia contraseña");
  if (password && password.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres.");
  }

  const passwordTemporal = password ? null : generarPasswordTemporal();
  const passwordHash = await bcrypt.hash(password || passwordTemporal!, 10);

  await withUser(session.user.id, async (tx) => {
    await tx`
      update usuario
      set password_hash = ${passwordHash}
      where id = ${userId}
        and organizacion_id = mi_organizacion_id()
    `;
  });
  revalidatePath("/configuracion");
  return { passwordTemporal };
}

// ── Tareas ────────────────────────────────────────────────────────────────────

export async function asignarTarea(tareaId: string, usuarioId: string | null) {
  const session = await requireAdmin();
  await withUser(session.user.id, async (tx) => {
    const [antes] = await tx<[{ responsable_id: string | null } | undefined]>`
      select responsable_id from tarea
      where id = ${tareaId} and organizacion_id = mi_organizacion_id()
    `;
    await tx`
      update tarea
      set responsable_id = ${usuarioId}
      where id = ${tareaId}
        and organizacion_id = mi_organizacion_id()
    `;
    // Mismo tarea_log que usa el tablero al reasignar — un solo lugar para
    // el historial de una tarea, en vez de duplicarlo en auditoria.
    if (antes && antes.responsable_id !== usuarioId) {
      const nombres = await tx<{ id: string; nombre: string }[]>`
        select id, nombre from usuario where id = any(${[antes.responsable_id, usuarioId].filter((x): x is string => x !== null)}::uuid[])
      `;
      const nombreDe = (id: string | null) =>
        id ? (nombres.find((n) => n.id === id)?.nombre ?? null) : null;
      await tx`
        insert into tarea_log (tarea_id, usuario_id, campo, valor_antes, valor_despues)
        values (${tareaId}, mi_usuario_id(), 'Responsable', ${nombreDe(antes.responsable_id)}, ${nombreDe(usuarioId)})
      `;
    }
  });
  revalidatePath("/configuracion");
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
  revalidatePath("/configuracion");
  revalidatePath("/", "layout");
}

// ── Google Calendar ───────────────────────────────────────────────────────────

export async function actualizarGoogleCalendarId(calendarId: string | null) {
  const session = await requireAdmin();
  const idLimpio = calendarId ? extraerCalendarId(calendarId) || null : null;
  await withUser(session.user.id, async (tx) => {
    await tx`
      update organizacion
      set google_calendar_id = ${idLimpio}
      where id = mi_organizacion_id()
    `;
  });
  revalidatePath("/configuracion");
  revalidatePath("/calendario");
  updateTag("calendar-events");
}

// ── Secciones ─────────────────────────────────────────────────────────────────
// Qué secciones del sidebar usa esta organización (ver migración 032 y
// lib/secciones.ts). Hoy y Tablero no se tocan acá: siempre están activas.

export async function actualizarSecciones(data: SeccionesHabilitadas) {
  const session = await requireAdmin();
  await withUser(session.user.id, async (tx) => {
    await tx`
      update organizacion
      set tablero_habilitado = ${data.tablero},
        calendario_habilitado = ${data.calendario},
        cronograma_habilitado = ${data.cronograma},
        proyectos_habilitado = ${data.proyectos},
        visitas_habilitado = ${data.visitas}
      where id = mi_organizacion_id()
    `;
  });
  revalidatePath("/configuracion");
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
  revalidatePath("/configuracion");
  revalidatePath("/hoy");
}

// Reordena intercambiando el `orden` con el vecino inmediato — alcanza para
// una lista corta como esta (no hace falta drag&drop). No-op silencioso si
// ya está en la punta (no hay vecino hacia ese lado).
export async function moverAcceso(
  accesoId: string,
  direccion: "arriba" | "abajo",
) {
  const session = await requireAdmin();
  await withUser(session.user.id, async (tx) => {
    const filas = await tx<{ id: string; orden: number }[]>`
      select id, orden from acceso_rapido
      where organizacion_id = mi_organizacion_id() and area_id is null
      order by orden asc
    `;
    const idx = filas.findIndex((f) => f.id === accesoId);
    if (idx === -1) return;
    const vecinoIdx = direccion === "arriba" ? idx - 1 : idx + 1;
    if (vecinoIdx < 0 || vecinoIdx >= filas.length) return;

    const actual = filas[idx];
    const vecino = filas[vecinoIdx];
    await tx`update acceso_rapido set orden = ${vecino.orden} where id = ${actual.id}`;
    await tx`update acceso_rapido set orden = ${actual.orden} where id = ${vecino.id}`;
  });
  revalidatePath("/configuracion");
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
  revalidatePath("/configuracion");
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

  const { tareaId, zonaHoraria, calendarId } = await withUser(
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
      const [org] = await tx<[{ zona_horaria: string; google_calendar_id: string | null }]>`
        select zona_horaria, google_calendar_id from organizacion where id = mi_organizacion_id()
      `;
      return {
        tareaId: id,
        zonaHoraria: org.zona_horaria,
        calendarId: org.google_calendar_id ?? process.env.GOOGLE_CALENDAR_ID ?? null,
      };
    },
  );
  revalidatePath("/configuracion");
  revalidatePath("/tablero");
  revalidatePath("/hoy");
  revalidatePath("/calendario");

  let sincronizada = false;
  let error: string | null = null;
  try {
    const eventId = await crearEventoCalendar(calendarId, {
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
