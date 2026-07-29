'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { withUser } from '@/lib/db';

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
  },
) {
  const session = await requireAuth();
  const completada_en = data.estado === 'hecha' ? new Date() : null;
  await withUser(session.user.id, async (tx) => {
    await tx`
      update tarea set
        titulo            = ${data.titulo},
        descripcion       = ${data.descripcion},
        tipo              = ${data.tipo}::tipo_tarea,
        prioridad         = ${data.prioridad}::prioridad_tarea,
        area_id           = ${data.area_id},
        responsable_id    = ${data.responsable_id},
        fecha_vencimiento = ${data.fecha_vencimiento},
        estado            = ${data.estado}::estado_tarea,
        completada_en     = ${completada_en}
      where id = ${tareaId}
        and organizacion_id = mi_organizacion_id()
    `;
  });
  revalidatePath('/tablero');
  revalidatePath('/hoy');
  revalidatePath('/coordinacion');
}

export async function eliminarTarea(tareaId: string) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await tx`
      delete from tarea
      where id = ${tareaId}
        and organizacion_id = mi_organizacion_id()
    `;
  });
  revalidatePath('/tablero');
  revalidatePath('/hoy');
  revalidatePath('/coordinacion');
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
  await withUser(session.user.id, async (tx) => {
    await tx`update subtarea set hecha = ${hecha} where id = ${subtareaId}`;
  });
  revalidatePath('/tablero');
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
