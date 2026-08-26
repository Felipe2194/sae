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
import { AsignadosPicker } from "@/components/features/asignados-picker";
import {
  crearArea,
  actualizarArea,
  type TipoArea,
  type CategoriaArea,
} from "./actions";

export const AREA_COLORS = [
  "#ef4444",
  "#f97316",
  "#E05B22",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
  "#64748b",
];

export const TIPO_AREA_OPTS: { value: TipoArea; label: string }[] = [
  { value: "continua", label: "Área continua" },
  { value: "evento", label: "Evento / Temporal" },
];

export const CATEGORIA_AREA_OPTS: { value: CategoriaArea; label: string }[] = [
  { value: "deportes", label: "Deportes" },
  { value: "becas", label: "Becas" },
  { value: "institucional", label: "Institucional" },
  { value: "cultura", label: "Cultura" },
  { value: "academico", label: "Académico" },
  { value: "general", label: "General" },
];

export type UsuarioOption = {
  id: string;
  nombre: string;
  avatar_color: string | null;
};

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
    tipo: TipoArea;
    categoria: CategoriaArea;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    responsable_id: string | null;
    asignados: { id: string; nombre: string; avatar_color: string | null }[];
  };
};

export function AreaDialog({
  open,
  onOpenChange,
  usuarios,
  areaInicial,
}: Props) {
  const isEdit = !!areaInicial;
  const [isPending, startTransition] = useTransition();

  const [nombre, setNombre] = useState(areaInicial?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(
    areaInicial?.descripcion ?? "",
  );
  const [color, setColor] = useState(areaInicial?.color ?? AREA_COLORS[5]);
  const [tipo, setTipo] = useState<TipoArea>(areaInicial?.tipo ?? "continua");
  const [categoria, setCategoria] = useState<CategoriaArea>(
    areaInicial?.categoria ?? "general",
  );
  const [fechaInicio, setFechaInicio] = useState(
    areaInicial?.fecha_inicio ?? "",
  );
  const [fechaFin, setFechaFin] = useState(areaInicial?.fecha_fin ?? "");
  const [responsableId, setResponsableId] = useState(
    areaInicial?.responsable_id ?? "",
  );
  const [asignadosIds, setAsignadosIds] = useState<string[]>(
    areaInicial?.asignados.map((a) => a.id) ?? [],
  );

  const TIPO_ITEMS = Object.fromEntries(
    TIPO_AREA_OPTS.map((o) => [o.value, o.label]),
  );
  const CATEGORIA_ITEMS = Object.fromEntries(
    CATEGORIA_AREA_OPTS.map((o) => [o.value, o.label]),
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    const payload = {
      nombre: nombre.trim(),
      color,
      tipo,
      categoria,
      fecha_inicio: fechaInicio || null,
      fecha_fin: fechaFin || null,
      responsable_id: responsableId || null,
      asignados_ids: asignadosIds,
    };
    startTransition(async () => {
      if (isEdit) {
        await actualizarArea(areaInicial.id, {
          ...payload,
          descripcion: descripcion.trim() || null,
        });
      } else {
        await crearArea({ ...payload, descripcion: descripcion.trim() });
      }
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar proyecto" : "Nuevo proyecto"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-1 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="area-nombre" className="text-xs">
              Nombre *
            </Label>
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
            <Label htmlFor="area-desc" className="text-xs">
              Descripción
            </Label>
            <Textarea
              id="area-desc"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="¿De qué se ocupa?"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Modalidad</Label>
              <Select
                value={tipo}
                onValueChange={(v) => setTipo((v ?? "continua") as TipoArea)}
                items={TIPO_ITEMS}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_AREA_OPTS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Categoría</Label>
              <Select
                value={categoria}
                onValueChange={(v) =>
                  setCategoria((v ?? "general") as CategoriaArea)
                }
                items={CATEGORIA_ITEMS}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIA_AREA_OPTS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {tipo === "evento" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="area-fecha-inicio" className="text-xs">
                  Fecha de inicio
                </Label>
                <Input
                  id="area-fecha-inicio"
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="area-fecha-fin" className="text-xs">
                  Fecha de cierre
                </Label>
                <Input
                  id="area-fecha-fin"
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Color</Label>
            <div className="flex flex-wrap gap-2">
              {AREA_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="ring-offset-background flex size-7 items-center justify-center rounded-full transition-all hover:scale-110"
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
              onValueChange={(v) =>
                setResponsableId(!v || v === "_none" ? "" : v)
              }
              items={{
                _none: "Sin responsable",
                ...Object.fromEntries(usuarios.map((u) => [u.id, u.nombre])),
              }}
            >
              <SelectTrigger className="h-9 w-full">
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

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Colaboradores</Label>
            <AsignadosPicker
              usuarios={usuarios}
              selectedIds={asignadosIds}
              onChange={setAsignadosIds}
              placeholder="Sin colaboradores adicionales"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending || !nombre.trim()}>
              {isPending
                ? isEdit
                  ? "Guardando..."
                  : "Creando..."
                : isEdit
                  ? "Guardar cambios"
                  : "Crear proyecto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
