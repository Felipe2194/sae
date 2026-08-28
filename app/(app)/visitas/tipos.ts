// Constantes compartidas entre server actions y componentes cliente de
// /visitas. Separado de actions.ts porque un archivo "use server" solo puede
// exportar funciones async — estas listas y helpers los necesitan también
// los componentes cliente (dropdowns, formato de fecha/hora).

import type {
  EstadoRelacionColegio,
  EstadoVisita,
  TipoVisita,
} from "@/types/database";

export const TIPOS_VISITA: { value: TipoVisita; label: string }[] = [
  { value: "visita_colegio", label: "Visita a colegio" },
  { value: "nos_visitan", label: "Nos visitan" },
  { value: "feria_expo", label: "Feria/Expo" },
  { value: "charla_taller", label: "Charla/Taller" },
  { value: "virtual", label: "Virtual" },
  { value: "otro", label: "Otro" },
];

export const ESTADOS_VISITA: { value: EstadoVisita; label: string }[] = [
  { value: "pendiente", label: "Pendiente" },
  { value: "confirmado", label: "Confirmado" },
  { value: "realizado", label: "Realizado" },
  { value: "cancelado", label: "Cancelado" },
  { value: "reprogramado", label: "Reprogramado" },
];

// Estados que se sincronizan a Google Calendar (mismo criterio que el Sheet:
// cancelado/reprogramado no aparecen en el Calendar).
export const ESTADOS_VISITA_SINCRONIZABLES: EstadoVisita[] = [
  "pendiente",
  "confirmado",
  "realizado",
];

export const ESTADOS_RELACION_COLEGIO: {
  value: EstadoRelacionColegio;
  label: string;
}[] = [
  { value: "nuevo", label: "Nuevo" },
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
];

// Sugerencias para el campo de cargo del contacto — texto libre (ver
// justificación en db/migrations/030_visitas_colegios.sql), no un enum.
export const CARGOS_CONTACTO_SUGERIDOS = [
  "Profesora",
  "Profesor",
  "Administración",
  "Director",
  "Directora",
  "Preceptor",
  "Preceptora",
  "Otro",
];

export function labelTipoVisita(tipo: TipoVisita): string {
  return TIPOS_VISITA.find((t) => t.value === tipo)?.label ?? tipo;
}

export function labelEstadoVisita(estado: EstadoVisita): string {
  return ESTADOS_VISITA.find((e) => e.value === estado)?.label ?? estado;
}
