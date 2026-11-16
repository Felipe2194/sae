"use client";

import { useMemo, useState } from "react";
import { Plus, Search, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Conflicto } from "@/lib/becas/conflictos";
import { nombreCompleto, type Asignacion } from "@/lib/becas/tipos";
import type { DatosBecas } from "./becas-cliente";
import { CHIP_ESTADO, Selector } from "./selector";
import { EstudianteDialog } from "./estudiante-dialog";

const MAX_FILAS = 300;

function sinAcentos(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function EstudiantesTab(props: DatosBecas & { conflictos: Conflicto[] }) {
  const { anio, estudiantes, asignaciones, programas, areas, conflictos } = props;
  const [busqueda, setBusqueda] = useState("");
  // "_becados": con alguna beca este año · "_todos": todo el padrón ·
  // "_sin": sin beca este año · o el id de un programa.
  const [filtro, setFiltro] = useState("_becados");
  // id del estudiante abierto, "nuevo" para el alta, null cerrado.
  const [ficha, setFicha] = useState<string | null>(null);

  const programaPorId = useMemo(() => new Map(programas.map((p) => [p.id, p])), [programas]);
  const areaPorId = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);
  const becasPorEstudiante = useMemo(() => {
    const mapa = new Map<string, Asignacion[]>();
    for (const a of asignaciones) {
      const lista = mapa.get(a.estudiante_id);
      if (lista) lista.push(a);
      else mapa.set(a.estudiante_id, [a]);
    }
    return mapa;
  }, [asignaciones]);
  const enConflicto = useMemo(() => new Set(conflictos.map((c) => c.estudiante_id)), [conflictos]);

  const filtrados = useMemo(() => {
    const q = sinAcentos(busqueda.trim());
    return estudiantes.filter((e) => {
      const becas = becasPorEstudiante.get(e.id) ?? [];
      if (filtro === "_becados" && becas.length === 0) return false;
      if (filtro === "_sin" && becas.length > 0) return false;
      if (!filtro.startsWith("_") && !becas.some((b) => b.programa_id === filtro)) return false;
      if (!q) return true;
      return (
        sinAcentos(`${e.apellido} ${e.nombre}`).includes(q) ||
        e.dni.includes(q) ||
        (e.legajo ?? "").includes(q)
      );
    });
  }, [estudiantes, becasPorEstudiante, busqueda, filtro]);

  const visibles = filtrados.slice(0, MAX_FILAS);
  const abierto = ficha && ficha !== "nuevo" ? (estudiantes.find((e) => e.id === ficha) ?? null) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, DNI o legajo"
            className="h-9 pl-8"
            aria-label="Buscar estudiante"
          />
        </div>
        <Selector
          ariaLabel="Filtrar"
          className="w-56"
          value={filtro}
          onChange={setFiltro}
          opciones={[
            { value: "_becados", label: `Con beca en ${anio}` },
            ...programas.map((p) => ({ value: p.id, label: p.nombre })),
            { value: "_sin", label: `Sin beca en ${anio}` },
            { value: "_todos", label: "Todo el padrón" },
          ]}
        />
        <span className="text-muted-foreground text-sm">
          {filtrados.length} estudiante{filtrados.length !== 1 ? "s" : ""}
        </span>
        <Button size="sm" variant="outline" className="ml-auto h-9" onClick={() => setFicha("nuevo")}>
          <Plus className="size-4" />
          Nuevo estudiante
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtrados.length === 0 ? (
            <p className="text-muted-foreground px-4 py-10 text-center text-sm">
              {estudiantes.length === 0
                ? "Todavía no hay estudiantes. Importá un listado en Excel o cargá uno a mano."
                : "No hay estudiantes que coincidan con ese filtro."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-xs">
                    <th className="px-3 py-2 font-medium">Estudiante</th>
                    <th className="px-3 py-2 font-medium">DNI</th>
                    <th className="hidden px-3 py-2 font-medium sm:table-cell">Legajo</th>
                    <th className="px-3 py-2 font-medium">Becas {anio}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((e) => {
                    const becas = becasPorEstudiante.get(e.id) ?? [];
                    return (
                      <tr
                        key={e.id}
                        className="hover:bg-muted/50 cursor-pointer border-b last:border-0"
                        onClick={() => setFicha(e.id)}
                      >
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="text-left font-medium hover:underline"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setFicha(e.id);
                            }}
                          >
                            {nombreCompleto(e)}
                          </button>
                          {e.carrera && <p className="text-muted-foreground text-xs">{e.carrera}</p>}
                        </td>
                        <td className="px-3 py-2 tabular-nums">{e.dni}</td>
                        <td className="hidden px-3 py-2 tabular-nums sm:table-cell">{e.legajo ?? "—"}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-1">
                            {enConflicto.has(e.id) && (
                              <span title="Tiene becas incompatibles" className="text-red-600">
                                <TriangleAlert className="size-4" aria-label="Becas incompatibles" />
                              </span>
                            )}
                            {becas.length === 0 && <span className="text-muted-foreground">—</span>}
                            {becas.map((b) => {
                              const area = b.area_id ? areaPorId.get(b.area_id) : null;
                              return (
                                <Badge
                                  key={b.id}
                                  variant="outline"
                                  className={CHIP_ESTADO[b.estado]}
                                  title={[
                                    b.estado !== "activa" ? b.estado : null,
                                    b.condicion,
                                    area?.nombre,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                >
                                  {programaPorId.get(b.programa_id)?.nombre ?? "?"}
                                </Badge>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {filtrados.length > MAX_FILAS && (
            <p className="text-muted-foreground border-t px-3 py-2 text-xs">
              Se muestran los primeros {MAX_FILAS} de {filtrados.length}. Usá el buscador para acotar.
            </p>
          )}
        </CardContent>
      </Card>

      {ficha && (
        <EstudianteDialog
          key={ficha}
          {...props}
          estudiante={abierto}
          becasDelAnio={abierto ? (becasPorEstudiante.get(abierto.id) ?? []) : []}
          onClose={() => setFicha(null)}
          onCreado={(id) => setFicha(id)}
        />
      )}
    </div>
  );
}
