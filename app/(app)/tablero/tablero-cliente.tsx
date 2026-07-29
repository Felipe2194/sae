"use client";

import { useState, useMemo } from "react";
import { Plus, X, SlidersHorizontal } from "lucide-react";
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

export function TableroCliente({ tareas, areas, usuarios, currentUserId }: Props) {
  const [selectedTarea, setSelectedTarea] = useState<TareaCard | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogEstado, setDialogEstado] = useState("por_hacer");
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);

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

  return (
    <>
      {/* ── Barra de filtros ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
          <SlidersHorizontal className="size-3.5" />
          Filtrar
        </div>

        {/* Mis tareas */}
        <Button
          variant={filtros.misTareas ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => set("misTareas", !filtros.misTareas)}
        >
          Mis tareas
        </Button>

        {/* Área */}
        <Select
          value={filtros.areaId || "_all"}
          onValueChange={(v) => set("areaId", v === "_all" ? "" : v)}
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

        {/* Prioridad */}
        <Select
          value={filtros.prioridad || "_all"}
          onValueChange={(v) => set("prioridad", v === "_all" ? "" : v)}
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

        {/* Responsable */}
        <Select
          value={filtros.responsableId || "_all"}
          onValueChange={(v) => set("responsableId", v === "_all" ? "" : v)}
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

        {/* Limpiar */}
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

        {/* Contador de resultados cuando hay filtros */}
        {hayFiltros && (
          <span className="text-xs text-muted-foreground ml-auto">
            {tareasFiltradas.length} tarea{tareasFiltradas.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ── Kanban ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNAS.map((col) => {
          const tareasColumna = tareasFiltradas.filter((t) => t.estado === col.estado);
          return (
            <div key={col.estado} className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-medium">{col.titulo}</h2>
                  <Badge variant="outline">{tareasColumna.length}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => abrirDialog(col.estado)}
                  aria-label={`Nueva tarea en ${col.titulo}`}
                >
                  <Plus className="size-4" />
                </Button>
              </div>

              <div className="flex flex-col gap-2">
                {tareasColumna.map((t) => (
                  <TareaCardItem
                    key={t.id}
                    tarea={t}
                    onClick={() => abrirSheet(t)}
                  />
                ))}
                {tareasColumna.length === 0 && !hayFiltros && (
                  <button
                    onClick={() => abrirDialog(col.estado)}
                    className="text-muted-foreground flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-4 text-sm hover:text-foreground hover:border-foreground/30 transition-colors w-full"
                  >
                    <Plus className="size-3.5" />
                    Agregar tarea
                  </button>
                )}
                {tareasColumna.length === 0 && hayFiltros && (
                  <p className="text-muted-foreground text-xs px-3 py-4 text-center">
                    Sin resultados
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
