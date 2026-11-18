// Tipos y constantes del módulo Becas, compartidos entre la página (server),
// las server actions y los componentes cliente. Vive en lib/ (y sin
// "use client") a propósito: un helper exportado desde un archivo cliente y
// llamado desde un Server Component rompe en producción.

export type OrigenPrograma = "nacional" | "facultad" | "externa";
export type EstadoAsignacion = "activa" | "rechazada" | "baja";
export type EstadoEntrega = "pendiente" | "recibida" | "observada";
export type ACargoEntrega = "becario" | "tutor";

export type Programa = {
  id: string;
  nombre: string;
  origen: OrigenPrograma;
  horas_por_modulo: number | null;
  activo: boolean;
};

// Par no ordenado de programas incompatibles (ver beca_incompatibilidad).
export type Incompatibilidad = { programa_a: string; programa_b: string };

export type Area = {
  id: string;
  anio: number;
  departamento: string | null;
  nombre: string;
  tipo: string | null;
  tutor_nombre: string | null;
  tutor_email: string | null;
  tutor_telefono: string | null;
  modulos_cupo: number | null;
  perfil: string | null;
};

export type Estudiante = {
  id: string;
  dni: string;
  apellido: string;
  nombre: string;
  legajo: string | null;
  carrera: string | null;
  email: string | null;
  telefono: string | null;
  notas: string | null;
};

export type Asignacion = {
  id: string;
  estudiante_id: string;
  programa_id: string;
  anio: number;
  condicion: string | null;
  estado: EstadoAsignacion;
  area_id: string | null;
  modulos: number | null;
  observaciones: string | null;
};

export type Entrega = {
  id: string;
  programa_id: string;
  anio: number;
  nombre: string;
  vence_el: string | null;
  a_cargo: ACargoEntrega;
};

export type EntregaMarcada = {
  asignacion_id: string;
  entrega_id: string;
  estado: Exclude<EstadoEntrega, "pendiente">;
  observacion: string | null;
};

// Una fila del historial de un estudiante (todas sus becas, todos los años).
export type HistorialBeca = {
  id: string;
  anio: number;
  programa: string;
  condicion: string | null;
  estado: EstadoAsignacion;
  area: string | null;
  tutor: string | null;
  modulos: number | null;
  observaciones: string | null;
};

export const ORIGENES: { value: OrigenPrograma; label: string; ayuda: string }[] = [
  { value: "nacional", label: "Nacional", ayuda: "La otorga Nación; acá solo se lleva el padrón." },
  { value: "facultad", label: "De la facultad", ayuda: "La otorga la facultad; puede tener entregas." },
  { value: "externa", label: "Externa", ayuda: "Solo para marcar que la tiene y controlar incompatibilidades." },
];

export const ESTADOS_ASIGNACION: { value: EstadoAsignacion; label: string }[] = [
  { value: "activa", label: "Activa" },
  { value: "rechazada", label: "Rechazada" },
  { value: "baja", label: "Baja" },
];

export function labelEstadoAsignacion(estado: EstadoAsignacion): string {
  return ESTADOS_ASIGNACION.find((e) => e.value === estado)?.label ?? estado;
}

export function labelOrigen(origen: OrigenPrograma): string {
  return ORIGENES.find((o) => o.value === origen)?.label ?? origen;
}

// "Apellido, Nombre" — o solo el apellido cuando el listado traía todo junto
// en una sola columna y no se pudo separar.
export function nombreCompleto(e: { apellido: string; nombre: string }): string {
  return e.nombre ? `${e.apellido}, ${e.nombre}` : e.apellido;
}

// Programas sugeridos para arrancar (los de la UTN FRVM en 2025). Manuel
// Belgrano es incompatible con las otras tres; todo queda editable después.
export const PROGRAMAS_SUGERIDOS: {
  nombre: string;
  origen: OrigenPrograma;
  horas_por_modulo: number | null;
}[] = [
  { nombre: "Manuel Belgrano", origen: "nacional", horas_por_modulo: 5 },
  { nombre: "Investigación y Servicio", origen: "facultad", horas_por_modulo: 6 },
  { nombre: "BASE", origen: "facultad", horas_por_modulo: null },
  { nombre: "Progresar", origen: "externa", horas_por_modulo: null },
];

export const INCOMPATIBILIDADES_SUGERIDAS: [string, string][] = [
  ["Manuel Belgrano", "Investigación y Servicio"],
  ["Manuel Belgrano", "BASE"],
  ["Manuel Belgrano", "Progresar"],
];
