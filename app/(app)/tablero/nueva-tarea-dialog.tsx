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
import { crearTarea } from "./actions";
import type { AreaOption, UsuarioOption } from "./page";

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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estadoInicial: string;
  areas: AreaOption[];
  usuarios: UsuarioOption[];
};

export function NuevaTareaDialog({
  open,
  onOpenChange,
  estadoInicial,
  areas,
  usuarios,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState("tarea");
  const [prioridad, setPrioridad] = useState("media");
  const [areaId, setAreaId] = useState(areas[0]?.id ?? "");
  const [responsableId, setResponsableId] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");

  function resetForm() {
    setTitulo("");
    setDescripcion("");
    setTipo("tarea");
    setPrioridad("media");
    setAreaId(areas[0]?.id ?? "");
    setResponsableId("");
    setFechaVencimiento("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim() || !areaId) return;
    startTransition(async () => {
      await crearTarea({
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        tipo,
        prioridad,
        area_id: areaId,
        responsable_id: responsableId || null,
        fecha_vencimiento: fechaVencimiento || null,
        estado: estadoInicial,
      });
      resetForm();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva tarea</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nt-titulo" className="text-xs">
              Título *
            </Label>
            <Input
              id="nt-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="¿Qué hay que hacer?"
              required
              autoFocus
              className="h-10"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nt-desc" className="text-xs">
              Descripción
            </Label>
            <Textarea
              id="nt-desc"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Detalles adicionales..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v ?? "")}>
                <SelectTrigger className="w-full h-9">
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
              <Select value={prioridad} onValueChange={(v) => setPrioridad(v ?? "")}>
                <SelectTrigger className="w-full h-9">
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

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Área *</Label>
              <Select value={areaId} onValueChange={(v) => setAreaId(v ?? "")}>
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="Elegir área" />
                </SelectTrigger>
                <SelectContent>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="flex items-center gap-1.5">
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: a.color }}
                        />
                        {a.nombre}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Responsable</Label>
              <Select
                value={responsableId || "_none"}
                onValueChange={(v) => setResponsableId(!v || v === "_none" ? "" : v)}
              >
                <SelectTrigger className="w-full h-9">
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
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nt-fecha" className="text-xs">
              Fecha de vencimiento
            </Label>
            <Input
              id="nt-fecha"
              type="date"
              value={fechaVencimiento}
              onChange={(e) => setFechaVencimiento(e.target.value)}
              className="h-9"
            />
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={isPending || !titulo.trim() || !areaId}
            >
              {isPending ? "Creando..." : "Crear tarea"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
