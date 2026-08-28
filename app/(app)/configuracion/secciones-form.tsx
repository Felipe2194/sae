"use client";

import { useState, useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SECCIONES_OPCIONALES, type SeccionesHabilitadas } from "@/lib/secciones";
import { actualizarSecciones } from "./actions";

export function SeccionesForm({
  secciones,
}: {
  secciones: SeccionesHabilitadas;
}) {
  const [isPending, startTransition] = useTransition();
  const [valores, setValores] = useState(secciones);
  const [guardado, setGuardado] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGuardado(false);
    startTransition(async () => {
      await actualizarSecciones(valores);
      setGuardado(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {SECCIONES_OPCIONALES.map((s) => (
          <label
            key={s.key}
            className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-md p-2 -m-2"
          >
            <Checkbox
              checked={valores[s.key]}
              onCheckedChange={(checked) =>
                setValores((v) => ({ ...v, [s.key]: checked === true }))
              }
              className="mt-0.5"
            />
            <div className="flex flex-col gap-0.5">
              <Label className="cursor-pointer text-sm font-medium">
                {s.label}
              </Label>
              <p className="text-muted-foreground text-xs">{s.descripcion}</p>
            </div>
          </label>
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
