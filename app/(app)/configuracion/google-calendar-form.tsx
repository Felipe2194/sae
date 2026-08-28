"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { actualizarGoogleCalendarId } from "./actions";

export function GoogleCalendarForm({
  calendarIdInicial,
  emailServicio,
}: {
  calendarIdInicial: string | null;
  emailServicio: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [calendarId, setCalendarId] = useState(calendarIdInicial ?? "");
  const [guardado, setGuardado] = useState(false);
  const [copiado, setCopiado] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGuardado(false);
    startTransition(async () => {
      await actualizarGoogleCalendarId(calendarId.trim() || null);
      setGuardado(true);
    });
  }

  function copiarEmail() {
    if (!emailServicio) return;
    navigator.clipboard.writeText(emailServicio);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <div className="flex flex-col gap-4">
      {emailServicio && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">
            1. Compartí tu Google Calendar con esta cuenta
          </Label>
          <div className="flex items-center gap-2">
            <code className="bg-muted flex-1 truncate rounded-lg border px-3 py-2 font-mono text-xs">
              {emailServicio}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={copiarEmail}
              className="h-9 shrink-0"
              type="button"
            >
              {copiado ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Configuración del calendario → Compartir con personas
            específicas → agregalo con permiso &ldquo;Realizar cambios en
            los eventos&rdquo;. No hace falta ponerlo público.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
        <Label htmlFor="gc-id" className="text-xs">
          {emailServicio ? "2. " : ""}ID de tu Google Calendar
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="gc-id"
            value={calendarId}
            onChange={(e) => setCalendarId(e.target.value)}
            placeholder="tu-calendario@group.calendar.google.com"
            className="h-9 flex-1 font-mono text-xs"
          />
          <Button type="submit" size="sm" disabled={isPending} className="shrink-0">
            {isPending ? "Guardando..." : "Guardar"}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Lo encontrás en Configuración del calendario → Integrar calendario
          → ID de calendario (si pegás por error la URL de embebido de esa
          misma sección, no pasa nada: se saca el ID solo).
        </p>
        {guardado && !isPending && (
          <span className="text-muted-foreground text-xs">Guardado.</span>
        )}
      </form>
    </div>
  );
}
