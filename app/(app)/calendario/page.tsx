"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CalendarEvent } from "@/app/api/calendar/events/route";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DIAS_CABECERA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Días del mes: empieza el lunes (ISO week). */
function celdas(year: number, month: number): (Date | null)[] {
  const primerDia = new Date(year, month - 1, 1);
  const ultimoDia = new Date(year, month, 0);
  // getDay(): 0=dom,1=lun,…6=sáb → convertir a 0=lun,…6=dom
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
    // allDay: inicio <= day < fin  |  timed: mismo día
    if (e.allDay) {
      const finReal = new Date(e.fin);
      finReal.setDate(finReal.getDate() - 1); // GCal usa [start, end) para all-day
      return e.inicio <= dateISO && dateISO <= isoDate(finReal);
    }
    return e.inicio.slice(0, 10) === dateISO;
  });
}

export default function CalendarioPage() {
  const hoy = new Date();
  const [year, setYear] = useState(hoy.getFullYear());
  const [month, setMonth] = useState(hoy.getMonth() + 1);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [cargando, setCargando] = useState(true);
  const [tieneCredenciales, setTieneCredenciales] = useState(true);

  const fetchEvents = useCallback(async (y: number, m: number) => {
    setCargando(true);
    try {
      const res = await fetch(`/api/calendar/events?year=${y}&month=${m}`);
      const data: CalendarEvent[] = await res.json();
      setEvents(data);
      // Si hay eventos mock (id comienza con "mock-"), no hay credenciales reales
      if (data.length > 0 && data[0].id.startsWith("mock-")) {
        setTieneCredenciales(false);
      } else {
        setTieneCredenciales(true);
      }
    } catch {
      setEvents([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents(year, month);
  }, [year, month, fetchEvents]);

  const mesAnterior = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const mesSiguiente = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };
  const irAHoy = () => { setYear(hoy.getFullYear()); setMonth(hoy.getMonth() + 1); };

  const hoyISO = isoDate(hoy);
  const dias = celdas(year, month);

  // Eventos del mes ordenados para el panel lateral
  const eventosDelMes = events.slice().sort((a, b) => a.inicio.localeCompare(b.inicio));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      {/* Encabezado */}
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

      {!tieneCredenciales && (
        <div className="bg-muted/60 rounded-lg border border-dashed px-4 py-3 text-sm">
          <span className="font-medium">Modo demo</span> — estás viendo eventos de ejemplo.
          Para conectar tu Google Calendar, agregá{" "}
          <code className="bg-background rounded px-1 font-mono text-xs">
            GOOGLE_CALENDAR_API_KEY
          </code>{" "}
          y{" "}
          <code className="bg-background rounded px-1 font-mono text-xs">
            GOOGLE_CALENDAR_ID
          </code>{" "}
          en <code className="bg-background rounded px-1 font-mono text-xs">.env.local</code>.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        {/* Calendario mensual */}
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
                  const evsDelDia = dateISO ? eventosDelDia(events, dateISO) : [];
                  const esMesActual = dia !== null;

                  return (
                    <div
                      key={i}
                      className={`min-h-20 border-b border-r p-1.5 ${
                        !esMesActual ? "bg-muted/20" : ""
                      } ${i % 7 === 6 ? "border-r-0" : ""}`}
                    >
                      {dia && (
                        <>
                          <div className="mb-1 flex justify-end">
                            <span
                              className={`flex size-6 items-center justify-center rounded-full text-xs font-medium ${
                                esHoy
                                  ? "bg-primary text-primary-foreground"
                                  : "text-foreground"
                              }`}
                            >
                              {dia.getDate()}
                            </span>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            {evsDelDia.slice(0, 3).map((ev) => (
                              <div
                                key={ev.id}
                                title={ev.titulo}
                                className="truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight"
                                style={{
                                  backgroundColor: ev.color
                                    ? `${ev.color}33`
                                    : "var(--primary)/10",
                                  color: ev.color ?? "var(--primary)",
                                  borderLeft: `2px solid ${ev.color ?? "var(--primary)"}`,
                                }}
                              >
                                {ev.titulo}
                              </div>
                            ))}
                            {evsDelDia.length > 3 && (
                              <span className="text-muted-foreground pl-1 text-[10px]">
                                +{evsDelDia.length - 3} más
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Panel lateral: lista de eventos del mes */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">
            Eventos de {MESES[month - 1]}
          </h2>
          {cargando ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="text-muted-foreground size-4 animate-spin" />
            </div>
          ) : eventosDelMes.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-sm">
              <CalendarDays className="size-6" />
              Sin eventos este mes.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {eventosDelMes.map((ev) => {
                const fecha = new Date(ev.inicio + "T00:00:00");
                return (
                  <Card key={ev.id} className="py-2">
                    <CardContent className="flex items-start gap-2 px-3">
                      <div
                        className="mt-0.5 size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: ev.color ?? "#94a3b8" }}
                      />
                      <div className="min-w-0">
                        <p className="text-sm leading-tight font-medium truncate">
                          {ev.titulo}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {fecha.toLocaleDateString("es-AR", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
