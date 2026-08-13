"use client";

import { useState, useTransition } from "react";
import { ClipboardList, Plus, Trash2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { crearPlantilla, eliminarPlantilla, aplicarPlantilla, type PlantillaRow } from "../actions";

type Props = {
  areaId: string;
  plantillasIniciales: PlantillaRow[];
  canManage: boolean;
};

export function AreaPlantillas({ areaId, plantillasIniciales, canManage }: Props) {
  const [plantillas, setPlantillas] = useState<PlantillaRow[]>(plantillasIniciales);
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [items, setItems] = useState("");
  const [pending, startTransition] = useTransition();
  const [aplicandoId, setAplicandoId] = useState<string | null>(null);
  const [aplicadaId, setAplicadaId] = useState<string | null>(null);

  if (plantillas.length === 0 && !canManage) return null;

  function handleCrear() {
    const titulos = items.split("\n");
    if (!nombre.trim() || titulos.every((t) => !t.trim())) return;
    startTransition(async () => {
      const nueva = await crearPlantilla(areaId, nombre.trim(), titulos);
      if (nueva) setPlantillas((prev) => [nueva, ...prev]);
      setNombre("");
      setItems("");
      setAbierto(false);
    });
  }

  function handleEliminar(id: string) {
    setPlantillas((prev) => prev.filter((p) => p.id !== id));
    startTransition(() => eliminarPlantilla(id, areaId));
  }

  function handleAplicar(id: string) {
    setAplicandoId(id);
    startTransition(async () => {
      await aplicarPlantilla(id, areaId);
      setAplicandoId(null);
      setAplicadaId(id);
      setTimeout(() => setAplicadaId(null), 2500);
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Plantillas de tareas</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Para procesos que se repiten — creá el conjunto de tareas de un saque.
          </p>
        </div>
        {canManage && (
          <Button
            variant={abierto ? "secondary" : "outline"}
            size="sm"
            onClick={() => setAbierto((v) => !v)}
          >
            <Plus className="size-4" />
            Nueva plantilla
          </Button>
        )}
      </div>

      {abierto && (
        <div className="rounded-xl border bg-card p-4 flex flex-col gap-3 shadow-sm">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Nombre</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Organización de torneo"
              className="h-9"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Tareas (una por línea)</Label>
            <Textarea
              value={items}
              onChange={(e) => setItems(e.target.value)}
              placeholder={"Reservar cancha\nDifundir en redes\nArmar planilla de inscripción"}
              rows={4}
              className="text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleCrear} disabled={pending || !nombre.trim()}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : "Guardar plantilla"}
            </Button>
          </div>
        </div>
      )}

      {plantillas.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Todavía no hay plantillas para esta área.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {plantillas.map((p) => (
            <div
              key={p.id}
              className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3"
            >
              <div className="mt-0.5 shrink-0 size-7 rounded-full flex items-center justify-center bg-muted">
                <ClipboardList className="size-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{p.nombre}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {p.items.length} tarea{p.items.length !== 1 ? "s" : ""}: {p.items.join(", ")}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  disabled={aplicandoId === p.id}
                  onClick={() => handleAplicar(p.id)}
                >
                  {aplicandoId === p.id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : aplicadaId === p.id ? (
                    <Sparkles className="size-3" />
                  ) : null}
                  {aplicadaId === p.id ? "Aplicada" : "Aplicar"}
                </Button>
                {canManage && (
                  <button
                    onClick={() => handleEliminar(p.id)}
                    className="text-muted-foreground hover:text-destructive p-1 rounded-md hover:bg-destructive/10"
                    title="Eliminar plantilla"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
