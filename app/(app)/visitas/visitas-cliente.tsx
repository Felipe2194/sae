"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  CalendarCheck,
  ArrowUpRight,
  ArrowDownLeft,
  Video,
  Presentation,
  CircleDot,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { UserAvatarStack } from "@/components/features/user-avatar";
import { VisitaDialog } from "./visita-dialog";
import { ColegiosCliente } from "./colegios-cliente";
import { PresenciaEquipo } from "./presencia-equipo";
import { labelTipoVisita, labelEstadoVisita } from "./tipos";
import { cn } from "@/lib/utils";
import type { ColegioFila, PresenciaFila, UsuarioOption, VisitaFila } from "./page";

// El estado queda en segundo plano (un punto de color + texto chico): lo
// que se busca de un vistazo es la hora y si vamos nosotros o vienen ellos.
const ESTADO_PUNTO: Record<VisitaFila["estado"], string> = {
  pendiente: "bg-amber-500",
  confirmado: "bg-blue-500",
  realizado: "bg-green-500",
  cancelado: "bg-red-500",
  reprogramado: "bg-orange-500",
};

const CLASE_VAMOS =
  "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30";
const CLASE_VIENEN =
  "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30";
const CLASE_NEUTRA = "bg-muted text-foreground border-border";

// Mismo criterio que Informes ("veces viajamos" vs "nos visitaron"):
// visita a colegio y feria/expo = vamos; nos visitan = vienen.
const TIPO_ESTILO: Record<VisitaFila["tipo"], { icono: LucideIcon; clase: string }> = {
  visita_colegio: { icono: ArrowUpRight, clase: CLASE_VAMOS },
  feria_expo: { icono: ArrowUpRight, clase: CLASE_VAMOS },
  nos_visitan: { icono: ArrowDownLeft, clase: CLASE_VIENEN },
  charla_taller: { icono: Presentation, clase: CLASE_NEUTRA },
  virtual: { icono: Video, clase: CLASE_NEUTRA },
  otro: { icono: CircleDot, clase: CLASE_NEUTRA },
};

function TipoVisitaChip({ tipo }: { tipo: VisitaFila["tipo"] }) {
  const { icono: Icono, clase } = TIPO_ESTILO[tipo];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        clase,
      )}
    >
      <Icono className="size-3.5" />
      {labelTipoVisita(tipo)}
    </span>
  );
}

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function diaSemana(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  return DIAS[new Date(a, m - 1, d).getDay()];
}

const PAGINA = 8;

type Pestaña = "proximas" | "realizadas" | "todas";

const PESTAÑAS: { value: Pestaña; label: string }[] = [
  { value: "proximas", label: "Próximas" },
  { value: "realizadas", label: "Realizadas" },
  { value: "todas", label: "Todas" },
];

function formatFecha(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function formatHora(hhmmss: string | null): string {
  if (!hhmmss) return "";
  return hhmmss.slice(0, 5);
}

type Props = {
  visitas: VisitaFila[];
  colegios: ColegioFila[];
  usuarios: UsuarioOption[];
  presencia: PresenciaFila[];
  anio: number;
  anios: number[];
};

export function VisitasCliente({
  visitas,
  colegios,
  usuarios,
  presencia,
  anio,
  anios,
}: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<VisitaFila | undefined>(undefined);
  const [pestaña, setPestaña] = useState<Pestaña>("proximas");
  const [visibles, setVisibles] = useState(PAGINA);

  function abrirNueva() {
    setEditando(undefined);
    setDialogOpen(true);
  }

  function abrirEditar(v: VisitaFila) {
    setEditando(v);
    setDialogOpen(true);
  }

  function cambiarPestaña(p: Pestaña) {
    setPestaña(p);
    setVisibles(PAGINA);
  }

  const ANIO_ITEMS = Object.fromEntries(anios.map((a) => [String(a), String(a)]));

  // Próximas primero (lo que se consulta todo el tiempo): pendiente,
  // confirmado y reprogramado, ordenadas por fecha más cercana arriba.
  // Realizadas queda aparte para revisar el detalle histórico sin que tape
  // lo que falta hacer — ver pedido de navegabilidad.
  const proximas = useMemo(
    () =>
      visitas
        .filter((v) => v.estado !== "realizado" && v.estado !== "cancelado")
        .sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [visitas],
  );
  const realizadas = useMemo(
    () =>
      visitas
        .filter((v) => v.estado === "realizado")
        .sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [visitas],
  );
  const todas = useMemo(
    () => [...visitas].sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [visitas],
  );

  const listaCompleta =
    pestaña === "proximas" ? proximas : pestaña === "realizadas" ? realizadas : todas;
  const lista = listaCompleta.slice(0, visibles);
  const quedanMas = listaCompleta.length > lista.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Visitas a colegios</h1>
          <p className="text-muted-foreground text-sm">
            Registro de visitas, ferias y contactos con colegios.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(anio)}
            onValueChange={(v) => router.push(`/visitas?anio=${v ?? anio}`)}
            items={ANIO_ITEMS}
          >
            <SelectTrigger className="h-9 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anios.map((a) => (
                <SelectItem key={a} value={String(a)}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={abrirNueva}>
            <Plus className="size-4" />
            Nueva visita
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Presencia del equipo — {anio}</CardTitle>
        </CardHeader>
        <CardContent>
          <PresenciaEquipo presencia={presencia} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
          <div className="bg-muted flex items-center gap-1 rounded-lg p-1">
            {PESTAÑAS.map((p) => {
              const cantidad =
                p.value === "proximas"
                  ? proximas.length
                  : p.value === "realizadas"
                    ? realizadas.length
                    : todas.length;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => cambiarPestaña(p.value)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    pestaña === p.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p.label}
                  <span className="text-muted-foreground ml-1.5 text-xs">
                    {cantidad}
                  </span>
                </button>
              );
            })}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {listaCompleta.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              {pestaña === "proximas"
                ? `No hay visitas próximas cargadas para ${anio}.`
                : pestaña === "realizadas"
                  ? `Todavía no se marcó ninguna visita como realizada en ${anio}.`
                  : `Todavía no hay visitas cargadas para ${anio}.`}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-xs">
                    <th className="w-24 px-3 py-2 text-center font-medium">Hora</th>
                    <th className="px-3 py-2 text-left font-medium">Colegio</th>
                    <th className="hidden px-3 py-2 text-center font-medium sm:table-cell">Tipo</th>
                    <th className="hidden px-3 py-2 text-center font-medium md:table-cell">Integrantes</th>
                    <th className="hidden px-3 py-2 text-center font-medium md:table-cell">Alumnos</th>
                    <th className="hidden px-3 py-2 text-center font-medium sm:table-cell">Estado</th>
                    <th className="w-10 px-3 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((v) => (
                    <tr key={v.id} className="hover:bg-muted/40 border-b align-middle last:border-0">
                      {/* Hora grande arriba, día chico abajo: lo primero que
                          se busca es a qué hora es. */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        {v.hora_inicio ? (
                          <p className="text-lg leading-tight font-bold tabular-nums">
                            {formatHora(v.hora_inicio)}
                          </p>
                        ) : (
                          <p className="text-muted-foreground text-xs leading-tight">Sin hora</p>
                        )}
                        <p className="text-muted-foreground text-xs capitalize tabular-nums">
                          {diaSemana(v.fecha)} {formatFecha(v.fecha)}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium">{v.colegio_nombre}</p>
                        {v.ciudad && (
                          <p className="text-muted-foreground text-xs">{v.ciudad}</p>
                        )}
                        {/* En celular no hay columna de tipo: va acá abajo. */}
                        <div className="mt-1.5 sm:hidden">
                          <TipoVisitaChip tipo={v.tipo} />
                        </div>
                      </td>
                      <td className="hidden px-3 py-3 text-center sm:table-cell">
                        <TipoVisitaChip tipo={v.tipo} />
                      </td>
                      <td className="hidden px-3 py-3 md:table-cell">
                        <div className="flex justify-center">
                          {v.integrantes.length > 0 ? (
                            <UserAvatarStack usuarios={v.integrantes} size="sm" max={4} />
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </div>
                      </td>
                      <td className="hidden px-3 py-3 text-center tabular-nums md:table-cell">
                        {v.cant_alumnos ?? "—"}
                      </td>
                      <td className="hidden px-3 py-3 sm:table-cell">
                        <div className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs whitespace-nowrap">
                          <span className={cn("size-1.5 shrink-0 rounded-full", ESTADO_PUNTO[v.estado])} />
                          {labelEstadoVisita(v.estado)}
                          {v.google_event_id && (
                            <CalendarCheck
                              className="size-3.5"
                              aria-label="Sincronizada con Google Calendar"
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          onClick={() => abrirEditar(v)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {quedanMas && (
                <div className="flex justify-center border-t py-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setVisibles((v) => v + PAGINA)}
                  >
                    Mostrar {Math.min(PAGINA, listaCompleta.length - lista.length)} más
                    ({listaCompleta.length - lista.length} restantes)
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Collapsible defaultOpen={false}>
        <Card>
          <CollapsibleTrigger className="hover:bg-muted/40 flex w-full items-center justify-between rounded-t-xl px-(--card-spacing) py-4 text-left">
            <span className="font-heading text-base font-medium">
              Directorio de colegios ({colegios.length})
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="p-0">
              <ColegiosCliente colegios={colegios} />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <VisitaDialog
        key={editando?.id ?? "nueva"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        colegios={colegios}
        usuarios={usuarios}
        visitaInicial={editando}
      />
    </div>
  );
}
