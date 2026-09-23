"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  SECCIONES_OPCIONALES,
  type SeccionOpcionalKey,
  type SeccionesHabilitadas,
} from "@/lib/secciones";
import { cn } from "@/lib/utils";
import { actualizarSecciones } from "./actions";

// Tres estados por sección: toda la organización, solo quien administra
// (para ir armándola antes de mostrarla al equipo, como Informes) o apagada.
type Visibilidad = "equipo" | "admin" | "off";

const OPCIONES: { value: Visibilidad; label: string }[] = [
  { value: "equipo", label: "Todo el equipo" },
  { value: "admin", label: "Solo administradores" },
  { value: "off", label: "Desactivada" },
];

export function SeccionesForm({
  secciones,
  soloAdmin,
}: {
  secciones: SeccionesHabilitadas;
  soloAdmin: SeccionOpcionalKey[];
}) {
  const [isPending, startTransition] = useTransition();
  const [valores, setValores] = useState<Record<SeccionOpcionalKey, Visibilidad>>(
    () =>
      Object.fromEntries(
        SECCIONES_OPCIONALES.map((s) => [
          s.key,
          !secciones[s.key] ? "off" : soloAdmin.includes(s.key) ? "admin" : "equipo",
        ]),
      ) as Record<SeccionOpcionalKey, Visibilidad>,
  );
  const [guardado, setGuardado] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGuardado(false);
    const habilitadas = Object.fromEntries(
      SECCIONES_OPCIONALES.map((s) => [s.key, valores[s.key] !== "off"]),
    ) as SeccionesHabilitadas;
    const soloAdminNuevo = SECCIONES_OPCIONALES.filter((s) => valores[s.key] === "admin").map(
      (s) => s.key,
    );
    startTransition(async () => {
      await actualizarSecciones(habilitadas, soloAdminNuevo);
      setGuardado(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col divide-y">
        {SECCIONES_OPCIONALES.map((s) => (
          <div
            key={s.key}
            className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-sm font-medium">{s.label}</p>
              <p className="text-muted-foreground text-xs">{s.descripcion}</p>
            </div>
            <div
              role="radiogroup"
              aria-label={`Quién ve ${s.label}`}
              className="bg-muted flex w-full shrink-0 items-center gap-1 rounded-lg p-1 sm:w-auto"
            >
              {OPCIONES.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={valores[s.key] === o.value}
                  onClick={() => setValores((v) => ({ ...v, [s.key]: o.value }))}
                  className={cn(
                    "flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors sm:flex-none",
                    valores[s.key] === o.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={isPending} className="w-fit">
          {isPending ? "Guardando..." : "Guardar cambios"}
        </Button>
        {guardado && !isPending && (
          <span className="text-muted-foreground text-xs">Guardado.</span>
        )}
      </div>
    </form>
  );
}
