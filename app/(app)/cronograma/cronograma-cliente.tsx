"use client";

import { useState, useTransition, useMemo } from "react";
import { ChevronLeft, ChevronRight, Clock, Users, Plus, Pencil, Trash2, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TurnoDialog } from "./turno-dialog";
import { AusenciaDialog } from "./ausencia-dialog";
import { eliminarTurno, eliminarExcepcion } from "./actions";
import type { TurnoData, UsuarioOpt, ExcepcionData } from "./page";

// ── Constantes ────────────────────────────────────────────────────────────────

const DIAS = [
  { dia: 0, label: "Lunes",     abrev: "Lun" },
  { dia: 1, label: "Martes",    abrev: "Mar" },
  { dia: 2, label: "Miércoles", abrev: "Mié" },
  { dia: 3, label: "Jueves",    abrev: "Jue" },
  { dia: 4, label: "Viernes",   abrev: "Vie" },
];

const PX_POR_HORA = 48;

const PALETTE = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6",
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

// ── Overlap: asigna lanes a turnos que se solapan ─────────────────────────────

type TurnoConLane = TurnoData & { lane: number; totalLanes: number };

function asignarLanes(turnos: TurnoData[]): TurnoConLane[] {
  const sorted = [...turnos].sort((a, b) =>
    a.hora_inicio.localeCompare(b.hora_inicio),
  );
  const lanes: string[] = []; // last fin de cada lane
  const asignados: (TurnoData & { lane: number })[] = [];

  for (const t of sorted) {
    let lane = lanes.findIndex((fin) => fin <= t.hora_inicio);
    if (lane === -1) {
      lane = lanes.length;
      lanes.push(t.hora_fin);
    } else {
      lanes[lane] = t.hora_fin;
    }
    asignados.push({ ...t, lane });
  }

  const totalLanes = Math.max(1, lanes.length);
  return asignados.map((t) => ({ ...t, totalLanes }));
}

// ── Componente ────────────────────────────────────────────────────────────────

type Props = {
  turnos: TurnoData[];
  usuarios: UsuarioOpt[];
  excepciones: ExcepcionData[];
  sesionUsuarioId: string;
  canManage: boolean;
};

export function CronogramaCliente({ turnos, usuarios, excepciones, sesionUsuarioId, canManage }: Props) {
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
  const diasSemanaISO = [0, 1, 2, 3, 4].map((i) => fechaDia(lunes, i).toISOString().slice(0, 10));
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

  // Rango de horas dinámico: se ajusta a los turnos reales ± 1 h de margen
  const horaMin = turnos.length
    ? Math.max(0, Math.floor(Math.min(...turnos.map((t) => horaANum(t.hora_inicio)))) - 1)
    : 7;
  const horaMax = turnos.length
    ? Math.min(24, Math.ceil(Math.max(...turnos.map((t) => horaANum(t.hora_fin)))) + 1)
    : 22;
  const totalHoras = horaMax - horaMin;

  const ahora = new Date();
  const hoyISO = ahora.toISOString().slice(0, 10);
  const horaActual = ahora.getHours() + ahora.getMinutes() / 60;
  const diaHoy = (ahora.getDay() + 6) % 7; // 0=Lun…4=Vie

  const esSemanaActual =
    lunesDe(ahora).toISOString().slice(0, 10) === lunes.toISOString().slice(0, 10);

  // Quién está en la oficina ahora mismo (excluye a quien marcó ausencia hoy)
  const presentesAhora =
    esSemanaActual && diaHoy < 5
      ? turnos.filter(
          (t) =>
            t.dia_semana === diaHoy &&
            horaANum(t.hora_inicio) <= horaActual &&
            horaANum(t.hora_fin) > horaActual &&
            !ausenciasPorUsuario.get(t.usuario_id)?.has(hoyISO),
        )
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
    <div className="mx-auto flex max-w-6xl flex-col gap-3">

      {/* ── Encabezado + ahora en línea ─────────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold tracking-tight leading-tight">Cronograma</h1>
            <p className="text-muted-foreground text-xs">{formatSemana(lunes)}</p>
          </div>

          {/* Ahora: inline junto al título */}
          {esSemanaActual && presentesAhora.length > 0 && (
            <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1">
              <Clock className="size-3 text-primary shrink-0" />
              <span className="text-xs font-medium text-primary shrink-0">Ahora:</span>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {presentesAhora.map((t) => {
                  const color = colorMap.get(t.usuario_nombre) ?? "#94a3b8";
                  const esMio = t.usuario_id === sesionUsuarioId;
                  return (
                    <div key={t.usuario_nombre} className="flex items-center gap-1">
                      <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className={`text-xs ${esMio ? "font-semibold" : ""}`}>
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
          <div className="hidden md:flex items-center gap-2">
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
          {canManage && (
            <Button size="sm" onClick={abrirNuevo} className="gap-1.5">
              <Plus className="size-4" />
              Nuevo turno
            </Button>
          )}
        </div>
      </div>

      {/* ── Timeline ────────────────────────────────────────────────────────── */}
      {turnos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-20 text-center rounded-xl border border-dashed">
          <Users className="size-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            No hay turnos cargados para esta semana.
          </p>
          {canManage && (
            <Button size="sm" variant="outline" onClick={abrirNuevo} className="mt-1 gap-1.5">
              <Plus className="size-4" />
              Agregar turno
            </Button>
          )}
        </div>
      ) : (
        <>
        <Card className="hidden md:block">
          <CardContent className="p-0 overflow-x-auto">
            <div className="min-w-[580px]">

              {/* Cabecera días */}
              <div className="grid border-b" style={{ gridTemplateColumns: "3.5rem repeat(5, 1fr)" }}>
                <div className="border-r" /> {/* espacio horas */}
                {DIAS.map(({ dia, label, abrev }) => {
                  const fecha = fechaDia(lunes, dia);
                  const esHoy = fecha.toISOString().slice(0, 10) === hoyISO;
                  return (
                    <div
                      key={dia}
                      className={`py-2 text-center border-r last:border-r-0 ${esHoy ? "bg-primary/5" : ""}`}
                    >
                      <p className={`text-[12px] font-semibold ${esHoy ? "text-primary" : "text-muted-foreground"}`}>
                        <span className="hidden sm:inline">{label}</span>
                        <span className="sm:hidden">{abrev}</span>
                      </p>
                      <p className={`text-[12px] ${esHoy ? "text-primary font-medium" : "text-muted-foreground"}`}>
                        {fecha.toLocaleDateString("es-AR", { day: "numeric", month: "numeric" })}
                      </p>
                      {esHoy && (
                        <div className="mx-auto mt-0.5 h-0.5 w-4 rounded-full bg-primary" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Cuerpo: horas + columnas de días */}
              <div
                className="grid relative"
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
                      className="absolute right-2 text-[11px] text-muted-foreground leading-none"
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
                  const turnosDia = turnos.filter((t) => t.dia_semana === dia);
                  const conLanes = asignarLanes(turnosDia);

                  return (
                    <div
                      key={dia}
                      className={`relative border-r last:border-r-0 ${esHoy ? "bg-primary/[0.03]" : ""}`}
                    >
                      {/* Guías horizontales por hora */}
                      {horaLabels.map((h) => (
                        <div
                          key={h}
                          className="absolute left-0 right-0 border-t border-border/30"
                          style={{ top: `${(h - horaMin) * PX_POR_HORA}px` }}
                        />
                      ))}

                      {/* Línea "ahora" */}
                      {esHoy && nowPx !== null && (
                        <div
                          className="absolute left-0 right-0 z-20 flex items-center"
                          style={{ top: `${nowPx}px` }}
                        >
                          <div className="size-2 rounded-full bg-red-500 -ml-1 shrink-0" />
                          <div className="flex-1 border-t-2 border-red-500" />
                        </div>
                      )}

                      {/* Bloques de turno */}
                      {conLanes.map((t) => {
                        const inicio = horaANum(t.hora_inicio);
                        const fin = horaANum(t.hora_fin);
                        if (inicio >= horaMax || fin <= horaMin) return null;

                        const top = (Math.max(inicio, horaMin) - horaMin) * PX_POR_HORA;
                        const height = (Math.min(fin, horaMax) - Math.max(inicio, horaMin)) * PX_POR_HORA;
                        const color = colorMap.get(t.usuario_nombre) ?? "#94a3b8";
                        const esMio = t.usuario_id === sesionUsuarioId;
                        const ausente = ausenciasPorUsuario.get(t.usuario_id)?.has(fechaISO) ?? false;

                        const laneW = 100 / t.totalLanes;
                        const left = `calc(${t.lane * laneW}% + 3px)`;
                        const width = `calc(${laneW}% - 6px)`;

                        return (
                          <div
                            key={`${t.usuario_nombre}-${t.dia_semana}-${t.hora_inicio}`}
                            className={`absolute rounded-md overflow-hidden transition-opacity ${ausente ? "opacity-40" : ""}`}
                            style={{
                              top: `${top + 2}px`,
                              height: `${height - 4}px`,
                              left,
                              width,
                              backgroundColor: `${color}20`,
                              borderLeft: `3px solid ${ausente ? "#94a3b8" : color}`,
                              borderStyle: ausente ? "dashed" : "solid",
                              boxShadow: esMio ? `0 0 0 1px ${color}40` : undefined,
                            }}
                            title={
                              ausente
                                ? `${t.usuario_nombre} — ausente`
                                : `${t.usuario_nombre} · ${t.hora_inicio}–${t.hora_fin}`
                            }
                          >
                            <div className="px-1.5 py-1 h-full flex flex-col justify-start overflow-hidden group/bloque min-h-0">
                              <div className="flex items-center gap-1 min-w-0">
                                <span
                                  className="size-3.5 shrink-0 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                                  style={{ backgroundColor: color }}
                                >
                                  {iniciales(t.usuario_nombre).slice(0, 1)}
                                </span>
                                <p
                                  className="text-[12px] font-semibold truncate leading-tight flex-1 min-w-0"
                                  style={{ color }}
                                >
                                  {esMio ? "Vos" : t.usuario_nombre.split(" ")[0]}
                                </p>
                                {canManage && (
                                  <div className="hidden group-hover/bloque:flex items-center gap-0.5 shrink-0">
                                    <button
                                      onClick={() => abrirEditar(t)}
                                      className="rounded p-0.5 hover:bg-black/10 transition-colors"
                                      title="Editar turno"
                                    >
                                      <Pencil className="size-2.5" style={{ color }} />
                                    </button>
                                    <button
                                      onClick={() => handleEliminar(t.id)}
                                      className="rounded p-0.5 hover:bg-black/10 transition-colors"
                                      title="Eliminar turno"
                                    >
                                      <Trash2 className="size-2.5" style={{ color }} />
                                    </button>
                                  </div>
                                )}
                              </div>
                              {height >= PX_POR_HORA && (
                                <p className="text-[11px] leading-tight mt-0.5 truncate opacity-70" style={{ color }}>
                                  {ausente ? "Ausente" : `${t.hora_inicio}–${t.hora_fin}`}
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
        <div className="md:hidden flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" onClick={diaAnterior} className="shrink-0">
              <ChevronLeft className="size-4" />
            </Button>
            <div className="flex flex-col items-center">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {DIAS[diaSeleccionado].label}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-xl font-bold leading-tight">
                  {fechaSeleccionada.toLocaleDateString("es-AR", { day: "numeric", month: "long" })}
                </p>
                {esHoySeleccionado && (
                  <Badge className="text-[10px]">Hoy</Badge>
                )}
              </div>
              {!esHoySeleccionado && (
                <button
                  onClick={irAHoy}
                  className="text-[11px] text-primary underline underline-offset-2 mt-0.5"
                >
                  Volver a hoy
                </button>
              )}
            </div>
            <Button variant="outline" size="icon" onClick={diaSiguiente} className="shrink-0">
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {turnosDelDia.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center rounded-xl border border-dashed">
              <Users className="size-7 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Sin turnos para este día.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {turnosDelDia.map((t) => {
                const color = colorMap.get(t.usuario_nombre) ?? "#94a3b8";
                const esMio = t.usuario_id === sesionUsuarioId;
                const ausente = ausenciasPorUsuario.get(t.usuario_id)?.has(fechaSeleccionadaISO) ?? false;
                const enCurso =
                  esHoySeleccionado &&
                  !ausente &&
                  horaANum(t.hora_inicio) <= horaActual &&
                  horaANum(t.hora_fin) > horaActual;

                return (
                  <div
                    key={t.id}
                    className={`flex items-center gap-3 rounded-xl border p-3 transition-opacity ${ausente ? "opacity-60" : ""} ${esMio ? "bg-primary/[0.04]" : ""}`}
                    style={{
                      borderLeftWidth: 4,
                      borderLeftColor: ausente ? "#94a3b8" : color,
                      borderLeftStyle: ausente ? "dashed" : "solid",
                    }}
                  >
                    <div
                      className="size-10 shrink-0 rounded-full flex items-center justify-center text-sm font-bold text-white"
                      style={{ backgroundColor: ausente ? "#94a3b8" : color }}
                    >
                      {iniciales(t.usuario_nombre)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {esMio ? `${t.usuario_nombre} (vos)` : t.usuario_nombre}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {ausente ? "Ausente" : `${t.hora_inicio} – ${t.hora_fin}`}
                      </p>
                    </div>
                    {enCurso && (
                      <Badge variant="outline" className="shrink-0 border-primary/30 text-primary text-[10px]">
                        En curso
                      </Badge>
                    )}
                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => abrirEditar(t)}
                          className="rounded-md p-1.5 hover:bg-black/5 transition-colors"
                          title="Editar turno"
                        >
                          <Pencil className="size-4 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => handleEliminar(t.id)}
                          className="rounded-md p-1.5 hover:bg-black/5 transition-colors"
                          title="Eliminar turno"
                        >
                          <Trash2 className="size-4 text-muted-foreground" />
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
            const esMio = turnos.find((t) => t.usuario_nombre === nombre)?.usuario_id === sesionUsuarioId;
            return (
              <div key={nombre} className="flex items-center gap-1.5 text-xs">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
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
            <UserX className="size-3.5 text-muted-foreground" />
            Ausencias de la semana
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => setAusenciaDialogOpen(true)}
          >
            <Plus className="size-3.5" />
            Marcar ausencia
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
                    {fecha.toLocaleDateString("es-AR", { weekday: "short", day: "numeric" })}
                  </Badge>
                  <span className="font-medium">{e.usuario_nombre}</span>
                  <span className="text-muted-foreground">
                    {e.tipo === "ausencia" ? "ausente" : "cambio de turno"}
                  </span>
                  {e.nota && (
                    <span className="text-muted-foreground truncate">— {e.nota}</span>
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

      {canManage && (
        <TurnoDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          turno={turnoEditar}
          usuarios={usuarios}
        />
      )}

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
