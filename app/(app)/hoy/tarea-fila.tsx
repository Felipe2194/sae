"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { CalendarDays, Users } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toggleTarea } from "./actions";

const TIPO_LABEL: Record<string, string> = {
  evento: "Evento",
  entrega: "Entrega",
  reunion: "Reunión",
};

const PRIORIDAD_COLOR: Record<string, string> = {
  baja: "bg-slate-300",
  media: "bg-amber-400",
  alta: "bg-red-500",
};

type TareaFilaProps = {
  id: string;
  titulo: string;
  estado: string;
  prioridad: string;
  tipo: string;
  areaColor: string | null;
  areaNombre: string | null;
  fecha: string | null;
  fechaRelativa: string | null;
  vencida: boolean;
  paraTodos?: boolean;
};

export function TareaFila({
  id,
  titulo,
  estado,
  prioridad,
  tipo,
  areaColor,
  areaNombre,
  fechaRelativa,
  vencida,
  paraTodos,
}: TareaFilaProps) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      try {
        await toggleTarea(id, estado);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "No se pudo actualizar la tarea.",
        );
      }
    });
  }

  const hecha = estado === "hecha";

  return (
    <div
      className={`flex items-start gap-3 py-2.5 transition-opacity ${isPending ? "opacity-50" : ""}`}
    >
      <Checkbox
        checked={hecha}
        onCheckedChange={handleToggle}
        disabled={isPending}
        className="mt-0.5 shrink-0"
      />

      <div className="flex-1 min-w-0">
        <p
          className={`text-sm leading-snug ${hecha ? "text-muted-foreground line-through" : "font-medium"}`}
        >
          {titulo}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className={`size-1.5 rounded-full shrink-0 ${PRIORIDAD_COLOR[prioridad] ?? "bg-slate-300"}`}
          />
          {areaNombre && (
            <span className="text-xs text-muted-foreground truncate">
              {areaNombre}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {paraTodos && (
          <Badge
            variant="outline"
            className="text-[11px] px-1.5 py-0 font-normal gap-1"
            title="Tarea para todo el equipo — la puede tomar cualquiera"
          >
            <Users className="size-3" />
            Compartida
          </Badge>
        )}
        {TIPO_LABEL[tipo] && (
          <Badge variant="outline" className="text-[11px] px-1.5 py-0 font-normal">
            {TIPO_LABEL[tipo]}
          </Badge>
        )}
        {fechaRelativa && (
          <span
            className={`flex items-center gap-1 text-[12px] ${
              vencida ? "text-destructive font-medium" : "text-muted-foreground"
            }`}
          >
            <CalendarDays className="size-3" />
            {fechaRelativa}
          </span>
        )}
      </div>
    </div>
  );
}
