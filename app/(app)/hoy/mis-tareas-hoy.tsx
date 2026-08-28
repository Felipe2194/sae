"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import confetti from "canvas-confetti";
import { TareaFila } from "./tarea-fila";

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
      colors: ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6"],
    });
  }, [tareas.length, prefiereMenosMovimiento]);

  return (
    <AnimatePresence initial={false}>
      {tareas.map((t) => (
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
          <TareaFila {...t} vencida={false} />
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
