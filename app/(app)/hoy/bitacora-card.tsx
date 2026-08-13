"use client";

import { useState, useTransition } from "react";
import { NotebookPen, CircleAlert, ChevronDown } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  // Si ya se cargó hoy, arranca colapsada — la mayor parte del espacio de
  // la columna se lo llevaba este formulario incluso cuando ya no hacía
  // falta tocarlo. Si todavía no se cargó, se deja abierta como recordatorio.
  const [abierta, setAbierta] = useState(!yaCargada);

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
    <Collapsible open={abierta} onOpenChange={setAbierta}>
      <Card>
        <CollapsibleTrigger
          nativeButton={false}
          render={<CardHeader className="cursor-pointer select-none pb-2 pt-4 px-4" />}
        >
          <CardTitle className="flex items-center gap-2 font-semibold">
            <NotebookPen className="size-4 text-muted-foreground shrink-0" />
            Bitácora del día
            <span className="ml-auto flex items-center gap-1.5 shrink-0">
              {!guardada && (
                <span className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-normal text-amber-800">
                  <CircleAlert className="size-3" />
                  Sin cargar
                </span>
              )}
              <ChevronDown
                className={`size-4 text-muted-foreground transition-transform ${abierta ? "rotate-180" : ""}`}
              />
            </span>
          </CardTitle>
          {!abierta && (
            <CardDescription className="text-xs">
              {guardada ? "Cargada — tocá para editar." : "Qué hiciste y qué quedó pendiente hoy."}
            </CardDescription>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="flex flex-col gap-3 px-4 pb-4 pt-1">
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
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
