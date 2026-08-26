"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { crearTareaPlanificada } from "../actions";
import type { TareaRow, UsuarioRow } from "./page";

const TIPO_OPTS = [
  { value: "tarea", label: "Tarea" },
  { value: "evento", label: "Evento" },
  { value: "entrega", label: "Entrega" },
  { value: "reunion", label: "Reunión" },
];

const PRIORIDAD_OPTS = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
];

const TIPO_ITEMS = Object.fromEntries(TIPO_OPTS.map((o) => [o.value, o.label]));
const PRIORIDAD_ITEMS = Object.fromEntries(
  PRIORIDAD_OPTS.map((o) => [o.value, o.label]),
);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  areaId: string;
  usuarios: UsuarioRow[];
  onCreada: (tarea: TareaRow) => void;
};

export function NuevaTareaPlanificadaDialog({
  open,
  onOpenChange,
  areaId,
  usuarios,
  onCreada,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState("tarea");
  const [prioridad, setPrioridad] = useState("media");
  const [responsableId, setResponsableId] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");

  const RESPONSABLE_ITEMS = {
    _none: "Sin asignar",
    ...Object.fromEntries(usuarios.map((u) => [u.id, u.nombre])),
  };

  function resetForm() {
    setTitulo("");
    setDescripcion("");
    setTipo("tarea");
    setPrioridad("media");
    setResponsableId("");
    setFechaVencimiento("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;
    startTransition(async () => {
      const tituloFinal = titulo.trim();
      const descripcionFinal = descripcion.trim();
      const { id } = await crearTareaPlanificada(areaId, {
        titulo: tituloFinal,
        descripcion: descripcionFinal,
        tipo,
        prioridad,
        responsable_id: responsableId || null,
        fecha_vencimiento: fechaVencimiento || null,
      });
      onCreada({
        id,
        titulo: tituloFinal,
        descripcion: descripcionFinal || null,
        estado: "por_hacer",
        prioridad,
        tipo,
        fecha_vencimiento: fechaVencimiento || null,
        responsable_id: responsableId || null,
        responsable_nombre:
          usuarios.find((u) => u.id === responsableId)?.nombre ?? null,
        activa: false,
        subtarea_total: 0,
        subtarea_hecha: 0,
      });
      resetForm();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Planificar tarea</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ntp-titulo" className="text-xs">
              Título *
            </Label>
            <Input
              id="ntp-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="¿Qué hay que preparar?"
              required
              autoFocus
              className="h-10"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ntp-desc" className="text-xs">
              Descripción
            </Label>
            <Textarea
              id="ntp-desc"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Detalles adicionales..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select
                value={tipo}
                onValueChange={(v) => setTipo(v ?? "")}
                items={TIPO_ITEMS}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_OPTS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Prioridad</Label>
              <Select
                value={prioridad}
                onValueChange={(v) => setPrioridad(v ?? "")}
                items={PRIORIDAD_ITEMS}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORIDAD_OPTS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Responsable</Label>
            <Select
              value={responsableId || "_none"}
              onValueChange={(v) =>
                setResponsableId(!v || v === "_none" ? "" : v)
              }
              items={RESPONSABLE_ITEMS}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Sin asignar</SelectItem>
                {usuarios.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ntp-fecha" className="text-xs">
              Fecha de vencimiento
            </Label>
            <Input
              id="ntp-fecha"
              type="date"
              value={fechaVencimiento}
              onChange={(e) => setFechaVencimiento(e.target.value)}
              className="h-9"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending || !titulo.trim()}>
              {isPending ? "Creando..." : "Crear y cargar subtareas"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
