"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Loader2, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CalendarEvent } from "@/app/api/calendar/events/route";
import type { TareaConFecha } from "./page";

// ── Constantes ────────────────────────────────────────────────────────────────

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DIAS_CABECERA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const TIPO_LABEL: Record<string, string> = {
  evento: "Evento",
  entrega: "Entrega",
  reunion: "Reunión",
};

const ESTADO_LABEL: Record<string, string> = {
  por_hacer: "Por hacer",
  en_progreso: "En progreso",
};

// ── Utilidades ────────────────────────────────────────────────────────────────

function celdas(year: number, month: number): (Date | null)[] {
  const primerDia = new Date(year, month - 1, 1);
  const ultimoDia = new Date(year, month, 0);
  const inicioOffset = (primerDia.getDay() + 6) % 7;
  const total = inicioOffset + ultimoDia.getDate();
  const filas = Math.ceil(total / 7) * 7;
  return Array.from({ length: filas }, (_, i) => {
    const d = i - inicioOffset + 1;
    return d >= 1 && d <= ultimoDia.getDate() ? new Date(year, month - 1, d) : null;
  });
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function eventosDelDia(events: CalendarEvent[], dateISO: string) {
  return events.filter((e) => {
    if (e.allDay) {
      const finReal = new Date(e.fin);
      finReal.setDate(finReal.getDate() - 1);
      return e.inicio <= dateISO && dateISO <= isoDate(finReal);
    }
    return e.inicio.slice(0, 10) === dateISO;
  });
}

function tareasDelDia(tareas: TareaConFecha[], dateISO: string) {
  return tareas.filter((t) => t.fecha_vencimiento === dateISO);
}

function formatDiaLargo(dateISO: string): string {
  const d = new Date(dateISO + "T00:00:00");
  const s = d.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Componente ────────────────────────────────────────────────────────────────

type Props = {
  tareas: TareaConFecha[];
  tieneCalendar: boolean;
};

export function CalendarioCliente({ tareas, tieneCalendar }: Props) {
  const hoy = new Date();
  const hoyISO = isoDate(hoy);

  const [year, setYear] = useState(hoy.getFullYear());
  const [month, setMonth] = useState(hoy.getMonth() + 1);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modoDemo, setModoDemo] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>(hoyISO);

  const fetchEvents = useCallback(async (y: number, m: number) => {
    setCargando(true);
    try {
      const res = await fetch(`/api/calendar/events?year=${y}&month=${m}`);
      const data: CalendarEvent[] = await res.json();
      setEvents(data);
      setModoDemo(data.length > 0 && data[0].id.startsWith("mock-"));
    } catch {
      setEvents([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch de datos según año/mes seleccionado
    fetchEvents(year, month);
  }, [year, month, fetchEvents]);

  const mesAnterior = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const mesSiguiente = () => {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };
  const irAHoy = () => {
    setYear(hoy.getFullYear());
    setMonth(hoy.getMonth() + 1);
    setSelectedDay(hoyISO);
  };

  const dias = celdas(year, month);

  // Panel del día seleccionado
  const evsSelected = eventosDelDia(events, selectedDay);
  const tareasSelected = tareasDelDia(tareas, selectedDay);
  const totalSelected = evsSelected.length + tareasSelected.length;

  // Tareas de este mes para el sidebar (si no hay día seleccionado)
  const tareasMes = tareas.filter(
    (t) =>
      t.fecha_vencimiento.startsWith(`${year}-${String(month).padStart(2, "0")}`),
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">

      {/* ── Encabezado ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendario</h1>
          <p className="text-muted-foreground text-sm">
            {MESES[month - 1]} {year}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={mesAnterior}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={irAHoy}>
            Hoy
          </Button>
          <Button variant="outline" size="sm" onClick={mesSiguiente}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Aviso modo demo */}
      {modoDemo && (
        <div className="bg-muted/60 rounded-lg border border-dashed px-4 py-3 text-sm">
          <span className="font-medium">Modo demo</span> — eventos de ejemplo.
          Para conectar Google Calendar configurá{" "}
          <code className="bg-background rounded px-1 font-mono text-xs">GOOGLE_CALENDAR_API_KEY</code>{" "}
          y{" "}
          <code className="bg-background rounded px-1 font-mono text-xs">GOOGLE_CALENDAR_ID</code>{" "}
          en{" "}
          <code className="bg-background rounded px-1 font-mono text-xs">.env.local</code>.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">

        {/* ── Grilla mensual ───────────────────────────────────────────────── */}
        <Card>
          <CardContent className="p-0">
            {/* Cabecera días */}
            <div className="grid grid-cols-7 border-b">
              {DIAS_CABECERA.map((d) => (
                <div
                  key={d}
                  className="text-muted-foreground py-2 text-center text-xs font-medium"
                >
                  {d}
                </div>
              ))}
            </div>

            {cargando ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="text-muted-foreground size-5 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {dias.map((dia, i) => {
                  const dateISO = dia ? isoDate(dia) : null;
                  const esHoy = dateISO === hoyISO;
                  const esSeleccionado = dateISO === selectedDay;
                  const esMesActual = dia !== null;
                  const esFinDeSemana = i % 7 >= 5;

                  const evsDelDia = dateISO ? eventosDelDia(events, dateISO) : [];
                  const tareasD = dateISO ? tareasDelDia(tareas, dateISO) : [];
                  const todosItems = [...evsDelDia, ...tareasD];
                  const maxMostrar = 2;

                  return (
                    <button
                      key={i}
                      onClick={() => dateISO && setSelectedDay(dateISO)}
                      disabled={!dia}
                      className={[
                        "min-h-[3.25rem] sm:min-h-[5.5rem] border-b border-r p-1 sm:p-1.5 text-left transition-colors",
                        !esMesActual ? "bg-muted/20 cursor-default" : "hover:bg-muted/40 cursor-pointer",
                        esSeleccionado ? "bg-accent/60" : "",
                        esFinDeSemana && esMesActual ? "bg-muted/10" : "",
                        i % 7 === 6 ? "border-r-0" : "",
                      ].filter(Boolean).join(" ")}
                    >
                      {dia && (
                        <>
                          <div className="mb-1 flex justify-end">
                            <span
                              className={[
                                "flex size-6 items-center justify-center rounded-full text-xs font-medium",
                                esHoy
                                  ? "bg-primary text-primary-foreground"
                                  : esSeleccionado
                                    ? "text-primary font-bold"
                                    : "text-foreground",
                              ].join(" ")}
                            >
                              {dia.getDate()}
                            </span>
                          </div>

                          {/* Pantallas chicas: puntos de color — el detalle vive en el
                              panel del día seleccionado, que ya es legible. Un texto de
                              11px truncado en una celda de ~50px de ancho no lo es. */}
                          <div className="flex flex-wrap gap-0.5 sm:hidden">
                            {todosItems.slice(0, 4).map((item) => {
                              const isGcal = "allDay" in item;
                              const color = isGcal
                                ? (item.color ?? "#94a3b8")
                                : ((item as TareaConFecha).area_color ?? "#94a3b8");
                              return (
                                <span
                                  key={isGcal ? item.id : (item as TareaConFecha).id}
                                  className="size-1.5 shrink-0 rounded-full"
                                  style={{ backgroundColor: color }}
                                />
                              );
                            })}
                          </div>

                          <div className="hidden sm:flex flex-col gap-0.5">
                            {todosItems.slice(0, maxMostrar).map((item) => {
                              const isGcal = "allDay" in item;
                              const color = isGcal
                                ? (item.color ?? "#94a3b8")
                                : ((item as TareaConFecha).area_color ?? "#94a3b8");
                              const titulo = isGcal
                                ? item.titulo
                                : (item as TareaConFecha).titulo;

                              return (
                                <div
                                  key={isGcal ? item.id : (item as TareaConFecha).id}
                                  title={titulo}
                                  className="truncate rounded px-1 py-0.5 text-[11px] font-medium leading-tight"
                                  style={{
                                    backgroundColor: `${color}22`,
                                    color: color,
                                    borderLeft: `2px solid ${color}`,
                                  }}
                                >
                                  {!isGcal && (
                                    <span className="mr-0.5 opacity-60">✓</span>
                                  )}
                                  {titulo}
                                </div>
                              );
                            })}
                            {todosItems.length > maxMostrar && (
                              <span className="text-muted-foreground pl-1 text-[11px]">
                                +{todosItems.length - maxMostrar} más
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Panel lateral: día seleccionado ──────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              {selectedDay === hoyISO ? "Hoy" : ""}
            </h2>
            <p className="text-xs text-muted-foreground">
              {formatDiaLargo(selectedDay)}
            </p>
          </div>

          {cargando ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="text-muted-foreground size-4 animate-spin" />
            </div>
          ) : totalSelected === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <CalendarDays className="size-7 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Sin eventos ni tareas para este día.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {/* Eventos de Google Calendar */}
              {evsSelected.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-start gap-2.5 rounded-lg border bg-card px-3 py-2.5"
                >
                  <div
                    className="mt-0.5 size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: ev.color ?? "#94a3b8" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug truncate">
                      {ev.titulo}
                    </p>
                    {!ev.allDay && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(ev.inicio).toLocaleTimeString("es-AR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {/* Tareas del sistema */}
              {tareasSelected.map((t) => (
                <div
                  key={t.id}
                  className="flex items-start gap-2.5 rounded-lg border bg-card px-3 py-2.5"
                >
                  <div
                    className="mt-0.5 size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: t.area_color ?? "#94a3b8" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug truncate">
                      {t.titulo}
                    </p>
                    <div className="flex items-center flex-wrap gap-1.5 mt-1">
                      {t.area_nombre && (
                        <span className="text-xs text-muted-foreground">
                          {t.area_nombre}
                        </span>
                      )}
                      {TIPO_LABEL[t.tipo] && (
                        <Badge variant="outline" className="text-[11px] px-1.5 py-0 font-normal">
                          {TIPO_LABEL[t.tipo]}
                        </Badge>
                      )}
                      {ESTADO_LABEL[t.estado] && (
                        <Badge variant="secondary" className="text-[11px] px-1.5 py-0 font-normal">
                          {ESTADO_LABEL[t.estado]}
                        </Badge>
                      )}
                    </div>
                    {t.responsable_nombre && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t.responsable_nombre}
                      </p>
                    )}
                  </div>
                  <CheckSquare className="size-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
                </div>
              ))}
            </div>
          )}

          {/* Tareas del mes (si hay, debajo del día seleccionado) */}
          {tareasMes.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground">
                Tareas este mes
              </p>
              {tareasMes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedDay(t.fecha_vencimiento)}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted transition-colors"
                >
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: t.area_color ?? "#94a3b8" }}
                  />
                  <span className="text-xs truncate flex-1">{t.titulo}</span>
                  <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                    {t.fecha_vencimiento.slice(8)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
