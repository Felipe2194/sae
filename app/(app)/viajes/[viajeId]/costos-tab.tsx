"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Banknote, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { moverEstadoTarea } from "../../tablero/actions";
import { crearTareaCosteo, fijarCosto, eliminarCosto } from "./actions";
import type { CostoRow, TareaCostoRow } from "./page";

function formatMonto(n: number): string {
  return `$${n.toLocaleString("es-AR")}`;
}

export function CostosTab({
  viajeId,
  tareasIniciales,
  costosIniciales,
  canManage,
}: {
  viajeId: string;
  tareasIniciales: TareaCostoRow[];
  costosIniciales: CostoRow[];
  canManage: boolean;
}) {
  const [tareas, setTareas] = useState(tareasIniciales);
  const [costos, setCostos] = useState(costosIniciales);
  const [nuevoTitulo, setNuevoTitulo] = useState("");
  const [fijando, setFijando] = useState<TareaCostoRow | null>(null);
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState(false);

  const total = costos.reduce((acc, c) => acc + c.monto, 0);

  function handleAgregarTarea(e: React.FormEvent) {
    e.preventDefault();
    const titulo = nuevoTitulo.trim();
    if (!titulo) return;
    setPending(true);
    startTransition(async () => {
      const nueva = await crearTareaCosteo(viajeId, titulo);
      if (nueva) {
        setTareas((prev) => [
          ...prev,
          { id: nueva.id, titulo, estado: "por_hacer", responsable_id: null, responsable_nombre: null, ya_fijada: false },
        ]);
        setNuevoTitulo("");
      }
      setPending(false);
    });
  }

  function handleMarcarHecha(tareaId: string) {
    setTareas((prev) => prev.map((t) => (t.id === tareaId ? { ...t, estado: "hecha" } : t)));
    startTransition(async () => {
      try {
        await moverEstadoTarea(tareaId, "hecha");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo marcar como hecha.");
      }
    });
  }

  function abrirFijar(tarea: TareaCostoRow) {
    setFijando(tarea);
    setConcepto(tarea.titulo);
    setMonto("");
  }

  function handleFijar(e: React.FormEvent) {
    e.preventDefault();
    if (!fijando || !concepto.trim() || !monto) return;
    const montoNum = parseFloat(monto);
    if (!(montoNum > 0)) return;
    startTransition(async () => {
      try {
        const nuevo = await fijarCosto(viajeId, {
          concepto: concepto.trim(),
          monto: montoNum,
          tareaId: fijando.id,
        });
        if (nuevo) {
          setCostos((prev) => [
            ...prev,
            { id: nuevo.id, concepto: concepto.trim(), monto: montoNum, tarea_id: fijando.id, fijado_en: new Date().toISOString() },
          ]);
          setTareas((prev) => prev.map((t) => (t.id === fijando.id ? { ...t, ya_fijada: true } : t)));
        }
        setFijando(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo fijar el costo.");
      }
    });
  }

  function handleEliminarCosto(costoId: string) {
    setCostos((prev) => prev.filter((c) => c.id !== costoId));
    startTransition(async () => {
      await eliminarCosto(costoId, viajeId);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Tareas de costeo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {canManage && (
            <form onSubmit={handleAgregarTarea} className="flex gap-2">
              <Input
                value={nuevoTitulo}
                onChange={(e) => setNuevoTitulo(e.target.value)}
                placeholder="Ej: Cotizar micro a Neuquén"
                className="h-9 text-sm"
              />
              <Button type="submit" size="sm" disabled={pending || !nuevoTitulo.trim()}>
                <Plus className="size-3.5" />
                Agregar
              </Button>
            </form>
          )}

          {tareas.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              No hay costos en cotización todavía.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {tareas.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1.5 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={
                        t.estado === "hecha"
                          ? "text-muted-foreground line-through"
                          : ""
                      }
                    >
                      {t.titulo}
                    </span>
                    {t.ya_fijada && (
                      <span className="text-muted-foreground text-xs">(ya fijado)</span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {canManage && t.estado !== "hecha" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => handleMarcarHecha(t.id)}
                      >
                        <CheckCircle2 className="size-3.5" />
                        Marcar hecha
                      </Button>
                    )}
                    {canManage && t.estado === "hecha" && !t.ya_fijada && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => abrirFijar(t)}
                      >
                        <Banknote className="size-3.5" />
                        Fijar como costo
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Costos fijados</CardTitle>
          <span className="text-sm font-semibold">{formatMonto(total)}</span>
        </CardHeader>
        <CardContent>
          {costos.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              Todavía no se fijó ningún costo.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {costos.map((c) => (
                <div key={c.id} className="group flex items-center justify-between gap-2 py-1 text-sm">
                  <span>{c.concepto}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatMonto(c.monto)}</span>
                    {canManage && (
                      <button
                        onClick={() => handleEliminarCosto(c.id)}
                        className="text-muted-foreground hover:text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!fijando} onOpenChange={(v) => !v && setFijando(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg">Fijar como costo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFijar} className="mt-1 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Concepto</Label>
              <Input value={concepto} onChange={(e) => setConcepto(e.target.value)} required className="h-10" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Monto final</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                required
                className="h-10"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!concepto.trim() || !monto}>
                Guardar costo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
