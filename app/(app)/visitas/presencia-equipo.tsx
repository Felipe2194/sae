import { UserAvatar } from "@/components/features/user-avatar";
import type { PresenciaFila } from "./page";

// Equivalente a la sección "👥 Presencia del equipo" de la hoja Resumen del
// Sheet — acá solo con datos de visitas (Viajes y Eventos queda para una
// etapa posterior). Visible para todo el equipo, no solo administradores.
export function PresenciaEquipo({ presencia }: { presencia: PresenciaFila[] }) {
  const conRealizadas = presencia.filter((p) => p.visitas_realizadas > 0);
  if (conRealizadas.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Todavía no hay visitas realizadas con integrantes asignados este año.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {conRealizadas.map((p) => (
        <div
          key={p.usuario_id}
          className="bg-muted/30 flex items-center gap-2 rounded-lg border px-3 py-2"
        >
          <UserAvatar nombre={p.nombre} avatarColor={p.avatar_color} size="sm" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium">{p.nombre}</p>
            <p className="text-muted-foreground text-xs">
              {p.visitas_realizadas} realizada{p.visitas_realizadas !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
