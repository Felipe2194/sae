"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Plus, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchNotas, crearNota, moverNota, editarNota, eliminarNota, type NotaRow } from "./actions";
import { NotaSticky, COLOR_BG } from "./nota-sticky";

const COLORES = Object.keys(COLOR_BG);
const POLL_MS = 4000;
// Debe coincidir con el h-44 w-44 (11rem = 176px) de NotaSticky.
const NOTA_SIZE = 176;

type Props = {
  notasIniciales: NotaRow[];
  sesionUsuarioId: string;
  canManageAll: boolean;
};

export function PizarraCliente({ notasIniciales, sesionUsuarioId, canManageAll }: Props) {
  const [notas, setNotas] = useState<NotaRow[]>(notasIniciales);
  const [notaNuevaId, setNotaNuevaId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Notas que el usuario actual está arrastrando o editando en este momento
  // — el polling no las debe pisar con lo que traiga del servidor.
  const suciasRef = useRef<Set<string>>(new Set());
  function marcarSucia(id: string) {
    suciasRef.current.add(id);
  }
  function limpiarSucia(id: string) {
    suciasRef.current.delete(id);
  }

  useEffect(() => {
    let cancelled = false;
    function cargar() {
      fetchNotas().then((rows) => {
        if (cancelled) return;
        setNotas((prev) => {
          const propias = prev.filter((n) => suciasRef.current.has(n.id));
          const idsPropias = new Set(propias.map((n) => n.id));
          const delServidor = rows.filter((n) => !idsPropias.has(n.id));
          return [...delServidor, ...propias];
        });
      });
    }
    const interval = setInterval(cargar, POLL_MS);
    function alVolver() {
      if (document.visibilityState === "visible") cargar();
    }
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // El lienzo mide lo mismo que el contenedor visible (nada de scroll a un
  // área gigante) — las notas quedan acotadas a ese espacio real.
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    function medir() {
      setCanvasSize({ width: el!.clientWidth, height: el!.clientHeight });
    }
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function clamp(valor: number, dimension: number) {
    return Math.min(Math.max(valor, 0), Math.max(dimension - NOTA_SIZE, 0));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, delta } = event;
    if (delta.x === 0 && delta.y === 0) {
      limpiarSucia(active.id as string);
      return;
    }
    const id = active.id as string;
    const nota = notas.find((n) => n.id === id);
    if (!nota) return;

    const nuevoX = clamp(nota.pos_x + delta.x, canvasSize.width);
    const nuevoY = clamp(nota.pos_y + delta.y, canvasSize.height);
    const maxZ = notas.reduce((m, n) => Math.max(m, n.z_index), 0) + 1;

    setNotas((prev) =>
      prev.map((n) => (n.id === id ? { ...n, pos_x: nuevoX, pos_y: nuevoY, z_index: maxZ } : n)),
    );
    startTransition(async () => {
      await moverNota(id, nuevoX, nuevoY, maxZ);
      limpiarSucia(id);
    });
  }

  function handleCrear() {
    startTransition(async () => {
      const color = COLORES[Math.floor(Math.random() * COLORES.length)];
      const posX = Math.random() * Math.max(canvasSize.width - NOTA_SIZE, 0);
      const posY = Math.random() * Math.max(canvasSize.height - NOTA_SIZE, 0);
      const nota = await crearNota("", color, posX, posY);
      marcarSucia(nota.id);
      setNotaNuevaId(nota.id);
      setNotas((prev) => [...prev, nota]);
    });
  }

  function handleEditar(id: string, contenido: string) {
    setNotas((prev) => prev.map((n) => (n.id === id ? { ...n, contenido } : n)));
    startTransition(async () => {
      await editarNota(id, contenido);
      limpiarSucia(id);
    });
  }

  function handleEliminar(id: string) {
    limpiarSucia(id);
    setNotas((prev) => prev.filter((n) => n.id !== id));
    startTransition(() => eliminarNota(id));
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-3rem)] max-w-[100rem] flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <StickyNote className="text-muted-foreground size-5" />
            Pizarra de ideas
          </h1>
          <p className="text-muted-foreground text-xs">
            Un corcho compartido — pegá ideas o comentarios que todo el equipo pueda ver.
          </p>
        </div>
        <Button size="sm" onClick={handleCrear} disabled={isPending} className="gap-1.5">
          <Plus className="size-4" />
          Nueva nota
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={({ active }) => marcarSucia(active.id as string)}
        onDragEnd={handleDragEnd}
        onDragCancel={({ active }) => limpiarSucia(active.id as string)}
      >
        <div
          ref={canvasRef}
          className="border-border/60 relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl border bg-[radial-gradient(circle,var(--color-border)_1px,transparent_1px)] bg-[length:22px_22px]"
        >
          {notas.length === 0 && (
            <div className="text-muted-foreground pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-sm">
              <StickyNote className="size-8 opacity-30" />
              Todavía no hay ninguna idea pegada. ¡Arrancá vos!
            </div>
          )}

          {/* absolute inset-0 (no relative): un hijo en flujo normal empuja
              el min-content de los contenedores flex ancestros (el layout
              compartido) y desborda la página; posicionado absoluto queda
              afuera de ese cálculo, y con inset-0 mide justo el lienzo. */}
          <div className="absolute inset-0">
            {notas.map((n) => (
              <NotaSticky
                key={n.id}
                nota={n}
                puedeBorrar={n.autor_id === sesionUsuarioId || canManageAll}
                autoEditar={n.id === notaNuevaId}
                onEmpezarEdicion={() => marcarSucia(n.id)}
                onEditar={(contenido) => handleEditar(n.id, contenido)}
                onEliminar={() => handleEliminar(n.id)}
              />
            ))}
          </div>
        </div>
      </DndContext>
    </div>
  );
}
