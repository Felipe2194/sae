"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NuevaTareaPlanificadaDialog } from "./nueva-tarea-planificada-dialog";
import { TareaPlanificadaModal } from "./tarea-planificada-modal";
import type { TareaRow, UsuarioRow } from "./page";

const PRIORIDAD_COLOR: Record<string, string> = {
  baja: "#94a3b8",
  media: "#f59e0b",
  alta: "#ef4444",
};

const TIPO_LABEL: Record<string, string> = {
  evento: "Evento",
  entrega: "Entrega",
  reunion: "Reunión",
};

function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/);
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

export function AreaTareasPlanificadas({
  areaId,
  tareasIniciales,
  usuarios,
}: {
  areaId: string;
  tareasIniciales: TareaRow[];
  usuarios: UsuarioRow[];
}) {
  const [tareas, setTareas] = useState<TareaRow[]>(tareasIniciales);
  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [tareaAbierta, setTareaAbierta] = useState<TareaRow | null>(null);

  function handleCreada(tarea: TareaRow) {
    setTareas((prev) => [tarea, ...prev]);
    setTareaAbierta(tarea);
  }

  function handleActualizada(tarea: TareaRow) {
    setTareas((prev) => prev.map((t) => (t.id === tarea.id ? tarea : t)));
  }

  function handleRemovida(id: string) {
    setTareas((prev) => prev.filter((t) => t.id !== id));
    setTareaAbierta(null);
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Tareas planificadas</h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Preparadas de antemano — no aparecen en el Tablero ni en las
            métricas hasta que las activás.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDialogAbierto(true)}
        >
          <Plus className="size-4" />
          Planificar tarea
        </Button>
      </div>

      {tareas.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          No hay tareas planificadas todavía.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {tareas.map((t) => (
            <button
              key={t.id}
              onClick={() => setTareaAbierta(t)}
              className="bg-card hover:bg-muted/40 flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors"
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{
                  backgroundColor: PRIORIDAD_COLOR[t.prioridad] ?? "#94a3b8",
                }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug font-medium">{t.titulo}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {TIPO_LABEL[t.tipo] && (
                    <Badge
                      variant="outline"
                      className="px-1.5 py-0 text-[11px] font-normal"
                    >
                      {TIPO_LABEL[t.tipo]}
                    </Badge>
                  )}
                  {t.fecha_vencimiento && (
                    <span className="text-muted-foreground flex items-center gap-1 text-[12px]">
                      {new Date(
                        t.fecha_vencimiento + "T00:00:00",
                      ).toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </span>
                  )}
                  {t.subtarea_total > 0 && (
                    <span className="text-muted-foreground text-[12px]">
                      {t.subtarea_hecha}/{t.subtarea_total}
                    </span>
                  )}
                </div>
              </div>

              {t.responsable_nombre ? (
                <Avatar className="size-6 shrink-0">
                  <AvatarFallback className="bg-[oklch(0.62_0.19_42)] text-[10px] font-semibold text-white">
                    {iniciales(t.responsable_nombre)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <span className="text-muted-foreground/40 shrink-0 text-[11px]">
                  —
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <NuevaTareaPlanificadaDialog
        open={dialogAbierto}
        onOpenChange={setDialogAbierto}
        areaId={areaId}
        usuarios={usuarios}
        onCreada={handleCreada}
      />

      {tareaAbierta && (
        <TareaPlanificadaModal
          tarea={tareaAbierta}
          areaId={areaId}
          usuarios={usuarios}
          open={!!tareaAbierta}
          onOpenChange={(open) => !open && setTareaAbierta(null)}
          onActualizada={handleActualizada}
          onActivada={() => handleRemovida(tareaAbierta.id)}
          onDescartada={() => handleRemovida(tareaAbierta.id)}
        />
      )}
    </section>
  );
}
