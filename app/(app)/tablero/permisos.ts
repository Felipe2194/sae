import type { TareaCard } from "./page";

// Mover una tarea de columna (o marcarla Hecha desde el modal) es más
// restrictivo que editar sus otros campos: hace falta ser responsable,
// co-asignado, administrador, o que la tarea esté "libre" (sin responsable
// ni co-asignados, así que cualquiera puede tomarla). Mismo criterio que
// puedeMoverEstado() en actions.ts — acá se usa solo para la UI (mostrar/
// ocultar); la autorización real la impone el server.
export function puedeMoverEstadoTarea(
  tarea: Pick<TareaCard, "responsable_id" | "asignados">,
  usuarioId: string,
  rol: string,
): boolean {
  if (rol === "administrador") return true;
  const esResponsable = tarea.responsable_id === usuarioId;
  const esAsignado = tarea.asignados.some((a) => a.id === usuarioId);
  const libre = tarea.responsable_id === null && tarea.asignados.length === 0;
  return esResponsable || esAsignado || libre;
}
