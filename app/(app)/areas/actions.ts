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

export async function crearArea(data: {
  nombre: string;
  descripcion: string;
  color: string;
  responsable_id: string | null;
}) {
  const session = await requireCoord();
  await withUser(session.user.id, async (tx) => {
    await tx`
      insert into area (organizacion_id, nombre, descripcion, color, responsable_id)
      values (mi_organizacion_id(), ${data.nombre}, ${data.descripcion || null}, ${data.color}, ${data.responsable_id})
    `;
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

export async function archivarArea(areaId: string) {
  const session = await requireCoord();
  await withUser(session.user.id, async (tx) => {
    await tx`
      update area set activa = false
      where id = ${areaId} and organizacion_id = mi_organizacion_id()
    `;
  });
  revalidatePath('/areas');
  revalidatePath(`/areas/${areaId}`);
  revalidatePath('/coordinacion');
}

export async function reactivarArea(areaId: string) {
  const session = await requireCoord();
  await withUser(session.user.id, async (tx) => {
    await tx`
      update area set activa = true
      where id = ${areaId} and organizacion_id = mi_organizacion_id()
    `;
  });
  revalidatePath('/areas');
  revalidatePath(`/areas/${areaId}`);
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
  });
  revalidatePath('/areas');
  revalidatePath(`/areas/${areaId}`);
  revalidatePath('/coordinacion');
}
