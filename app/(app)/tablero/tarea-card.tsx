"use client";

import { useEffect, useMemo, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  CalendarDays,
  MessageSquare,
  CheckSquare,
  Repeat,
  CircleCheck,
  Flag,
  Plane,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatarStack } from "@/components/features/user-avatar";
import type { TareaCard } from "./page";

const SIGUIENTE_ESTADO_LABEL: Record<string, string> = {
  por_hacer: "Marcar en progreso",
  en_progreso: "Marcar hecha",
};

const TIPO_LABEL: Record<string, string> = {
  tarea: "Tarea",
  evento: "Evento",
  entrega: "Entrega",
  reunion: "Reunión",
};

// Ícono de bandera en vez de punto de color: un punto acá se confundía a
// simple vista con el punto de color del proyecto (área) que está justo
// arriba, ambos círculos del mismo tamaño. La bandera es una forma distinta
// y de lectura inmediata como "prioridad".
const PRIORIDAD_COLOR: Record<string, string> = {
  baja: "text-slate-300",
  media: "text-amber-500",
  alta: "text-red-500",
};

export function TareaCardItem({
  tarea,
  onClick,
  onAvanzar,
  overlay = false,
  puedeMover = true,
}: {
  tarea: TareaCard;
  onClick: () => void;
  onAvanzar?: () => void;
  overlay?: boolean;
  puedeMover?: boolean;
}) {
  const siguienteLabel = SIGUIENTE_ESTADO_LABEL[tarea.estado];
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: overlay ? `overlay-${tarea.id}` : tarea.id,
      data: { estado: tarea.estado },
      disabled: overlay || !puedeMover,
    });

  // dnd-kit genera aria-describedby con un id autoincremental que no coincide
  // entre el render de servidor y el de cliente — se activa recién montado en
  // el cliente para evitar el hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const estaVencida =
    tarea.fecha_vencimiento &&
    tarea.estado !== "hecha" &&
    new Date(tarea.fecha_vencimiento + "T00:00:00") < new Date();

  // Responsable + co-asignados, sin duplicados, en un solo stack de avatares.
  const asignados = useMemo(() => {
    const lista = [...tarea.asignados];
    if (
      tarea.responsable_id &&
      tarea.responsable_nombre &&
      !lista.some((a) => a.id === tarea.responsable_id)
    ) {
      lista.unshift({
        id: tarea.responsable_id,
        nombre: tarea.responsable_nombre,
        avatar_color: tarea.responsable_avatar_color,
      });
    }
    return lista;
  }, [
    tarea.asignados,
    tarea.responsable_id,
    tarea.responsable_nombre,
    tarea.responsable_avatar_color,
  ]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      // El arrastre se activa desde cualquier parte de la card — PointerSensor
      // ya exige 8px de movimiento antes de considerarlo drag, así que un
      // click normal (sin mover el mouse) sigue abriendo el detalle. Sin
      // permiso para cambiar el estado, no se registran los listeners: la
      // card se sigue pudiendo abrir (ver detalle), pero no arrastrar.
      {...(mounted && !overlay && puedeMover ? listeners : undefined)}
      {...(mounted && !overlay && puedeMover ? attributes : undefined)}
      className={isDragging ? "opacity-40" : ""}
    >
      <Card
        className={`gap-0 rounded-xl py-0 shadow-sm transition-all duration-150 select-none hover:-translate-y-0.5 hover:shadow-lg ${
          puedeMover ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
        } ${tarea.prioridad === "alta" && tarea.estado !== "hecha" ? "ring-1 ring-red-500/25" : ""}`}
        onClick={onClick}
        title={
          puedeMover
            ? undefined
            : "Solo quien está asignado (o administrador) puede cambiar el estado de esta tarea"
        }
      >
        <CardContent className="flex flex-col gap-2 p-3.5">
          {/* Área + tipo + grip decorativo */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              {tarea.viaje_nombre ? (
                <>
                  <Plane className="text-muted-foreground size-3 shrink-0" />
                  <span className="text-muted-foreground truncate text-xs">
                    {tarea.viaje_nombre}
                  </span>
                </>
              ) : (
                <>
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: tarea.area_color ?? "#94a3b8" }}
                  />
                  <span className="text-muted-foreground truncate text-xs">
                    {tarea.area_nombre}
                  </span>
                </>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {tarea.tipo !== "tarea" && (
                <Badge variant="secondary" className="px-1.5 py-0 text-[11px]">
                  {TIPO_LABEL[tarea.tipo] ?? tarea.tipo}
                </Badge>
              )}
              {!overlay && puedeMover && (
                <GripVertical
                  className="text-muted-foreground/30 pointer-events-none size-3.5"
                  aria-hidden
                />
              )}
            </div>
          </div>

          {/* Título + prioridad (bandera) */}
          <div className="flex items-start gap-2">
            <Flag
              className={`mt-[3px] size-3 shrink-0 ${PRIORIDAD_COLOR[tarea.prioridad] ?? "text-slate-300"}`}
              fill="currentColor"
              aria-label={`Prioridad ${tarea.prioridad}`}
            />
            <p className="flex-1 text-sm leading-snug font-medium">
              {tarea.titulo}
            </p>
            {tarea.recurrencia && (
              <Repeat
                className="text-muted-foreground mt-0.5 size-3 shrink-0"
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
                <span className="text-muted-foreground flex items-center gap-1 text-[12px]">
                  <CheckSquare className="size-3" />
                  {tarea.subtarea_hecha}/{tarea.subtarea_total}
                </span>
              )}
              {tarea.comentario_count > 0 && (
                <span className="text-muted-foreground flex items-center gap-1 text-[12px]">
                  <MessageSquare className="size-3" />
                  {tarea.comentario_count}
                </span>
              )}
            </div>
            <UserAvatarStack usuarios={asignados} size="sm" max={3} />
          </div>

          {/* Avanzar de estado sin arrastrar — en mobile arrastrar una card
              es incómodo (el dedo tapa la columna de al lado), así que hay
              un botón directo Por hacer → En progreso → Hecha. Se oculta
              desde md: porque ahí el drag-and-drop ya es cómodo con mouse. */}
          {!overlay && puedeMover && siguienteLabel && onAvanzar && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-full gap-1.5 text-xs md:hidden"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onAvanzar();
              }}
            >
              <CircleCheck className="size-3.5" />
              {siguienteLabel}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
