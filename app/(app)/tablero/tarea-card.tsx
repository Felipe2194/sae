"use client";

import { useEffect, useMemo, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, CalendarDays, MessageSquare, CheckSquare, Repeat } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserAvatarStack } from "@/components/features/user-avatar";
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

export function TareaCardItem({
  tarea,
  onClick,
  overlay = false,
}: {
  tarea: TareaCard;
  onClick: () => void;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: overlay ? `overlay-${tarea.id}` : tarea.id,
    data: { estado: tarea.estado },
    disabled: overlay,
  });

  // dnd-kit genera aria-describedby con un id autoincremental que no coincide
  // entre el render de servidor y el de cliente — se activa recién montado en
  // el cliente para evitar el hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  const estaVencida =
    tarea.fecha_vencimiento &&
    tarea.estado !== "hecha" &&
    new Date(tarea.fecha_vencimiento + "T00:00:00") < new Date();

  // Responsable + co-asignados, sin duplicados, en un solo stack de avatares.
  const asignados = useMemo(() => {
    const lista = [...tarea.asignados];
    if (tarea.responsable_id && tarea.responsable_nombre && !lista.some((a) => a.id === tarea.responsable_id)) {
      lista.unshift({ id: tarea.responsable_id, nombre: tarea.responsable_nombre, avatar_color: tarea.responsable_avatar_color });
    }
    return lista;
  }, [tarea.asignados, tarea.responsable_id, tarea.responsable_nombre, tarea.responsable_avatar_color]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      // El arrastre se activa desde cualquier parte de la card — PointerSensor
      // ya exige 8px de movimiento antes de considerarlo drag, así que un
      // click normal (sin mover el mouse) sigue abriendo el detalle.
      {...(mounted && !overlay ? listeners : undefined)}
      {...(mounted && !overlay ? attributes : undefined)}
      className={isDragging ? "opacity-40" : ""}
    >
      <Card
        className={`gap-0 py-0 rounded-xl shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-150 select-none cursor-grab active:cursor-grabbing ${
          tarea.prioridad === "alta" && tarea.estado !== "hecha"
            ? "ring-1 ring-red-500/25"
            : ""
        }`}
        onClick={onClick}
      >
        <CardContent className="flex flex-col gap-2 p-3.5">
          {/* Área + tipo + grip decorativo */}
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
            <div className="flex items-center gap-1 shrink-0">
              {tarea.tipo !== "tarea" && (
                <Badge variant="secondary" className="text-[11px] px-1.5 py-0">
                  {TIPO_LABEL[tarea.tipo] ?? tarea.tipo}
                </Badge>
              )}
              {!overlay && (
                <GripVertical
                  className="size-3.5 pointer-events-none text-muted-foreground/30"
                  aria-hidden
                />
              )}
            </div>
          </div>

          {/* Título + prioridad dot */}
          <div className="flex items-start gap-2">
            <span
              className={`mt-[5px] size-2 shrink-0 rounded-full ${PRIORIDAD_COLOR[tarea.prioridad] ?? "bg-slate-300"}`}
            />
            <p className="text-sm leading-snug font-medium flex-1">{tarea.titulo}</p>
            {tarea.recurrencia && (
              <Repeat
                className="mt-0.5 size-3 shrink-0 text-muted-foreground"
                aria-label="Tarea recurrente"
              />
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-2.5">
              {tarea.fecha_vencimiento && (
                <span
                  className={`flex items-center gap-1 text-[12px] ${
                    estaVencida ? "text-destructive font-medium" : "text-muted-foreground"
                  }`}
                >
                  <CalendarDays className="size-3" />
                  {new Date(tarea.fecha_vencimiento + "T00:00:00").toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </span>
              )}
              {tarea.subtarea_total > 0 && (
                <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                  <CheckSquare className="size-3" />
                  {tarea.subtarea_hecha}/{tarea.subtarea_total}
                </span>
              )}
              {tarea.comentario_count > 0 && (
                <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                  <MessageSquare className="size-3" />
                  {tarea.comentario_count}
                </span>
              )}
            </div>
            <UserAvatarStack usuarios={asignados} size="sm" max={3} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
