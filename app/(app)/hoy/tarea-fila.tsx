"use client";

import { useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toggleTarea } from "./actions";

type TareaFilaProps = {
  id: string;
  titulo: string;
  estado: string;
  areaColor: string | null;
  vencida: boolean;
};

export function TareaFila({ id, titulo, estado, areaColor, vencida }: TareaFilaProps) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(() => toggleTarea(id, estado));
  }

  return (
    <div className={`flex items-center gap-3 py-2 ${isPending ? "opacity-60" : ""}`}>
      <Checkbox
        checked={estado === "hecha"}
        onCheckedChange={handleToggle}
        disabled={isPending}
      />
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: areaColor ?? "#94a3b8" }}
      />
      <span
        className={`flex-1 text-sm ${estado === "hecha" ? "text-muted-foreground line-through" : ""}`}
      >
        {titulo}
      </span>
      {vencida && (
        <Badge variant="destructive" className="shrink-0">
          Vencida
        </Badge>
      )}
      {estado === "en_progreso" && (
        <Badge variant="secondary" className="shrink-0">
          En progreso
        </Badge>
      )}
    </div>
  );
}
