import { CalendarDays, MessageSquare, CheckSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { TareaCard } from "./page";

const TIPO_LABEL: Record<string, string> = {
  tarea: "Tarea",
  evento: "Evento",
  entrega: "Entrega",
  reunion: "Reunión",
};

const PRIORIDAD_COLOR: Record<string, string> = {
  baja: "bg-slate-300",
  media: "bg-amber-400",
  alta: "bg-red-500",
};

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function TareaCardItem({
  tarea,
  onClick,
}: {
  tarea: TareaCard;
  onClick: () => void;
}) {
  const estaVencida =
    tarea.fecha_vencimiento &&
    tarea.estado !== "hecha" &&
    new Date(tarea.fecha_vencimiento + "T00:00:00") < new Date();

  return (
    <Card
      className="cursor-pointer gap-0 py-0 hover:shadow-md transition-shadow select-none"
      onClick={onClick}
    >
      <CardContent className="flex flex-col gap-2 p-3">
        {/* Área + tipo */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: tarea.area_color ?? "#94a3b8" }}
            />
            <span className="text-muted-foreground text-xs truncate">
              {tarea.area_nombre}
            </span>
          </div>
          {tarea.tipo !== "tarea" && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
              {TIPO_LABEL[tarea.tipo] ?? tarea.tipo}
            </Badge>
          )}
        </div>

        {/* Título + prioridad dot */}
        <div className="flex items-start gap-2">
          <span
            className={`mt-[5px] size-2 shrink-0 rounded-full ${PRIORIDAD_COLOR[tarea.prioridad] ?? "bg-slate-300"}`}
          />
          <p className="text-sm leading-snug font-medium">{tarea.titulo}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-2.5">
            {tarea.fecha_vencimiento && (
              <span
                className={`flex items-center gap-1 text-[11px] ${
                  estaVencida
                    ? "text-destructive font-medium"
                    : "text-muted-foreground"
                }`}
              >
                <CalendarDays className="size-3" />
                {new Date(
                  tarea.fecha_vencimiento + "T00:00:00",
                ).toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "2-digit",
                })}
              </span>
            )}
            {tarea.subtarea_total > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <CheckSquare className="size-3" />
                {tarea.subtarea_hecha}/{tarea.subtarea_total}
              </span>
            )}
            {tarea.comentario_count > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <MessageSquare className="size-3" />
                {tarea.comentario_count}
              </span>
            )}
          </div>
          {tarea.responsable_nombre && (
            <Avatar className="size-5 shrink-0">
              <AvatarFallback className="text-[9px] font-semibold bg-[oklch(0.62_0.19_42)] text-white">
                {iniciales(tarea.responsable_nombre)}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
