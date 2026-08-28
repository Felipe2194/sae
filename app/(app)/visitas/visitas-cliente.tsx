"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CalendarCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { eliminarVisita } from "./actions";
import { labelTipoVisita, labelEstadoVisita } from "./tipos";
import { cn } from "@/lib/utils";
import type { ColegioFila, PresenciaFila, UsuarioOption, VisitaFila } from "./page";

const ESTADO_BADGE: Record<VisitaFila["estado"], string> = {
  pendiente: "bg-amber-200 text-amber-900 border-amber-400",
  confirmado: "bg-blue-100 text-blue-800 border-blue-200",
  realizado: "bg-green-200 text-green-900 border-green-400",
  cancelado: "bg-red-200 text-red-900 border-red-400",
  reprogramado: "bg-orange-100 text-orange-800 border-orange-200",
};

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
  const [, startTransition] = useTransition();
  const [borrandoId, setBorrandoId] = useState<string | null>(null);
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

  function handleEliminar(id: string) {
    setBorrandoId(id);
    startTransition(async () => {
      await eliminarVisita(id);
      toast.success("Visita eliminada.");
      setBorrandoId(null);
    });
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
    <div className="flex flex-col gap-6 p-6">
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
                  <tr className="text-muted-foreground border-b text-left text-xs">
                    <th className="px-3 py-2 font-medium">Fecha</th>
                    <th className="px-3 py-2 font-medium">Colegio</th>
                    <th className="hidden px-3 py-2 font-medium sm:table-cell">Tipo</th>
                    <th className="hidden px-3 py-2 font-medium sm:table-cell">Estado</th>
                    <th className="hidden px-3 py-2 font-medium sm:table-cell">Integrantes</th>
                    <th className="hidden px-3 py-2 font-medium sm:table-cell">Alumnos</th>
                    <th className="px-3 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((v) => (
                    <tr key={v.id} className="hover:bg-muted/40 border-b last:border-0">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatFecha(v.fecha)}
                        {v.hora_inicio && (
                          <span className="text-muted-foreground ml-1 text-xs">
                            {formatHora(v.hora_inicio)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium">{v.colegio_nombre}</p>
                        {v.ciudad && (
                          <p className="text-muted-foreground text-xs">{v.ciudad}</p>
                        )}
                      </td>
                      <td className="text-muted-foreground hidden px-3 py-2 sm:table-cell">
                        {labelTipoVisita(v.tipo)}
                      </td>
                      <td className="hidden px-3 py-2 sm:table-cell">
                        <Badge variant="outline" className={ESTADO_BADGE[v.estado]}>
                          {labelEstadoVisita(v.estado)}
                        </Badge>
                        {v.google_event_id && (
                          <CalendarCheck className="text-muted-foreground ml-1.5 inline size-3.5" />
                        )}
                      </td>
                      <td className="hidden px-3 py-2 sm:table-cell">
                        {v.integrantes.length > 0 ? (
                          <UserAvatarStack usuarios={v.integrantes} size="sm" max={4} />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="hidden px-3 py-2 sm:table-cell">{v.cant_alumnos ?? "—"}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          onClick={() => abrirEditar(v)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-muted-foreground hover:text-destructive size-7"
                          disabled={borrandoId === v.id}
                          onClick={() => handleEliminar(v.id)}
                        >
                          <Trash2 className="size-3.5" />
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
