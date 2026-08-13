'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { withUser } from '@/lib/db';
import { notificarAsignacion, notificarComentario } from '@/lib/notificaciones';
import type { TareaCard } from './page';

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error('No autenticado');
  return session;
}

// ── Tarea ─────────────────────────────────────────────────────────────────────

export async function crearTarea(input: {
  titulo: string;
  descripcion: string;
  tipo: string;
  prioridad: string;
  area_id: string;
  responsable_id: string | null;
  fecha_vencimiento: string | null;
  estado: string;
}) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await tx`
      insert into tarea (
        organizacion_id, area_id, titulo, descripcion, tipo, prioridad,
        responsable_id, fecha_vencimiento, estado, creada_por, orden
      )
      values (
        mi_organizacion_id(),
        ${input.area_id},
        ${input.titulo},
        ${input.descripcion || null},
        ${input.tipo}::tipo_tarea,
        ${input.prioridad}::prioridad_tarea,
        ${input.responsable_id || null},
        ${input.fecha_vencimiento || null},
        ${input.estado}::estado_tarea,
        mi_usuario_id(),
        0
      )
    `;
  });
  revalidatePath('/tablero');
  revalidatePath('/hoy');
  revalidatePath('/coordinacion');
}

export async function actualizarTarea(
  tareaId: string,
  data: {
    titulo: string;
    descripcion: string | null;
    tipo: string;
    prioridad: string;
    area_id: string;
    responsable_id: string | null;
    fecha_vencimiento: string | null;
    estado: string;
    duracion_estimada_hs?: number | null;
    duracion_real_hs?: number | null;
  },
  prev?: {
    titulo: string;
    descripcion: string | null;
    tipo: string;
    prioridad: string;
    area_id: string;
    responsable_id: string | null;
    fecha_vencimiento: string | null;
    estado: string;
  },
) {
  const session = await requireAuth();
  const completada_en = data.estado === 'hecha' ? new Date() : null;
  await withUser(session.user.id, async (tx) => {
    await tx`
      update tarea set
        titulo               = ${data.titulo},
        descripcion          = ${data.descripcion},
        tipo                 = ${data.tipo}::tipo_tarea,
        prioridad            = ${data.prioridad}::prioridad_tarea,
        area_id              = ${data.area_id},
        responsable_id       = ${data.responsable_id},
        fecha_vencimiento    = ${data.fecha_vencimiento},
        estado               = ${data.estado}::estado_tarea,
        completada_en        = ${completada_en},
        duracion_estimada_hs = ${data.duracion_estimada_hs ?? null},
        duracion_real_hs     = ${data.duracion_real_hs ?? null}
      where id = ${tareaId}
        and organizacion_id = mi_organizacion_id()
    `;

    // Notificar al nuevo responsable si cambió
    if (prev && data.responsable_id && data.responsable_id !== prev.responsable_id) {
      await notificarAsignacion(tx, data.responsable_id, data.titulo);
    }

    // Registrar cambios en el log
    if (prev) {
      const CAMPOS: { key: keyof NonNullable<typeof prev>; label: string }[] = [
        { key: 'titulo',            label: 'Título' },
        { key: 'estado',            label: 'Estado' },
        { key: 'prioridad',         label: 'Prioridad' },
        { key: 'tipo',              label: 'Tipo' },
        { key: 'responsable_id',    label: 'Responsable' },
        { key: 'fecha_vencimiento', label: 'Vencimiento' },
        { key: 'descripcion',       label: 'Descripción' },
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
  revalidatePath('/tablero');
  revalidatePath('/hoy');
  revalidatePath('/coordinacion');
}

export async function moverEstadoTarea(tareaId: string, estado: string) {
  const session = await requireAuth();
  const completada_en = estado === 'hecha' ? new Date() : null;
  await withUser(session.user.id, async (tx) => {
    await tx`
      update tarea set
        estado        = ${estado}::estado_tarea,
        completada_en = ${completada_en}
      where id = ${tareaId}
        and organizacion_id = mi_organizacion_id()
    `;
    await tx`
      insert into tarea_log (tarea_id, usuario_id, campo, valor_antes, valor_despues)
      select ${tareaId}, mi_usuario_id(), 'Estado', estado::text, ${estado}
      from tarea where id = ${tareaId}
    `;
  });
  revalidatePath('/tablero');
  revalidatePath('/hoy');
  revalidatePath('/coordinacion');
}

export async function archivarTarea(tareaId: string) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await tx`
      update tarea set archivada = true
      where id = ${tareaId}
        and organizacion_id = mi_organizacion_id()
    `;
  });
  revalidatePath('/tablero');
  revalidatePath('/hoy');
  revalidatePath('/coordinacion');
}

export async function restaurarTarea(tareaId: string) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await tx`
      update tarea set archivada = false
      where id = ${tareaId}
        and organizacion_id = mi_organizacion_id()
    `;
  });
  revalidatePath('/tablero');
  revalidatePath('/hoy');
  revalidatePath('/coordinacion');
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
        t.area_id,
        t.responsable_id,
        t.creada_por,
        t.archivada,
        t.duracion_estimada_hs,
        t.duracion_real_hs,
        a.nombre  as area_nombre,
        a.color   as area_color,
        u.nombre  as responsable_nombre,
        coalesce((select count(*)::int from subtarea s where s.tarea_id = t.id), 0)              as subtarea_total,
        coalesce((select count(*)::int from subtarea s where s.tarea_id = t.id and s.hecha), 0)  as subtarea_hecha,
        coalesce((select count(*)::int from comentario c where c.tarea_id = t.id), 0)            as comentario_count
      from tarea t
      left join area    a on a.id = t.area_id
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
    const comentarios = await tx<(Omit<ComentarioRow, 'es_propio'> & { es_propio: boolean })[]>`
      select
        c.id,
        c.contenido,
        u.nombre as autor_nombre,
        c.creado_en::text,
        (c.autor_id = mi_usuario_id()) as es_propio
      from comentario c
      join usuario u on u.id = c.autor_id
      where c.tarea_id = ${tareaId}
      order by c.creado_en asc
    `;
    return {
      subtareas: [...subtareas],
      comentarios: comentarios.map(c => ({ ...c, es_propio: Boolean(c.es_propio) })),
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
  revalidatePath('/tablero');
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
  revalidatePath('/tablero');
  revalidatePath('/hoy');
}

export async function eliminarSubtarea(subtareaId: string) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await tx`delete from subtarea where id = ${subtareaId}`;
  });
  revalidatePath('/tablero');
}

export async function crearComentario(tareaId: string, contenido: string) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await tx`
      insert into comentario (tarea_id, autor_id, contenido)
      values (${tareaId}, mi_usuario_id(), ${contenido})
    `;

    // Notificar al responsable de la tarea si no es el autor
    const [tarea] = await tx<[{ responsable_id: string | null; titulo: string }]>`
      select responsable_id, titulo from tarea where id = ${tareaId}
    `;
    if (tarea?.responsable_id) {
      await notificarComentario(tx, tarea.responsable_id, tarea.titulo, session.user.name ?? 'Alguien');
    }
  });
  revalidatePath('/tablero');
}

export async function eliminarComentario(comentarioId: string) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await tx`
      delete from comentario
      where id = ${comentarioId}
        and (autor_id = mi_usuario_id() or mi_rol() in ('coordinador', 'administrador'))
    `;
  });
  revalidatePath('/tablero');
}

// ── Adjuntos ──────────────────────────────────────────────────────────────────

export type AdjuntoRow = {
  id: string;
  nombre: string;
  tipo: 'archivo' | 'enlace';
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
  revalidatePath('/tablero');
}

export async function eliminarAdjunto(adjuntoId: string) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await tx`
      delete from adjunto
      where id = ${adjuntoId}
        and (subido_por = mi_usuario_id() or mi_rol() in ('coordinador', 'administrador'))
    `;
  });
  revalidatePath('/tablero');
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
