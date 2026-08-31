"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  Layers3,
  NotebookPen,
  AlertTriangle,
  ClipboardList,
  MessageSquare,
  CalendarOff,
  Users,
  Gauge,
  Timer,
  School,
  MapPin,
  GraduationCap,
  Plane,
  DoorOpen,
  Printer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  GlobalStats,
  ResumenArea,
  ResumenPersona,
  TareaAntigua,
  PrecisionEstimacion,
  SemanaTareas,
  ActividadBitacora,
  AntiguedadVencidas,
  UsoPlantilla,
  ActividadComentarios,
  AusenciaPersona,
  UltimoLogin,
  ReporteVisitas,
  LocalidadVisitas,
  IntegranteVisitas,
  ReporteViajes,
  ViajeResumenInformes,
} from "./tipos";

// Paleta validada (dataviz skill): CVD-safe y con contraste suficiente en
// claro y oscuro, node scripts/validate_palette.js "#2563eb,#16a34a" --mode
// light|dark → ALL CHECKS PASS en ambos modos con el mismo par de colores.
const COLOR_CREADAS = "#2563eb";
const COLOR_COMPLETADAS = "#16a34a";

function formatFecha(iso: string | null): string {
  if (!iso) return "Nunca";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatFechaHora(iso: string | null): string {
  if (!iso) return "Nunca";
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BarraDoble({ label, a, b }: { label: string; a: number; b: number }) {
  const max = Math.max(a, b, 1);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-[11px]">{label}</span>
      <div className="flex h-20 items-end gap-0.5">
        <div
          className="flex-1 rounded-t-sm"
          style={{
            height: `${Math.max((a / max) * 100, a > 0 ? 4 : 0)}%`,
            backgroundColor: COLOR_CREADAS,
          }}
          title={`Creadas: ${a}`}
        />
        <div
          className="flex-1 rounded-t-sm"
          style={{
            height: `${Math.max((b / max) * 100, b > 0 ? 4 : 0)}%`,
            backgroundColor: COLOR_COMPLETADAS,
          }}
          title={`Completadas: ${b}`}
        />
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  colorClass,
  icon: Icon,
}: {
  label: string;
  value: string;
  colorClass?: string;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border p-4">
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
        {Icon && <Icon className="size-3.5" />}
        {label}
      </span>
      <span className={`text-2xl font-semibold ${colorClass ?? ""}`}>{value}</span>
    </div>
  );
}

// Medidor circular de avance por área — no un gráfico de torta multi-serie
// (por_hacer/en_progreso/hecha compitiendo por ángulo, difícil de comparar
// entre muchas áreas a la vez), sino un anillo de una sola serie por área:
// % completado, con el propio color del área como identidad — mismo criterio
// que ya usa la barra de progreso lineal en /proyectos/[areaId].
function MedidorArea({
  id,
  nombre,
  color,
  hechas,
  total,
}: {
  id: string;
  nombre: string;
  color: string;
  hechas: number;
  total: number;
}) {
  const sinTareas = total === 0;
  const pct = sinTareas ? 0 : Math.round((hechas / total) * 100);
  const r = 30;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);

  return (
    <Link
      href={`/proyectos/${id}`}
      className="hover:bg-muted/40 flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors"
      title={`${nombre}: ${sinTareas ? "sin tareas" : `${hechas} de ${total} completadas (${pct}%)`}`}
    >
      <svg width="76" height="76" viewBox="0 0 76 76">
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke={color}
          strokeOpacity={0.15}
          strokeWidth="8"
        />
        {!sinTareas && (
          <circle
            cx="38"
            cy="38"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            transform="rotate(-90 38 38)"
          />
        )}
        <text
          x="38"
          y="35"
          textAnchor="middle"
          className="fill-foreground"
          style={{ fontSize: 15, fontWeight: 600 }}
        >
          {sinTareas ? "—" : `${pct}%`}
        </text>
        <text
          x="38"
          y="48"
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: 9 }}
        >
          {sinTareas ? "sin tareas" : `${hechas}/${total}`}
        </text>
      </svg>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="max-w-[6.5rem] truncate text-xs font-medium">{nombre}</span>
      </span>
    </Link>
  );
}

function BarraSimple({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <div className="bg-muted h-1.5 min-w-6 flex-1 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(pct, 100)}%`,
            backgroundColor: COLOR_COMPLETADAS,
          }}
        />
      </div>
      <span className="text-muted-foreground w-7 shrink-0 text-right text-[11px] tabular-nums sm:w-9 sm:text-xs">
        {pct}%
      </span>
    </div>
  );
}

type Pestaña = "tareas" | "actividad" | "visitas" | "viajes";

const PESTAÑAS: { value: Pestaña; label: string; icon: React.ElementType }[] = [
  { value: "tareas", label: "Tareas", icon: Gauge },
  { value: "actividad", label: "Actividad", icon: NotebookPen },
  { value: "visitas", label: "Visitas a colegios", icon: School },
  { value: "viajes", label: "Viajes", icon: Plane },
];

type Props = {
  tabInicial: Pestaña;
  secciones: { proyectos: boolean; visitas: boolean; viajes: boolean };
  global: GlobalStats;
  resumenAreas: ResumenArea[];
  porPersona: ResumenPersona[];
  tareasAntiguas: TareaAntigua[];
  precisionEstimacion: PrecisionEstimacion;
  semanas: SemanaTareas[];
  actividadBitacora: ActividadBitacora[];
  antiguedadVencidas: AntiguedadVencidas;
  usoPlantillas: UsoPlantilla[];
  actividadComentarios: ActividadComentarios[];
  ausencias: AusenciaPersona[];
  ultimosLogins: UltimoLogin[];
  reporteVisitas: ReporteVisitas;
  localidadesVisitas: LocalidadVisitas[];
  integrantesVisitas: IntegranteVisitas[];
  totalColegios: number;
  anioVisitas: number;
  aniosVisitas: number[];
  reporteViajes: ReporteViajes;
  viajesResumen: ViajeResumenInformes[];
};

export function InformesCliente({
  tabInicial,
  secciones,
  global,
  resumenAreas,
  porPersona,
  tareasAntiguas,
  precisionEstimacion,
  semanas,
  actividadBitacora,
  antiguedadVencidas,
  usoPlantillas,
  actividadComentarios,
  ausencias,
  ultimosLogins,
  reporteVisitas,
  localidadesVisitas,
  integrantesVisitas,
  totalColegios,
  anioVisitas,
  aniosVisitas,
  reporteViajes,
  viajesResumen,
}: Props) {
  const router = useRouter();
  const [pestaña, setPestaña] = useState<Pestaña>(tabInicial);
  const [mostrarTodasAreas, setMostrarTodasAreas] = useState(false);

  const pestañasVisibles = PESTAÑAS.filter(
    (p) =>
      (p.value !== "visitas" || secciones.visitas) &&
      (p.value !== "viajes" || secciones.viajes),
  );

  const LIMITE_AREAS = 6;
  const areasVisibles = mostrarTodasAreas
    ? resumenAreas
    : resumenAreas.slice(0, LIMITE_AREAS);

  const vencidasTotal =
    antiguedadVencidas.b0_7 + antiguedadVencidas.b8_14 + antiguedadVencidas.b15_30 + antiguedadVencidas.b30_mas;
  const avanceGeneralPct = global.total > 0 ? Math.round((global.hecha / global.total) * 100) : 0;

  const ANIO_ITEMS: Record<string, string> = {
    todos: "Todos los años",
    ...Object.fromEntries(aniosVisitas.map((a) => [String(a), String(a)])),
  };

  function cambiarAnioVisitas(v: string) {
    router.push(`/informes?tab=visitas&anio=${v}`);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Informes</h1>
        <p className="text-muted-foreground text-sm">
          Cómo viene la organización: carga de trabajo, avance por área y por
          persona, visitas a colegios y actividad del sistema.
        </p>
      </div>

      <div className="bg-muted flex w-fit items-center gap-1 rounded-lg p-1">
        {pestañasVisibles.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPestaña(p.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              pestaña === p.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <p.icon className="size-4" />
            {p.label}
          </button>
        ))}
      </div>

      {pestaña === "tareas" && (
        <div className="flex flex-col gap-8">
          {/* ── Estado general ────────────────────────────────────────── */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Gauge className="text-muted-foreground size-4" />
              <h2 className="font-semibold">Estado general</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatTile label="Total" value={String(global.total)} />
              <StatTile label="Por hacer" value={String(global.por_hacer)} />
              <StatTile
                label="En progreso"
                value={String(global.en_progreso)}
                colorClass="text-blue-600"
              />
              <StatTile
                label="Vencidas"
                value={String(global.vencidas)}
                colorClass={global.vencidas > 0 ? "text-destructive" : undefined}
              />
              <StatTile label="Completadas" value={String(global.hecha)} colorClass="text-green-600" />
              <StatTile label="Avance general" value={`${avanceGeneralPct}%`} />
            </div>
          </section>

          {/* ── Avance por área ───────────────────────────────────────── */}
          {secciones.proyectos && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Layers3 className="text-muted-foreground size-4" />
              <h2 className="font-semibold">Avance por área</h2>
            </div>

            {resumenAreas.length === 0 ? (
              <p className="text-muted-foreground px-1 text-sm">No hay áreas activas.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {areasVisibles.map((a) => (
                    <MedidorArea key={a.id} id={a.id} nombre={a.nombre} color={a.color} hechas={a.hecha} total={a.total} />
                  ))}
                </div>
                {resumenAreas.length > LIMITE_AREAS && (
                  <button
                    type="button"
                    onClick={() => setMostrarTodasAreas((v) => !v)}
                    className="text-muted-foreground hover:text-foreground self-start text-xs font-medium underline underline-offset-2"
                  >
                    {mostrarTodasAreas
                      ? "Mostrar menos"
                      : `Mostrar ${resumenAreas.length - LIMITE_AREAS} más`}
                  </button>
                )}
              </>
            )}

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-muted-foreground w-full px-2 py-3 text-left text-xs font-medium sm:px-4">Área</th>
                        <th className="text-muted-foreground px-1.5 py-3 text-center text-xs font-medium whitespace-nowrap sm:px-3">Total</th>
                        <th className="text-muted-foreground px-1.5 py-3 text-center text-xs font-medium whitespace-nowrap sm:px-3">Venc.</th>
                        <th className="text-muted-foreground px-1.5 py-3 text-center text-xs font-medium whitespace-nowrap sm:px-3">Hechas</th>
                        <th className="text-muted-foreground hidden px-3 py-3 text-center text-xs font-medium whitespace-nowrap sm:table-cell">Prom. días</th>
                        <th className="text-muted-foreground min-w-[68px] px-2 py-3 text-left text-xs font-medium sm:min-w-[120px] sm:px-4">Progreso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumenAreas.map((a) => (
                        <tr key={a.id} className="border-b last:border-0">
                          <td className="max-w-0 px-2 py-2.5 sm:px-4">
                            <Link href={`/proyectos/${a.id}`} className="flex items-center gap-2 hover:underline">
                              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: a.color }} />
                              <span className="truncate font-medium">{a.nombre}</span>
                            </Link>
                          </td>
                          <td className="text-muted-foreground px-1.5 py-2.5 text-center tabular-nums sm:px-3">{a.total}</td>
                          <td className="px-1.5 py-2.5 text-center tabular-nums sm:px-3">
                            {a.vencidas > 0 ? (
                              <span className="text-destructive font-medium">{a.vencidas}</span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                          <td className="px-1.5 py-2.5 text-center font-medium text-green-600 tabular-nums sm:px-3">{a.hecha}</td>
                          <td className="text-muted-foreground hidden px-3 py-2.5 text-center text-xs tabular-nums sm:table-cell">
                            {a.dias_promedio != null ? `${a.dias_promedio}d` : "—"}
                          </td>
                          <td className="px-2 py-2.5 sm:px-4">
                            <BarraSimple pct={a.total > 0 ? Math.round((a.hecha / a.total) * 100) : 0} />
                          </td>
                        </tr>
                      ))}
                      {resumenAreas.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-muted-foreground px-4 py-6 text-center text-sm">
                            No hay áreas creadas.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </section>
          )}

          {/* ── Carga por persona ─────────────────────────────────────── */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Users className="text-muted-foreground size-4" />
              <h2 className="font-semibold">Carga por persona</h2>
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-muted-foreground w-full px-4 py-3 text-left text-xs font-medium">Miembro</th>
                        <th className="text-muted-foreground px-3 py-3 text-center text-xs font-medium whitespace-nowrap">Abiertas</th>
                        <th className="text-muted-foreground px-3 py-3 text-center text-xs font-medium whitespace-nowrap">Vencidas</th>
                        <th className="text-muted-foreground px-3 py-3 text-center text-xs font-medium whitespace-nowrap">Hechas</th>
                        <th className="text-muted-foreground hidden px-3 py-3 text-center text-xs font-medium whitespace-nowrap sm:table-cell">Prom. días</th>
                        <th className="text-muted-foreground min-w-[120px] px-4 py-3 text-left text-xs font-medium">Progreso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {porPersona.map((p) => (
                        <tr key={p.nombre} className="border-b last:border-0">
                          <td className="px-4 py-2.5 font-medium">{p.nombre}</td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {p.en_progreso > 0 && (
                                <Badge variant="secondary" className="px-1.5 py-0 text-xs">
                                  {p.en_progreso}
                                </Badge>
                              )}
                              {p.por_hacer > 0 && (
                                <Badge variant="outline" className="px-1.5 py-0 text-xs">
                                  {p.por_hacer}
                                </Badge>
                              )}
                              {p.en_progreso === 0 && p.por_hacer === 0 && (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center tabular-nums">
                            {p.vencidas > 0 ? (
                              <span className="text-destructive font-medium">{p.vencidas}</span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center font-medium text-green-600 tabular-nums">{p.hecha}</td>
                          <td className="text-muted-foreground hidden px-3 py-2.5 text-center text-xs tabular-nums sm:table-cell">
                            {p.dias_promedio != null ? `${p.dias_promedio}d` : "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            <BarraSimple pct={p.total > 0 ? Math.round((p.hecha / p.total) * 100) : 0} />
                          </td>
                        </tr>
                      ))}
                      {porPersona.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-muted-foreground px-4 py-6 text-center text-sm">
                            No hay tareas asignadas.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* ── Tareas más antiguas abiertas ──────────────────────────── */}
          {tareasAntiguas.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Timer className="text-muted-foreground size-4" />
                <h2 className="font-semibold">Tareas más antiguas abiertas</h2>
              </div>
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {tareasAntiguas.map((t, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3">
                        {t.area_color && (
                          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: t.area_color }} />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{t.titulo}</p>
                          <p className="text-muted-foreground text-xs">
                            {t.area_nombre ?? "Sin área"}
                            {t.responsable_nombre && ` · ${t.responsable_nombre}`}
                          </p>
                        </div>
                        <Badge variant="outline" className={t.dias_abierta > 14 ? "border-destructive/40 text-destructive" : ""}>
                          {t.dias_abierta}d
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

          {/* ── Antigüedad de tareas vencidas ─────────────────────────── */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-muted-foreground size-4" />
              <h2 className="font-semibold">Antigüedad de tareas vencidas</h2>
            </div>
            <Card>
              <CardContent className="pt-4">
                {vencidasTotal === 0 ? (
                  <p className="text-muted-foreground text-sm">No hay tareas vencidas. 🎉</p>
                ) : (
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: "0–7 días", n: antiguedadVencidas.b0_7 },
                      { label: "8–14 días", n: antiguedadVencidas.b8_14 },
                      { label: "15–30 días", n: antiguedadVencidas.b15_30 },
                      { label: "30+ días", n: antiguedadVencidas.b30_mas },
                    ].map((b) => (
                      <div key={b.label} className="flex flex-col items-center gap-1 rounded-md border p-3">
                        <span className={`text-2xl font-bold tabular-nums ${b.n > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {b.n}
                        </span>
                        <span className="text-muted-foreground text-center text-[11px]">{b.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* ── Precisión de estimación ────────────────────────────────── */}
          {precisionEstimacion.cantidad > 0 && (
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Timer className="text-muted-foreground size-4" />
                <h2 className="font-semibold">Precisión de estimación</h2>
              </div>
              <Card>
                <CardContent className="flex flex-wrap items-center gap-6 pt-4 text-sm">
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground text-xs">Promedio estimado</span>
                    <span className="text-xl font-bold tabular-nums">{precisionEstimacion.promedio_estimado}h</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground text-xs">Promedio real</span>
                    <span className="text-xl font-bold tabular-nums">{precisionEstimacion.promedio_real}h</span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Basado en {precisionEstimacion.cantidad} tarea
                    {precisionEstimacion.cantidad !== 1 ? "s" : ""} con ambos datos cargados.
                  </p>
                </CardContent>
              </Card>
            </section>
          )}

          {/* ── Tareas por semana ──────────────────────────────────────── */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="text-muted-foreground size-4" />
              <h2 className="font-semibold">Tareas por semana</h2>
            </div>
            <Card>
              <CardContent className="flex flex-col gap-3 pt-4">
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: COLOR_CREADAS }} />
                    Creadas
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: COLOR_COMPLETADAS }} />
                    Completadas
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
                  {semanas.map((s) => (
                    <BarraDoble
                      key={s.semana}
                      label={new Date(s.semana).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}
                      a={s.creadas}
                      b={s.completadas}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      )}

      {pestaña === "actividad" && (
        <div className="flex flex-col gap-8">
          {/* ── Actividad de bitácora ──────────────────────────────────── */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <NotebookPen className="text-muted-foreground size-4" />
              <h2 className="font-semibold">Actividad de bitácora (últimos 30 días)</h2>
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {actividadBitacora.map((p) => (
                    <div key={p.nombre} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.nombre}</span>
                      <div className="w-40">
                        <BarraSimple pct={Math.round((p.dias_cargados / 30) * 100)} />
                      </div>
                    </div>
                  ))}
                  {actividadBitacora.length === 0 && (
                    <p className="text-muted-foreground px-4 py-6 text-center text-sm">No hay usuarios activos.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* ── Uso de plantillas ──────────────────────────────────────── */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="text-muted-foreground size-4" />
              <h2 className="font-semibold">Uso de plantillas</h2>
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-muted-foreground w-full px-4 py-3 text-left text-xs font-medium">Plantilla</th>
                        <th className="text-muted-foreground px-3 py-3 text-center text-xs font-medium whitespace-nowrap">Veces aplicada</th>
                        <th className="text-muted-foreground px-4 py-3 text-right text-xs font-medium whitespace-nowrap">Última vez</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usoPlantillas.map((p, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-4 py-2.5">
                            <span className="font-medium">{p.nombre}</span>
                            <span className="text-muted-foreground text-xs"> · {p.area_nombre}</span>
                          </td>
                          <td className="px-3 py-2.5 text-center tabular-nums">
                            {p.veces_aplicada > 0 ? (
                              <Badge variant="secondary">{p.veces_aplicada}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                          <td className="text-muted-foreground px-4 py-2.5 text-right text-xs tabular-nums">
                            {formatFecha(p.ultima_aplicacion)}
                          </td>
                        </tr>
                      ))}
                      {usoPlantillas.length === 0 && (
                        <tr>
                          <td colSpan={3} className="text-muted-foreground px-4 py-6 text-center text-sm">
                            No hay plantillas creadas.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* ── Actividad de comentarios ─────────────────────────────────── */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="text-muted-foreground size-4" />
              <h2 className="font-semibold">Colaboración: comentarios (últimos 30 días)</h2>
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {actividadComentarios.map((p) => (
                    <div key={p.nombre} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.nombre}</span>
                      <Badge variant="secondary">{p.comentarios}</Badge>
                    </div>
                  ))}
                  {actividadComentarios.length === 0 && (
                    <p className="text-muted-foreground px-4 py-6 text-center text-sm">
                      No hay comentarios en los últimos 30 días.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* ── Ausencias por persona ─────────────────────────────────── */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <CalendarOff className="text-muted-foreground size-4" />
              <h2 className="font-semibold">Ausencias por persona (últimos 90 días)</h2>
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {ausencias.map((p) => (
                    <div key={p.nombre} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.nombre}</span>
                      <Badge variant="outline">{p.ausencias}</Badge>
                    </div>
                  ))}
                  {ausencias.length === 0 && (
                    <p className="text-muted-foreground px-4 py-6 text-center text-sm">
                      No se registraron ausencias en los últimos 90 días.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* ── Última conexión ──────────────────────────────────────── */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Users className="text-muted-foreground size-4" />
              <h2 className="font-semibold">Última conexión por usuario</h2>
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-muted-foreground w-full px-4 py-3 text-left text-xs font-medium">Usuario</th>
                        <th className="text-muted-foreground px-3 py-3 text-center text-xs font-medium whitespace-nowrap">Rol</th>
                        <th className="text-muted-foreground px-4 py-3 text-right text-xs font-medium whitespace-nowrap">Último acceso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ultimosLogins.map((u, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-4 py-2.5 font-medium">{u.nombre}</td>
                          <td className="px-3 py-2.5 text-center">
                            <Badge variant="outline" className="capitalize">
                              {u.rol}
                            </Badge>
                          </td>
                          <td className="text-muted-foreground px-4 py-2.5 text-right text-xs tabular-nums">
                            {formatFechaHora(u.ultimo_login)}
                          </td>
                        </tr>
                      ))}
                      {ultimosLogins.length === 0 && (
                        <tr>
                          <td colSpan={3} className="text-muted-foreground px-4 py-6 text-center text-sm">
                            No hay usuarios activos.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      )}

      {pestaña === "visitas" && (
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <School className="text-muted-foreground size-4" />
                <h2 className="font-semibold">Reporte anual de visitas</h2>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={anioVisitas === 0 ? "todos" : String(anioVisitas)}
                  onValueChange={(v) => cambiarAnioVisitas(v ?? "todos")}
                  items={ANIO_ITEMS}
                >
                  <SelectTrigger className="h-9 w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los años</SelectItem>
                    {aniosVisitas.map((a) => (
                      <SelectItem key={a} value={String(a)}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9"
                  nativeButton={false}
                  render={
                    <Link
                      href={`/reporte-visitas?anio=${anioVisitas === 0 ? "todos" : anioVisitas}`}
                      target="_blank"
                    />
                  }
                >
                  <Printer className="size-4" />
                  Generar reporte
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <StatTile
                label="Visitas realizadas"
                value={String(reporteVisitas.visitas_realizadas)}
                colorClass="text-green-600"
                icon={GraduationCap}
              />
              <StatTile
                label="Colegios visitados"
                value={String(reporteVisitas.colegios_visitados)}
                icon={School}
              />
              <StatTile
                label="Localidades alcanzadas"
                value={String(reporteVisitas.localidades_alcanzadas)}
                icon={MapPin}
              />
              <StatTile
                label="Alumnos alcanzados"
                value={reporteVisitas.alumnos_alcanzados.toLocaleString("es-AR")}
                icon={Users}
              />
              <StatTile
                label="Veces que viajamos"
                value={String(reporteVisitas.veces_viajamos)}
                icon={Plane}
              />
              <StatTile
                label="Nos visitaron"
                value={String(reporteVisitas.veces_nos_visitaron)}
                icon={DoorOpen}
              />
              <StatTile label="Pendientes" value={String(reporteVisitas.visitas_pendientes)} />
              <StatTile
                label="Canceladas"
                value={String(reporteVisitas.visitas_canceladas)}
                colorClass={reporteVisitas.visitas_canceladas > 0 ? "text-muted-foreground" : undefined}
              />
            </div>

            <p className="text-muted-foreground text-xs">
              {totalColegios} colegios en el directorio en total · Ferias/expos:{" "}
              {reporteVisitas.ferias_expos} · Charlas/talleres: {reporteVisitas.charlas_talleres} ·
              Virtuales: {reporteVisitas.virtuales}
              {reporteVisitas.otros > 0 && ` · Otro: ${reporteVisitas.otros}`}
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <MapPin className="text-muted-foreground size-4" />
              <h2 className="font-semibold">Visitas realizadas por localidad</h2>
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-muted-foreground w-full px-4 py-3 text-left text-xs font-medium">Localidad</th>
                        <th className="text-muted-foreground px-3 py-3 text-center text-xs font-medium whitespace-nowrap">Visitas</th>
                        <th className="text-muted-foreground px-4 py-3 text-right text-xs font-medium whitespace-nowrap">Alumnos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {localidadesVisitas.map((l) => (
                        <tr key={l.ciudad} className="border-b last:border-0">
                          <td className="px-4 py-2.5 font-medium">{l.ciudad}</td>
                          <td className="px-3 py-2.5 text-center tabular-nums">
                            <Badge variant="secondary">{l.visitas}</Badge>
                          </td>
                          <td className="text-muted-foreground px-4 py-2.5 text-right tabular-nums">
                            {l.alumnos > 0 ? l.alumnos.toLocaleString("es-AR") : "—"}
                          </td>
                        </tr>
                      ))}
                      {localidadesVisitas.length === 0 && (
                        <tr>
                          <td colSpan={3} className="text-muted-foreground px-4 py-6 text-center text-sm">
                            No hay visitas realizadas con localidad cargada
                            {anioVisitas !== 0 ? ` en ${anioVisitas}` : ""}.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Users className="text-muted-foreground size-4" />
              <h2 className="font-semibold">Visitas realizadas por integrante</h2>
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {integrantesVisitas.map((p) => (
                    <div key={p.nombre} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.nombre}</span>
                      <Badge variant="secondary">{p.visitas_realizadas}</Badge>
                    </div>
                  ))}
                  {integrantesVisitas.length === 0 && (
                    <p className="text-muted-foreground px-4 py-6 text-center text-sm">
                      Nadie tiene visitas realizadas registradas
                      {anioVisitas !== 0 ? ` en ${anioVisitas}` : ""}.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

          <p className="text-muted-foreground text-center text-xs">
            <Link href="/visitas" className="hover:text-foreground underline underline-offset-2">
              Ver el detalle de visitas y el directorio de colegios
            </Link>
          </p>
        </div>
      )}

      {pestaña === "viajes" && (
        <div className="flex flex-col gap-8">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Viajes activos" value={String(reporteViajes.viajes_activos)} icon={Plane} />
            <StatTile label="Inscriptos confirmados" value={String(reporteViajes.inscriptos_confirmados)} icon={Users} />
            <StatTile
              label="Recaudado"
              value={`$${reporteViajes.total_recaudado.toLocaleString("es-AR")}`}
              colorClass={COLOR_COMPLETADAS}
            />
            <StatTile
              label="Costos fijados"
              value={`$${reporteViajes.total_costos.toLocaleString("es-AR")}`}
            />
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Plane className="text-muted-foreground size-4" />
              <h2 className="font-semibold">Viajes</h2>
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs">
                        <th className="text-muted-foreground px-4 py-3 font-medium">Viaje</th>
                        <th className="text-muted-foreground px-3 py-3 text-center font-medium whitespace-nowrap">Confirmados</th>
                        <th className="text-muted-foreground px-3 py-3 text-right font-medium whitespace-nowrap">Recaudado</th>
                        <th className="text-muted-foreground px-3 py-3 text-right font-medium whitespace-nowrap">Costos</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {viajesResumen.map((v) => (
                        <tr key={v.id} className="border-b last:border-0">
                          <td className="px-4 py-2.5">
                            <Link href={`/viajes/${v.id}`} className="font-medium hover:underline">
                              {v.nombre}
                            </Link>
                          </td>
                          <td className="px-3 py-2.5 text-center tabular-nums">
                            <Badge variant="secondary">{v.confirmados}</Badge>
                          </td>
                          <td className="text-muted-foreground px-3 py-2.5 text-right tabular-nums">
                            ${v.recaudado.toLocaleString("es-AR")}
                          </td>
                          <td className="text-muted-foreground px-3 py-2.5 text-right tabular-nums">
                            ${v.costos.toLocaleString("es-AR")}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Link
                              href={`/reporte-viajes/${v.id}`}
                              target="_blank"
                              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs underline underline-offset-2"
                            >
                              <Printer className="size-3" />
                              Generar reporte
                            </Link>
                          </td>
                        </tr>
                      ))}
                      {viajesResumen.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-muted-foreground px-4 py-6 text-center text-sm">
                            No hay viajes cargados todavía.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </section>

          <p className="text-muted-foreground text-center text-xs">
            <Link href="/viajes" className="hover:text-foreground underline underline-offset-2">
              Ver el módulo de Viajes
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
