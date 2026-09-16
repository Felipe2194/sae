// Tipos compartidos entre page.tsx (fetch de datos, server) e
// informes-cliente.tsx (render con pestañas, client) — separados porque un
// archivo async server component no puede reexportar tipos a un "use client".

export type SemanaTareas = { semana: string; creadas: number; completadas: number };

export type GlobalStats = {
  total: number;
  hecha: number;
  en_progreso: number;
  por_hacer: number;
  vencidas: number;
  hechas_30d: number;
};

export type ResumenArea = {
  id: string;
  nombre: string;
  color: string;
  total: number;
  hecha: number;
  vencidas: number;
  dias_promedio: number | null;
};

export type ResumenPersona = {
  nombre: string;
  total: number;
  hecha: number;
  en_progreso: number;
  por_hacer: number;
  vencidas: number;
  dias_promedio: number | null;
};

export type TareaAntigua = {
  titulo: string;
  area_nombre: string | null;
  area_color: string | null;
  responsable_nombre: string | null;
  dias_abierta: number;
};

export type PrecisionEstimacion = {
  cantidad: number;
  promedio_estimado: number | null;
  promedio_real: number | null;
};

export type ActividadBitacora = { nombre: string; dias_cargados: number };

// Unión de "actividad de bitácora" + "carga por persona": una fila resumen
// por integrante, con el detalle (tareas creadas/asignadas) cargado aparte
// al expandir (ver fetchLogIntegrante en actions.ts) para no traer todo el
// historial de cada persona en la carga inicial de /informes.
export type ActividadIntegrante = {
  id: string;
  nombre: string;
  tareas_creadas: number;
  tareas_asignadas: number;
  asignadas_hecha: number;
  asignadas_en_progreso: number;
  asignadas_por_hacer: number;
  asignadas_vencidas: number;
  dias_bitacora: number;
  comentarios_30d: number;
};

export type LogIntegranteItem = {
  id: string;
  titulo: string;
  estado: string;
  area_nombre: string | null;
  area_color: string | null;
  fecha: string;
  rol: "creada" | "asignada";
};

export type AntiguedadVencidas = {
  b0_7: number;
  b8_14: number;
  b15_30: number;
  b30_mas: number;
};

export type UsoPlantilla = {
  nombre: string;
  area_nombre: string;
  veces_aplicada: number;
  ultima_aplicacion: string | null;
};

export type ActividadComentarios = { nombre: string; comentarios: number };
export type AusenciaPersona = { nombre: string; ausencias: number };
export type UltimoLogin = { nombre: string; rol: string; ultimo_login: string | null };

export type ReporteVisitas = {
  visitas_realizadas: number;
  colegios_visitados: number;
  localidades_alcanzadas: number;
  visitas_pendientes: number;
  visitas_canceladas: number;
  alumnos_alcanzados: number;
  veces_viajamos: number;
  veces_nos_visitaron: number;
  ferias_expos: number;
  charlas_talleres: number;
  virtuales: number;
  otros: number;
};

export type LocalidadVisitas = { ciudad: string; visitas: number; alumnos: number };
export type IntegranteVisitas = { nombre: string; visitas_realizadas: number };

export type ReporteViajes = {
  viajes_activos: number;
  inscriptos_confirmados: number;
  total_recaudado: number;
  total_costos: number;
};

export type ViajeResumenInformes = {
  id: string;
  nombre: string;
  estado: string;
  confirmados: number;
  recaudado: number;
  costos: number;
};
