"use server";

import bcrypt from "bcryptjs";
import { revalidatePath, updateTag, refresh } from "next/cache";
import { auth } from "@/auth";
import { withUser, sql } from "@/lib/db";
import { generarPasswordTemporal } from "@/lib/passwords";
import { generarTokenInvitacion, DURACION_INVITACION_MS } from "@/lib/invitaciones";
import { crearEventoCalendar, extraerCalendarId } from "@/lib/google/calendar";
import {
  SECCIONES_OPCIONALES,
  type SeccionesHabilitadas,
  type SeccionOpcionalKey,
} from "@/lib/secciones";
import { urlSegura } from "@/lib/utils";
import { logger } from "@/lib/logger";

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

// Rechazar una solicitud de acceso (alta automática vía Google o /registro):
// se borra la cuenta en vez de pasarla a 'inactivo' para que no quede en la
// lista de usuarios mezclada con quienes sí fueron parte del equipo. Una
// cuenta 'pendiente' nunca entró al sistema, así que no tiene turnos, tareas
// ni nada que dependa de ella. El email queda en solicitud_rechazada (ver
// 049_solicitud_rechazada.sql): auth.ts y /registro no le vuelven a crear
// una cuenta, hasta que un administrador lo desbloquee.
export async function rechazarSolicitud(userId: string): Promise<{ error: string | null }> {
  const session = await requireAdmin();
  if (userId === session.user.id) return { error: "No podés rechazar tu propia cuenta." };

  try {
    const error = await withUser(session.user.id, async (tx) => {
      const [usuario] = await tx<[{ nombre: string; email: string; estado: string } | undefined]>`
        select nombre, email, estado from usuario
        where id = ${userId} and organizacion_id = mi_organizacion_id()
      `;
      if (!usuario) return "La solicitud ya no existe.";
      if (usuario.estado !== "pendiente") return "Solo se pueden rechazar solicitudes pendientes.";

      await tx`
        insert into solicitud_rechazada (organizacion_id, email, nombre, rechazada_por)
        values (mi_organizacion_id(), ${usuario.email.trim().toLowerCase()}, ${usuario.nombre}, mi_usuario_id())
        on conflict (organizacion_id, email) do nothing
      `;
      await tx`
        delete from usuario
        where id = ${userId} and organizacion_id = mi_organizacion_id() and estado = 'pendiente'
      `;
      await tx`
        insert into auditoria (organizacion_id, usuario_id, entidad, entidad_id, entidad_nombre, campo, valor_antes, valor_despues)
        values (mi_organizacion_id(), mi_usuario_id(), 'usuario', ${userId}, ${usuario.nombre}, '(solicitud rechazada)', ${usuario.email}, null)
      `;
      return null;
    });
    if (error) return { error };
  } catch (e) {
    logger.error("rechazarSolicitud falló", { userId, error: e instanceof Error ? e.message : String(e) });
    return { error: "No se pudo rechazar la solicitud." };
  }

  revalidatePath("/configuracion");
  return { error: null };
}

// Deshacer un rechazo: el email puede volver a pedir acceso (entra de nuevo
// como solicitud pendiente, no directo como activo).
export async function desbloquearSolicitud(id: string): Promise<{ error: string | null }> {
  const session = await requireAdmin();

  try {
    await withUser(session.user.id, async (tx) => {
      const [fila] = await tx<[{ email: string } | undefined]>`
        delete from solicitud_rechazada
        where id = ${id} and organizacion_id = mi_organizacion_id()
        returning email
      `;
      if (fila) {
        await tx`
          insert into auditoria (organizacion_id, usuario_id, entidad, entidad_id, entidad_nombre, campo, valor_antes, valor_despues)
          values (mi_organizacion_id(), mi_usuario_id(), 'usuario', null, ${fila.email}, '(rechazo deshecho)', null, ${fila.email})
        `;
      }
    });
  } catch (e) {
    logger.error("desbloquearSolicitud falló", { id, error: e instanceof Error ? e.message : String(e) });
    return { error: "No se pudo desbloquear." };
  }

  revalidatePath("/configuracion");
  return { error: null };
}

// ── Quitar del equipo ─────────────────────────────────────────────────────────
// Desactivar a secas dejaba todo lo pendiente a nombre de quien se va: sus
// turnos seguían en el cronograma, figuraba en visitas y viajes futuros, y sus
// tareas/proyectos quedaban con un responsable que ya no entra. Esto muestra
// qué tiene pendiente y lo pasa a otra persona (o lo deja sin asignar) en la
// misma transacción que la desactiva. Lo pasado (visitas realizadas, tareas
// hechas, bitácora) no se toca: es historial.

export type PendientesUsuario = {
  turnos: { id: string; dia_semana: number; hora_inicio: string; hora_fin: string }[];
  visitas: { id: string; fecha: string; colegio_nombre: string }[];
  tareas: { id: string; titulo: string; coasignado: boolean }[];
  proyectos: { id: string; nombre: string; coasignado: boolean }[];
  viajes: { id: string; nombre: string }[];
  ausenciasFuturas: number;
  coberturasFuturas: number;
};

export async function obtenerPendientesUsuario(userId: string): Promise<PendientesUsuario> {
  const session = await requireAdmin();
  return withUser(session.user.id, async (tx) => {
    const [turnos, visitas, tareas, proyectos, viajes, [excepciones]] = await Promise.all([
      tx<PendientesUsuario["turnos"]>`
        select id, dia_semana::int as dia_semana,
          substring(hora_inicio::text, 1, 5) as hora_inicio,
          substring(hora_fin::text, 1, 5) as hora_fin
        from turno
        where usuario_id = ${userId} and organizacion_id = mi_organizacion_id()
          and (vigente_hasta is null or vigente_hasta >= current_date)
        order by dia_semana, hora_inicio
      `,
      tx<PendientesUsuario["visitas"]>`
        select v.id, v.fecha::text as fecha, c.nombre as colegio_nombre
        from visita_integrante vi
        join visita_colegio v on v.id = vi.visita_id
        join colegio c on c.id = v.colegio_id
        where vi.usuario_id = ${userId} and v.organizacion_id = mi_organizacion_id()
          and v.fecha >= current_date and v.estado not in ('realizado', 'cancelado')
        order by v.fecha
      `,
      tx<PendientesUsuario["tareas"]>`
        select t.id, t.titulo, (t.responsable_id is distinct from ${userId}) as coasignado
        from tarea t
        where t.organizacion_id = mi_organizacion_id() and t.estado != 'hecha'
          and (
            t.responsable_id = ${userId}
            or exists (select 1 from tarea_asignado ta where ta.tarea_id = t.id and ta.usuario_id = ${userId})
          )
        order by t.titulo
      `,
      tx<PendientesUsuario["proyectos"]>`
        select a.id, a.nombre, (a.responsable_id is distinct from ${userId}) as coasignado
        from area a
        where a.organizacion_id = mi_organizacion_id() and a.activa
          and (
            a.responsable_id = ${userId}
            or exists (select 1 from area_asignado aa where aa.area_id = a.id and aa.usuario_id = ${userId})
          )
        order by a.nombre
      `,
      tx<PendientesUsuario["viajes"]>`
        select v.id, v.nombre
        from viaje_asignado va
        join viaje v on v.id = va.viaje_id
        where va.usuario_id = ${userId} and v.organizacion_id = mi_organizacion_id()
          and v.estado not in ('realizado', 'cancelado')
        order by v.fecha_inicio
      `,
      tx<[{ ausencias: number; coberturas: number }]>`
        select
          count(*) filter (where usuario_id = ${userId})::int as ausencias,
          count(*) filter (where usuario_reemplazo_id = ${userId})::int as coberturas
        from excepcion_turno
        where organizacion_id = mi_organizacion_id() and fecha >= current_date
      `,
    ]);
    return {
      turnos: [...turnos],
      visitas: [...visitas],
      tareas: [...tareas],
      proyectos: [...proyectos],
      viajes: [...viajes],
      ausenciasFuturas: excepciones.ausencias,
      coberturasFuturas: excepciones.coberturas,
    };
  });
}

export async function quitarDelEquipo(
  userId: string,
  reemplazoId: string | null,
): Promise<{ error: string | null }> {
  const session = await requireAdmin();
  if (userId === session.user.id) return { error: "No podés quitarte a vos mismo del equipo." };
  if (reemplazoId === userId) return { error: "El reemplazo tiene que ser otra persona." };

  // Errores esperados como valor de retorno, no lanzados — ver eliminarUsuario.
  const error = await withUser(session.user.id, async (tx) => {
    const [usuario] = await tx<[{ nombre: string; estado: string } | undefined]>`
      select nombre, estado::text from usuario
      where id = ${userId} and organizacion_id = mi_organizacion_id()
    `;
    if (!usuario) return "El usuario no existe.";
    let reemplazoNombre: string | null = null;
    if (reemplazoId) {
      const [r] = await tx<[{ nombre: string } | undefined]>`
        select nombre from usuario
        where id = ${reemplazoId} and organizacion_id = mi_organizacion_id() and estado = 'activo'
      `;
      if (!r) return "La persona elegida como reemplazo no está activa.";
      reemplazoNombre = r.nombre;
    }

    // Cronograma: los turnos que ya arrancaron se cierran ayer (queda el
    // historial) y, si hay reemplazo, se copian a su nombre desde hoy; los que
    // todavía no arrancaron se pasan directo o se borran. No se duplica un
    // turno que el reemplazo ya tenga en el mismo día y horario.
    if (reemplazoId) {
      await tx`
        insert into turno (organizacion_id, usuario_id, dia_semana, hora_inicio, hora_fin, vigente_desde, vigente_hasta)
        select t.organizacion_id, ${reemplazoId}::uuid, t.dia_semana, t.hora_inicio, t.hora_fin,
          greatest(t.vigente_desde, current_date), t.vigente_hasta
        from turno t
        where t.usuario_id = ${userId} and t.organizacion_id = mi_organizacion_id()
          and (t.vigente_hasta is null or t.vigente_hasta >= current_date)
          and not exists (
            select 1 from turno r
            where r.usuario_id = ${reemplazoId} and r.dia_semana = t.dia_semana
              and r.hora_inicio = t.hora_inicio and r.hora_fin = t.hora_fin
              and (r.vigente_hasta is null or r.vigente_hasta >= current_date)
          )
      `;
    }
    await tx`
      delete from turno
      where usuario_id = ${userId} and organizacion_id = mi_organizacion_id()
        and vigente_desde >= current_date
    `;
    await tx`
      update turno set vigente_hasta = current_date - 1
      where usuario_id = ${userId} and organizacion_id = mi_organizacion_id()
        and (vigente_hasta is null or vigente_hasta >= current_date)
    `;

    // Ausencias futuras de quien se va ya no significan nada. Los días en que
    // cubría a otro vuelven a ser una ausencia sin cubrir de la persona
    // original (excepcion_turno no tiene policy de UPDATE: se reinserta).
    await tx`
      delete from excepcion_turno
      where usuario_id = ${userId} and organizacion_id = mi_organizacion_id()
        and fecha >= current_date
    `;
    await tx`
      insert into excepcion_turno (organizacion_id, usuario_id, fecha, tipo, nota, creada_por)
      select organizacion_id, usuario_id, fecha, 'ausencia'::tipo_excepcion_turno,
        concat_ws(' — ', nota, ${`Lo cubría ${usuario.nombre}, que ya no está en el equipo`}::text),
        mi_usuario_id()
      from excepcion_turno
      where usuario_reemplazo_id = ${userId} and organizacion_id = mi_organizacion_id()
        and fecha >= current_date
    `;
    await tx`
      delete from excepcion_turno
      where usuario_reemplazo_id = ${userId} and organizacion_id = mi_organizacion_id()
        and fecha >= current_date
    `;

    // Visitas futuras todavía no realizadas.
    const visitas = await tx<{ id: string }[]>`
      select v.id from visita_integrante vi
      join visita_colegio v on v.id = vi.visita_id
      where vi.usuario_id = ${userId} and v.organizacion_id = mi_organizacion_id()
        and v.fecha >= current_date and v.estado not in ('realizado', 'cancelado')
    `;
    const visitaIds = visitas.map((v) => v.id);
    if (visitaIds.length) {
      await tx`
        delete from visita_integrante
        where usuario_id = ${userId} and visita_id = any(${visitaIds}::uuid[])
      `;
      if (reemplazoId) {
        await tx`
          insert into visita_integrante (visita_id, usuario_id)
          select unnest(${visitaIds}::uuid[]), ${reemplazoId}::uuid
          on conflict do nothing
        `;
      }
    }

    // Tareas abiertas: responsable principal (con su tarea_log, igual que
    // asignarTarea) y co-asignaciones.
    const tareasResp = await tx<{ id: string }[]>`
      select id from tarea
      where responsable_id = ${userId} and organizacion_id = mi_organizacion_id()
        and estado != 'hecha'
    `;
    const tareaRespIds = tareasResp.map((t) => t.id);
    if (tareaRespIds.length) {
      await tx`
        update tarea set responsable_id = ${reemplazoId}
        where id = any(${tareaRespIds}::uuid[])
      `;
      await tx`
        insert into tarea_log (tarea_id, usuario_id, campo, valor_antes, valor_despues)
        select unnest(${tareaRespIds}::uuid[]), mi_usuario_id(), 'Responsable',
          ${usuario.nombre}::text, ${reemplazoNombre}::text
      `;
      if (reemplazoId) {
        // Si el reemplazo ya era co-asignado, ahora es el principal.
        await tx`
          delete from tarea_asignado
          where usuario_id = ${reemplazoId} and tarea_id = any(${tareaRespIds}::uuid[])
        `;
      }
    }
    const tareasCo = await tx<{ tarea_id: string; responsable_id: string | null }[]>`
      select ta.tarea_id, t.responsable_id from tarea_asignado ta
      join tarea t on t.id = ta.tarea_id
      where ta.usuario_id = ${userId} and t.organizacion_id = mi_organizacion_id()
        and t.estado != 'hecha'
    `;
    if (tareasCo.length) {
      await tx`
        delete from tarea_asignado
        where usuario_id = ${userId} and tarea_id = any(${tareasCo.map((t) => t.tarea_id)}::uuid[])
      `;
      const aSumar = tareasCo
        .filter((t) => t.responsable_id !== reemplazoId)
        .map((t) => t.tarea_id);
      if (reemplazoId && aSumar.length) {
        await tx`
          insert into tarea_asignado (tarea_id, usuario_id)
          select unnest(${aSumar}::uuid[]), ${reemplazoId}::uuid
          on conflict do nothing
        `;
      }
    }

    // Proyectos activos: mismo criterio que tareas.
    const areasResp = await tx<{ id: string }[]>`
      select id from area
      where responsable_id = ${userId} and organizacion_id = mi_organizacion_id() and activa
    `;
    const areaRespIds = areasResp.map((a) => a.id);
    if (areaRespIds.length) {
      await tx`
        update area set responsable_id = ${reemplazoId}
        where id = any(${areaRespIds}::uuid[])
      `;
      if (reemplazoId) {
        await tx`
          delete from area_asignado
          where usuario_id = ${reemplazoId} and area_id = any(${areaRespIds}::uuid[])
        `;
      }
    }
    const areasCo = await tx<{ area_id: string; responsable_id: string | null }[]>`
      select aa.area_id, a.responsable_id from area_asignado aa
      join area a on a.id = aa.area_id
      where aa.usuario_id = ${userId} and a.organizacion_id = mi_organizacion_id() and a.activa
    `;
    if (areasCo.length) {
      await tx`
        delete from area_asignado
        where usuario_id = ${userId} and area_id = any(${areasCo.map((a) => a.area_id)}::uuid[])
      `;
      const aSumar = areasCo
        .filter((a) => a.responsable_id !== reemplazoId)
        .map((a) => a.area_id);
      if (reemplazoId && aSumar.length) {
        await tx`
          insert into area_asignado (area_id, usuario_id)
          select unnest(${aSumar}::uuid[]), ${reemplazoId}::uuid
          on conflict do nothing
        `;
      }
    }

    // Viajes que todavía no se hicieron.
    const viajes = await tx<{ id: string }[]>`
      select v.id from viaje_asignado va
      join viaje v on v.id = va.viaje_id
      where va.usuario_id = ${userId} and v.organizacion_id = mi_organizacion_id()
        and v.estado not in ('realizado', 'cancelado')
    `;
    const viajeIds = viajes.map((v) => v.id);
    if (viajeIds.length) {
      await tx`
        delete from viaje_asignado
        where usuario_id = ${userId} and viaje_id = any(${viajeIds}::uuid[])
      `;
      if (reemplazoId) {
        await tx`
          insert into viaje_asignado (viaje_id, usuario_id)
          select unnest(${viajeIds}::uuid[]), ${reemplazoId}::uuid
          on conflict do nothing
        `;
      }
    }

    await tx`
      update usuario set estado = 'inactivo'
      where id = ${userId} and organizacion_id = mi_organizacion_id()
    `;
    await tx`
      insert into auditoria (organizacion_id, usuario_id, entidad, entidad_id, entidad_nombre, campo, valor_antes, valor_despues)
      values (
        mi_organizacion_id(), mi_usuario_id(), 'usuario', ${userId}, ${usuario.nombre},
        'quitado del equipo', ${usuario.estado},
        ${reemplazoNombre ? `inactivo — pendientes a ${reemplazoNombre}` : "inactivo — pendientes sin asignar"}
      )
    `;
    return null;
  });
  if (error) return { error };

  for (const ruta of ["/configuracion", "/cronograma", "/hoy", "/visitas", "/tablero", "/proyectos", "/viajes", "/informes"]) {
    revalidatePath(ruta);
  }
  return { error: null };
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
//
// Devuelve el error en vez de lanzarlo: en producción Next reemplaza el
// mensaje de un error lanzado desde una Server Action por uno genérico, y el
// admin se quedaba sin saber por qué no se podía borrar.
//
// El cronograma (turnos y ausencias) de alguien que se borra no es historial
// que valga la pena conservar: se limpia antes de borrar, así no bloquea.
const TABLAS_ACTIVIDAD: Record<string, string> = {
  tarea: "tareas",
  comentario: "comentarios",
  adjunto: "archivos adjuntos",
  bitacora_diaria: "bitácora",
  nota_area: "notas de proyectos",
  hito_area: "hitos de proyectos",
  plantilla_area: "plantillas",
  visita_colegio: "visitas",
  viaje: "viajes",
  viaje_costo: "costos de viajes",
  viaje_pago: "pagos de viajes",
};

export async function eliminarUsuario(userId: string): Promise<{ error: string | null }> {
  const session = await requireAdmin();
  if (userId === session.user.id) return { error: "No podés eliminar tu propia cuenta." };

  try {
    const error = await withUser(session.user.id, async (tx) => {
      const [usuario] = await tx<[{ nombre: string; estado: string } | undefined]>`
        select nombre, estado from usuario
        where id = ${userId} and organizacion_id = mi_organizacion_id()
      `;
      if (!usuario) return "El usuario no existe.";
      if (usuario.estado !== "inactivo") {
        return "Solo se pueden eliminar cuentas inactivas.";
      }
      await tx`
        delete from excepcion_turno
        where organizacion_id = mi_organizacion_id()
          and (usuario_id = ${userId} or usuario_reemplazo_id = ${userId})
      `;
      await tx`
        delete from turno
        where usuario_id = ${userId} and organizacion_id = mi_organizacion_id()
      `;
      await tx`
        delete from usuario
        where id = ${userId} and organizacion_id = mi_organizacion_id()
      `;
      await tx`
        insert into auditoria (organizacion_id, usuario_id, entidad, entidad_id, entidad_nombre, campo, valor_antes, valor_despues)
        values (mi_organizacion_id(), mi_usuario_id(), 'usuario', ${userId}, ${usuario.nombre}, '(eliminado)', ${usuario.nombre}, null)
      `;
      return null;
    });
    if (error) return { error };
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "23503") {
      // Postgres dice qué tabla todavía la referencia (la primera que
      // encuentra) — se nombra para que se entienda qué la bloquea.
      const detalle = "detail" in e ? String(e.detail) : "";
      const tabla = detalle.match(/from table "(\w+)"/)?.[1];
      const que = tabla ? (TABLAS_ACTIVIDAD[tabla] ?? tabla) : null;
      return {
        error: `No se puede eliminar: tiene actividad registrada en el sistema${que ? ` (por ejemplo, ${que})` : ""}. Como está inactiva ya no puede entrar ni aparece en ningún lado; dejala así para conservar el historial.`,
      };
    }
    throw e;
  }
  revalidatePath("/configuracion");
  revalidatePath("/cronograma");
  return { error: null };
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

// Genera un link de un solo uso para que el propio usuario cargue su email
// real y elija su contraseña — pensado para las cuentas dadas de alta con un
// placeholder (ej. @sae.test) que hoy nadie puede loguear con su email real.
// Devuelve el token crudo (nunca se guarda así en la base, ver
// lib/invitaciones.ts) para mostrarlo una única vez, mismo patrón que la
// contraseña temporal de crearUsuario/resetearPassword. Generar uno nuevo
// pisa cualquier token anterior de esa persona — el link viejo deja de
// funcionar solo, no hace falta invalidarlo aparte.
// Devuelve { error } en vez de tirar: en producción Next oculta el mensaje de
// un throw en una server action (llega como "Minified React error #441").
export async function generarInvitacion(
  userId: string,
): Promise<{ token: string; error?: never } | { token?: never; error: string }> {
  const session = await requireAdmin();
  if (userId === session.user.id) return { error: "No podés invitarte a vos mismo." };

  const { token, hash } = generarTokenInvitacion();
  const expira = new Date(Date.now() + DURACION_INVITACION_MS);

  try {
    const filas = await withUser(session.user.id, async (tx) => {
      return await tx`
        update usuario
        set token_invitacion_hash = ${hash}, token_invitacion_expira = ${expira}
        where id = ${userId} and organizacion_id = mi_organizacion_id()
        returning id
      `;
    });
    if (filas.length === 0) return { error: "El usuario no existe." };
  } catch (e) {
    logger.error("generarInvitacion falló", { userId, error: e instanceof Error ? e.message : String(e) });
    return { error: "No se pudo generar el link." };
  }

  return { token };
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
  if (data.color_principal && !/^#[0-9a-fA-F]{6}$/.test(data.color_principal)) {
    throw new Error("Color principal inválido");
  }
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
  // El color/logo por defecto se aplican en app/(app)/layout.tsx para toda la
  // organización — sin esto, quien lo cambia solo lo ve reflejado después de
  // navegar o refrescar a mano.
  refresh();
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

export async function actualizarSecciones(
  data: SeccionesHabilitadas,
  soloAdmin: SeccionOpcionalKey[],
) {
  const session = await requireAdmin();
  const claves = new Set<string>(SECCIONES_OPCIONALES.map((s) => s.key));
  const soloAdminValidas = soloAdmin.filter((k) => claves.has(k));
  await withUser(session.user.id, async (tx) => {
    await tx`
      update organizacion
      set tablero_habilitado = ${data.tablero},
        calendario_habilitado = ${data.calendario},
        cronograma_habilitado = ${data.cronograma},
        proyectos_habilitado = ${data.proyectos},
        visitas_habilitado = ${data.visitas},
        viajes_habilitado = ${data.viajes},
        secciones_solo_admin = ${soloAdminValidas}::text[]
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
  // Solo http/https: un acceso rápido con esquema "javascript:" se
  // renderiza como <a href> tal cual (ver app/(app)/hoy/accesos-card.tsx y
  // configuracion/page.tsx) y correría con la sesión de quien lo clickee.
  const url = urlSegura((formData.get("url") as string).trim());
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
      where organizacion_id = mi_organizacion_id() and area_id is null and viaje_id is null
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
        zonaHoraria: org?.zona_horaria ?? "UTC",
        calendarId: org?.google_calendar_id ?? process.env.GOOGLE_CALENDAR_ID ?? null,
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
