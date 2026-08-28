"use server";

import { revalidatePath, updateTag } from "next/cache";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import {
  crearEventoCalendar,
  actualizarEventoCalendar,
  eliminarEventoCalendar,
} from "@/lib/google/calendar";
import type { EstadoVisita, TipoVisita } from "@/types/database";
import { ESTADOS_VISITA_SINCRONIZABLES, labelTipoVisita } from "./tipos";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");
  return session;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- transacción de postgres.js
async function sincronizarIntegrantes(tx: any, visitaId: string, usuarioIds: string[]) {
  await tx`delete from visita_integrante where visita_id = ${visitaId}`;
  for (const usuarioId of new Set(usuarioIds)) {
    await tx`
      insert into visita_integrante (visita_id, usuario_id)
      values (${visitaId}, ${usuarioId})
    `;
  }
}

// Busca un colegio existente por nombre (case-insensitive, dentro de la org)
// o lo crea — reemplaza el auto-registro por onEdit del Sheet. Si el colegio
// ya existía pero le faltaba ciudad y/o zona, y la visita trae esos datos,
// los completa ahí mismo (backfill): así el directorio se va enriqueciendo
// con lo que carga cada visita en vez de quedar incompleto para siempre.
async function resolverColegio(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- transacción de postgres.js
  tx: any,
  input: { colegioId: string | null; nombre: string; ciudad: string | null; zona: string | null },
): Promise<string> {
  if (input.colegioId) {
    if (input.ciudad || input.zona) {
      await tx`
        update colegio set
          ciudad = coalesce(ciudad, ${input.ciudad}),
          zona   = coalesce(zona, ${input.zona})
        where id = ${input.colegioId} and organizacion_id = mi_organizacion_id()
      `;
    }
    return input.colegioId;
  }
  const nombre = input.nombre.trim();
  if (!nombre) throw new Error("Falta el nombre del colegio.");
  const [existente] = await tx<[{ id: string } | undefined]>`
    select id from colegio
    where organizacion_id = mi_organizacion_id()
      and lower(nombre) = lower(${nombre})
    limit 1
  `;
  if (existente) return existente.id;
  const [{ id }] = await tx<[{ id: string }]>`
    insert into colegio (organizacion_id, nombre, ciudad, zona)
    values (mi_organizacion_id(), ${nombre}, ${input.ciudad}, ${input.zona})
    returning id
  `;
  return id;
}

export type VisitaInput = {
  colegioId: string | null;
  colegioNombreNuevo?: string;
  ciudad?: string | null;
  zona?: string | null;
  fecha: string;
  horaInicio: string | null;
  horaFin: string | null;
  tipo: TipoVisita;
  estado: EstadoVisita;
  cantAlumnos: number | null;
  contactoNombre: string | null;
  contactoCargo: string | null;
  contactoEmail: string | null;
  contactoTelefono: string | null;
  observaciones: string | null;
  asignadoPorId: string | null;
  integrantesIds: string[];
};

// Arma título + descripción del evento de Calendar con el mismo formato que
// usaba la macro de Sheets (_syncVisitas en SAE_macro_v4_6.gs).
function armarEvento(
  visita: VisitaInput,
  colegioNombre: string,
  integrantesNombres: string[],
  zonaHoraria: string,
) {
  const ciudad = visita.ciudad?.trim() || "";
  const titulo = `📍 Visita: ${colegioNombre}${ciudad ? " — " + ciudad : ""}`;
  const lineas = [
    `Colegio: ${colegioNombre}`,
    ciudad ? `Ciudad: ${ciudad}` : null,
    `Tipo de visita: ${labelTipoVisita(visita.tipo)}`,
    visita.horaInicio
      ? `Hora de visita: ${visita.horaInicio}${visita.horaFin ? ` → ${visita.horaFin}` : ""}`
      : null,
    integrantesNombres.length
      ? `Integrante SAE: ${integrantesNombres.join(", ")}`
      : null,
    visita.observaciones ? `\nObservaciones: ${visita.observaciones}` : null,
  ].filter((linea): linea is string => linea !== null);

  return {
    titulo,
    descripcion: lineas.join("\n"),
    fecha: visita.fecha,
    horaInicio: visita.horaInicio ?? undefined,
    horaFin: visita.horaFin ?? undefined,
    timeZone: zonaHoraria,
  };
}

export async function crearVisita(
  data: VisitaInput,
): Promise<{ id: string; sincronizada: boolean; error: string | null }> {
  const session = await requireAuth();

  const { visitaId, colegioNombre, integrantesNombres, zonaHoraria, calendarId } =
    await withUser(session.user.id, async (tx) => {
      const colegioId = await resolverColegio(tx, {
        colegioId: data.colegioId,
        nombre: data.colegioNombreNuevo ?? "",
        ciudad: data.ciudad ?? null,
        zona: data.zona ?? null,
      });

      const [{ id }] = await tx<[{ id: string }]>`
        insert into visita_colegio (
          organizacion_id, colegio_id, fecha, hora_inicio, hora_fin, tipo,
          estado, cant_alumnos, contacto_nombre, contacto_cargo,
          contacto_email, contacto_telefono, observaciones, asignado_por_id,
          creada_por
        )
        values (
          mi_organizacion_id(), ${colegioId}, ${data.fecha},
          ${data.horaInicio}, ${data.horaFin}, ${data.tipo}::tipo_visita,
          ${data.estado}::estado_visita, ${data.cantAlumnos},
          ${data.contactoNombre}, ${data.contactoCargo}, ${data.contactoEmail},
          ${data.contactoTelefono}, ${data.observaciones}, ${data.asignadoPorId},
          mi_usuario_id()
        )
        returning id
      `;
      await sincronizarIntegrantes(tx, id, data.integrantesIds);

      const [colegio] = await tx<[{ nombre: string }]>`
        select nombre from colegio where id = ${colegioId}
      `;
      const integrantes = data.integrantesIds.length
        ? await tx<{ nombre: string }[]>`
            select nombre from usuario where id = any(${data.integrantesIds}::uuid[])
          `
        : [];
      const [org] = await tx<[{ zona_horaria: string; google_calendar_id: string | null }]>`
        select zona_horaria, google_calendar_id from organizacion where id = mi_organizacion_id()
      `;
      return {
        visitaId: id,
        colegioNombre: colegio.nombre,
        integrantesNombres: integrantes.map((u) => u.nombre),
        zonaHoraria: org.zona_horaria,
        calendarId: org.google_calendar_id ?? process.env.GOOGLE_CALENDAR_ID ?? null,
      };
    });

  revalidatePath("/visitas");
  revalidatePath("/informes");

  let sincronizada = false;
  let error: string | null = null;
  if (ESTADOS_VISITA_SINCRONIZABLES.includes(data.estado)) {
    try {
      const evento = armarEvento(data, colegioNombre, integrantesNombres, zonaHoraria);
      const eventId = await crearEventoCalendar(calendarId, evento);
      if (eventId) {
        await withUser(session.user.id, async (tx) => {
          await tx`
            update visita_colegio set google_event_id = ${eventId}
            where id = ${visitaId} and organizacion_id = mi_organizacion_id()
          `;
        });
        sincronizada = true;
        updateTag("calendar-events");
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "Error al sincronizar con Calendar";
    }
  }

  return { id: visitaId, sincronizada, error };
}

export async function actualizarVisita(
  visitaId: string,
  data: VisitaInput,
): Promise<{ sincronizada: boolean; error: string | null }> {
  const session = await requireAuth();

  const { colegioNombre, integrantesNombres, zonaHoraria, googleEventIdPrevio, calendarId } =
    await withUser(session.user.id, async (tx) => {
      const [previa] = await tx<[{ google_event_id: string | null; estado: string }]>`
        select google_event_id, estado::text from visita_colegio
        where id = ${visitaId} and organizacion_id = mi_organizacion_id()
      `;
      if (!previa) throw new Error("La visita no existe.");

      const colegioId = await resolverColegio(tx, {
        colegioId: data.colegioId,
        nombre: data.colegioNombreNuevo ?? "",
        ciudad: data.ciudad ?? null,
        zona: data.zona ?? null,
      });

      await tx`
        update visita_colegio set
          colegio_id        = ${colegioId},
          fecha              = ${data.fecha},
          hora_inicio        = ${data.horaInicio},
          hora_fin           = ${data.horaFin},
          tipo               = ${data.tipo}::tipo_visita,
          estado             = ${data.estado}::estado_visita,
          cant_alumnos       = ${data.cantAlumnos},
          contacto_nombre    = ${data.contactoNombre},
          contacto_cargo     = ${data.contactoCargo},
          contacto_email     = ${data.contactoEmail},
          contacto_telefono  = ${data.contactoTelefono},
          observaciones      = ${data.observaciones},
          asignado_por_id    = ${data.asignadoPorId}
        where id = ${visitaId} and organizacion_id = mi_organizacion_id()
      `;
      await sincronizarIntegrantes(tx, visitaId, data.integrantesIds);

      const [colegio] = await tx<[{ nombre: string }]>`
        select nombre from colegio where id = ${colegioId}
      `;
      if (previa.estado !== data.estado) {
        await tx`
          insert into auditoria (organizacion_id, usuario_id, entidad, entidad_id, entidad_nombre, campo, valor_antes, valor_despues)
          values (
            mi_organizacion_id(), mi_usuario_id(), 'visita', ${visitaId}, ${colegio.nombre},
            'estado', ${previa.estado}, ${data.estado}
          )
        `;
      }
      const integrantes = data.integrantesIds.length
        ? await tx<{ nombre: string }[]>`
            select nombre from usuario where id = any(${data.integrantesIds}::uuid[])
          `
        : [];
      const [org] = await tx<[{ zona_horaria: string; google_calendar_id: string | null }]>`
        select zona_horaria, google_calendar_id from organizacion where id = mi_organizacion_id()
      `;
      return {
        colegioNombre: colegio.nombre,
        integrantesNombres: integrantes.map((u) => u.nombre),
        zonaHoraria: org.zona_horaria,
        googleEventIdPrevio: previa.google_event_id,
        calendarId: org.google_calendar_id ?? process.env.GOOGLE_CALENDAR_ID ?? null,
      };
    });

  revalidatePath("/visitas");
  revalidatePath("/informes");

  let sincronizada = false;
  let error: string | null = null;
  try {
    const debeSincronizar = ESTADOS_VISITA_SINCRONIZABLES.includes(data.estado);
    if (debeSincronizar) {
      const evento = armarEvento(data, colegioNombre, integrantesNombres, zonaHoraria);
      const eventId = googleEventIdPrevio
        ? await actualizarEventoCalendar(calendarId, googleEventIdPrevio, evento)
        : await crearEventoCalendar(calendarId, evento);
      if (eventId && eventId !== googleEventIdPrevio) {
        await withUser(session.user.id, async (tx) => {
          await tx`
            update visita_colegio set google_event_id = ${eventId}
            where id = ${visitaId} and organizacion_id = mi_organizacion_id()
          `;
        });
      }
      sincronizada = eventId !== null;
      if (sincronizada) updateTag("calendar-events");
    } else if (googleEventIdPrevio) {
      // Cancelada/Reprogramada: se retira del Calendar, igual que hacía el
      // trigger diario del Sheet (que solo sincronizaba Pendiente/Confirmado/
      // Realizado).
      await eliminarEventoCalendar(calendarId, googleEventIdPrevio);
      await withUser(session.user.id, async (tx) => {
        await tx`
          update visita_colegio set google_event_id = null
          where id = ${visitaId} and organizacion_id = mi_organizacion_id()
        `;
      });
      updateTag("calendar-events");
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Error al sincronizar con Calendar";
  }

  return { sincronizada, error };
}

export async function eliminarVisita(visitaId: string): Promise<void> {
  const session = await requireAuth();
  const { googleEventId, calendarId } = await withUser(session.user.id, async (tx) => {
    const [visita] = await tx<
      [{ google_event_id: string | null; colegio_nombre: string; fecha: string } | undefined]
    >`
      select v.google_event_id, c.nombre as colegio_nombre, v.fecha::text
      from visita_colegio v
      join colegio c on c.id = v.colegio_id
      where v.id = ${visitaId} and v.organizacion_id = mi_organizacion_id()
    `;
    await tx`
      delete from visita_colegio
      where id = ${visitaId} and organizacion_id = mi_organizacion_id()
    `;
    if (visita) {
      await tx`
        insert into auditoria (organizacion_id, usuario_id, entidad, entidad_id, entidad_nombre, campo, valor_antes, valor_despues)
        values (
          mi_organizacion_id(), mi_usuario_id(), 'visita', ${visitaId},
          ${`${visita.colegio_nombre} (${visita.fecha})`}, '(eliminada)', 'existía', null
        )
      `;
    }
    const [org] = await tx<[{ google_calendar_id: string | null }]>`
      select google_calendar_id from organizacion where id = mi_organizacion_id()
    `;
    return {
      googleEventId: visita?.google_event_id ?? null,
      calendarId: org.google_calendar_id ?? process.env.GOOGLE_CALENDAR_ID ?? null,
    };
  });
  if (googleEventId) {
    try {
      await eliminarEventoCalendar(calendarId, googleEventId);
      updateTag("calendar-events");
    } catch {
      // Si Calendar rechaza el borrado (ya no existe, etc.) no bloqueamos el
      // borrado de la visita, que ya se hizo.
    }
  }
  revalidatePath("/visitas");
  revalidatePath("/informes");
}

// Copia el contacto de esta visita puntual al directorio de colegios —
// equivalente a "📋 Guardar contacto de esta fila → Colegios" del Sheet.
export async function guardarContactoColegio(visitaId: string): Promise<void> {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    const [visita] = await tx<
      [
        {
          colegio_id: string;
          contacto_nombre: string | null;
          contacto_cargo: string | null;
          contacto_email: string | null;
          contacto_telefono: string | null;
        } | undefined,
      ]
    >`
      select colegio_id, contacto_nombre, contacto_cargo, contacto_email, contacto_telefono
      from visita_colegio
      where id = ${visitaId} and organizacion_id = mi_organizacion_id()
    `;
    if (!visita) throw new Error("La visita no existe.");
    await tx`
      update colegio set
        contacto_nombre   = ${visita.contacto_nombre},
        contacto_cargo    = ${visita.contacto_cargo},
        contacto_email    = ${visita.contacto_email},
        contacto_telefono = ${visita.contacto_telefono}
      where id = ${visita.colegio_id} and organizacion_id = mi_organizacion_id()
    `;
  });
  revalidatePath("/visitas");
}

export type ColegioUpdateInput = {
  nombre: string;
  ciudad: string | null;
  zona: string | null;
  contactoNombre: string | null;
  contactoCargo: string | null;
  contactoEmail: string | null;
  contactoTelefono: string | null;
  estadoRelacion: "nuevo" | "activo" | "inactivo";
};

export async function actualizarColegio(
  colegioId: string,
  data: ColegioUpdateInput,
): Promise<void> {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await tx`
      update colegio set
        nombre            = ${data.nombre},
        ciudad             = ${data.ciudad},
        zona               = ${data.zona},
        contacto_nombre    = ${data.contactoNombre},
        contacto_cargo     = ${data.contactoCargo},
        contacto_email     = ${data.contactoEmail},
        contacto_telefono  = ${data.contactoTelefono},
        estado_relacion    = ${data.estadoRelacion}::estado_relacion_colegio
      where id = ${colegioId} and organizacion_id = mi_organizacion_id()
    `;
  });
  revalidatePath("/visitas");
  // La ciudad del colegio agrupa "Visitas por localidad" en Informes — si
  // se edita, ese reporte tiene que reflejarlo sin esperar a que venza el
  // cache de router del navegador.
  revalidatePath("/informes");
}
