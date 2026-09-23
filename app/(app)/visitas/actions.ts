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
import {
  ESTADOS_VISITA_SINCRONIZABLES,
  labelTipoVisita,
  horaDentroDeFranjaLaboral,
  emailValido,
  telefonoValido,
} from "./tipos";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");
  return session;
}

export type VisitaDelDia = {
  id: string;
  colegio_nombre: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  estado: EstadoVisita;
};

// Para avisar, al elegir la fecha, qué otras visitas ya están anotadas ese
// día y en qué horario — así se evita pisar un horario ya ocupado. Se llama
// desde el cliente cada vez que cambia la fecha del formulario (ver
// visita-dialog.tsx). No es un bloqueo: solo informa, porque puede haber
// más de una persona del equipo visitando el mismo día sin problema.
export async function obtenerVisitasDelDia(
  fecha: string,
  excluirId?: string,
): Promise<VisitaDelDia[]> {
  const session = await requireAuth();
  return withUser(session.user.id, async (tx) => {
    const filas = await tx<VisitaDelDia[]>`
      select
        v.id, c.nombre as colegio_nombre, v.hora_inicio::text as hora_inicio,
        v.hora_fin::text as hora_fin, v.estado::text as estado
      from visita_colegio v
      join colegio c on c.id = v.colegio_id
      where v.organizacion_id = mi_organizacion_id()
        and v.fecha = ${fecha}
        and v.estado != 'cancelado'
        and (${excluirId ?? null}::uuid is null or v.id != ${excluirId ?? null})
      order by v.hora_inicio asc nulls last
    `;
    return [...filas];
  });
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
// ya existía pero le faltaba ciudad y/o provincia, y la visita trae esos
// datos, los completa ahí mismo (backfill): así el directorio se va
// enriqueciendo con lo que carga cada visita en vez de quedar incompleto
// para siempre.
async function resolverColegio(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- transacción de postgres.js
  tx: any,
  input: {
    colegioId: string | null;
    nombre: string;
    ciudad: string | null;
    provincia: string | null;
  },
): Promise<string> {
  if (input.colegioId) {
    if (input.ciudad || input.provincia) {
      await tx`
        update colegio set
          ciudad    = coalesce(ciudad, ${input.ciudad}),
          provincia = coalesce(provincia, ${input.provincia})
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
    insert into colegio (organizacion_id, nombre, ciudad, provincia)
    values (mi_organizacion_id(), ${nombre}, ${input.ciudad}, ${input.provincia})
    returning id
  `;
  return id;
}

export type VisitaInput = {
  colegioId: string | null;
  colegioNombreNuevo?: string;
  ciudad?: string | null;
  provincia?: string | null;
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

function validarVisitaInput(data: VisitaInput): void {
  if (!horaDentroDeFranjaLaboral(data.horaInicio) || !horaDentroDeFranjaLaboral(data.horaFin)) {
    throw new Error(
      "El horario de la visita tiene que estar entre 08:00–12:00 o 14:00–21:00.",
    );
  }
  if (!emailValido(data.contactoEmail)) {
    throw new Error("El email del contacto no es válido.");
  }
  if (!telefonoValido(data.contactoTelefono)) {
    throw new Error("El teléfono del contacto no es válido.");
  }
}

export async function crearVisita(
  data: VisitaInput,
): Promise<{ id: string; sincronizada: boolean; error: string | null }> {
  const session = await requireAuth();
  validarVisitaInput(data);

  const { visitaId, colegioNombre, integrantesNombres, zonaHoraria, calendarId } =
    await withUser(session.user.id, async (tx) => {
      const colegioId = await resolverColegio(tx, {
        colegioId: data.colegioId,
        nombre: data.colegioNombreNuevo ?? "",
        ciudad: data.ciudad ?? null,
        provincia: data.provincia ?? null,
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
          ${data.contactoTelefono}, ${data.observaciones},
          -- Quien carga la visita queda como quien la coordinó; no se elige.
          mi_usuario_id(), mi_usuario_id()
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
        zonaHoraria: org?.zona_horaria ?? "UTC",
        calendarId: org?.google_calendar_id ?? process.env.GOOGLE_CALENDAR_ID ?? null,
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
  validarVisitaInput(data);

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
        provincia: data.provincia ?? null,
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
          observaciones      = ${data.observaciones}
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
        zonaHoraria: org?.zona_horaria ?? "UTC",
        googleEventIdPrevio: previa.google_event_id,
        calendarId: org?.google_calendar_id ?? process.env.GOOGLE_CALENDAR_ID ?? null,
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

// No hay acción para eliminar visitas a propósito: era demasiado fácil
// borrar una por error desde la tabla y se perdía el historial. Una visita
// que no va más se marca como Cancelada editándola.

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
  provincia: string | null;
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
  if (!emailValido(data.contactoEmail)) {
    throw new Error("El email del contacto no es válido.");
  }
  if (!telefonoValido(data.contactoTelefono)) {
    throw new Error("El teléfono del contacto no es válido.");
  }
  await withUser(session.user.id, async (tx) => {
    await tx`
      update colegio set
        nombre            = ${data.nombre},
        ciudad             = ${data.ciudad},
        zona               = ${data.zona},
        provincia          = ${data.provincia},
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
