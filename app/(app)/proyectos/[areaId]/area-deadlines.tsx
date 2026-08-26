"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { crearHitoArea, eliminarHitoArea } from "../actions";

export type DeadlineRow = {
  id: string;
  titulo: string;
  fecha_vencimiento: string;
  responsable_nombre: string | null;
  esHito: boolean;
};

function formatFecha(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function diasHasta(iso: string, hoyISO: string): number {
  const a = new Date(hoyISO + "T00:00:00").getTime();
  const b = new Date(iso + "T00:00:00").getTime();
  return Math.round((b - a) / 86400000);
}

export function AreaDeadlines({
  deadlines,
  hoyISO,
  areaId,
  puedePlanificar,
}: {
  deadlines: DeadlineRow[];
  hoyISO: string;
  areaId: string;
  puedePlanificar: boolean;
}) {
  const [items, setItems] = useState(deadlines);
  const [abierto, setAbierto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState("");
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleAgregar(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim() || !fecha) return;
    const tituloFinal = titulo.trim();
    const fechaFinal = fecha;
    startTransition(async () => {
      const nuevo = await crearHitoArea(areaId, tituloFinal, fechaFinal);
      if (nuevo) {
        setItems((prev) =>
          [
            ...prev,
            {
              id: nuevo.id,
              titulo: tituloFinal,
              fecha_vencimiento: fechaFinal,
              responsable_nombre: null,
              esHito: true,
            },
          ].sort((a, b) =>
            a.fecha_vencimiento.localeCompare(b.fecha_vencimiento),
          ),
        );
      }
      setTitulo("");
      setFecha("");
      setAbierto(false);
    });
  }

  function handleEliminar(id: string) {
    setDeletingId(id);
    setItems((prev) => prev.filter((d) => d.id !== id));
    startTransition(async () => {
      await eliminarHitoArea(id, areaId);
      setDeletingId(null);
    });
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm">
          <CalendarClock className="text-muted-foreground size-4" />
          Fechas importantes
        </CardTitle>
        {puedePlanificar && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => setAbierto((v) => !v)}
          >
            <Plus className="size-3.5" />
            Agregar
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {abierto && (
          <form
            onSubmit={handleAgregar}
            className="flex flex-col gap-2 rounded-lg border p-3"
          >
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título (ej: Cierre de inscripciones)"
              required
              className="h-8 text-sm"
            />
            <Input
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              type="date"
              required
              className="h-8 text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setAbierto(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                Guardar
              </Button>
            </div>
          </form>
        )}

        {items.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            No hay vencimientos próximos.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((d) => {
              const dias = diasHasta(d.fecha_vencimiento, hoyISO);
              const vencida = dias < 0;
              const esHoy = dias === 0;
              return (
                <div key={d.id} className="group flex items-center gap-3">
                  <Badge
                    variant={
                      vencida ? "destructive" : esHoy ? "default" : "outline"
                    }
                    className="shrink-0 px-1.5 py-0 text-[10px] font-normal whitespace-nowrap"
                  >
                    {formatFecha(d.fecha_vencimiento)}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm leading-tight">{d.titulo}</p>
                    {d.responsable_nombre && (
                      <p className="text-muted-foreground text-[11px]">
                        {d.responsable_nombre}
                      </p>
                    )}
                  </div>
                  {vencida && (
                    <span className="text-destructive shrink-0 text-[11px] font-medium">
                      {-dias}d atraso
                    </span>
                  )}
                  {d.esHito && puedePlanificar && (
                    <button
                      onClick={() => handleEliminar(d.id)}
                      disabled={deletingId === d.id}
                      className="text-muted-foreground hover:text-destructive shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                      title="Quitar"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
