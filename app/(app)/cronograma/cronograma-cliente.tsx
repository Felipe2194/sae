"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TurnoData } from "./page";

// ── Estructura de la semana ─────────────────────────────────────────────────

const DIAS = [
  { dia: 0, label: "Lunes",     abrev: "Lun" },
  { dia: 1, label: "Martes",    abrev: "Mar" },
  { dia: 2, label: "Miércoles", abrev: "Mié" },
  { dia: 3, label: "Jueves",    abrev: "Jue" },
  { dia: 4, label: "Viernes",   abrev: "Vie" },
];

const SECCIONES = [
  {
    nombre: "Mañana",
    bg: "bg-amber-50 dark:bg-amber-950/20",
    slots: [{ inicio: "08:00", fin: "12:00" }],
  },
  {
    nombre: "Tarde",
    bg: "bg-orange-50 dark:bg-orange-950/20",
    slots: [
      { inicio: "14:00", fin: "15:00" },
      { inicio: "15:00", fin: "16:00" },
      { inicio: "16:00", fin: "17:00" },
      { inicio: "17:00", fin: "18:00" },
    ],
  },
  {
    nombre: "Noche",
    bg: "bg-blue-50 dark:bg-blue-950/20",
    slots: [
      { inicio: "18:00", fin: "19:00" },
      { inicio: "19:00", fin: "20:00" },
      { inicio: "20:00", fin: "21:00" },
    ],
  },
];

// ── Paleta por usuario (orden alfabético) ───────────────────────────────────

const PALETTE = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6",
];

function buildColorMap(turnos: TurnoData[]): Map<string, string> {
  const nombres = [...new Set(turnos.map((t) => t.usuario_nombre))].sort();
  return new Map(nombres.map((n, i) => [n, PALETTE[i % PALETTE.length]]));
}

// ── Utilidades de semana ─────────────────────────────────────────────────────

function lunesDe(fecha: Date): Date {
  const d = new Date(fecha);
  const dow = d.getDay(); // 0=dom
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

// ── Lógica de overlap ───────────────────────────────────────────────────────

/** Devuelve los nombres de quienes tienen turno en ese día+slot. */
function usuariosEnSlot(
  turnos: TurnoData[],
  dia: number,
  slotInicio: string,
  slotFin: string,
): string[] {
  return turnos
    .filter(
      (t) =>
        t.dia_semana === dia &&
        t.hora_inicio <= slotInicio &&
        t.hora_fin >= slotFin,
    )
    .map((t) => t.usuario_nombre);
}

// ── Resumen semanal ──────────────────────────────────────────────────────────

function horasPorUsuario(
  turnos: TurnoData[],
): { nombre: string; horas: number }[] {
  const map = new Map<string, number>();
  for (const t of turnos) {
    const [hi] = t.hora_inicio.split(":").map(Number);
    const [hf] = t.hora_fin.split(":").map(Number);
    map.set(t.usuario_nombre, (map.get(t.usuario_nombre) ?? 0) + (hf - hi));
  }
  return [...map.entries()]
    .map(([nombre, horas]) => ({ nombre, horas }))
    .sort((a, b) => b.horas - a.horas);
}

// ── Componente ───────────────────────────────────────────────────────────────

export function CronogramaCliente({ turnos }: { turnos: TurnoData[] }) {
  const [lunes, setLunes] = useState(() => lunesDe(new Date()));
  const colorMap = buildColorMap(turnos);

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
  const irAHoy = () => setLunes(lunesDe(new Date()));

  const hoyISO = new Date().toISOString().slice(0, 10);
  const resumen = horasPorUsuario(turnos);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Cronograma semanal
          </h1>
          <p className="text-muted-foreground text-sm">{formatSemana(lunes)}</p>
        </div>
        <div className="flex items-center gap-2">
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
      </div>

      {/* Leyenda de colores */}
      <div className="flex flex-wrap gap-3">
        {[...colorMap.entries()].map(([nombre, color]) => (
          <div key={nombre} className="flex items-center gap-1.5 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            {nombre}
          </div>
        ))}
      </div>

      {/* Grilla */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {/* Columna turno */}
                  <th className="text-muted-foreground w-20 border-b px-3 py-3 text-left text-xs font-medium">
                    Turno
                  </th>
                  {/* Columna horario */}
                  <th className="text-muted-foreground w-24 border-b px-3 py-3 text-left text-xs font-medium">
                    Horario
                  </th>
                  {/* Columnas de días */}
                  {DIAS.map(({ dia, label, abrev }) => {
                    const fecha = fechaDia(lunes, dia);
                    const fechaISO = fecha.toISOString().slice(0, 10);
                    const esHoy = fechaISO === hoyISO;
                    return (
                      <th
                        key={dia}
                        className={`border-b px-2 py-3 text-center text-xs font-medium ${
                          esHoy ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        <span className="hidden sm:block">{label}</span>
                        <span className="sm:hidden">{abrev}</span>
                        <div className="text-[10px] font-normal mt-0.5">
                          {fecha.toLocaleDateString("es-AR", {
                            day: "numeric",
                            month: "numeric",
                          })}
                        </div>
                        {esHoy && (
                          <div className="bg-primary mx-auto mt-0.5 h-1 w-5 rounded-full" />
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {SECCIONES.map((seccion) =>
                  seccion.slots.map((slot, si) => (
                    <tr key={`${seccion.nombre}-${slot.inicio}`}>
                      {/* Etiqueta de sección (solo en el primer slot) */}
                      {si === 0 ? (
                        <td
                          rowSpan={seccion.slots.length}
                          className={`border-b px-3 py-2 text-xs font-semibold align-top pt-3 ${seccion.bg}`}
                        >
                          {seccion.nombre}
                        </td>
                      ) : null}

                      {/* Horario */}
                      <td
                        className={`border-b px-3 py-2 text-xs text-muted-foreground whitespace-nowrap ${seccion.bg}`}
                      >
                        {slot.inicio} – {slot.fin}
                      </td>

                      {/* Celdas por día */}
                      {DIAS.map(({ dia }) => {
                        const nombres = usuariosEnSlot(
                          turnos,
                          dia,
                          slot.inicio,
                          slot.fin,
                        );
                        return (
                          <td
                            key={dia}
                            className="border-b px-2 py-1.5 text-center"
                          >
                            {nombres.length > 0 ? (
                              <div className="flex flex-wrap justify-center gap-1">
                                {nombres.map((nombre) => (
                                  <span
                                    key={nombre}
                                    className="inline-block rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
                                    style={{
                                      backgroundColor:
                                        colorMap.get(nombre) ?? "#94a3b8",
                                    }}
                                  >
                                    {nombre}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">
                                —
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Resumen semanal */}
      <div>
        <h2 className="mb-3 text-sm font-medium">Horas semanales</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {resumen.map(({ nombre, horas }) => (
            <Card key={nombre} className="py-3">
              <CardContent className="px-4">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: colorMap.get(nombre) ?? "#94a3b8" }}
                  />
                  <span className="text-sm font-medium">{nombre}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">{horas}</span>
                  <span className="text-muted-foreground text-xs">hs</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
