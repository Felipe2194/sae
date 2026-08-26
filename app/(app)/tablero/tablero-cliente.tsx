"use client";

import {
  useState,
  useMemo,
  useEffect,
  useTransition,
  useOptimistic,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Plus,
  X,
  SlidersHorizontal,
  Archive,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
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
import { TareaModal } from "./tarea-modal";
import { TareaArchivadaFila } from "./tarea-archivada-fila";
import {
  moverEstadoTarea,
  fetchTareasArchivadas,
  restaurarTarea,
} from "./actions";
import { puedeMoverEstadoTarea } from "./permisos";
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
  categoria: string;
  prioridad: string;
  responsableId: string;
};

const FILTROS_VACIOS: Filtros = {
  misTareas: false,
  areaId: "",
  categoria: "",
  prioridad: "",
  responsableId: "",
};

// "Sin proyecto": tareas cotidianas sin area_id — sentinel distinto de ""
// (que significa "todas") en el filtro de Proyecto.
const SIN_PROYECTO = "_sin_proyecto";

const CATEGORIA_OPTS = [
  { value: "deportes", label: "Deportes" },
  { value: "becas", label: "Becas" },
  { value: "institucional", label: "Institucional" },
  { value: "cultura", label: "Cultura" },
  { value: "academico", label: "Académico" },
  { value: "general", label: "General" },
];

type Props = {
  tareas: TareaCard[];
  areas: AreaOption[];
  usuarios: UsuarioOption[];
  currentUserId: string;
  rol: string;
};

function Columna({
  estado,
  titulo,
  tareas,
  hayFiltros,
  colapsada,
  onToggleColapsar,
  onNueva,
  onAbrirModal,
  currentUserId,
  rol,
}: {
  estado: string;
  titulo: string;
  tareas: TareaCard[];
  hayFiltros: boolean;
  colapsada: boolean;
  onToggleColapsar: () => void;
  onNueva: () => void;
  onAbrirModal: (t: TareaCard) => void;
  currentUserId: string;
  rol: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: estado });

  if (colapsada) {
    // Franja angosta — el droppable sigue activo para poder soltar una
    // tarea acá sin tener que expandir la columna primero.
    return (
      <div
        ref={setNodeRef}
        className={`flex w-[52px] shrink-0 flex-col items-center gap-3 rounded-xl border py-3 transition-colors ${
          isOver ? "bg-primary/5 ring-primary/20 ring-1" : "bg-muted/30"
        }`}
      >
        <button
          onClick={onToggleColapsar}
          className="text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors"
          aria-label={`Expandir columna ${titulo}`}
        >
          <ChevronsRight className="size-4" />
        </button>
        <Badge variant="outline">{tareas.length}</Badge>
        <span className="text-muted-foreground mt-1 text-sm font-medium whitespace-nowrap [writing-mode:vertical-rl]">
          {titulo}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-muted/30 flex min-w-0 flex-1 flex-col gap-3 rounded-2xl p-2 transition-all duration-200">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium">{titulo}</h2>
          <Badge variant="outline">{tareas.length}</Badge>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onNueva}
            aria-label={`Nueva tarea en ${titulo}`}
          >
            <Plus className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleColapsar}
            aria-label={`Colapsar columna ${titulo}`}
          >
            <ChevronsLeft className="size-4" />
          </Button>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={`flex min-h-[80px] flex-col gap-2 rounded-lg transition-colors ${
          isOver ? "bg-primary/5 ring-primary/20 ring-1" : ""
        }`}
      >
        {tareas.map((t) => (
          <TareaCardItem
            key={t.id}
            tarea={t}
            onClick={() => onAbrirModal(t)}
            puedeMover={puedeMoverEstadoTarea(t, currentUserId, rol)}
          />
        ))}
        {tareas.length === 0 && !hayFiltros && (
          <button
            onClick={onNueva}
            className="text-muted-foreground hover:text-foreground hover:border-foreground/30 flex w-full items-center gap-1.5 rounded-lg border border-dashed px-3 py-4 text-sm transition-colors"
          >
            <Plus className="size-3.5" />
            Agregar tarea
          </button>
        )}
        {tareas.length === 0 && hayFiltros && (
          <p className="text-muted-foreground px-3 py-4 text-center text-xs">
            Sin resultados
          </p>
        )}
      </div>
    </div>
  );
}

const LS_COLUMNAS_COLAPSADAS = "tablero-columnas-colapsadas";

export function TableroCliente({
  tareas: tareasIniciales,
  areas,
  usuarios,
  currentUserId,
  rol,
}: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [optimisticTareas, moverOptimista] = useOptimistic(
    tareasIniciales,
    (
      state,
      { tareaId, nuevoEstado }: { tareaId: string; nuevoEstado: string },
    ) =>
      state.map((t) => (t.id === tareaId ? { ...t, estado: nuevoEstado } : t)),
  );
  const [selectedTarea, setSelectedTarea] = useState<TareaCard | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogEstado, setDialogEstado] = useState("por_hacer");
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dragError, setDragError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [showArchivadas, setShowArchivadas] = useState(false);
  const [archivadas, setArchivadas] = useState<TareaCard[] | null>(null);
  const [, startArchivadasTransition] = useTransition();

  // Preferencia personal de UI, no dato de la organización — se guarda en
  // localStorage, no en la base. Arranca vacío (igual en server y cliente,
  // sin mismatch de hidratación) y se hidrata desde localStorage recién
  // después de montar.
  const [colapsadas, setColapsadas] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LS_COLUMNAS_COLAPSADAS);
      if (raw) setColapsadas(new Set(JSON.parse(raw)));
    } catch {
      // localStorage no disponible o valor corrupto — se queda con columnas expandidas.
    }
  }, []);

  function toggleColapsada(estado: string) {
    setColapsadas((prev) => {
      const next = new Set(prev);
      if (next.has(estado)) next.delete(estado);
      else next.add(estado);
      try {
        window.localStorage.setItem(
          LS_COLUMNAS_COLAPSADAS,
          JSON.stringify([...next]),
        );
      } catch {
        // localStorage no disponible — la preferencia no persiste, pero no rompe nada.
      }
      return next;
    });
  }

  // Atajo desde el buscador global (Cmd/Ctrl+K → "Nueva tarea"): /tablero?nueva=1
  useEffect(() => {
    if (searchParams.get("nueva") === "1") {
      setDialogEstado("por_hacer");
      setDialogOpen(true);
      router.replace("/tablero");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe correr cuando cambia el query param
  }, [searchParams]);

  useEffect(() => {
    if (!dragError) return;
    const id = setTimeout(() => setDragError(null), 4000);
    return () => clearTimeout(id);
  }, [dragError]);

  const tareas = optimisticTareas;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const hayFiltros =
    filtros.misTareas ||
    !!filtros.areaId ||
    !!filtros.categoria ||
    !!filtros.prioridad ||
    !!filtros.responsableId;

  const tareasFiltradas = useMemo(() => {
    return tareas.filter((t) => {
      if (filtros.misTareas && t.responsable_id !== currentUserId) return false;
      if (filtros.areaId === SIN_PROYECTO) {
        if (t.area_id !== null) return false;
      } else if (filtros.areaId && t.area_id !== filtros.areaId) {
        return false;
      }
      if (filtros.categoria && t.area_categoria !== filtros.categoria)
        return false;
      if (filtros.prioridad && t.prioridad !== filtros.prioridad) return false;
      if (filtros.responsableId && t.responsable_id !== filtros.responsableId)
        return false;
      return true;
    });
  }, [tareas, filtros, currentUserId]);

  const activeTarea = activeDragId
    ? (tareas.find((t) => t.id === activeDragId) ?? null)
    : null;

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

  function abrirModal(tarea: TareaCard) {
    setSelectedTarea(tarea);
    setModalOpen(true);
  }

  function toggleArchivadas() {
    const next = !showArchivadas;
    setShowArchivadas(next);
    if (next && archivadas === null) {
      startArchivadasTransition(async () => {
        const rows = await fetchTareasArchivadas();
        setArchivadas(rows);
      });
    }
  }

  function handleRestaurarArchivada(tareaId: string) {
    setArchivadas((prev) => prev?.filter((t) => t.id !== tareaId) ?? prev);
    startArchivadasTransition(async () => {
      await restaurarTarea(tareaId);
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;
    const tareaId = active.id as string;
    const nuevoEstado = over.id as string;
    const tarea = tareas.find((t) => t.id === tareaId);
    if (!tarea || tarea.estado === nuevoEstado) return;
    if (!puedeMoverEstadoTarea(tarea, currentUserId, rol)) return;

    startTransition(async () => {
      moverOptimista({ tareaId, nuevoEstado });
      try {
        await moverEstadoTarea(tareaId, nuevoEstado);
      } catch (err) {
        // La card ya volvió sola a su columna (useOptimistic revierte al
        // asentarse la transición sin que tareasIniciales haya cambiado) —
        // esto solo avisa por qué no se movió.
        setDragError(
          err instanceof Error ? err.message : "No se pudo mover la tarea.",
        );
      }
    });
  }

  return (
    <>
      {dragError && (
        <div className="bg-card fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border px-4 py-2.5 text-sm shadow-lg">
          {dragError}
        </div>
      )}

      {/* ── Barra de filtros ──────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
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
          items={{
            _all: "Todos los proyectos",
            [SIN_PROYECTO]: "Sin proyecto",
            ...Object.fromEntries(areas.map((a) => [a.id, a.nombre])),
          }}
        >
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="Proyecto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos los proyectos</SelectItem>
            <SelectItem value={SIN_PROYECTO}>Sin proyecto</SelectItem>
            {areas.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: a.color }}
                  />
                  {a.nombre}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filtros.categoria || "_all"}
          onValueChange={(v) => set("categoria", !v || v === "_all" ? "" : v)}
          items={{
            _all: "Todas las categorías",
            ...Object.fromEntries(
              CATEGORIA_OPTS.map((c) => [c.value, c.label]),
            ),
          }}
        >
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todas las categorías</SelectItem>
            {CATEGORIA_OPTS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filtros.prioridad || "_all"}
          onValueChange={(v) => set("prioridad", !v || v === "_all" ? "" : v)}
          items={{
            _all: "Toda prioridad",
            ...Object.fromEntries(
              PRIORIDAD_OPTS.map((p) => [p.value, p.label]),
            ),
          }}
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
          onValueChange={(v) =>
            set("responsableId", !v || v === "_all" ? "" : v)
          }
          items={{
            _all: "Todos",
            ...Object.fromEntries(usuarios.map((u) => [u.id, u.nombre])),
          }}
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
            className="text-muted-foreground h-8 gap-1 text-xs"
            onClick={limpiar}
          >
            <X className="size-3" />
            Limpiar
          </Button>
        )}

        {hayFiltros && (
          <span className="text-muted-foreground ml-auto text-xs">
            {tareasFiltradas.length} tarea
            {tareasFiltradas.length !== 1 ? "s" : ""}
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
        <div className="flex flex-col gap-4 md:flex-row">
          {COLUMNAS.map((col) => {
            const tareasColumna = tareasFiltradas.filter(
              (t) => t.estado === col.estado,
            );
            return (
              <Columna
                key={col.estado}
                estado={col.estado}
                titulo={col.titulo}
                tareas={tareasColumna}
                hayFiltros={hayFiltros}
                colapsada={colapsadas.has(col.estado)}
                onToggleColapsar={() => toggleColapsada(col.estado)}
                onNueva={() => abrirDialog(col.estado)}
                onAbrirModal={abrirModal}
                currentUserId={currentUserId}
                rol={rol}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activeTarea && (
            <div className="rotate-[1.5deg] opacity-90 shadow-2xl">
              <TareaCardItem tarea={activeTarea} onClick={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* ── Archivadas ────────────────────────────────────────────────────── */}
      <div className="mt-6 border-t pt-4">
        <button
          onClick={toggleArchivadas}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs"
        >
          <Archive className="size-3.5" />
          {showArchivadas ? "Ocultar archivadas" : "Ver tareas archivadas"}
        </button>
        {showArchivadas && (
          <div className="mt-3 flex flex-col gap-1.5">
            {archivadas === null ? (
              <p className="text-muted-foreground text-xs">Cargando...</p>
            ) : archivadas.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                No hay tareas archivadas.
              </p>
            ) : (
              archivadas.map((t) => (
                <TareaArchivadaFila
                  key={t.id}
                  tarea={t}
                  onAbrir={() => abrirModal(t)}
                  onRestaurar={() => handleRestaurarArchivada(t.id)}
                />
              ))
            )}
          </div>
        )}
      </div>

      <NuevaTareaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        estadoInicial={dialogEstado}
        areas={areas}
        usuarios={usuarios}
      />

      {selectedTarea && (
        <TareaModal
          key={selectedTarea.id}
          tarea={selectedTarea}
          areas={areas}
          usuarios={usuarios}
          currentUserId={currentUserId}
          rol={rol}
          open={modalOpen}
          onOpenChange={(v) => {
            setModalOpen(v);
            if (!v) setSelectedTarea(null);
          }}
        />
      )}
    </>
  );
}
