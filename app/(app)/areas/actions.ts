'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { withUser } from '@/lib/db';

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error('No autenticado');
  return session;
}

async function requireCoord() {
  const session = await auth();
  if (!session?.user) throw new Error('No autenticado');
  const rol = (session.user as { rol: string }).rol;
  if (rol !== 'coordinador' && rol !== 'administrador') {
    throw new Error('Se requiere rol coordinador o administrador');
  }
  return session;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- transacción de postgres.js
async function sincronizarColaboradores(tx: any, areaId: string, asignadosIds: string[]) {
  await tx`delete from area_asignado where area_id = ${areaId}`;
  for (const usuarioId of new Set(asignadosIds)) {
    await tx`
      insert into area_asignado (area_id, usuario_id)
      values (${areaId}, ${usuarioId})
    `;
  }
}

export async function crearArea(data: {
  nombre: string;
  descripcion: string;
  color: string;
  responsable_id: string | null;
  asignados_ids?: string[];
}) {
  const session = await requireCoord();
  await withUser(session.user.id, async (tx) => {
    const [{ id }] = await tx<[{ id: string }]>`
      insert into area (organizacion_id, nombre, descripcion, color, responsable_id)
      values (mi_organizacion_id(), ${data.nombre}, ${data.descripcion || null}, ${data.color}, ${data.responsable_id})
      returning id
    `;
    await sincronizarColaboradores(tx, id, data.asignados_ids ?? []);
  });
  revalidatePath('/areas');
  revalidatePath('/coordinacion');
}

// ── Notas de área ─────────────────────────────────────────────────────────────

export async function crearNota(
  areaId: string,
  contenido: string,
  tipo: 'nota' | 'idea' | 'actividad' | 'progreso',
) {
  const session = await requireAuth();
  const texto = contenido.trim();
  if (!texto) return;
  await withUser(session.user.id, async (tx) => {
    await tx`
      insert into nota_area (area_id, autor_id, contenido, tipo)
      values (${areaId}, mi_usuario_id(), ${texto}, ${tipo}::tipo_nota_area)
    `;
  });
  revalidatePath(`/areas/${areaId}`);
}

export async function eliminarNota(notaId: string, areaId: string) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await tx`
      delete from nota_area
      where id = ${notaId}
    `;
  });
  revalidatePath(`/areas/${areaId}`);
}

export type AreaArchivadaRow = {
  id: string;
  nombre: string;
  color: string;
  descripcion: string | null;
};

// Cierre de temporada: archivar un área archiva con ella (no borra) sus
// tareas que no estén ya 'hecha' — si no, quedaban huérfanas viviendo en el
// tablero activo sin ningún indicio de que su área ya se había cerrado.
// area.archivada_en y las tarea.archivada_en de este cierre quedan con el
// mismo now() de esta transacción — eso es lo que permite después ofrecerlas
// como sugerencia puntual de "esto se cerró la última vez" al reactivar
// (ver fetchTareasCierre), sin mezclarlas con archivados de otro momento.
export async function archivarArea(areaId: string) {
  const session = await requireCoord();
  await withUser(session.user.id, async (tx) => {
    await tx`
      update area set activa = false, archivada_en = now()
      where id = ${areaId} and organizacion_id = mi_organizacion_id()
    `;
    await tx`
      update tarea set archivada = true, archivada_en = now()
      where area_id = ${areaId}
        and organizacion_id = mi_organizacion_id()
        and archivada = false
        and estado != 'hecha'
    `;
  });
  revalidatePath('/areas');
  revalidatePath(`/areas/${areaId}`);
  revalidatePath('/tablero');
  revalidatePath('/coordinacion');
}

export type TareaCierreRow = { id: string; titulo: string };

// Tareas que se archivaron junto con el área la última vez que se cerró —
// para sugerirlas al reactivar el área una temporada nueva ("¿repetimos
// estas o arrancamos en blanco?"). Si el área nunca se cerró con este
// mecanismo (o se archivó con la versión vieja de archivarArea, antes de
// esta migración), area.archivada_en es null y esto devuelve vacío — la
// UI de reactivar, en ese caso, no ofrece nada para elegir.
export async function fetchTareasCierre(areaId: string): Promise<TareaCierreRow[]> {
  const session = await requireAuth();
  return withUser(session.user.id, async (tx) => {
    const rows = await tx<TareaCierreRow[]>`
      select t.id, t.titulo
      from tarea t
      join area a on a.id = t.area_id
      where t.area_id = ${areaId}
        and t.organizacion_id = mi_organizacion_id()
        and t.archivada = true
        and a.archivada_en is not null
        and t.archivada_en = a.archivada_en
      order by t.orden asc, t.creada_en asc
    `;
    return [...rows];
  });
}

// titulosNuevos: los títulos elegidos de fetchTareasCierre() para recrear
// como tareas frescas en 'por_hacer' al reactivar — vacío si se eligió
// arrancar la temporada en blanco.
export async function reactivarArea(areaId: string, titulosNuevos: string[] = []) {
  const session = await requireCoord();
  await withUser(session.user.id, async (tx) => {
    await tx`
      update area set activa = true
      where id = ${areaId} and organizacion_id = mi_organizacion_id()
    `;
    for (const titulo of titulosNuevos) {
      if (!titulo.trim()) continue;
      await tx`
        insert into tarea (organizacion_id, area_id, titulo, creada_por, orden)
        values (mi_organizacion_id(), ${areaId}, ${titulo.trim()}, mi_usuario_id(), 0)
      `;
    }
  });
  revalidatePath('/areas');
  revalidatePath(`/areas/${areaId}`);
  revalidatePath('/tablero');
  revalidatePath('/coordinacion');
}

// ── Plantillas de tareas ─────────────────────────────────────────────────────
// Un nombre + una lista de títulos de tarea. "Aplicar" clona esos títulos como
// tareas reales en estado 'por_hacer' — útil para procesos que se repiten
// (inscripción a becas, torneos, campañas de salud).

export type PlantillaRow = {
  id: string;
  nombre: string;
  items: string[];
};

export async function fetchPlantillas(areaId: string): Promise<PlantillaRow[]> {
  const session = await requireAuth();
  return withUser(session.user.id, async (tx) => {
    const rows = await tx<PlantillaRow[]>`
      select
        p.id,
        p.nombre,
        coalesce(
          json_agg(pi.titulo order by pi.orden) filter (where pi.id is not null),
          '[]'
        ) as items
      from plantilla_area p
      left join plantilla_item pi on pi.plantilla_id = p.id
      where p.area_id = ${areaId}
      group by p.id, p.nombre, p.creada_en
      order by p.creada_en desc
    `;
    return [...rows];
  });
}

export async function crearPlantilla(
  areaId: string,
  nombre: string,
  items: string[],
): Promise<PlantillaRow | null> {
  const session = await requireCoord();
  const titulos = items.map((t) => t.trim()).filter(Boolean);
  if (!nombre.trim() || titulos.length === 0) return null;

  const plantilla = await withUser(session.user.id, async (tx) => {
    const [plantilla] = await tx<[{ id: string }]>`
      insert into plantilla_area (organizacion_id, area_id, nombre, creada_por)
      values (mi_organizacion_id(), ${areaId}, ${nombre.trim()}, mi_usuario_id())
      returning id
    `;
    for (let i = 0; i < titulos.length; i++) {
      await tx`
        insert into plantilla_item (plantilla_id, titulo, orden)
        values (${plantilla.id}, ${titulos[i]}, ${i})
      `;
    }
    return plantilla;
  });
  revalidatePath(`/areas/${areaId}`);
  return { id: plantilla.id, nombre: nombre.trim(), items: titulos };
}

export async function eliminarPlantilla(plantillaId: string, areaId: string) {
  const session = await requireCoord();
  await withUser(session.user.id, async (tx) => {
    await tx`delete from plantilla_area where id = ${plantillaId}`;
  });
  revalidatePath(`/areas/${areaId}`);
}

export async function aplicarPlantilla(plantillaId: string, areaId: string) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    const items = await tx<{ titulo: string }[]>`
      select titulo from plantilla_item
      where plantilla_id = ${plantillaId}
      order by orden asc
    `;
    for (const item of items) {
      await tx`
        insert into tarea (organizacion_id, area_id, titulo, creada_por, orden)
        values (mi_organizacion_id(), ${areaId}, ${item.titulo}, mi_usuario_id(), 0)
      `;
    }
    await tx`
      update plantilla_area
      set veces_aplicada = veces_aplicada + 1, ultima_aplicacion = now()
      where id = ${plantillaId}
    `;
  });
  revalidatePath(`/areas/${areaId}`);
  revalidatePath('/tablero');
  revalidatePath('/coordinacion');
}

export async function fetchAreasArchivadas(): Promise<AreaArchivadaRow[]> {
  const session = await requireCoord();
  return withUser(session.user.id, async (tx) => {
    const rows = await tx<AreaArchivadaRow[]>`
      select id, nombre, color, descripcion
      from area
      where organizacion_id = mi_organizacion_id() and activa = false
      order by nombre asc
    `;
    return [...rows];
  });
}

export async function actualizarArea(
  areaId: string,
  data: {
    nombre: string;
    descripcion: string | null;
    color: string;
    responsable_id: string | null;
    asignados_ids?: string[];
  },
) {
  const session = await requireCoord();
  await withUser(session.user.id, async (tx) => {
    await tx`
      update area set
        nombre        = ${data.nombre},
        descripcion   = ${data.descripcion},
        color         = ${data.color},
        responsable_id = ${data.responsable_id}
      where id = ${areaId}
        and organizacion_id = mi_organizacion_id()
    `;
    if (data.asignados_ids !== undefined) {
      await sincronizarColaboradores(tx, areaId, data.asignados_ids);
    }
  });
  revalidatePath('/areas');
  revalidatePath(`/areas/${areaId}`);
  revalidatePath('/coordinacion');
}
