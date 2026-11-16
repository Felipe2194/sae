"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileSpreadsheet, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { detectarConflictos } from "@/lib/becas/conflictos";
import type {
  Area,
  Asignacion,
  Entrega,
  EntregaMarcada,
  Estudiante,
  Incompatibilidad,
  Programa,
} from "@/lib/becas/tipos";
import { cargarProgramasSugeridos } from "./actions";
import { Selector } from "./selector";
import { EstudiantesTab } from "./estudiantes-tab";
import { EntregasTab } from "./entregas-tab";
import { AreasTab } from "./areas-tab";
import { ConflictosTab } from "./conflictos-tab";
import { ProgramasTab } from "./programas-tab";
import { ImportarDialog } from "./importar-dialog";

export type DatosBecas = {
  anio: number;
  aniosDisponibles: number[];
  programas: Programa[];
  incompatibilidades: Incompatibilidad[];
  areas: Area[];
  estudiantes: Estudiante[];
  // Solo las del año elegido.
  asignaciones: Asignacion[];
  entregas: Entrega[];
  marcadas: EntregaMarcada[];
  esAdmin: boolean;
};

type Pestaña = "estudiantes" | "entregas" | "areas" | "conflictos" | "programas";

export function BecasCliente(datos: DatosBecas) {
  const { anio, aniosDisponibles, programas, incompatibilidades, asignaciones, esAdmin } = datos;
  const router = useRouter();
  const [pestaña, setPestaña] = useState<Pestaña>("estudiantes");
  const [importarAbierto, setImportarAbierto] = useState(false);
  const [isPending, startTransition] = useTransition();

  const conflictos = useMemo(
    () => detectarConflictos(asignaciones, incompatibilidades),
    [asignaciones, incompatibilidades],
  );

  const pestañas: { value: Pestaña; label: string; aviso?: number }[] = [
    { value: "estudiantes", label: "Estudiantes" },
    { value: "entregas", label: "Entregas" },
    { value: "areas", label: "Áreas y tutores" },
    { value: "conflictos", label: "Conflictos", aviso: conflictos.length },
    ...(esAdmin ? [{ value: "programas" as const, label: "Programas" }] : []),
  ];

  function cargarSugeridos() {
    startTransition(async () => {
      try {
        const r = await cargarProgramasSugeridos();
        if ("error" in r) toast.error(r.error);
        else toast.success("Programas cargados. Podés ajustarlos en la pestaña Programas.");
      } catch {
        toast.error("No se pudieron cargar los programas.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Becas</h1>
          <p className="text-muted-foreground text-sm">
            Padrón de estudiantes becados, áreas y tutores, incompatibilidades y entregas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Selector
            ariaLabel="Año"
            className="w-28"
            value={String(anio)}
            onChange={(v) => router.push(`/becas?anio=${v}`)}
            opciones={aniosDisponibles.map((a) => ({ value: String(a), label: String(a) }))}
          />
          {programas.length > 0 && (
            <Button size="sm" className="h-9" onClick={() => setImportarAbierto(true)}>
              <FileSpreadsheet className="size-4" />
              Importar Excel
            </Button>
          )}
        </div>
      </div>

      {programas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <GraduationCap className="text-muted-foreground size-8" />
            <p className="font-medium">Todavía no hay programas de becas cargados</p>
            <p className="text-muted-foreground max-w-md text-sm">
              Un programa es cada beca que se gestiona (Manuel Belgrano, Investigación y Servicio,
              BASE…). Con los programas cargados se pueden importar los listados y controlar
              incompatibilidades.
            </p>
            {esAdmin ? (
              <Button onClick={cargarSugeridos} disabled={isPending}>
                {isPending ? "Cargando…" : "Cargar programas sugeridos"}
              </Button>
            ) : (
              <p className="text-muted-foreground text-sm">Pedile a un administrador que los cargue.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="bg-muted flex w-full items-center gap-1 overflow-x-auto rounded-lg p-1 sm:w-fit">
            {pestañas.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPestaña(p.value)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  pestaña === p.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
                {!!p.aviso && (
                  <span className="rounded-full bg-red-600 px-1.5 text-[11px] leading-5 font-semibold text-white">
                    {p.aviso}
                  </span>
                )}
              </button>
            ))}
          </div>

          {pestaña === "estudiantes" && <EstudiantesTab {...datos} conflictos={conflictos} />}
          {pestaña === "entregas" && <EntregasTab {...datos} />}
          {pestaña === "areas" && <AreasTab {...datos} />}
          {pestaña === "conflictos" && <ConflictosTab {...datos} conflictos={conflictos} />}
          {pestaña === "programas" && esAdmin && <ProgramasTab {...datos} />}
        </>
      )}

      {importarAbierto && (
        <ImportarDialog
          anio={anio}
          programas={programas.filter((p) => p.activo)}
          onClose={() => setImportarAbierto(false)}
        />
      )}
    </div>
  );
}
