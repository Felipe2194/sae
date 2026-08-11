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
import { crearArea, actualizarArea } from "./actions";

export const AREA_COLORS = [
  "#ef4444", "#f97316", "#E05B22", "#eab308",
  "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
  "#8b5cf6", "#a855f7", "#ec4899", "#64748b",
];

export type UsuarioOption = { id: string; nombre: string };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  usuarios: UsuarioOption[];
  /** Si se pasa, es modo edición */
  areaInicial?: {
    id: string;
    nombre: string;
    descripcion: string | null;
    color: string;
    responsable_id: string | null;
  };
};

export function AreaDialog({ open, onOpenChange, usuarios, areaInicial }: Props) {
  const isEdit = !!areaInicial;
  const [isPending, startTransition] = useTransition();

  const [nombre, setNombre] = useState(areaInicial?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(areaInicial?.descripcion ?? "");
  const [color, setColor] = useState(areaInicial?.color ?? AREA_COLORS[5]);
  const [responsableId, setResponsableId] = useState(areaInicial?.responsable_id ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    startTransition(async () => {
      if (isEdit) {
        await actualizarArea(areaInicial.id, {
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          color,
          responsable_id: responsableId || null,
        });
      } else {
        await crearArea({
          nombre: nombre.trim(),
          descripcion: descripcion.trim(),
          color,
          responsable_id: responsableId || null,
        });
      }
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar área" : "Nueva área"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="area-nombre" className="text-xs">Nombre *</Label>
            <Input
              id="area-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Comunicación"
              required
              autoFocus
              className="h-9"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="area-desc" className="text-xs">Descripción</Label>
            <Textarea
              id="area-desc"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="¿De qué se ocupa esta área?"
              rows={2}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Color</Label>
            <div className="flex flex-wrap gap-2">
              {AREA_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="size-7 rounded-full transition-all hover:scale-110 flex items-center justify-center ring-offset-background"
                  style={{ backgroundColor: c }}
                  aria-label={c}
                >
                  {color === c && (
                    <span className="size-2.5 rounded-full bg-white/80 shadow-sm" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Responsable</Label>
            <Select
              value={responsableId || "_none"}
              onValueChange={(v) => setResponsableId(!v || v === "_none" ? "" : v)}
            >
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="Sin responsable" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Sin responsable</SelectItem>
                {usuarios.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending || !nombre.trim()}>
              {isPending
                ? isEdit ? "Guardando..." : "Creando..."
                : isEdit ? "Guardar cambios" : "Crear área"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
