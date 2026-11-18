"use client";

import { useMemo, useTransition } from "react";
import { toast } from "sonner";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useConfirmar } from "@/components/features/confirmar-dialog";
import { mensajeDeError } from "@/lib/errores";
import type { Conflicto } from "@/lib/becas/conflictos";
import { nombreCompleto, type Asignacion } from "@/lib/becas/tipos";
import { cambiarEstadoAsignacion } from "./actions";
import type { DatosBecas } from "./becas-cliente";

export function ConflictosTab({
  anio,
  estudiantes,
  programas,
  areas,
  conflictos,
}: DatosBecas & { conflictos: Conflicto[] }) {
  const [isPending, startTransition] = useTransition();
  const [confirmar, dialogoConfirmar] = useConfirmar();
  const estudiantePorId = useMemo(() => new Map(estudiantes.map((e) => [e.id, e])), [estudiantes]);
  const programaPorId = useMemo(() => new Map(programas.map((p) => [p.id, p])), [programas]);
  const areaPorId = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);

  const ordenados = useMemo(
    () =>
      [...conflictos].sort((x, y) => {
        const ex = estudiantePorId.get(x.estudiante_id);
        const ey = estudiantePorId.get(y.estudiante_id);
        return (ex ? nombreCompleto(ex) : "").localeCompare(ey ? nombreCompleto(ey) : "", "es");
      }),
    [conflictos, estudiantePorId],
  );

  async function darDeBaja(beca: Asignacion, nombreEstudiante: string) {
    const programa = programaPorId.get(beca.programa_id)?.nombre ?? "la beca";
    const ok = await confirmar({
      titulo: `¿Dar de baja ${programa}?`,
      descripcion: `${nombreEstudiante} deja de figurar con ${programa} en ${anio}. Queda en su historial como baja y se puede reactivar desde su ficha.`,
      confirmar: "Dar de baja",
      destructivo: true,
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        const r = await cambiarEstadoAsignacion(beca.id, "baja");
        if ("error" in r) toast.error(r.error);
        else toast.success(`${programa} dada de baja.`);
      } catch (err) {
        toast.error(mensajeDeError(err, "No se pudo dar de baja."));
      }
    });
  }

  if (conflictos.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <CircleCheck className="size-7 text-green-600" />
          <p className="font-medium">No hay becas incompatibles en {anio}</p>
          <p className="text-muted-foreground max-w-md text-sm">
            Acá aparecen los estudiantes que tienen activas dos becas marcadas como incompatibles.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        {conflictos.length} estudiante{conflictos.length !== 1 ? "s tienen" : " tiene"} activas dos becas
        incompatibles en {anio}. Para resolverlo, dá de baja una de las dos.
      </p>
      {ordenados.map((c) => {
        const estudiante = estudiantePorId.get(c.estudiante_id);
        const nombre = estudiante ? nombreCompleto(estudiante) : "Estudiante";
        return (
          <Card key={`${c.a.id}-${c.b.id}`}>
            <CardContent className="flex flex-col gap-3 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <TriangleAlert className="size-4 text-red-600" />
                <span className="font-medium">{nombre}</span>
                {estudiante && (
                  <span className="text-muted-foreground text-sm tabular-nums">DNI {estudiante.dni}</span>
                )}
                {estudiante?.carrera && (
                  <span className="text-muted-foreground text-sm">· {estudiante.carrera}</span>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[c.a, c.b].map((beca) => {
                  const area = beca.area_id ? areaPorId.get(beca.area_id) : null;
                  return (
                    <div key={beca.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{programaPorId.get(beca.programa_id)?.nombre ?? "?"}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {[beca.condicion, area?.nombre].filter(Boolean).join(" · ") || "Sin área asignada"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        disabled={isPending}
                        onClick={() => darDeBaja(beca, nombre)}
                      >
                        Dar de baja
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
      {dialogoConfirmar}
    </div>
  );
}
