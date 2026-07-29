"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TareaCardItem } from "./tarea-card";
import { NuevaTareaDialog } from "./nueva-tarea-dialog";
import { TareaSheet } from "./tarea-sheet";
import type { TareaCard, AreaOption, UsuarioOption } from "./page";

const COLUMNAS = [
  { estado: "por_hacer", titulo: "Por hacer" },
  { estado: "en_progreso", titulo: "En progreso" },
  { estado: "hecha", titulo: "Hecha" },
] as const;

type Props = {
  tareas: TareaCard[];
  areas: AreaOption[];
  usuarios: UsuarioOption[];
  currentUserId: string;
};

export function TableroCliente({ tareas, areas, usuarios, currentUserId }: Props) {
  const [selectedTarea, setSelectedTarea] = useState<TareaCard | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogEstado, setDialogEstado] = useState("por_hacer");

  function abrirDialog(estado: string) {
    setDialogEstado(estado);
    setDialogOpen(true);
  }

  function abrirSheet(tarea: TareaCard) {
    setSelectedTarea(tarea);
    setSheetOpen(true);
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNAS.map((col) => {
          const tareasColumna = tareas.filter((t) => t.estado === col.estado);
          return (
            <div key={col.estado} className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-medium">{col.titulo}</h2>
                  <Badge variant="outline">{tareasColumna.length}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => abrirDialog(col.estado)}
                  aria-label={`Nueva tarea en ${col.titulo}`}
                >
                  <Plus className="size-4" />
                </Button>
              </div>

              <div className="flex flex-col gap-2">
                {tareasColumna.map((t) => (
                  <TareaCardItem
                    key={t.id}
                    tarea={t}
                    onClick={() => abrirSheet(t)}
                  />
                ))}
                {tareasColumna.length === 0 && (
                  <button
                    onClick={() => abrirDialog(col.estado)}
                    className="text-muted-foreground flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-4 text-sm hover:text-foreground hover:border-foreground/30 transition-colors w-full"
                  >
                    <Plus className="size-3.5" />
                    Agregar tarea
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <NuevaTareaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        estadoInicial={dialogEstado}
        areas={areas}
        usuarios={usuarios}
      />

      {selectedTarea && (
        <TareaSheet
          key={selectedTarea.id}
          tarea={selectedTarea}
          areas={areas}
          usuarios={usuarios}
          currentUserId={currentUserId}
          open={sheetOpen}
          onOpenChange={(v) => {
            setSheetOpen(v);
            if (!v) setSelectedTarea(null);
          }}
        />
      )}
    </>
  );
}
