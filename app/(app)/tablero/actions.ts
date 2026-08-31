"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import { notificarAsignacion, notificarComentario } from "@/lib/notificaciones";
import type { TareaCard } from "./page";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");
  return session;
}

// Mover una tarea de columna (estado) es más restrictivo que editarla: acá
// no alcanza con ser quien la creó, como sí permite tarea_update de RLS —
// tiene que ser responsable, co-asignado, administrador, o la tarea tiene
// que estar "libre" (sin responsable ni co-asignados, así que cualquiera
// puede tomarla). Se resuelve a mano porque RLS no puede distinguir
// "cambiar el estado" de "editar cualquier otro campo" dentro de un mismo
// UPDATE.
async function puedeMoverEstado(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- transacción de postgres.js
  tx: any,
  tareaId: string,
  session: Awaited<ReturnType<typeof requireAuth>>,
): Promise<boolean> {
  const rol = (session.user as { rol: string }).rol;
  if (rol === "administrador") return true;

  const [fila] = await tx<
    {
      responsable_id: string | null;
      tiene_asignados: boolean;
      soy_asignado: boolean;
    }[]
  >`
    select
      t.responsable_id,
      exists (select 1 from tarea_asignado ta where ta.tarea_id = t.id) as tiene_asignados,
      exists (
        select 1 from tarea_asignado ta
        where ta.tarea_id = t.id and ta.usuario_id = mi_usuario_id()
      ) as soy_asignado
    from tarea t
    where t.id = ${tareaId} and t.organizacion_id = mi_organizacion_id()
  `;
  if (!fila) return false;

  const esResponsable = fila.responsable_id === session.user.id;
  const libre = fila.responsable_id === null && !fila.tiene_asignados;
  return esResponsable || fila.soy_asignado || libre;
}

// Crear una tarea en un proyecto, o editar cualquier campo suyo que no sea
// el estado, requiere ser administrador o responsable de ese proyecto — un
// colaborador del área solo trabaja las tareas que ya tiene asignadas (eso
// lo resuelve puedeMoverEstado). Mismo criterio que requirePlanificador en
// proyectos/actions.ts (ahí acotado a tareas planificadas); se duplica en
// vez de importarse cruzado porque cada actions.ts de esta app ya repite sus
// propios helpers de autorización en vez de compartirlos desde lib/.
async function puedeGestionarArea(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- transacción de postgres.js
  tx: any,
  areaId: string,
  session: Awaited<ReturnType<typeof requireAuth>>,
) {
  const rol = (session.user as { rol: string }).rol;
  if (rol === "administrador") return;
  const [area] = await tx<[{ responsable_id: string | null }]>`
    select responsable_id from area
    where id = ${areaId} and organizacion_id = mi_organizacion_id()
  `;
  if (!area || area.responsable_id !== session.user.id) {
    throw new Error(
      "Solo el administrador o el responsable del proyecto pueden crear o editar tareas de este proyecto.",
    );
  }
}

// ── Tareas recurrentes ───────────────────────────────────────────────────────
// Cálculo al vuelo, no generación anticipada: al completar una tarea con
// recurrencia, se clona la siguiente ocurrencia en ese momento (no se crean
// instancias futuras por adelantado). Más simple y no ensucia el tablero con
// tareas de fechas lejanas que capaz nunca hacen falta.

type Frecuencia = "diaria" | "semanal" | "mensual";
type Recurrencia = { frecuencia: Frecuencia } | null;

function calcularSiguienteFecha(
  fechaISO: string,
  frecuencia: Frecuencia,
): string {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const fecha = new Date(y, m - 1, d);

  if (frecuencia === "diaria") {
    fecha.setDate(fecha.getDate() + 1);
  } else if (frecuencia === "semanal") {
    fecha.setDate(fecha.getDate() + 7);
  } else {
    // Clamp al último día del mes destino — evita que "setMonth" desborde
    // al mes siguiente (31 ene + 1 mes = 3 mar sin este ajuste, no 28/29 feb).
    const mesDestino = fecha.getMonth() + 1;
    const ultimoDiaMesDestino = new Date(
      fecha.getFullYear(),
      mesDestino + 1,
      0,
    ).getDate();
    fecha.setDate(1);
    fecha.setMonth(mesDestino);
    fecha.setDate(Math.min(d, ultimoDiaMesDestino));
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- transacción de postgres.js
async function generarSiguienteOcurrencia(tx: any, tareaId: string) {
  const [tarea] = await tx<
    {
      area_id: string | null;
      titulo: string;
      descripcion: string | null;
      tipo: string;
      prioridad: string;
      responsable_id: string | null;
      fecha_vencimiento: string | null;
      recurrencia: Recurrencia;
      para_todos: boolean;
    }[]
  >`
    select
      area_id, titulo, descripcion, tipo::text, prioridad::text,
      responsable_id, fecha_vencimiento::text, recurrencia, para_todos
    from tarea where id = ${tareaId}
  `;

  if (!tarea?.recurrencia || !tarea.fecha_vencimiento) return;

  const siguiente = calcularSiguienteFecha(
    tarea.fecha_vencimiento,
    tarea.recurrencia.frecuencia,
  );

  await tx`
    insert into tarea (
      organizacion_id, area_id, titulo, descripcion, tipo, prioridad,
      responsable_id, fecha_vencimiento, recurrencia, para_todos, estado, creada_por, orden
    )
    values (
      mi_organizacion_id(), ${tarea.area_id}, ${tarea.titulo}, ${tarea.descripcion},
      ${tarea.tipo}::tipo_tarea, ${tarea.prioridad}::prioridad_tarea,
      ${tarea.responsable_id}, ${siguiente}, ${JSON.stringify(tarea.recurrencia)}::jsonb,
      ${tarea.para_todos}, 'por_hacer', mi_usuario_id(), 0
    )
  `;
}

// ── Tarea ─────────────────────────────────────────────────────────────────────

async function sincronizarAsignados(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- transacción de postgres.js
  tx: any,
  tareaId: string,
  asignadosIds: string[],
) {
  // Reemplazo completo: se borra todo y se vuelve a insertar el set nuevo.
  // Simple y suficiente — la cantidad de asignados por tarea siempre es chica.
  await tx`delete from tarea_asignado where tarea_id = ${tareaId}`;
  for (const usuarioId of new Set(asignadosIds)) {
    await tx`
      insert into tarea_asignado (tarea_id, usuario_id)
      values (${tareaId}, ${usuarioId})
    `;
  }
}

export async function crearTarea(input: {
  titulo: string;
  descripcion: string;
  tipo: string;
  prioridad: string;
  area_id: string | null;
  responsable_id: string | null;
  asignados_ids?: string[];
  fecha_vencimiento: string | null;
  estado: string;
  para_todos?: boolean;
}) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    if (input.area_id) {
      await puedeGestionarArea(tx, input.area_id, session);
    }
    // Defensivo: una tarea para_todos nunca lleva responsable, aunque el
    // cliente mande algo raro (coincide con el check constraint de la base).
    const responsableId = input.para_todos ? null : input.responsable_id || null;
    const [{ id }] = await tx<[{ id: string }]>`
      insert into tarea (
        organizacion_id, area_id, titulo, descripcion, tipo, prioridad,
        responsable_id, fecha_vencimiento, estado, para_todos, creada_por, orden
      )
      values (
        mi_organizacion_id(),
        ${input.area_id},
        ${input.titulo},
        ${input.descripcion || null},
        ${input.tipo}::tipo_tarea,
        ${input.prioridad}::prioridad_tarea,
        ${responsableId},
        ${input.fecha_vencimiento || null},
        ${input.estado}::estado_tarea,
        ${input.para_todos ?? false},
        mi_usuario_id(),
        0
      )
      returning id
    `;
    const asignadosIds = input.para_todos ? [] : (input.asignados_ids ?? []);
    await sincronizarAsignados(tx, id, asignadosIds);

    const aNotificar = [
      ...(responsableId ? [responsableId] : []),
      ...asignadosIds,
    ];
    if (aNotificar.length > 0) {
      await notificarAsignacion(tx, aNotificar, input.titulo);
    }
  });
  revalidatePath("/tablero");
  revalidatePath("/hoy");
  revalidatePath("/informes");
}

export async function actualizarTarea(
  tareaId: string,
  data: {
    titulo: string;
    descripcion: string | null;
    tipo: string;
    prioridad: string;
    area_id: string | null;
    responsable_id: string | null;
    asignados_ids?: string[];
    fecha_vencimiento: string | null;
    estado: string;
    duracion_estimada_hs?: number | null;
    duracion_real_hs?: number | null;
    recurrencia?: Recurrencia;
    para_todos?: boolean;
  },
  prev?: {
    titulo: string;
    descripcion: string | null;
    tipo: string;
    prioridad: string;
    area_id: string | null;
    responsable_id: string | null;
    fecha_vencimiento: string | null;
    estado: string;
    asignados_ids?: string[];
    para_todos?: boolean;
  },
) {
  const session = await requireAuth();
  const completada_en = data.estado === "hecha" ? new Date() : null;
  const responsableId = data.para_todos ? null : data.responsable_id;
  await withUser(session.user.id, async (tx) => {
    if (
      prev &&
      data.estado !== prev.estado &&
      !(await puedeMoverEstado(tx, tareaId, session))
    ) {
      throw new Error(
        "Solo quien está asignado a esta tarea (o administrador) puede cambiar su estado.",
      );
    }

    // Editar cualquier campo que no sea el estado (incluido reasignar,
    // cambiar de proyecto, etc.) de una tarea de un proyecto requiere ser
    // responsable de ese proyecto o administrador — un colaborador solo
    // cambia el estado de lo que ya tiene asignado (chequeo de arriba).
    if (prev && prev.area_id) {
      const soloCambioDeEstado =
        data.titulo === prev.titulo &&
        data.descripcion === prev.descripcion &&
        data.tipo === prev.tipo &&
        data.prioridad === prev.prioridad &&
        data.area_id === prev.area_id &&
        responsableId === prev.responsable_id &&
        data.fecha_vencimiento === prev.fecha_vencimiento &&
        (data.para_todos ?? false) === (prev.para_todos ?? false) &&
        JSON.stringify([...(data.asignados_ids ?? [])].sort()) ===
          JSON.stringify([...(prev.asignados_ids ?? [])].sort());
      if (!soloCambioDeEstado) {
        await puedeGestionarArea(tx, prev.area_id, session);
      }
    }

    const actualizadas = await tx`
      update tarea set
        titulo               = ${data.titulo},
        descripcion          = ${data.descripcion},
        tipo                 = ${data.tipo}::tipo_tarea,
        prioridad            = ${data.prioridad}::prioridad_tarea,
        area_id              = ${data.area_id},
        responsable_id       = ${responsableId},
        fecha_vencimiento    = ${data.fecha_vencimiento},
        estado               = ${data.estado}::estado_tarea,
        completada_en        = ${completada_en},
        duracion_estimada_hs = ${data.duracion_estimada_hs ?? null},
        duracion_real_hs     = ${data.duracion_real_hs ?? null},
        recurrencia          = ${data.recurrencia ? JSON.stringify(data.recurrencia) : null}::jsonb,
        para_todos           = ${data.para_todos ?? false}
      where id = ${tareaId}
        and organizacion_id = mi_organizacion_id()
    `;

    // La política de RLS deja pasar el UPDATE pero lo filtra a 0 filas si
    // quien edita no es responsable/creador/administrador de la tarea.
    // Sin este chequeo, el resto de la función seguía de largo como si el
    // guardado hubiera funcionado (incluyendo el log de auditoría).
    if (actualizadas.count === 0) {
      throw new Error(
        "No se pudo guardar: no tenés permiso para editar esta tarea.",
      );
    }

    if (data.asignados_ids !== undefined) {
      await sincronizarAsignados(tx, tareaId, data.asignados_ids);
    }

    // Notificar a quien se sume como responsable o co-asignado — no a quien
    // ya estaba, para no repetir el aviso en cada guardado sin cambios reales.
    if (prev) {
      const antes = new Set(prev.asignados_ids ?? []);
      const nuevosCoasignados = (data.asignados_ids ?? []).filter(
        (id) => !antes.has(id),
      );
      const aNotificar = [
        ...(responsableId && responsableId !== prev.responsable_id
          ? [responsableId]
          : []),
        ...nuevosCoasignados,
      ];
      if (aNotificar.length > 0) {
        await notificarAsignacion(tx, aNotificar, data.titulo);
      }
    }

    // Tarea recurrente que se acaba de completar -> clonar la siguiente ocurrencia
    if (data.estado === "hecha" && prev?.estado !== "hecha") {
      await generarSiguienteOcurrencia(tx, tareaId);
    }

    // Registrar cambios en el log
    if (prev) {
      const CAMPOS: { key: keyof NonNullable<typeof prev>; label: string }[] = [
        { key: "titulo", label: "Título" },
        { key: "estado", label: "Estado" },
        { key: "prioridad", label: "Prioridad" },
        { key: "tipo", label: "Tipo" },
        { key: "responsable_id", label: "Responsable" },
        { key: "fecha_vencimiento", label: "Vencimiento" },
        { key: "descripcion", label: "Descripción" },
      ];
      for (const { key, label } of CAMPOS) {
        const antes = prev[key] ?? null;
        const despues = data[key] ?? null;
        if (antes !== despues) {
          await tx`
            insert into tarea_log (tarea_id, usuario_id, campo, valor_antes, valor_despues)
            values (${tareaId}, mi_usuario_id(), ${label}, ${antes}, ${despues})
          `;
        }
      }
    }
  });
  revalidatePath("/tablero");
  revalidatePath("/hoy");
  revalidatePath("/informes");
}

export async function moverEstadoTarea(tareaId: string, estado: string) {
  const session = await requireAuth();
  const completada_en = estado === "hecha" ? new Date() : null;
  await withUser(session.user.id, async (tx) => {
    if (!(await puedeMoverEstado(tx, tareaId, session))) {
      throw new Error(
        "Solo quien está asignado a esta tarea (o administrador) puede cambiar su estado.",
      );
    }

    const actualizadas = await tx`
      update tarea set
        estado        = ${estado}::estado_tarea,
        completada_en = ${completada_en}
      where id = ${tareaId}
        and organizacion_id = mi_organizacion_id()
    `;
    if (actualizadas.count === 0) {
      throw new Error("No se pudo mover la tarea: no tenés permiso.");
    }
    await tx`
      insert into tarea_log (tarea_id, usuario_id, campo, valor_antes, valor_despues)
      select ${tareaId}, mi_usuario_id(), 'Estado', estado::text, ${estado}
      from tarea where id = ${tareaId}
    `;

    // El drag-and-drop del lado del cliente ya evita llamar acá si no hubo
    // cambio real de estado, así que llegar con 'hecha' implica que antes no
    // lo estaba.
    if (estado === "hecha") {
      await generarSiguienteOcurrencia(tx, tareaId);
    }
  });
  revalidatePath("/tablero");
  revalidatePath("/hoy");
  revalidatePath("/informes");
}

async function areaDeTarea(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- transacción de postgres.js
  tx: any,
  tareaId: string,
): Promise<string | null> {
  const [fila] = await tx<[{ area_id: string | null } | undefined]>`
    select area_id from tarea where id = ${tareaId} and organizacion_id = mi_organizacion_id()
  `;
  return fila?.area_id ?? null;
}

export async function archivarTarea(tareaId: string) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    const areaId = await areaDeTarea(tx, tareaId);
    if (areaId) await puedeGestionarArea(tx, areaId, session);
    await tx`
      update tarea set archivada = true
      where id = ${tareaId}
        and organizacion_id = mi_organizacion_id()
    `;
  });
  revalidatePath("/tablero");
  revalidatePath("/hoy");
  revalidatePath("/informes");
}

export async function restaurarTarea(tareaId: string) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    const areaId = await areaDeTarea(tx, tareaId);
    if (areaId) await puedeGestionarArea(tx, areaId, session);
    await tx`
      update tarea set archivada = false
      where id = ${tareaId}
        and organizacion_id = mi_organizacion_id()
    `;
  });
  revalidatePath("/tablero");
  revalidatePath("/hoy");
  revalidatePath("/informes");
}

export async function fetchTareasArchivadas(): Promise<TareaCard[]> {
  const session = await requireAuth();
  return withUser(session.user.id, async (tx) => {
    const rows = await tx<TareaCard[]>`
      select
        t.id,
        t.titulo,
        t.estado::text,
        t.prioridad::text,
        t.tipo::text,
        t.descripcion,
        t.fecha_vencimiento::text,
        t.hora_inicio::text,
        t.area_id,
        t.viaje_id,
        t.responsable_id,
        t.creada_por,
        t.archivada,
        t.duracion_estimada_hs,
        t.duracion_real_hs,
        t.recurrencia,
        t.para_todos,
        a.nombre  as area_nombre,
        a.color   as area_color,
        v.nombre  as viaje_nombre,
        u.nombre  as responsable_nombre,
        u.avatar_color as responsable_avatar_color,
        coalesce(
          (
            select json_agg(json_build_object('id', u2.id, 'nombre', u2.nombre, 'avatar_color', u2.avatar_color))
            from tarea_asignado ta
            join usuario u2 on u2.id = ta.usuario_id
            where ta.tarea_id = t.id
          ),
          '[]'
        ) as asignados,
        coalesce((select count(*)::int from subtarea s where s.tarea_id = t.id), 0)              as subtarea_total,
        coalesce((select count(*)::int from subtarea s where s.tarea_id = t.id and s.hecha), 0)  as subtarea_hecha,
        coalesce((select count(*)::int from comentario c where c.tarea_id = t.id), 0)            as comentario_count
      from tarea t
      left join area    a on a.id = t.area_id
      left join viaje   v on v.id = t.viaje_id
      left join usuario u on u.id = t.responsable_id
      where t.organizacion_id = mi_organizacion_id() and t.archivada = true
      order by t.titulo asc
    `;
    return [...rows];
  });
}

// ── Subtareas ─────────────────────────────────────────────────────────────────

export type SubtareaRow = {
  id: string;
  titulo: string;
  hecha: boolean;
  orden: number;
};

export type ComentarioRow = {
  id: string;
  contenido: string;
  autor_nombre: string;
  autor_avatar_color: string | null;
  creado_en: string;
  es_propio: boolean;
};

export async function fetchTareaDetalle(tareaId: string): Promise<{
  subtareas: SubtareaRow[];
  comentarios: ComentarioRow[];
}> {
  const session = await requireAuth();
  return withUser(session.user.id, async (tx) => {
    const subtareas = await tx<SubtareaRow[]>`
      select id, titulo, hecha, orden
      from subtarea
      where tarea_id = ${tareaId}
      order by orden asc, creada_en asc
    `;
    const comentarios = await tx<
      (Omit<ComentarioRow, "es_propio"> & { es_propio: boolean })[]
    >`
      select
        c.id,
        c.contenido,
        u.nombre as autor_nombre,
        u.avatar_color as autor_avatar_color,
        c.creado_en::text,
        (c.autor_id = mi_usuario_id()) as es_propio
      from comentario c
      join usuario u on u.id = c.autor_id
      where c.tarea_id = ${tareaId}
      order by c.creado_en asc
    `;
    return {
      subtareas: [...subtareas],
      comentarios: comentarios.map((c) => ({
        ...c,
        es_propio: Boolean(c.es_propio),
      })),
    };
  });
}

export async function fetchTareaDetalleFull(tareaId: string): Promise<{
  subtareas: SubtareaRow[];
  comentarios: ComentarioRow[];
  adjuntos: AdjuntoRow[];
}> {
  const [detalle, adjuntos] = await Promise.all([
    fetchTareaDetalle(tareaId),
    fetchAdjuntos(tareaId),
  ]);
  return { ...detalle, adjuntos };
}

export async function crearSubtarea(tareaId: string, titulo: string) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    const [{ max_orden }] = await tx<[{ max_orden: number | null }]>`
      select max(orden) as max_orden from subtarea where tarea_id = ${tareaId}
    `;
    await tx`
      insert into subtarea (tarea_id, titulo, orden)
      values (${tareaId}, ${titulo}, ${(max_orden ?? -1) + 1})
    `;
  });
  revalidatePath("/tablero");
}

export async function toggleSubtarea(subtareaId: string, hecha: boolean) {
  const session = await requireAuth();
  const completada_en = hecha ? new Date() : null;
  await withUser(session.user.id, async (tx) => {
    await tx`
      update subtarea set hecha = ${hecha}, completada_en = ${completada_en}
      where id = ${subtareaId}
    `;
  });
  revalidatePath("/tablero");
  revalidatePath("/hoy");
}

export async function eliminarSubtarea(subtareaId: string) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await tx`delete from subtarea where id = ${subtareaId}`;
  });
  revalidatePath("/tablero");
}

export async function crearComentario(tareaId: string, contenido: string) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await tx`
      insert into comentario (tarea_id, autor_id, contenido)
      values (${tareaId}, mi_usuario_id(), ${contenido})
    `;

    // Notificar al responsable de la tarea si no es el autor
    const [tarea] = await tx<
      [{ responsable_id: string | null; titulo: string }]
    >`
      select responsable_id, titulo from tarea where id = ${tareaId}
    `;
    if (tarea?.responsable_id) {
      await notificarComentario(
        tx,
        tarea.responsable_id,
        tarea.titulo,
        session.user.name ?? "Alguien",
      );
    }
  });
  revalidatePath("/tablero");
}

export async function eliminarComentario(comentarioId: string) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await tx`
      delete from comentario
      where id = ${comentarioId}
        and (autor_id = mi_usuario_id() or mi_rol() = 'administrador')
    `;
  });
  revalidatePath("/tablero");
}

// ── Adjuntos ──────────────────────────────────────────────────────────────────

export type AdjuntoRow = {
  id: string;
  nombre: string;
  tipo: "archivo" | "enlace";
  url: string;
  subido_por_nombre: string;
  creado_en: string;
};

export async function fetchAdjuntos(tareaId: string): Promise<AdjuntoRow[]> {
  const session = await requireAuth();
  return withUser(session.user.id, async (tx) => {
    const rows = await tx<AdjuntoRow[]>`
      select
        a.id,
        a.nombre,
        a.tipo::text as tipo,
        a.url,
        u.nombre as subido_por_nombre,
        a.creado_en::text
      from adjunto a
      join usuario u on u.id = a.subido_por
      where a.tarea_id = ${tareaId}
      order by a.creado_en desc
    `;
    return [...rows];
  });
}

export async function crearAdjunto(
  tareaId: string,
  data: { nombre: string; url: string },
) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await tx`
      insert into adjunto (tarea_id, nombre, tipo, url, subido_por)
      values (${tareaId}, ${data.nombre}, 'enlace'::tipo_adjunto, ${data.url}, mi_usuario_id())
    `;
  });
  revalidatePath("/tablero");
}

export async function eliminarAdjunto(adjuntoId: string) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await tx`
      delete from adjunto
      where id = ${adjuntoId}
        and (subido_por = mi_usuario_id() or mi_rol() = 'administrador')
    `;
  });
  revalidatePath("/tablero");
}

// ── Historial ─────────────────────────────────────────────────────────────────

export type LogRow = {
  id: string;
  campo: string;
  valor_antes: string | null;
  valor_despues: string | null;
  autor_nombre: string | null;
  creado_en: string;
};

export async function fetchTareaLog(tareaId: string): Promise<LogRow[]> {
  const session = await requireAuth();
  return withUser(session.user.id, async (tx) => {
    const rows = await tx<LogRow[]>`
      select
        l.id,
        l.campo,
        l.valor_antes,
        l.valor_despues,
        u.nombre as autor_nombre,
        l.creado_en::text
      from tarea_log l
      left join usuario u on u.id = l.usuario_id
      where l.tarea_id = ${tareaId}
      order by l.creado_en desc
      limit 30
    `;
    return [...rows];
  });
}
