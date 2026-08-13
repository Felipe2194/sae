"use client";

import { ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TareaCard } from "./page";

export function TareaArchivadaFila({
  tarea,
  onAbrir,
  onRestaurar,
}: {
  tarea: TareaCard;
  onAbrir: () => void;
  onRestaurar: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: tarea.area_color ?? "#94a3b8" }}
      />
      <button
        onClick={onAbrir}
        className="min-w-0 flex-1 truncate text-left text-sm hover:underline"
      >
        {tarea.titulo}
      </button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 shrink-0 text-xs"
        onClick={(e) => {
          e.stopPropagation();
          onRestaurar();
        }}
      >
        <ArchiveRestore className="size-3.5" />
        Restaurar
      </Button>
    </div>
  );
}
