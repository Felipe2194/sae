"use client";

import { useEffect, useRef } from "react";
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
};

// Lista de "Mis tareas de hoy": dispara un confetti cuando la lista pasa de
// tener algo a quedar vacía en esta sesión (no en el primer render, para no
// festejar por el simple hecho de no tener nada pendiente al entrar).
export function MisTareasHoy({ tareas }: { tareas: TareaRow[] }) {
  const vioAlgunaPendiente = useRef(false);

  useEffect(() => {
    if (tareas.length > 0) {
      vioAlgunaPendiente.current = true;
      return;
    }
    if (!vioAlgunaPendiente.current) return;

    const prefiereMenosMovimiento = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefiereMenosMovimiento) return;

    confetti({
      particleCount: 90,
      spread: 70,
      startVelocity: 35,
      origin: { y: 0.6 },
      colors: ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6"],
    });
  }, [tareas.length]);

  return (
    <>
      {tareas.map((t) => (
        <TareaFila key={t.id} {...t} vencida={false} />
      ))}
    </>
  );
}
