import { redirect } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  CalendarRange,
  Layers3,
  Users,
  AlertCircle,
  CheckCircle2,
  Clock,
  ListTodo,
} from "lucide-react";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TareaFila } from "./tarea-fila";
import { AccesosCard } from "./accesos-card";

// ── Helpers ───────────────────────────────────────────────────────────────────

function saludo(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

function fechaLarga(): string {
  const s = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fechaRelativa(fechaISO: string, hoyISO: string): string {
  const diff = Math.round(
    (new Date(fechaISO + "T00:00:00").getTime() -
      new Date(hoyISO + "T00:00:00").getTime()) /
      86400000,
  );
  if (diff < 0) return `hace ${Math.abs(diff)} ${Math.abs(diff) === 1 ? "día" : "días"}`;
  if (diff === 0) return "hoy";
  if (diff === 1) return "mañana";
  if (diff < 7) return `en ${diff} días`;
  return new Date(fechaISO + "T00:00:00").toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
  });
}

const PALETTE = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6",
];

function colorParaNombre(nombre: string, todos: string[]): string {
  const sorted = [...todos].sort();
  const idx = sorted.indexOf(nombre);
  return PALETTE[idx % PALETTE.length];
}

function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/);
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

type TareaRow = {
  id: string;
  titulo: string;
  estado: string;
  prioridad: string;
  tipo: string;
  fecha_vencimiento: string | null;
  area_color: string | null;
  area_nombre: string | null;
};

type StatRow = {
  abiertas: number;
  en_progreso: number;
  completadas_hoy: number;
};

type PersonaRow = { nombre: string };

type AccesoRow = { id: string; etiqueta: string; url: string };

// ── Navegación rápida ─────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: "/tablero", label: "Tablero", icon: LayoutDashboard },
  { href: "/cronograma", label: "Cronograma", icon: CalendarRange },
  { href: "/areas", label: "Áreas", icon: Layers3 },
  { href: "/coordinacion", label: "Coordinación", icon: Users },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function HoyPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const rol = (session.user as { rol: string }).rol;
  const canManage = rol === "coordinador" || rol === "administrador";
  const hoyISO = new Date().toISOString().slice(0, 10);

  const { tareas, stats, enOficina, accesos } = await withUser(
    session.user.id,
    async (tx) => {
      const tareas = await tx<TareaRow[]>`
        select
          t.id,
          t.titulo,
          t.estado::text,
          t.prioridad::text,
          t.tipo::text,
          t.fecha_vencimiento::text,
          a.color as area_color,
          a.nombre as area_nombre
        from tarea t
        left join area a on a.id = t.area_id
        where t.responsable_id = mi_usuario_id()
          and t.estado != 'hecha'
        order by t.fecha_vencimiento asc nulls last, t.orden asc
      `;

      const [stats] = await tx<[StatRow]>`
        select
          count(*)         filter (where estado != 'hecha')::int                           as abiertas,
          count(*)         filter (where estado = 'en_progreso')::int                      as en_progreso,
          count(*)         filter (where estado = 'hecha'
            and completada_en::date = current_date)::int                                   as completadas_hoy
        from tarea
        where organizacion_id = mi_organizacion_id()
      `;

      const enOficina = await tx<PersonaRow[]>`
        select u.nombre
        from turno t
        join usuario u on u.id = t.usuario_id
        where t.organizacion_id = mi_organizacion_id()
          and t.dia_semana = (extract(isodow from current_date)::int - 1)
          and t.hora_inicio <= current_time
          and t.hora_fin    >  current_time
          and t.vigente_desde <= current_date
          and (t.vigente_hasta is null or t.vigente_hasta >= current_date)
        order by u.nombre asc
      `;

      const accesos = await tx<AccesoRow[]>`
        select id, etiqueta, url
        from acceso_rapido
        where organizacion_id = mi_organizacion_id()
        order by orden asc
      `;

      return {
        tareas: [...tareas],
        stats,
        enOficina: [...enOficina],
        accesos: [...accesos],
      };
    },
  );

  // Clasificar tareas
  const vencidas = tareas.filter(
    (t) => t.fecha_vencimiento !== null && t.fecha_vencimiento < hoyISO,
  );
  const paraHoy = tareas.filter(
    (t) =>
      t.estado === "en_progreso" ||
      t.fecha_vencimiento === hoyISO ||
      (t.fecha_vencimiento === null && vencidas.every((v) => v.id !== t.id)),
  );
  const proximas = tareas.filter(
    (t) =>
      t.fecha_vencimiento !== null &&
      t.fecha_vencimiento > hoyISO &&
      t.estado !== "en_progreso",
  );

  const nombresPaleta = enOficina.map((p) => p.nombre);

  const subtituloHoy =
    paraHoy.length === 0 && vencidas.length === 0
      ? "Estás al día por hoy."
      : vencidas.length > 0
        ? `${vencidas.length} tarea${vencidas.length > 1 ? "s" : ""} vencida${vencidas.length > 1 ? "s" : ""} — revisalas.`
        : `${paraHoy.length} tarea${paraHoy.length > 1 ? "s" : ""} para completar hoy.`;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">{fechaLarga()}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {saludo()}, {session.user.name.split(" ")[0]}
        </h1>
        <p className={`text-sm ${vencidas.length > 0 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
          {subtituloHoy}
        </p>
      </div>

      {/* ── Body 2-col ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_260px]">

        {/* ── Columna izquierda ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">

          {/* Vencidas */}
          {vencidas.length > 0 && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="flex items-center gap-2 text-sm text-destructive font-semibold">
                  <AlertCircle className="size-4" />
                  Vencidas
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 divide-y divide-destructive/10">
                {vencidas.map((t) => (
                  <TareaFila
                    key={t.id}
                    id={t.id}
                    titulo={t.titulo}
                    estado={t.estado}
                    prioridad={t.prioridad}
                    tipo={t.tipo}
                    areaColor={t.area_color}
                    areaNombre={t.area_nombre}
                    fecha={t.fecha_vencimiento}
                    fechaRelativa={t.fecha_vencimiento ? fechaRelativa(t.fecha_vencimiento, hoyISO) : null}
                    vencida
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Mis tareas de hoy */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="flex items-center justify-between text-sm font-semibold">
                Mis tareas de hoy
                {paraHoy.length > 0 && (
                  <Badge variant="outline">{paraHoy.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 divide-y">
              {paraHoy.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <CheckCircle2 className="size-8 text-green-500 opacity-60" />
                  <p className="text-sm text-muted-foreground">
                    No tenés nada pendiente para hoy.
                  </p>
                  <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/tablero" />}>
                    Ver tablero completo
                  </Button>
                </div>
              ) : (
                paraHoy.map((t) => (
                  <TareaFila
                    key={t.id}
                    id={t.id}
                    titulo={t.titulo}
                    estado={t.estado}
                    prioridad={t.prioridad}
                    tipo={t.tipo}
                    areaColor={t.area_color}
                    areaNombre={t.area_nombre}
                    fecha={t.fecha_vencimiento}
                    fechaRelativa={t.fecha_vencimiento ? fechaRelativa(t.fecha_vencimiento, hoyISO) : null}
                    vencida={false}
                  />
                ))
              )}
            </CardContent>
          </Card>

          {/* Próximamente */}
          {proximas.length > 0 && (
            <Collapsible defaultOpen={proximas.length <= 5}>
              <Card>
                <CollapsibleTrigger
                  nativeButton={false}
                  render={<CardHeader className="cursor-pointer select-none pb-2 pt-4 px-4" />}
                >
                  <CardTitle className="flex items-center justify-between text-sm font-semibold">
                    Próximamente
                    <Badge variant="outline">{proximas.length}</Badge>
                  </CardTitle>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="px-4 pb-3 divide-y">
                    {proximas.map((t) => (
                      <TareaFila
                        key={t.id}
                        id={t.id}
                        titulo={t.titulo}
                        estado={t.estado}
                        prioridad={t.prioridad}
                        tipo={t.tipo}
                        areaColor={t.area_color}
                        areaNombre={t.area_nombre}
                        fecha={t.fecha_vencimiento}
                        fechaRelativa={t.fecha_vencimiento ? fechaRelativa(t.fecha_vencimiento, hoyISO) : null}
                        vencida={false}
                      />
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* Ir al tablero si no hay nada */}
          {tareas.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <Button key={href} variant="outline" size="sm" nativeButton={false} render={<Link href={href} />}>
                  <Icon className="size-3.5" />
                  {label}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* ── Columna derecha ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">

          {/* En la oficina ahora */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <span className={`size-2 rounded-full ${enOficina.length > 0 ? "bg-green-500" : "bg-muted-foreground/40"}`} />
                En la oficina ahora
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {enOficina.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Fuera del horario de oficina.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {enOficina.map((p) => (
                      <Avatar key={p.nombre} className="size-8">
                        <AvatarFallback
                          className="text-[10px] font-semibold text-white"
                          style={{ backgroundColor: colorParaNombre(p.nombre, nombresPaleta) }}
                        >
                          {iniciales(p.nombre)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {enOficina.map((p) => p.nombre.split(" ")[0]).join(", ")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats del equipo */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">
                Pulso del equipo
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 flex flex-col gap-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground text-xs">
                  <ListTodo className="size-3.5" />
                  Abiertas
                </span>
                <span className="font-semibold tabular-nums">{stats.abiertas}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground text-xs">
                  <Clock className="size-3.5" />
                  En progreso
                </span>
                <span className="font-semibold tabular-nums text-blue-600">{stats.en_progreso}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground text-xs">
                  <CheckCircle2 className="size-3.5" />
                  Completadas hoy
                </span>
                <span className="font-semibold tabular-nums text-green-600">{stats.completadas_hoy}</span>
              </div>
            </CardContent>
          </Card>

          {/* Accesos rápidos */}
          <AccesosCard accesos={accesos} canManage={canManage} />

          {/* Navegación rápida */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">
                Ir a
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 flex flex-col gap-1">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-muted transition-colors group"
                >
                  <Icon className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <span>{label}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
