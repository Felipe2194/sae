"use client";

import { useState, useMemo, useTransition, useOptimistic } from "react";
import { Plus, X, SlidersHorizontal } from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TareaCardItem } from "./tarea-card";
import { NuevaTareaDialog } from "./nueva-tarea-dialog";
import { TareaSheet } from "./tarea-sheet";
import { moverEstadoTarea } from "./actions";
import type { TareaCard, AreaOption, UsuarioOption } from "./page";

const COLUMNAS = [
  { estado: "por_hacer", titulo: "Por hacer" },
  { estado: "en_progreso", titulo: "En progreso" },
  { estado: "hecha", titulo: "Hecha" },
] as const;

const PRIORIDAD_OPTS = [
  { value: "alta", label: "Alta" },
  { value: "media", label: "Media" },
  { value: "baja", label: "Baja" },
];

type Filtros = {
  misTareas: boolean;
  areaId: string;
  prioridad: string;
  responsableId: string;
};

const FILTROS_VACIOS: Filtros = {
  misTareas: false,
  areaId: "",
  prioridad: "",
  responsableId: "",
};

type Props = {
  tareas: TareaCard[];
  areas: AreaOption[];
  usuarios: UsuarioOption[];
  currentUserId: string;
};

function Columna({
  estado,
  titulo,
  tareas,
  hayFiltros,
  onNueva,
  onAbrirSheet,
}: {
  estado: string;
  titulo: string;
  tareas: TareaCard[];
  hayFiltros: boolean;
  onNueva: () => void;
  onAbrirSheet: (t: TareaCard) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: estado });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium">{titulo}</h2>
          <Badge variant="outline">{tareas.length}</Badge>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onNueva}
          aria-label={`Nueva tarea en ${titulo}`}
        >
          <Plus className="size-4" />
        </Button>
      </div>

      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 min-h-[80px] rounded-lg transition-colors ${
          isOver ? "bg-primary/5 ring-1 ring-primary/20" : ""
        }`}
      >
        {tareas.map((t) => (
          <TareaCardItem
            key={t.id}
            tarea={t}
            onClick={() => onAbrirSheet(t)}
          />
        ))}
        {tareas.length === 0 && !hayFiltros && (
          <button
            onClick={onNueva}
            className="text-muted-foreground flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-4 text-sm hover:text-foreground hover:border-foreground/30 transition-colors w-full"
          >
            <Plus className="size-3.5" />
            Agregar tarea
          </button>
        )}
        {tareas.length === 0 && hayFiltros && (
          <p className="text-muted-foreground text-xs px-3 py-4 text-center">
            Sin resultados
          </p>
        )}
      </div>
    </div>
  );
}

export function TableroCliente({ tareas: tareasIniciales, areas, usuarios, currentUserId }: Props) {
  const [optimisticTareas, moverOptimista] = useOptimistic(
    tareasIniciales,
    (state, { tareaId, nuevoEstado }: { tareaId: string; nuevoEstado: string }) =>
      state.map((t) => (t.id === tareaId ? { ...t, estado: nuevoEstado } : t)),
  );
  const [selectedTarea, setSelectedTarea] = useState<TareaCard | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogEstado, setDialogEstado] = useState("por_hacer");
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const tareas = optimisticTareas;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const hayFiltros =
    filtros.misTareas || !!filtros.areaId || !!filtros.prioridad || !!filtros.responsableId;

  const tareasFiltradas = useMemo(() => {
    return tareas.filter((t) => {
      if (filtros.misTareas && t.responsable_id !== currentUserId) return false;
      if (filtros.areaId && t.area_id !== filtros.areaId) return false;
      if (filtros.prioridad && t.prioridad !== filtros.prioridad) return false;
      if (filtros.responsableId && t.responsable_id !== filtros.responsableId) return false;
      return true;
    });
  }, [tareas, filtros, currentUserId]);

  const activeTarea = activeDragId ? tareas.find((t) => t.id === activeDragId) ?? null : null;

  function set<K extends keyof Filtros>(key: K, value: Filtros[K]) {
    setFiltros((prev) => ({ ...prev, [key]: value }));
  }

  function limpiar() {
    setFiltros(FILTROS_VACIOS);
  }

  function abrirDialog(estado: string) {
    setDialogEstado(estado);
    setDialogOpen(true);
  }

  function abrirSheet(tarea: TareaCard) {
    setSelectedTarea(tarea);
    setSheetOpen(true);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;
    const tareaId = active.id as string;
    const nuevoEstado = over.id as string;
    const tarea = tareas.find((t) => t.id === tareaId);
    if (!tarea || tarea.estado === nuevoEstado) return;

    startTransition(async () => {
      moverOptimista({ tareaId, nuevoEstado });
      await moverEstadoTarea(tareaId, nuevoEstado);
    });
  }

  return (
    <>
      {/* ── Barra de filtros ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
          <SlidersHorizontal className="size-3.5" />
          Filtrar
        </div>

        <Button
          variant={filtros.misTareas ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => set("misTareas", !filtros.misTareas)}
        >
          Mis tareas
        </Button>

        <Select
          value={filtros.areaId || "_all"}
          onValueChange={(v) => set("areaId", !v || v === "_all" ? "" : v)}
        >
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="Área" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todas las áreas</SelectItem>
            {areas.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block size-2 rounded-full shrink-0"
                    style={{ backgroundColor: a.color }}
                  />
                  {a.nombre}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filtros.prioridad || "_all"}
          onValueChange={(v) => set("prioridad", !v || v === "_all" ? "" : v)}
        >
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue placeholder="Prioridad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Toda prioridad</SelectItem>
            {PRIORIDAD_OPTS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filtros.responsableId || "_all"}
          onValueChange={(v) => set("responsableId", !v || v === "_all" ? "" : v)}
        >
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="Responsable" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos</SelectItem>
            {usuarios.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hayFiltros && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground gap-1"
            onClick={limpiar}
          >
            <X className="size-3" />
            Limpiar
          </Button>
        )}

        {hayFiltros && (
          <span className="text-xs text-muted-foreground ml-auto">
            {tareasFiltradas.length} tarea{tareasFiltradas.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ── Kanban ────────────────────────────────────────────────────────── */}
      <DndContext
        sensors={sensors}
        onDragStart={({ active }) => setActiveDragId(active.id as string)}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDragId(null)}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {COLUMNAS.map((col) => {
            const tareasColumna = tareasFiltradas.filter((t) => t.estado === col.estado);
            return (
              <Columna
                key={col.estado}
                estado={col.estado}
                titulo={col.titulo}
                tareas={tareasColumna}
                hayFiltros={hayFiltros}
                onNueva={() => abrirDialog(col.estado)}
                onAbrirSheet={abrirSheet}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activeTarea && (
            <div className="rotate-2 opacity-90 shadow-xl">
              <TareaCardItem tarea={activeTarea} onClick={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <NuevaTareaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        estadoInicial={dialogEstado}
        areas={areas}
        usuarios={usuarios}
      />

      {selectedTarea && (
        <TareaSheet
          key={selectedTarea.id}
          tarea={selectedTarea}
          areas={areas}
          usuarios={usuarios}
          currentUserId={currentUserId}
          open={sheetOpen}
          onOpenChange={(v) => {
            setSheetOpen(v);
            if (!v) setSelectedTarea(null);
          }}
        />
      )}
    </>
  );
}
