"use client";

import { useState, useTransition, useEffect } from "react";
import { X, Plus, Loader2, CheckCircle2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  crearSubtarea,
  toggleSubtarea,
  eliminarSubtarea,
  fetchTareaDetalle,
  type SubtareaRow,
} from "../../tablero/actions";
import {
  actualizarTareaPlanificada,
  activarTarea,
  archivarTareaPlanificada,
} from "../actions";
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

const PRIORIDAD_COLOR: Record<string, string> = {
  baja: "bg-slate-300",
  media: "bg-amber-400",
  alta: "bg-red-500",
};

type Props = {
  tarea: TareaRow;
  areaId: string;
  usuarios: UsuarioRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActualizada: (tarea: TareaRow) => void;
  onActivada: () => void;
  onDescartada: () => void;
};

export function TareaPlanificadaModal({
  tarea,
  areaId,
  usuarios,
  open,
  onOpenChange,
  onActualizada,
  onActivada,
  onDescartada,
}: Props) {
  const [titulo, setTitulo] = useState(tarea.titulo);
  const [descripcion, setDescripcion] = useState(tarea.descripcion ?? "");
  const [tipo, setTipo] = useState(tarea.tipo);
  const [prioridad, setPrioridad] = useState(tarea.prioridad);
  const [responsableId, setResponsableId] = useState(
    tarea.responsable_id ?? "",
  );
  const [fechaVencimiento, setFechaVencimiento] = useState(
    tarea.fecha_vencimiento ?? "",
  );

  const [subtareas, setSubtareas] = useState<SubtareaRow[]>([]);
  const [loadingSubtareas, setLoadingSubtareas] = useState(false);
  const [nuevaSubtarea, setNuevaSubtarea] = useState("");
  const [isPendingSubtarea, startSubtarea] = useTransition();

  const [isPendingSave, startSave] = useTransition();
  const [isPendingAccion, startAccion] = useTransition();
  const [confirmDescartar, setConfirmDescartar] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch de subtareas al abrir el panel
    setLoadingSubtareas(true);
    fetchTareaDetalle(tarea.id)
      .then(({ subtareas }) => setSubtareas(subtareas))
      .finally(() => setLoadingSubtareas(false));
  }, [open, tarea.id]);

  const RESPONSABLE_ITEMS = {
    _none: "Sin asignar",
    ...Object.fromEntries(usuarios.map((u) => [u.id, u.nombre])),
  };

  function handleSave() {
    startSave(async () => {
      const tituloFinal = titulo.trim() || tarea.titulo;
      const descripcionFinal = descripcion.trim();
      await actualizarTareaPlanificada(tarea.id, areaId, {
        titulo: tituloFinal,
        descripcion: descripcionFinal,
        tipo,
        prioridad,
        responsable_id: responsableId || null,
        fecha_vencimiento: fechaVencimiento || null,
      });
      onActualizada({
        ...tarea,
        titulo: tituloFinal,
        descripcion: descripcionFinal || null,
        tipo,
        prioridad,
        responsable_id: responsableId || null,
        responsable_nombre:
          usuarios.find((u) => u.id === responsableId)?.nombre ?? null,
        fecha_vencimiento: fechaVencimiento || null,
      });
      onOpenChange(false);
    });
  }

  function handleActivar() {
    startAccion(async () => {
      await activarTarea(tarea.id, areaId);
      onActivada();
    });
  }

  function handleDescartar() {
    if (!confirmDescartar) {
      setConfirmDescartar(true);
      return;
    }
    startAccion(async () => {
      await archivarTareaPlanificada(tarea.id, areaId);
      onDescartada();
    });
  }

  function handleAddSubtarea(e: React.FormEvent) {
    e.preventDefault();
    const t = nuevaSubtarea.trim();
    if (!t) return;
    const optimista: SubtareaRow = {
      id: crypto.randomUUID(),
      titulo: t,
      hecha: false,
      orden: subtareas.length,
    };
    setSubtareas((prev) => [...prev, optimista]);
    setNuevaSubtarea("");
    startSubtarea(async () => {
      await crearSubtarea(tarea.id, t);
      fetchTareaDetalle(tarea.id).then(({ subtareas }) =>
        setSubtareas(subtareas),
      );
    });
  }

  function handleToggleSubtarea(s: SubtareaRow) {
    setSubtareas((prev) =>
      prev.map((x) => (x.id === s.id ? { ...x, hecha: !x.hecha } : x)),
    );
    startSubtarea(() => toggleSubtarea(s.id, !s.hecha));
  }

  function handleDeleteSubtarea(id: string) {
    setSubtareas((prev) => prev.filter((x) => x.id !== id));
    startSubtarea(() => eliminarSubtarea(id));
  }

  const hechas = subtareas.filter((s) => s.hecha).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[85vh] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        showCloseButton={false}
      >
        {/* Header */}
        <DialogHeader className="shrink-0 gap-2 border-b px-5 pt-5 pb-3">
          <div className="flex items-start justify-between gap-3 pr-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`mt-0.5 size-2.5 shrink-0 rounded-full ${PRIORIDAD_COLOR[prioridad]}`}
              />
              <span className="text-muted-foreground text-xs">
                Tarea planificada
              </span>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="hover:bg-muted shrink-0 rounded-md p-1 transition-colors"
              aria-label="Cerrar"
            >
              <X className="size-4" />
            </button>
          </div>
          <DialogTitle className="text-left text-base leading-snug font-semibold">
            {tarea.titulo}
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Título</Label>
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Descripción</Label>
              <Textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Agregá más contexto..."
                rows={3}
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
                  <SelectTrigger className="h-8 w-full">
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
                  <SelectTrigger className="h-8 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORIDAD_OPTS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        <span className="flex items-center gap-2">
                          <span
                            className={`size-2 rounded-full ${PRIORIDAD_COLOR[o.value]}`}
                          />
                          {o.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Responsable</Label>
                <Select
                  value={responsableId || "_none"}
                  onValueChange={(v) =>
                    setResponsableId(!v || v === "_none" ? "" : v)
                  }
                  items={RESPONSABLE_ITEMS}
                >
                  <SelectTrigger className="h-8 w-full">
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
                <Label className="text-xs">Fecha de vencimiento</Label>
                <Input
                  type="date"
                  value={fechaVencimiento}
                  onChange={(e) => setFechaVencimiento(e.target.value)}
                  className="h-8"
                />
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={isPendingSave}
              size="sm"
              className="self-start"
            >
              {isPendingSave ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin" />
                  Guardando...
                </span>
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </div>

          <Separator />

          {/* Subtareas */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">
              Subtareas
              {subtareas.length > 0 && (
                <span className="text-muted-foreground ml-1.5 font-normal">
                  {hechas}/{subtareas.length}
                </span>
              )}
            </h3>

            {loadingSubtareas ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="size-3.5 animate-spin" />
                Cargando...
              </div>
            ) : (
              <>
                {subtareas.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {subtareas.map((s) => (
                      <div
                        key={s.id}
                        className="group hover:bg-muted/50 flex items-center gap-2.5 rounded-md px-1 py-1"
                      >
                        <Checkbox
                          checked={s.hecha}
                          onCheckedChange={() => handleToggleSubtarea(s)}
                          className="shrink-0"
                        />
                        <span
                          className={`flex-1 text-sm leading-snug ${s.hecha ? "text-muted-foreground line-through" : ""}`}
                        >
                          {s.titulo}
                        </span>
                        <button
                          onClick={() => handleDeleteSubtarea(s.id)}
                          className="text-muted-foreground hover:text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                          aria-label="Eliminar subtarea"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <form
                  onSubmit={handleAddSubtarea}
                  className="flex items-center gap-2"
                >
                  <Input
                    value={nuevaSubtarea}
                    onChange={(e) => setNuevaSubtarea(e.target.value)}
                    placeholder="Agregar subtarea..."
                    className="h-8 flex-1 text-sm"
                    disabled={isPendingSubtarea}
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    size="icon-sm"
                    disabled={!nuevaSubtarea.trim() || isPendingSubtarea}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>

        {/* Footer: descartar / activar */}
        <div className="flex shrink-0 items-center justify-between border-t px-5 py-3">
          {confirmDescartar ? (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">
                ¿Descartar este borrador?
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDescartar(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDescartar}
                disabled={isPendingAccion}
              >
                {isPendingAccion ? "Descartando..." : "Confirmar"}
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={handleDescartar}
            >
              <Trash2 className="size-3.5" />
              Descartar
            </Button>
          )}
          <Button size="sm" onClick={handleActivar} disabled={isPendingAccion}>
            <CheckCircle2 className="size-3.5" />
            {isPendingAccion ? "Activando..." : "Activar tarea"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
