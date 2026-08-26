"use client";

import { useState, useTransition, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
  Plus,
  Pencil,
  Trash2,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TurnoDialog } from "./turno-dialog";
import { AusenciaDialog } from "./ausencia-dialog";
import { eliminarTurno, eliminarExcepcion } from "./actions";
import type { TurnoData, UsuarioOpt, ExcepcionData } from "./page";

// ── Constantes ────────────────────────────────────────────────────────────────

const DIAS = [
  { dia: 0, label: "Lunes", abrev: "Lun" },
  { dia: 1, label: "Martes", abrev: "Mar" },
  { dia: 2, label: "Miércoles", abrev: "Mié" },
  { dia: 3, label: "Jueves", abrev: "Jue" },
  { dia: 4, label: "Viernes", abrev: "Vie" },
];

const PX_POR_HORA = 48;

const PALETTE = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

// ── Utilidades ────────────────────────────────────────────────────────────────

function buildColorMap(turnos: TurnoData[]): Map<string, string> {
  const nombres = [...new Set(turnos.map((t) => t.usuario_nombre))].sort();
  return new Map(nombres.map((n, i) => [n, PALETTE[i % PALETTE.length]]));
}

function lunesDe(fecha: Date): Date {
  const d = new Date(fecha);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatSemana(lunes: Date): string {
  const viernes = new Date(lunes);
  viernes.setDate(lunes.getDate() + 4);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
  return `${lunes.toLocaleDateString("es-AR", opts)} – ${viernes.toLocaleDateString("es-AR", { ...opts, year: "numeric" })}`;
}

function fechaDia(lunes: Date, offsetDia: number): Date {
  const d = new Date(lunes);
  d.setDate(lunes.getDate() + offsetDia);
  return d;
}

function horaANum(h: string): number {
  const [hh, mm] = h.split(":").map(Number);
  return hh + (mm ?? 0) / 60;
}

function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/);
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

// ── Overlap: parte cada turno en segmentos según quién esté activo a cada
// momento, para que una franja sin superposición ocupe el ancho completo de
// la columna aunque el mismo turno se solape con otro en otro tramo ─────────

type Segmento = {
  turno: TurnoData;
  hora_inicio: string;
  hora_fin: string;
  rank: number; // posición entre los activos de este tramo (0 = más a la izquierda)
  total: number; // cuántos están activos en este tramo
  esPrimero: boolean; // primer segmento del turno (donde se muestra el texto)
};

// Orden estable (por lane) para decidir quién va más a la izquierda cuando
// varios turnos están activos al mismo tiempo.
function asignarLane(turnos: TurnoData[]): (TurnoData & { lane: number })[] {
  const sorted = [...turnos].sort((a, b) =>
    a.hora_inicio.localeCompare(b.hora_inicio),
  );
  const finPorLane: string[] = [];
  return sorted.map((t) => {
    let lane = finPorLane.findIndex((fin) => fin <= t.hora_inicio);
    if (lane === -1) {
      lane = finPorLane.length;
      finPorLane.push(t.hora_fin);
    } else {
      finPorLane[lane] = t.hora_fin;
    }
    return { ...t, lane };
  });
}

function construirSegmentos(turnosDia: TurnoData[]): Segmento[] {
  if (turnosDia.length === 0) return [];
  const conLane = asignarLane(turnosDia);

  const boundaries = [
    ...new Set(conLane.flatMap((t) => [t.hora_inicio, t.hora_fin])),
  ].sort();

  const segmentos: Segmento[] = [];

  for (const t of conLane) {
    let actual: Segmento | null = null;

    for (let i = 0; i < boundaries.length - 1; i++) {
      const ini = boundaries[i];
      const fin = boundaries[i + 1];
      if (ini < t.hora_inicio || fin > t.hora_fin) continue;

      const activos = conLane
        .filter((o) => o.hora_inicio <= ini && o.hora_fin >= fin)
        .sort((a, b) => a.lane - b.lane);
      const rank = activos.findIndex((o) => o.id === t.id);
      const total = activos.length;

      if (
        actual &&
        actual.rank === rank &&
        actual.total === total &&
        actual.hora_fin === ini
      ) {
        actual.hora_fin = fin;
      } else {
        if (actual) segmentos.push(actual);
        actual = {
          turno: t,
          hora_inicio: ini,
          hora_fin: fin,
          rank,
          total,
          esPrimero: ini === t.hora_inicio,
        };
      }
    }
    if (actual) segmentos.push(actual);
  }

  return segmentos;
}

// ── Componente ────────────────────────────────────────────────────────────────

type Props = {
  turnos: TurnoData[];
  usuarios: UsuarioOpt[];
  excepciones: ExcepcionData[];
  sesionUsuarioId: string;
  canManage: boolean;
};

export function CronogramaCliente({
  turnos,
  usuarios,
  excepciones,
  sesionUsuarioId,
  canManage,
}: Props) {
  const [lunes, setLunes] = useState(() => lunesDe(new Date()));
  const [diaSeleccionado, setDiaSeleccionado] = useState(() => {
    const dow = (new Date().getDay() + 6) % 7; // 0=Lun…6=Dom
    return dow < 5 ? dow : 0;
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [turnoEditar, setTurnoEditar] = useState<TurnoData | null>(null);
  const [ausenciaDialogOpen, setAusenciaDialogOpen] = useState(false);
  const [deletingId, startDeleteTransition] = useTransition();

  function abrirNuevo() {
    setTurnoEditar(null);
    setDialogOpen(true);
  }

  function abrirEditar(t: TurnoData) {
    setTurnoEditar(t);
    setDialogOpen(true);
  }

  function handleEliminar(turnoId: string) {
    startDeleteTransition(() => eliminarTurno(turnoId));
  }

  function handleEliminarExcepcion(excepcionId: string) {
    startDeleteTransition(() => eliminarExcepcion(excepcionId));
  }
  const colorMap = buildColorMap(turnos);

  // Excepciones de la semana visible (lunes a viernes)
  const diasSemanaISO = [0, 1, 2, 3, 4].map((i) =>
    fechaDia(lunes, i).toISOString().slice(0, 10),
  );
  const excepcionesSemana = useMemo(
    () => excepciones.filter((e) => diasSemanaISO.includes(e.fecha)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- diasSemanaISO se recalcula cada render pero solo cambia con `lunes`
    [excepciones, lunes],
  );
  // usuario_id -> set de fechas ISO en las que está ausente
  const ausenciasPorUsuario = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const e of excepciones) {
      if (e.tipo !== "ausencia") continue;
      if (!map.has(e.usuario_id)) map.set(e.usuario_id, new Set());
      map.get(e.usuario_id)!.add(e.fecha);
    }
    return map;
  }, [excepciones]);

  // usuario_id -> fecha ISO -> quién lo cubre ese día puntual (el turno fijo
  // no se toca, esto solo cambia quién figura ese día).
  const cambiosPorUsuario = useMemo(() => {
    const map = new Map<
      string,
      Map<string, { reemplazo_id: string; reemplazo_nombre: string }>
    >();
    for (const e of excepciones) {
      if (e.tipo !== "cambio" || !e.usuario_reemplazo_id) continue;
      if (!map.has(e.usuario_id)) map.set(e.usuario_id, new Map());
      map.get(e.usuario_id)!.set(e.fecha, {
        reemplazo_id: e.usuario_reemplazo_id,
        reemplazo_nombre: e.usuario_reemplazo_nombre ?? "—",
      });
    }
    return map;
  }, [excepciones]);

  // Rango de horas dinámico: se ajusta a los turnos reales ± 1 h de margen
  const horaMin = turnos.length
    ? Math.max(
        0,
        Math.floor(Math.min(...turnos.map((t) => horaANum(t.hora_inicio)))) - 1,
      )
    : 7;
  const horaMax = turnos.length
    ? Math.min(
        24,
        Math.ceil(Math.max(...turnos.map((t) => horaANum(t.hora_fin)))) + 1,
      )
    : 22;
  const totalHoras = horaMax - horaMin;

  const ahora = new Date();
  const hoyISO = ahora.toISOString().slice(0, 10);
  const horaActual = ahora.getHours() + ahora.getMinutes() / 60;
  const diaHoy = (ahora.getDay() + 6) % 7; // 0=Lun…4=Vie

  const esSemanaActual =
    lunesDe(ahora).toISOString().slice(0, 10) ===
    lunes.toISOString().slice(0, 10);

  // Quién está en la oficina ahora mismo (excluye a quien marcó ausencia
  // hoy; a quien tiene un cambio de turno hoy lo reemplaza por quien cubre).
  const presentesAhora: { usuario_id: string; usuario_nombre: string }[] =
    esSemanaActual && diaHoy < 5
      ? turnos
          .filter(
            (t) =>
              t.dia_semana === diaHoy &&
              horaANum(t.hora_inicio) <= horaActual &&
              horaANum(t.hora_fin) > horaActual &&
              !ausenciasPorUsuario.get(t.usuario_id)?.has(hoyISO),
          )
          .map((t) => {
            const cambio = cambiosPorUsuario.get(t.usuario_id)?.get(hoyISO);
            return cambio
              ? {
                  usuario_id: cambio.reemplazo_id,
                  usuario_nombre: cambio.reemplazo_nombre,
                }
              : { usuario_id: t.usuario_id, usuario_nombre: t.usuario_nombre };
          })
      : [];

  // Posición de la línea "ahora" (solo en columna de hoy)
  const nowPx =
    esSemanaActual &&
    diaHoy < 5 &&
    horaActual >= horaMin &&
    horaActual <= horaMax
      ? (horaActual - horaMin) * PX_POR_HORA
      : null;

  const semanaAnterior = () => {
    const d = new Date(lunes);
    d.setDate(d.getDate() - 7);
    setLunes(d);
  };
  const semanaSiguiente = () => {
    const d = new Date(lunes);
    d.setDate(d.getDate() + 7);
    setLunes(d);
  };
  const irAHoy = () => {
    setLunes(lunesDe(new Date()));
    setDiaSeleccionado(diaHoy < 5 ? diaHoy : 0);
  };

  const diaAnterior = () => {
    if (diaSeleccionado === 0) {
      semanaAnterior();
      setDiaSeleccionado(4);
    } else {
      setDiaSeleccionado(diaSeleccionado - 1);
    }
  };
  const diaSiguiente = () => {
    if (diaSeleccionado === 4) {
      semanaSiguiente();
      setDiaSeleccionado(0);
    } else {
      setDiaSeleccionado(diaSeleccionado + 1);
    }
  };

  const fechaSeleccionada = fechaDia(lunes, diaSeleccionado);
  const fechaSeleccionadaISO = fechaSeleccionada.toISOString().slice(0, 10);
  const esHoySeleccionado = fechaSeleccionadaISO === hoyISO;
  const turnosDelDia = turnos
    .filter((t) => t.dia_semana === diaSeleccionado)
    .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));

  const horaLabels = Array.from(
    { length: totalHoras + 1 },
    (_, i) => horaMin + i,
  );

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-3">
      {/* ── Encabezado + ahora en línea ─────────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-xl leading-tight font-semibold tracking-tight">
              Cronograma
            </h1>
            <p className="text-muted-foreground text-xs">
              {formatSemana(lunes)}
            </p>
          </div>

          {/* Ahora: inline junto al título */}
          {esSemanaActual && presentesAhora.length > 0 && (
            <div className="border-primary/20 bg-primary/5 flex items-center gap-2 rounded-full border px-3 py-1">
              <Clock className="text-primary size-3 shrink-0" />
              <span className="text-primary shrink-0 text-xs font-medium">
                Ahora:
              </span>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {presentesAhora.map((t) => {
                  const color = colorMap.get(t.usuario_nombre) ?? "#94a3b8";
                  const esMio = t.usuario_id === sesionUsuarioId;
                  return (
                    <div
                      key={t.usuario_nombre}
                      className="flex items-center gap-1"
                    >
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span
                        className={`text-xs ${esMio ? "font-semibold" : ""}`}
                      >
                        {esMio ? "Vos" : t.usuario_nombre.split(" ")[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 md:flex">
            <Button variant="outline" size="sm" onClick={semanaAnterior}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={irAHoy}>
              Hoy
            </Button>
            <Button variant="outline" size="sm" onClick={semanaSiguiente}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <Button size="sm" onClick={abrirNuevo} className="gap-1.5">
            <Plus className="size-4" />
            Nuevo turno
          </Button>
        </div>
      </div>

      {/* ── Timeline ────────────────────────────────────────────────────────── */}
      {turnos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-20 text-center">
          <Users className="text-muted-foreground/30 size-8" />
          <p className="text-muted-foreground text-sm">
            No hay turnos cargados para esta semana.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={abrirNuevo}
            className="mt-1 gap-1.5"
          >
            <Plus className="size-4" />
            Agregar turno
          </Button>
        </div>
      ) : (
        <>
          <Card className="hidden md:block">
            <CardContent className="overflow-x-auto p-0">
              <div className="min-w-[580px]">
                {/* Cabecera días */}
                <div
                  className="grid border-b"
                  style={{ gridTemplateColumns: "3.5rem repeat(5, 1fr)" }}
                >
                  <div className="border-r" /> {/* espacio horas */}
                  {DIAS.map(({ dia, label, abrev }) => {
                    const fecha = fechaDia(lunes, dia);
                    const esHoy = fecha.toISOString().slice(0, 10) === hoyISO;
                    return (
                      <div
                        key={dia}
                        className={`border-r py-2 text-center last:border-r-0 ${esHoy ? "bg-primary/5" : ""}`}
                      >
                        <p
                          className={`text-[12px] font-semibold ${esHoy ? "text-primary" : "text-muted-foreground"}`}
                        >
                          <span className="hidden sm:inline">{label}</span>
                          <span className="sm:hidden">{abrev}</span>
                        </p>
                        <p
                          className={`text-[12px] ${esHoy ? "text-primary font-medium" : "text-muted-foreground"}`}
                        >
                          {fecha.toLocaleDateString("es-AR", {
                            day: "numeric",
                            month: "numeric",
                          })}
                        </p>
                        {esHoy && (
                          <div className="bg-primary mx-auto mt-0.5 h-0.5 w-4 rounded-full" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Cuerpo: horas + columnas de días */}
                <div
                  className="relative grid"
                  style={{
                    gridTemplateColumns: "3.5rem repeat(5, 1fr)",
                    height: `${totalHoras * PX_POR_HORA}px`,
                  }}
                >
                  {/* Columna de horas */}
                  <div className="relative border-r">
                    {horaLabels.map((h) => (
                      <div
                        key={h}
                        className="text-muted-foreground absolute right-2 text-[11px] leading-none"
                        style={{ top: `${(h - horaMin) * PX_POR_HORA - 6}px` }}
                      >
                        {String(h).padStart(2, "0")}:00
                      </div>
                    ))}
                  </div>

                  {/* Columnas de días */}
                  {DIAS.map(({ dia }) => {
                    const fecha = fechaDia(lunes, dia);
                    const fechaISO = fecha.toISOString().slice(0, 10);
                    const esHoy = fechaISO === hoyISO;
                    const turnosDia = turnos.filter(
                      (t) => t.dia_semana === dia,
                    );
                    const segmentos = construirSegmentos(turnosDia);

                    return (
                      <div
                        key={dia}
                        className={`relative border-r last:border-r-0 ${esHoy ? "bg-primary/[0.03]" : ""}`}
                      >
                        {/* Guías horizontales por hora */}
                        {horaLabels.map((h) => (
                          <div
                            key={h}
                            className="border-border/30 absolute right-0 left-0 border-t"
                            style={{ top: `${(h - horaMin) * PX_POR_HORA}px` }}
                          />
                        ))}

                        {/* Línea "ahora" */}
                        {esHoy && nowPx !== null && (
                          <div
                            className="absolute right-0 left-0 z-20 flex items-center"
                            style={{ top: `${nowPx}px` }}
                          >
                            <div className="-ml-1 size-2 shrink-0 rounded-full bg-red-500" />
                            <div className="flex-1 border-t-2 border-red-500" />
                          </div>
                        )}

                        {/* Bloques de turno (uno o más segmentos por turno) */}
                        {segmentos.map((seg) => {
                          const t = seg.turno;
                          const inicio = horaANum(seg.hora_inicio);
                          const fin = horaANum(seg.hora_fin);
                          if (inicio >= horaMax || fin <= horaMin) return null;

                          const top =
                            (Math.max(inicio, horaMin) - horaMin) * PX_POR_HORA;
                          const height =
                            (Math.min(fin, horaMax) -
                              Math.max(inicio, horaMin)) *
                            PX_POR_HORA;
                          const color =
                            colorMap.get(t.usuario_nombre) ?? "#94a3b8";
                          const esMio = t.usuario_id === sesionUsuarioId;
                          const cambio = cambiosPorUsuario
                            .get(t.usuario_id)
                            ?.get(fechaISO);
                          const ausente =
                            !cambio &&
                            (ausenciasPorUsuario
                              .get(t.usuario_id)
                              ?.has(fechaISO) ??
                              false);
                          const nombreMostrado = cambio
                            ? cambio.reemplazo_nombre
                            : t.usuario_nombre;
                          const colorMostrado = cambio
                            ? (colorMap.get(cambio.reemplazo_nombre) ??
                              "#94a3b8")
                            : color;
                          const esYoMostrado = cambio
                            ? cambio.reemplazo_id === sesionUsuarioId
                            : esMio;
                          const angosto = seg.total >= 3;
                          const puedeGestionar = canManage || esMio;

                          const anchoLane = 100 / seg.total;
                          const left = `calc(${seg.rank * anchoLane}% + 3px)`;
                          const width = `calc(${anchoLane}% - 6px)`;

                          return (
                            <div
                              key={`${t.id}-${seg.hora_inicio}`}
                              className={`absolute overflow-hidden rounded-md transition-opacity ${ausente ? "opacity-40" : ""}`}
                              style={{
                                top: `${top + 2}px`,
                                height: `${height - 4}px`,
                                left,
                                width,
                                backgroundColor: `${colorMostrado}20`,
                                borderLeftWidth: "3px",
                                borderLeftColor: ausente
                                  ? "#94a3b8"
                                  : colorMostrado,
                                borderLeftStyle: ausente
                                  ? "dashed"
                                  : cambio
                                    ? "dotted"
                                    : "solid",
                                boxShadow: esYoMostrado
                                  ? `0 0 0 1px ${colorMostrado}40`
                                  : undefined,
                              }}
                              title={
                                cambio
                                  ? `${cambio.reemplazo_nombre} cubre a ${t.usuario_nombre} hoy · ${t.hora_inicio}–${t.hora_fin}`
                                  : ausente
                                    ? `${t.usuario_nombre} — ausente`
                                    : `${t.usuario_nombre} · ${t.hora_inicio}–${t.hora_fin}`
                              }
                            >
                              <div
                                className={`group/bloque flex h-full min-h-0 flex-col justify-start overflow-hidden ${angosto ? "px-1 py-0.5" : "px-1.5 py-1"}`}
                              >
                                <div className="flex min-w-0 items-center gap-1">
                                  <p
                                    className={`min-w-0 flex-1 truncate leading-tight font-semibold ${angosto ? "text-[10px]" : "text-[12px]"}`}
                                    style={{ color: colorMostrado }}
                                  >
                                    {esYoMostrado
                                      ? "Vos"
                                      : nombreMostrado.split(" ")[0]}
                                  </p>
                                  {puedeGestionar && (
                                    <div className="hidden shrink-0 items-center gap-0.5 group-hover/bloque:flex">
                                      <button
                                        onClick={() => abrirEditar(t)}
                                        className="rounded p-0.5 transition-colors hover:bg-black/10"
                                        title="Editar turno"
                                      >
                                        <Pencil
                                          className="size-2.5"
                                          style={{ color: colorMostrado }}
                                        />
                                      </button>
                                      <button
                                        onClick={() => handleEliminar(t.id)}
                                        className="rounded p-0.5 transition-colors hover:bg-black/10"
                                        title="Eliminar turno"
                                      >
                                        <Trash2
                                          className="size-2.5"
                                          style={{ color: colorMostrado }}
                                        />
                                      </button>
                                    </div>
                                  )}
                                </div>
                                {seg.esPrimero &&
                                  height >= PX_POR_HORA &&
                                  !angosto && (
                                    <p
                                      className="mt-0.5 truncate text-[11px] leading-tight opacity-70"
                                      style={{ color: colorMostrado }}
                                    >
                                      {cambio
                                        ? "Cambio de turno"
                                        : ausente
                                          ? "Ausente"
                                          : `${t.hora_inicio}–${t.hora_fin}`}
                                    </p>
                                  )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Agenda del día (mobile) ────────────────────────────────────────── */}
          <div className="flex flex-col gap-3 md:hidden">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="icon"
                onClick={diaAnterior}
                className="shrink-0"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <div className="flex flex-col items-center">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  {DIAS[diaSeleccionado].label}
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-xl leading-tight font-bold">
                    {fechaSeleccionada.toLocaleDateString("es-AR", {
                      day: "numeric",
                      month: "long",
                    })}
                  </p>
                  {esHoySeleccionado && (
                    <Badge className="text-[10px]">Hoy</Badge>
                  )}
                </div>
                {!esHoySeleccionado && (
                  <button
                    onClick={irAHoy}
                    className="text-primary mt-0.5 text-[11px] underline underline-offset-2"
                  >
                    Volver a hoy
                  </button>
                )}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={diaSiguiente}
                className="shrink-0"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>

            {turnosDelDia.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center">
                <Users className="text-muted-foreground/30 size-7" />
                <p className="text-muted-foreground text-sm">
                  Sin turnos para este día.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {turnosDelDia.map((t) => {
                  const color = colorMap.get(t.usuario_nombre) ?? "#94a3b8";
                  const esMio = t.usuario_id === sesionUsuarioId;
                  const cambio = cambiosPorUsuario
                    .get(t.usuario_id)
                    ?.get(fechaSeleccionadaISO);
                  const ausente =
                    !cambio &&
                    (ausenciasPorUsuario
                      .get(t.usuario_id)
                      ?.has(fechaSeleccionadaISO) ??
                      false);
                  const nombreMostrado = cambio
                    ? cambio.reemplazo_nombre
                    : t.usuario_nombre;
                  const colorMostrado = cambio
                    ? (colorMap.get(cambio.reemplazo_nombre) ?? "#94a3b8")
                    : color;
                  const esYoMostrado = cambio
                    ? cambio.reemplazo_id === sesionUsuarioId
                    : esMio;
                  const enCurso =
                    esHoySeleccionado &&
                    !ausente &&
                    horaANum(t.hora_inicio) <= horaActual &&
                    horaANum(t.hora_fin) > horaActual;

                  return (
                    <div
                      key={t.id}
                      className={`flex items-center gap-3 rounded-xl border p-3 transition-opacity ${ausente ? "opacity-60" : ""} ${esYoMostrado ? "bg-primary/[0.04]" : ""}`}
                      style={{
                        borderLeftWidth: 4,
                        borderLeftColor: ausente ? "#94a3b8" : colorMostrado,
                        borderLeftStyle: ausente
                          ? "dashed"
                          : cambio
                            ? "dotted"
                            : "solid",
                      }}
                    >
                      <div
                        className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                        style={{
                          backgroundColor: ausente ? "#94a3b8" : colorMostrado,
                        }}
                      >
                        {iniciales(nombreMostrado)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {esYoMostrado
                            ? `${nombreMostrado} (vos)`
                            : nombreMostrado}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          {cambio
                            ? `Cubre a ${t.usuario_nombre} · ${t.hora_inicio} – ${t.hora_fin}`
                            : ausente
                              ? "Ausente"
                              : `${t.hora_inicio} – ${t.hora_fin}`}
                        </p>
                      </div>
                      {enCurso && (
                        <Badge
                          variant="outline"
                          className="border-primary/30 text-primary shrink-0 text-[10px]"
                        >
                          En curso
                        </Badge>
                      )}
                      {(canManage || esMio) && (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => abrirEditar(t)}
                            className="rounded-md p-1.5 transition-colors hover:bg-black/5"
                            title="Editar turno"
                          >
                            <Pencil className="text-muted-foreground size-4" />
                          </button>
                          <button
                            onClick={() => handleEliminar(t.id)}
                            className="rounded-md p-1.5 transition-colors hover:bg-black/5"
                            title="Eliminar turno"
                          >
                            <Trash2 className="text-muted-foreground size-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Leyenda ─────────────────────────────────────────────────────────── */}
      {turnos.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {[...colorMap.entries()].map(([nombre, color]) => {
            const esMio =
              turnos.find((t) => t.usuario_nombre === nombre)?.usuario_id ===
              sesionUsuarioId;
            return (
              <div key={nombre} className="flex items-center gap-1.5 text-xs">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className={esMio ? "font-semibold" : ""}>
                  {esMio ? `${nombre} (vos)` : nombre}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Ausencias de la semana ────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 border-t pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <UserX className="text-muted-foreground size-3.5" />
            Ausencias y cambios de la semana
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => setAusenciaDialogOpen(true)}
          >
            <Plus className="size-3.5" />
            Ausencia / cambio
          </Button>
        </div>

        {excepcionesSemana.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            Nadie marcó ausencias para esta semana.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {excepcionesSemana.map((e) => {
              const puedeBorrar = canManage || e.usuario_id === sesionUsuarioId;
              const fecha = new Date(e.fecha + "T00:00:00");
              return (
                <div
                  key={e.id}
                  className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs"
                >
                  <Badge variant="outline" className="shrink-0">
                    {fecha.toLocaleDateString("es-AR", {
                      weekday: "short",
                      day: "numeric",
                    })}
                  </Badge>
                  <span className="font-medium">{e.usuario_nombre}</span>
                  <span className="text-muted-foreground">
                    {e.tipo === "ausencia"
                      ? "ausente"
                      : `cubre ${e.usuario_reemplazo_nombre ?? "—"}`}
                  </span>
                  {e.nota && (
                    <span className="text-muted-foreground truncate">
                      — {e.nota}
                    </span>
                  )}
                  {puedeBorrar && (
                    <button
                      onClick={() => handleEliminarExcepcion(e.id)}
                      disabled={deletingId}
                      className="text-muted-foreground hover:text-destructive ml-auto shrink-0"
                      title="Quitar"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <TurnoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        turno={turnoEditar}
        usuarios={usuarios}
        canManage={canManage}
        usuarioActualId={sesionUsuarioId}
      />

      <AusenciaDialog
        open={ausenciaDialogOpen}
        onOpenChange={setAusenciaDialogOpen}
        usuarios={usuarios}
        usuarioActualId={sesionUsuarioId}
        canManage={canManage}
      />
    </div>
  );
}
