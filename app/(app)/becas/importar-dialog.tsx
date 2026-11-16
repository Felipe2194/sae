"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mensajeDeError } from "@/lib/errores";
import {
  CAMPOS_IMPORTABLES,
  MAX_FILAS_IMPORTACION,
  armarFilas,
  detectarColumnas,
  detectarFilaEncabezados,
  textoCelda,
  type CampoImportable,
  type Celda,
  type MapeoColumnas,
  type SituacionFila,
} from "@/lib/becas/importacion";
import type { Programa } from "@/lib/becas/tipos";
import { aplicarImportacion, previsualizarImportacion, type VistaPreviaImportacion } from "./actions";
import { Selector } from "./selector";

type Hoja = { nombre: string; filas: Celda[][] };

const NO_USAR = "_";

// "A", "B", … "Z", "AA", … como en la planilla.
function letraColumna(indice: number): string {
  let n = indice;
  let letras = "";
  do {
    letras = String.fromCharCode(65 + (n % 26)) + letras;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letras;
}

const SITUACIONES: { value: SituacionFila; label: string; ayuda: string }[] = [
  { value: "nuevo", label: "Estudiantes nuevos", ayuda: "No estaban en el padrón: se dan de alta con esta beca." },
  { value: "existente", label: "Ya en el padrón", ayuda: "Se les suma esta beca." },
  { value: "ya_tiene", label: "Ya tenían esta beca", ayuda: "No se duplica; solo se completan datos que falten." },
  { value: "conflicto", label: "Con beca incompatible", ayuda: "Se cargan igual y quedan en Conflictos para resolver." },
];

export function ImportarDialog({
  anio,
  programas,
  onClose,
}: {
  anio: number;
  programas: Programa[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [archivo, setArchivo] = useState<string | null>(null);
  const [hojas, setHojas] = useState<Hoja[]>([]);
  const [hojaIdx, setHojaIdx] = useState(0);
  const [filaEnc, setFilaEnc] = useState(0); // base 0
  const [mapeo, setMapeo] = useState<MapeoColumnas | null>(null);
  const [programaId, setProgramaId] = useState(programas[0]?.id ?? "");
  const [vista, setVista] = useState<VistaPreviaImportacion | null>(null);

  const hoja = hojas[hojaIdx];

  function elegirHoja(lista: Hoja[], indice: number) {
    const filas = lista[indice]?.filas ?? [];
    const enc = detectarFilaEncabezados(filas);
    setHojaIdx(indice);
    setFilaEnc(enc);
    setMapeo(detectarColumnas(filas[enc] ?? []));
    setVista(null);
  }

  async function leerArchivo(file: File) {
    setError(null);
    setVista(null);
    setLeyendo(true);
    try {
      // Import dinámico: la librería solo se baja cuando alguien importa.
      const { default: readXlsxFile } = await import("read-excel-file/browser");
      const resultado = await readXlsxFile(file);
      const lista: Hoja[] = resultado
        .map((h) => ({ nombre: h.sheet, filas: h.data as unknown as Celda[][] }))
        .filter((h) => h.filas.length > 0);
      if (lista.length === 0) {
        setError("El archivo no tiene filas.");
        setHojas([]);
        return;
      }
      // Se abre en la primera hoja que tenga una columna de DNI reconocible.
      const conDni = lista.findIndex(
        (h) => detectarColumnas(h.filas[detectarFilaEncabezados(h.filas)] ?? []).dni !== null,
      );
      setArchivo(file.name);
      setHojas(lista);
      elegirHoja(lista, conDni >= 0 ? conDni : 0);
    } catch {
      setHojas([]);
      setError("No se pudo leer el archivo. Tiene que ser un Excel .xlsx (desde Google Sheets: Archivo → Descargar → Microsoft Excel).");
    } finally {
      setLeyendo(false);
    }
  }

  const encabezados = useMemo(() => hoja?.filas[filaEnc] ?? [], [hoja, filaEnc]);
  const opcionesColumna = useMemo(() => {
    const ancho = Math.max(encabezados.length, ...(hoja?.filas.slice(0, 50).map((f) => f.length) ?? [0]));
    return [
      { value: NO_USAR, label: "— No usar —" },
      ...Array.from({ length: ancho }, (_, i) => ({
        value: String(i),
        label: `${letraColumna(i)}: ${textoCelda(encabezados[i]) ?? "(sin título)"}`.slice(0, 60),
      })),
    ];
  }, [encabezados, hoja]);

  const lectura = useMemo(
    () => (hoja && mapeo ? armarFilas(hoja.filas, filaEnc, mapeo) : null),
    [hoja, mapeo, filaEnc],
  );
  const tieneNombre = !!mapeo && (mapeo.apellido !== null || mapeo.apellido_nombre !== null || mapeo.nombre !== null);
  const listo = !!lectura && lectura.filas.length > 0 && mapeo?.dni !== null && tieneNombre && !!programaId;
  const demasiadas = (lectura?.filas.length ?? 0) > MAX_FILAS_IMPORTACION;

  function cambiarColumna(campo: CampoImportable, valor: string) {
    setMapeo((m) => (m ? { ...m, [campo]: valor === NO_USAR ? null : Number(valor) } : m));
    setVista(null);
  }

  function revisar() {
    if (!lectura) return;
    setError(null);
    startTransition(async () => {
      try {
        const r = await previsualizarImportacion(programaId, anio, lectura.filas);
        if ("error" in r) setError(r.error);
        else setVista(r);
      } catch (err) {
        setError(mensajeDeError(err, "No se pudo revisar el archivo."));
      }
    });
  }

  function importar() {
    if (!lectura) return;
    setError(null);
    startTransition(async () => {
      try {
        const r = await aplicarImportacion(programaId, anio, lectura.filas);
        if ("error" in r) {
          setError(r.error);
          return;
        }
        toast.success(
          [
            `${r.becasNuevas} beca${r.becasNuevas !== 1 ? "s" : ""} cargada${r.becasNuevas !== 1 ? "s" : ""}`,
            `${r.estudiantesNuevos} estudiante${r.estudiantesNuevos !== 1 ? "s" : ""} nuevo${r.estudiantesNuevos !== 1 ? "s" : ""}`,
            r.becasYaExistentes > 0 ? `${r.becasYaExistentes} ya estaban` : null,
            r.areasCreadas > 0 ? `${r.areasCreadas} área${r.areasCreadas !== 1 ? "s" : ""} creada${r.areasCreadas !== 1 ? "s" : ""}` : null,
          ]
            .filter(Boolean)
            .join(" · "),
        );
        onClose();
      } catch (err) {
        setError(mensajeDeError(err, "No se pudo importar."));
      }
    });
  }

  const conteo = useMemo(() => {
    const c: Record<SituacionFila, number> = { nuevo: 0, existente: 0, ya_tiene: 0, conflicto: 0 };
    for (const f of vista?.filas ?? []) c[f.situacion]++;
    return c;
  }, [vista]);
  const conflictos = vista?.filas.filter((f) => f.situacion === "conflicto") ?? [];
  const programaNombre = programas.find((p) => p.id === programaId)?.nombre ?? "";

  return (
    <Dialog open onOpenChange={(o) => !o && !isPending && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar listado desde Excel</DialogTitle>
          <DialogDescription>
            Carga becas de {anio} a partir de un listado. Los estudiantes se identifican por DNI: si ya
            están en el padrón no se duplican.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Archivo .xlsx</Label>
            <Input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={leyendo || isPending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void leerArchivo(file);
              }}
            />
            {leyendo && <p className="text-muted-foreground text-xs">Leyendo el archivo…</p>}
          </div>

          {hoja && mapeo && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Programa de beca</Label>
                  <Selector
                    ariaLabel="Programa"
                    className="w-full"
                    value={programaId}
                    onChange={(v) => {
                      setProgramaId(v);
                      setVista(null);
                    }}
                    opciones={programas.map((p) => ({ value: p.id, label: p.nombre }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Hoja</Label>
                  <Selector
                    ariaLabel="Hoja"
                    className="w-full"
                    value={String(hojaIdx)}
                    onChange={(v) => elegirHoja(hojas, Number(v))}
                    opciones={hojas.map((h, i) => ({ value: String(i), label: h.nombre }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Fila de los títulos</Label>
                  <Input
                    type="number"
                    min={1}
                    max={hoja.filas.length}
                    value={filaEnc + 1}
                    className="h-9"
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isInteger(n) || n < 1 || n > hoja.filas.length) return;
                      setFilaEnc(n - 1);
                      setMapeo(detectarColumnas(hoja.filas[n - 1] ?? []));
                      setVista(null);
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div>
                  <p className="text-sm font-medium">Columnas</p>
                  <p className="text-muted-foreground text-xs">
                    Se detectaron por el título. Revisá que cada dato apunte a la columna correcta; DNI y
                    apellido (o apellido y nombre juntos) son obligatorios.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                  {CAMPOS_IMPORTABLES.map(({ campo, label }) => (
                    <div key={campo} className="grid grid-cols-[minmax(0,10rem)_1fr] items-center gap-2">
                      <span className="text-xs">{label}</span>
                      <Selector
                        ariaLabel={label}
                        className="w-full"
                        value={mapeo[campo] === null ? NO_USAR : String(mapeo[campo])}
                        onChange={(v) => cambiarColumna(campo, v)}
                        opciones={opcionesColumna}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {lectura && (
                <div className="bg-muted/50 flex flex-col gap-2 rounded-lg p-3 text-sm">
                  <p className="flex items-center gap-1.5 font-medium">
                    <FileSpreadsheet className="size-4" />
                    {archivo}: {lectura.filas.length} fila{lectura.filas.length !== 1 ? "s" : ""} con DNI
                  </p>
                  {(lectura.descartadas > 0 || lectura.repetidas > 0) && (
                    <p className="text-muted-foreground text-xs">
                      {[
                        lectura.descartadas > 0
                          ? `${lectura.descartadas} fila${lectura.descartadas !== 1 ? "s" : ""} sin DNI o sin nombre (títulos, subtotales) que no se cargan`
                          : null,
                        lectura.repetidas > 0
                          ? `${lectura.repetidas} con el DNI repetido en la planilla (se toma la primera)`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  {lectura.filas.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-muted-foreground text-left">
                            <th className="py-1 pr-3 font-medium">Fila</th>
                            <th className="py-1 pr-3 font-medium">DNI</th>
                            <th className="py-1 pr-3 font-medium">Estudiante</th>
                            <th className="py-1 pr-3 font-medium">Legajo</th>
                            <th className="py-1 pr-3 font-medium">Condición</th>
                            <th className="py-1 pr-3 font-medium">Área</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lectura.filas.slice(0, 4).map((f) => (
                            <tr key={f.fila}>
                              <td className="py-0.5 pr-3 tabular-nums">{f.fila}</td>
                              <td className="py-0.5 pr-3 tabular-nums">{f.dni}</td>
                              <td className="py-0.5 pr-3">{f.nombre ? `${f.apellido}, ${f.nombre}` : f.apellido}</td>
                              <td className="py-0.5 pr-3">{f.legajo ?? "—"}</td>
                              <td className="py-0.5 pr-3">
                                {f.estado === "rechazada" ? "Rechazada" : (f.condicion ?? "—")}
                              </td>
                              <td className="max-w-48 truncate py-0.5 pr-3">{f.area ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {demasiadas && (
                    <p className="text-destructive text-xs">
                      Son más de {MAX_FILAS_IMPORTACION} filas: dividí el archivo en partes.
                    </p>
                  )}
                </div>
              )}

              {vista && (
                <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
                  <p className="font-medium">
                    Qué va a pasar al importar en {programaNombre} {anio}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {SITUACIONES.filter((s) => conteo[s.value] > 0).map((s) => (
                      <li key={s.value} className="flex flex-wrap items-baseline gap-x-2">
                        <span className="w-8 text-right font-semibold tabular-nums">{conteo[s.value]}</span>
                        <span className={s.value === "conflicto" ? "font-medium text-red-600" : "font-medium"}>
                          {s.label}
                        </span>
                        <span className="text-muted-foreground text-xs">{s.ayuda}</span>
                      </li>
                    ))}
                  </ul>
                  {vista.areasNuevas.length > 0 && (
                    <p className="text-muted-foreground text-xs">
                      Se crean {vista.areasNuevas.length} área{vista.areasNuevas.length !== 1 ? "s" : ""} que no
                      existían en {anio}: {vista.areasNuevas.slice(0, 6).join("; ")}
                      {vista.areasNuevas.length > 6 ? "…" : ""}
                    </p>
                  )}
                  {conflictos.length > 0 && (
                    <div className="flex flex-col gap-1 rounded-md bg-red-50 p-2 text-xs text-red-900 dark:bg-red-950 dark:text-red-200">
                      <p className="flex items-center gap-1 font-medium">
                        <TriangleAlert className="size-3.5" />
                        Ya tienen activa una beca incompatible con {programaNombre}:
                      </p>
                      <ul className="max-h-32 overflow-y-auto">
                        {conflictos.map((f) => (
                          <li key={f.dni}>
                            {f.nombre} (DNI {f.dni}) — {f.choca_con.join(", ")}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          {vista ? (
            <Button onClick={importar} disabled={isPending || !listo || demasiadas}>
              {isPending ? "Importando…" : `Importar ${vista.filas.length} fila${vista.filas.length !== 1 ? "s" : ""}`}
            </Button>
          ) : (
            <Button onClick={revisar} disabled={isPending || !listo || demasiadas}>
              {isPending ? "Revisando…" : "Revisar antes de importar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
