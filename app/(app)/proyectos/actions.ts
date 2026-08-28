"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");
  return session;
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");
  const rol = (session.user as { rol: string }).rol;
  if (rol !== "administrador") {
    throw new Error("Se requiere rol administrador");
  }
  return session;
}

// Planificar/activar tareas y cargar/borrar fechas importantes: administrador
// o responsable del proyecto (a diferencia del resto de acciones de esta
// página, que siguen admin-only).
async function requirePlanificador(
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
      "Solo el administrador o el responsable del proyecto pueden hacer esto.",
    );
  }
}

async function sincronizarColaboradores(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- transacción de postgres.js
  tx: any,
  areaId: string,
  asignadosIds: string[],
) {
  await tx`delete from area_asignado where area_id = ${areaId}`;
  for (const usuarioId of new Set(asignadosIds)) {
    await tx`
      insert into area_asignado (area_id, usuario_id)
      values (${areaId}, ${usuarioId})
    `;
  }
}

export type TipoArea = "continua" | "evento";
export type CategoriaArea =
  "deportes" | "becas" | "institucional" | "cultura" | "academico" | "general";

export async function crearArea(data: {
  nombre: string;
  descripcion: string;
  color: string;
  tipo: TipoArea;
  categoria: CategoriaArea;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  responsable_id: string | null;
  asignados_ids?: string[];
}) {
  const session = await requireAdmin();
  await withUser(session.user.id, async (tx) => {
    const [{ id }] = await tx<[{ id: string }]>`
      insert into area (
        organizacion_id, nombre, descripcion, color, tipo, categoria,
        fecha_inicio, fecha_fin, responsable_id
      )
      values (
        mi_organizacion_id(), ${data.nombre}, ${data.descripcion || null}, ${data.color},
        ${data.tipo}::tipo_area, ${data.categoria}::categoria_area,
        ${data.tipo === "evento" ? data.fecha_inicio : null},
        ${data.tipo === "evento" ? data.fecha_fin : null},
        ${data.responsable_id}
      )
      returning id
    `;
    await sincronizarColaboradores(tx, id, data.asignados_ids ?? []);
  });
  revalidatePath("/proyectos");
  revalidatePath("/informes");
}

// ── Notas de área ─────────────────────────────────────────────────────────────

export async function crearNota(
  areaId: string,
  contenido: string,
  tipo: "nota" | "idea" | "actividad" | "progreso",
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
  revalidatePath(`/proyectos/${areaId}`);
}

export async function eliminarNota(notaId: string, areaId: string) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await tx`
      delete from nota_area
      where id = ${notaId}
    `;
  });
  revalidatePath(`/proyectos/${areaId}`);
}

// ── Documentos compartidos del área ─────────────────────────────────────────
// Reusa acceso_rapido (ya tenía area_id, sin usar hasta ahora — los de
// /configuracion siempre quedan con area_id null). Mismas políticas RLS, mismo
// criterio de permisos que /configuracion: administrador arma la lista.

export async function crearAccesoArea(
  areaId: string,
  etiqueta: string,
  url: string,
): Promise<{ id: string } | null> {
  const session = await requireAdmin();
  const etiquetaLimpia = etiqueta.trim();
  const urlLimpia = url.trim();
  if (!etiquetaLimpia || !urlLimpia) return null;
  const { id } = await withUser(session.user.id, async (tx) => {
    const [{ max_orden }] = await tx<[{ max_orden: number | null }]>`
      select max(orden) as max_orden from acceso_rapido where area_id = ${areaId}
    `;
    const [{ id }] = await tx<[{ id: string }]>`
      insert into acceso_rapido (organizacion_id, area_id, etiqueta, url, orden)
      values (mi_organizacion_id(), ${areaId}, ${etiquetaLimpia}, ${urlLimpia}, ${(max_orden ?? -1) + 1})
      returning id
    `;
    return { id };
  });
  revalidatePath(`/proyectos/${areaId}`);
  return { id };
}

export async function eliminarAccesoArea(accesoId: string, areaId: string) {
  const session = await requireAdmin();
  await withUser(session.user.id, async (tx) => {
    await tx`
      delete from acceso_rapido
      where id = ${accesoId}
        and area_id = ${areaId}
        and organizacion_id = mi_organizacion_id()
    `;
  });
  revalidatePath(`/proyectos/${areaId}`);
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
  const session = await requireAdmin();
  await withUser(session.user.id, async (tx) => {
    const [area] = await tx<[{ nombre: string } | undefined]>`
      select nombre from area where id = ${areaId} and organizacion_id = mi_organizacion_id()
    `;
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
    if (area) {
      await tx`
        insert into auditoria (organizacion_id, usuario_id, entidad, entidad_id, entidad_nombre, campo, valor_antes, valor_despues)
        values (mi_organizacion_id(), mi_usuario_id(), 'area', ${areaId}, ${area.nombre}, 'estado', 'activa', 'archivada')
      `;
    }
  });
  revalidatePath("/proyectos");
  revalidatePath(`/proyectos/${areaId}`);
  revalidatePath("/tablero");
  revalidatePath("/informes");
}

export type TareaCierreRow = { id: string; titulo: string };

// Tareas que se archivaron junto con el área la última vez que se cerró —
// para sugerirlas al reactivar el área una temporada nueva ("¿repetimos
// estas o arrancamos en blanco?"). Si el área nunca se cerró con este
// mecanismo (o se archivó con la versión vieja de archivarArea, antes de
// esta migración), area.archivada_en es null y esto devuelve vacío — la
// UI de reactivar, en ese caso, no ofrece nada para elegir.
export async function fetchTareasCierre(
  areaId: string,
): Promise<TareaCierreRow[]> {
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
export async function reactivarArea(
  areaId: string,
  titulosNuevos: string[] = [],
) {
  const session = await requireAdmin();
  await withUser(session.user.id, async (tx) => {
    const [area] = await tx<[{ nombre: string } | undefined]>`
      select nombre from area where id = ${areaId} and organizacion_id = mi_organizacion_id()
    `;
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
    if (area) {
      await tx`
        insert into auditoria (organizacion_id, usuario_id, entidad, entidad_id, entidad_nombre, campo, valor_antes, valor_despues)
        values (mi_organizacion_id(), mi_usuario_id(), 'area', ${areaId}, ${area.nombre}, 'estado', 'archivada', 'activa')
      `;
    }
  });
  revalidatePath("/proyectos");
  revalidatePath(`/proyectos/${areaId}`);
  revalidatePath("/tablero");
  revalidatePath("/informes");
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
  const session = await requireAdmin();
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
  revalidatePath(`/proyectos/${areaId}`);
  return { id: plantilla.id, nombre: nombre.trim(), items: titulos };
}

export async function eliminarPlantilla(plantillaId: string, areaId: string) {
  const session = await requireAdmin();
  await withUser(session.user.id, async (tx) => {
    await tx`delete from plantilla_area where id = ${plantillaId}`;
  });
  revalidatePath(`/proyectos/${areaId}`);
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
  revalidatePath(`/proyectos/${areaId}`);
  revalidatePath("/tablero");
  revalidatePath("/informes");
}

export async function fetchAreasArchivadas(): Promise<AreaArchivadaRow[]> {
  const session = await requireAdmin();
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
    tipo: TipoArea;
    categoria: CategoriaArea;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    responsable_id: string | null;
    asignados_ids?: string[];
  },
) {
  const session = await requireAdmin();
  await withUser(session.user.id, async (tx) => {
    const [antes] = await tx<[{ nombre: string; responsable_id: string | null } | undefined]>`
      select nombre, responsable_id from area
      where id = ${areaId} and organizacion_id = mi_organizacion_id()
    `;
    await tx`
      update area set
        nombre         = ${data.nombre},
        descripcion    = ${data.descripcion},
        color          = ${data.color},
        tipo           = ${data.tipo}::tipo_area,
        categoria      = ${data.categoria}::categoria_area,
        fecha_inicio   = ${data.tipo === "evento" ? data.fecha_inicio : null},
        fecha_fin      = ${data.tipo === "evento" ? data.fecha_fin : null},
        responsable_id = ${data.responsable_id}
      where id = ${areaId}
        and organizacion_id = mi_organizacion_id()
    `;
    if (data.asignados_ids !== undefined) {
      await sincronizarColaboradores(tx, areaId, data.asignados_ids);
    }
    if (antes && antes.responsable_id !== data.responsable_id) {
      const nombres = await tx<{ id: string; nombre: string }[]>`
        select id, nombre from usuario
        where id = any(${[antes.responsable_id, data.responsable_id].filter((x): x is string => x !== null)}::uuid[])
      `;
      const nombreDe = (id: string | null) =>
        id ? (nombres.find((n) => n.id === id)?.nombre ?? null) : null;
      await tx`
        insert into auditoria (organizacion_id, usuario_id, entidad, entidad_id, entidad_nombre, campo, valor_antes, valor_despues)
        values (
          mi_organizacion_id(), mi_usuario_id(), 'area', ${areaId}, ${data.nombre},
          'responsable', ${nombreDe(antes.responsable_id)}, ${nombreDe(data.responsable_id)}
        )
      `;
    }
  });
  revalidatePath("/proyectos");
  revalidatePath(`/proyectos/${areaId}`);
  revalidatePath("/informes");
}

// ── Tareas planificadas ──────────────────────────────────────────────────────
// Se cargan con activa=false: invisibles en el Tablero y en toda métrica
// (/hoy, /informes, /configuracion) hasta que se activan. Reusan subtarea (tabla y
// acciones de tablero/actions.ts) tal cual — son genéricas por tarea_id.

export type TareaPlanificadaInput = {
  titulo: string;
  descripcion: string;
  tipo: string;
  prioridad: string;
  responsable_id: string | null;
  fecha_vencimiento: string | null;
};

export async function crearTareaPlanificada(
  areaId: string,
  data: TareaPlanificadaInput,
): Promise<{ id: string }> {
  const session = await requireAuth();
  const resultado = await withUser(session.user.id, async (tx) => {
    await requirePlanificador(tx, areaId, session);
    const [{ id }] = await tx<[{ id: string }]>`
      insert into tarea (
        organizacion_id, area_id, titulo, descripcion, tipo, prioridad,
        responsable_id, fecha_vencimiento, estado, activa, creada_por, orden
      )
      values (
        mi_organizacion_id(), ${areaId}, ${data.titulo}, ${data.descripcion || null},
        ${data.tipo}::tipo_tarea, ${data.prioridad}::prioridad_tarea,
        ${data.responsable_id}, ${data.fecha_vencimiento}, 'por_hacer', false,
        mi_usuario_id(), 0
      )
      returning id
    `;
    return { id };
  });
  revalidatePath(`/proyectos/${areaId}`);
  return resultado;
}

export async function actualizarTareaPlanificada(
  tareaId: string,
  areaId: string,
  data: TareaPlanificadaInput,
) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await requirePlanificador(tx, areaId, session);
    await tx`
      update tarea set
        titulo            = ${data.titulo},
        descripcion       = ${data.descripcion || null},
        tipo              = ${data.tipo}::tipo_tarea,
        prioridad         = ${data.prioridad}::prioridad_tarea,
        responsable_id    = ${data.responsable_id},
        fecha_vencimiento = ${data.fecha_vencimiento}
      where id = ${tareaId} and area_id = ${areaId} and activa = false
    `;
  });
  revalidatePath(`/proyectos/${areaId}`);
}

export async function activarTarea(tareaId: string, areaId: string) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await requirePlanificador(tx, areaId, session);
    await tx`
      update tarea set activa = true
      where id = ${tareaId} and area_id = ${areaId} and activa = false
    `;
  });
  revalidatePath(`/proyectos/${areaId}`);
  revalidatePath("/tablero");
  revalidatePath("/hoy");
  revalidatePath("/informes");
}

// "Descartar" un borrador: reusa el campo archivada ya existente, sin sumar
// un estado nuevo.
export async function archivarTareaPlanificada(
  tareaId: string,
  areaId: string,
) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await requirePlanificador(tx, areaId, session);
    await tx`
      update tarea set archivada = true
      where id = ${tareaId} and area_id = ${areaId} and activa = false
    `;
  });
  revalidatePath(`/proyectos/${areaId}`);
  revalidatePath("/tablero");
  revalidatePath("/hoy");
  revalidatePath("/informes");
}

// ── Fechas importantes manuales (hito_area) ──────────────────────────────────
// "Fechas importantes" del proyecto era 100% derivado de tarea.fecha_vencimiento
// — esto suma hitos propios (fecha + título) que no dependen de ninguna tarea.

export async function crearHitoArea(
  areaId: string,
  titulo: string,
  fecha: string,
): Promise<{ id: string } | null> {
  const session = await requireAuth();
  const tituloLimpio = titulo.trim();
  if (!tituloLimpio || !fecha) return null;
  const { id } = await withUser(session.user.id, async (tx) => {
    await requirePlanificador(tx, areaId, session);
    const [{ id }] = await tx<[{ id: string }]>`
      insert into hito_area (area_id, titulo, fecha, creado_por)
      values (${areaId}, ${tituloLimpio}, ${fecha}, mi_usuario_id())
      returning id
    `;
    return { id };
  });
  revalidatePath(`/proyectos/${areaId}`);
  return { id };
}

export async function eliminarHitoArea(hitoId: string, areaId: string) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await requirePlanificador(tx, areaId, session);
    await tx`delete from hito_area where id = ${hitoId} and area_id = ${areaId}`;
  });
  revalidatePath(`/proyectos/${areaId}`);
}
