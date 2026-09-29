"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import confetti from "canvas-confetti";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TareaFila } from "./tarea-fila";

// Cuántas tareas se ven a la vez; el resto se navega con las flechas.
const POR_PAGINA = 4;

type TareaRow = {
  id: string;
  titulo: string;
  estado: string;
  prioridad: string;
  tipo: string;
  areaColor: string | null;
  areaNombre: string | null;
  fecha: string | null;
  fechaRelativa: string | null;
  paraTodos?: boolean;
};

// Lista de "Mis tareas de hoy": dispara un confetti cuando la lista pasa de
// tener algo a quedar vacía en esta sesión (no en el primer render, para no
// festejar por el simple hecho de no tener nada pendiente al entrar).
export function MisTareasHoy({ tareas }: { tareas: TareaRow[] }) {
  const vioAlgunaPendiente = useRef(false);
  const prefiereMenosMovimiento = useReducedMotion();

  useEffect(() => {
    if (tareas.length > 0) {
      vioAlgunaPendiente.current = true;
      return;
    }
    if (!vioAlgunaPendiente.current) return;
    if (prefiereMenosMovimiento) return;

    confetti({
      particleCount: 90,
      spread: 70,
      startVelocity: 35,
      origin: { y: 0.6 },
      colors: [
        "#ef4444",
        "#f97316",
        "#eab308",
        "#22c55e",
        "#3b82f6",
        "#8b5cf6",
      ],
    });
  }, [tareas.length, prefiereMenosMovimiento]);

  const [pagina, setPagina] = useState(0);
  const totalPaginas = Math.max(1, Math.ceil(tareas.length / POR_PAGINA));
  // Si al completar tareas la página actual queda vacía, se vuelve a la
  // última que tenga algo (clamp en el render, sin efecto aparte).
  const paginaActual = Math.min(pagina, totalPaginas - 1);
  const desde = paginaActual * POR_PAGINA;
  const visibles = tareas.slice(desde, desde + POR_PAGINA);

  return (
    <div className="flex flex-col">
      <div className="divide-y overflow-x-hidden">
        <AnimatePresence initial={false}>
          {visibles.map((t) => (
            <motion.div
              key={t.id}
              layout={!prefiereMenosMovimiento}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={
                prefiereMenosMovimiento
                  ? { opacity: 0 }
                  : { opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }
              }
              transition={{ duration: 0.2 }}
            >
              <TareaFila {...t} vencida={false} soloLectura />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {totalPaginas > 1 && (
        <div className="text-muted-foreground flex items-center justify-between border-t pt-2 text-xs">
          <span className="tabular-nums">
            {desde + 1}–{desde + visibles.length} de {tareas.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Tareas anteriores"
              disabled={paginaActual === 0}
              onClick={() => setPagina(paginaActual - 1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Tareas siguientes"
              disabled={paginaActual >= totalPaginas - 1}
              onClick={() => setPagina(paginaActual + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
