// Constantes compartidas entre server actions y componentes cliente de
// /viajes. Separado de actions.ts porque un archivo "use server" solo puede
// exportar funciones async (mismo motivo que app/(app)/visitas/tipos.ts).

import type { EstadoIntegranteViaje, EstadoViaje } from "@/types/database";

export const ESTADOS_VIAJE: { value: EstadoViaje; label: string }[] = [
  { value: "borrador", label: "Borrador" },
  { value: "inscripciones_abiertas", label: "Inscripciones abiertas" },
  { value: "inscripciones_cerradas", label: "Inscripciones cerradas" },
  { value: "realizado", label: "Realizado" },
  { value: "cancelado", label: "Cancelado" },
];

export const ESTADOS_INTEGRANTE_VIAJE: { value: EstadoIntegranteViaje; label: string }[] = [
  { value: "pendiente", label: "Pendiente" },
  { value: "confirmado", label: "Confirmado" },
  { value: "lista_espera", label: "Lista de espera" },
  { value: "rechazado", label: "Rechazado" },
  { value: "cancelado", label: "Cancelado" },
];

export function labelEstadoViaje(estado: EstadoViaje): string {
  return ESTADOS_VIAJE.find((e) => e.value === estado)?.label ?? estado;
}

export function labelEstadoIntegranteViaje(estado: EstadoIntegranteViaje): string {
  return ESTADOS_INTEGRANTE_VIAJE.find((e) => e.value === estado)?.label ?? estado;
}
