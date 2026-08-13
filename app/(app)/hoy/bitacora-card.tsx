"use client";

import { useState, useTransition } from "react";
import { NotebookPen, CircleAlert } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { guardarBitacora } from "./actions";

type BitacoraValues = {
  hecho: string | null;
  pendiente: string | null;
  observaciones: string | null;
};

type Props = {
  bitacoraHoy: BitacoraValues | null;
  prefillHecho: string;
};

export function BitacoraCard({ bitacoraHoy, prefillHecho }: Props) {
  const yaCargada = bitacoraHoy !== null;
  const [hecho, setHecho] = useState(bitacoraHoy?.hecho ?? prefillHecho);
  const [pendiente, setPendiente] = useState(bitacoraHoy?.pendiente ?? "");
  const [observaciones, setObservaciones] = useState(bitacoraHoy?.observaciones ?? "");
  const [guardada, setGuardada] = useState(yaCargada);
  const [isPending, startTransition] = useTransition();

  function editar<T extends (v: string) => void>(setter: T) {
    return (value: string) => {
      setter(value);
      setGuardada(false);
    };
  }

  function handleGuardar() {
    startTransition(async () => {
      await guardarBitacora({
        hecho: hecho.trim(),
        pendiente: pendiente.trim(),
        observaciones: observaciones.trim(),
      });
      setGuardada(true);
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="flex items-center gap-2 font-semibold">
          <NotebookPen className="size-4 text-muted-foreground" />
          Bitácora del día
          {!guardada && (
            <span className="ml-auto flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-normal text-amber-800">
              <CircleAlert className="size-3" />
              Sin cargar
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Tu registro de hoy: qué hiciste y qué quedó pendiente. Se guarda acá
          mismo — podés seguir editándolo durante el día, no se borra al guardar.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-4 pb-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Qué hice</Label>
          <Textarea
            value={hecho}
            onChange={(e) => editar(setHecho)(e.target.value)}
            className="min-h-16 text-xs"
            placeholder="Tareas y actividades de hoy..."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Qué quedó pendiente</Label>
          <Textarea
            value={pendiente}
            onChange={(e) => editar(setPendiente)(e.target.value)}
            className="min-h-12 text-xs"
            placeholder="Para retomar mañana..."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Observaciones</Label>
          <Textarea
            value={observaciones}
            onChange={(e) => editar(setObservaciones)(e.target.value)}
            className="min-h-12 text-xs"
            placeholder="Opcional..."
          />
        </div>
        <Button
          size="sm"
          className="h-7 self-end text-xs"
          onClick={handleGuardar}
          disabled={isPending}
        >
          {isPending ? "Guardando..." : guardada ? "Guardado ✓" : "Guardar bitácora"}
        </Button>
      </CardContent>
    </Card>
  );
}
