import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  CalendarDays,
  CheckCircle2,
  Clock,
  ListTodo,
  User,
} from "lucide-react";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AreaDetalleCliente } from "./area-detalle-cliente";
import { AreaNotas, type NotaRow } from "./area-notas";
import { AreaPlantillas } from "./area-plantillas";
import { fetchPlantillas } from "../actions";

type AreaRow = {
  id: string;
  nombre: string;
  color: string;
  descripcion: string | null;
  responsable_id: string | null;
  responsable_nombre: string | null;
  activa: boolean;
  asignados: { id: string; nombre: string; avatar_color: string | null }[];
  tareas_total: number;
  tareas_hechas: number;
  tareas_abiertas: number;
};

type TareaRow = {
  id: string;
  titulo: string;
  estado: string;
  prioridad: string;
  tipo: string;
  fecha_vencimiento: string | null;
  responsable_id: string | null;
  responsable_nombre: string | null;
};

type UsuarioRow = { id: string; nombre: string; avatar_color: string | null };

const PRIORIDAD_COLOR: Record<string, string> = {
  baja: "#94a3b8",
  media: "#f59e0b",
  alta: "#ef4444",
};

const TIPO_LABEL: Record<string, string> = {
  evento: "Evento",
  entrega: "Entrega",
  reunion: "Reunión",
};

const ESTADO_CONFIG = {
  en_progreso: { label: "En progreso", icon: Clock, color: "text-blue-600" },
  por_hacer:   { label: "Por hacer",   icon: ListTodo, color: "text-muted-foreground" },
  hecha:       { label: "Hechas",      icon: CheckCircle2, color: "text-green-600" },
} as const;

function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/);
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

export default async function AreaDetallePage({
  params,
}: {
  params: Promise<{ areaId: string }>;
}) {
  const { areaId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const rol = (session.user as { rol: string }).rol;
  const canManage = rol === "coordinador" || rol === "administrador";

  const { area, tareas, usuarios, notas } = await withUser(session.user.id, async (tx) => {
    const [area] = await tx<AreaRow[]>`
      select
        a.id, a.nombre, a.color, a.descripcion, a.responsable_id, a.activa,
        u.nombre  as responsable_nombre,
        coalesce(
          (
            select json_agg(json_build_object('id', u2.id, 'nombre', u2.nombre, 'avatar_color', u2.avatar_color))
            from area_asignado aa
            join usuario u2 on u2.id = aa.usuario_id
            where aa.area_id = a.id
          ),
          '[]'
        ) as asignados,
        count(t.id)::int                                    as tareas_total,
        count(t.id) filter (where t.estado = 'hecha')::int   as tareas_hechas,
        count(t.id) filter (where t.estado != 'hecha')::int  as tareas_abiertas
      from area a
      left join usuario u on u.id = a.responsable_id
      left join tarea   t on t.area_id = a.id and t.archivada = false
      where a.id = ${areaId}
        and a.organizacion_id = mi_organizacion_id()
      group by a.id, u.nombre
      limit 1
    `;

    if (!area) return { area: null, tareas: [], usuarios: [], notas: [] };

    const tareas = await tx<TareaRow[]>`
      select
        t.id, t.titulo, t.estado::text, t.prioridad::text, t.tipo::text,
        t.fecha_vencimiento::text,
        t.responsable_id,
        u.nombre as responsable_nombre
      from tarea t
      left join usuario u on u.id = t.responsable_id
      where t.area_id = ${areaId}
        and t.archivada = false
      order by
        case t.estado
          when 'en_progreso' then 1
          when 'por_hacer'   then 2
          when 'hecha'       then 3
        end,
        t.orden asc, t.creada_en asc
    `;

    const usuarios = canManage
      ? await tx<UsuarioRow[]>`
          select id, nombre, avatar_color from usuario
          where organizacion_id = mi_organizacion_id() and estado = 'activo'
          order by nombre asc
        `
      : [];

    const notas = await tx<NotaRow[]>`
      select
        n.id,
        n.contenido,
        n.tipo::text   as tipo,
        n.creada_en::text,
        n.autor_id,
        u.nombre       as autor_nombre
      from nota_area n
      join usuario u on u.id = n.autor_id
      where n.area_id = ${areaId}
      order by n.creada_en desc
      limit 100
    `;

    return { area, tareas: [...tareas], usuarios: [...usuarios], notas: [...notas] };
  });

  if (!area) notFound();

  const plantillas = await fetchPlantillas(areaId);

  const pct =
    area.tareas_total > 0
      ? Math.round((area.tareas_hechas / area.tareas_total) * 100)
      : 0;

  const hoyISO = new Date().toISOString().slice(0, 10);

  const grupos = (["en_progreso", "por_hacer", "hecha"] as const).map((estado) => ({
    estado,
    ...ESTADO_CONFIG[estado],
    tareas: tareas.filter((t) => t.estado === estado),
  }));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit -ml-2"
          nativeButton={false}
          render={<Link href="/areas" />}
        >
          <ArrowLeft className="size-4" />
          Áreas
        </Button>

        <AreaDetalleCliente
          area={{
            id: area.id,
            nombre: area.nombre,
            descripcion: area.descripcion,
            color: area.color,
            responsable_id: area.responsable_id,
            activa: area.activa,
            asignados: area.asignados,
          }}
          usuarios={usuarios}
          canManage={canManage}
        />
      </div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div
            className="mt-1 size-4 shrink-0 rounded-full"
            style={{ backgroundColor: area.color }}
          />
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{area.nombre}</h1>
              {!area.activa && (
                <Badge variant="outline" className="text-muted-foreground">Archivada</Badge>
              )}
            </div>
            {area.descripcion && (
              <p className="text-muted-foreground text-sm">{area.descripcion}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-1.5 text-sm">
            <ListTodo className="size-4 text-muted-foreground" />
            <span className="font-semibold">{area.tareas_abiertas}</span>
            <span className="text-muted-foreground">abiertas</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <CheckCircle2 className="size-4 text-green-500" />
            <span className="font-semibold text-green-600">{area.tareas_hechas}</span>
            <span className="text-muted-foreground">completadas</span>
          </div>
          {area.responsable_nombre && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <User className="size-4" />
              <span>{area.responsable_nombre}</span>
            </div>
          )}
        </div>

        {/* Barra de progreso */}
        {area.tareas_total > 0 && (
          <div className="flex flex-col gap-1.5 max-w-sm">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progreso</span>
              <span className="tabular-nums font-medium">{pct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: area.color }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {area.tareas_hechas} de {area.tareas_total} tareas completadas
            </p>
          </div>
        )}
      </div>

      {/* ── Tareas por estado ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6">
        {grupos.map(({ estado, label, icon: Icon, color, tareas: grupo }) => {
          if (grupo.length === 0) return null;
          return (
            <section key={estado} className="flex flex-col gap-2">
              <div className={`flex items-center gap-2 ${color}`}>
                <Icon className="size-4" />
                <h2 className="text-sm font-semibold">{label}</h2>
                <span className="text-muted-foreground font-normal text-xs">
                  {grupo.length}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                {grupo.map((t) => {
                  const vencida =
                    t.fecha_vencimiento !== null &&
                    t.fecha_vencimiento < hoyISO &&
                    t.estado !== "hecha";

                  return (
                    <div
                      key={t.id}
                      className="bg-card border rounded-lg px-4 py-3 flex items-start gap-3"
                    >
                      {/* Prioridad dot */}
                      <span
                        className="mt-1 size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: PRIORIDAD_COLOR[t.prioridad] ?? "#94a3b8" }}
                      />

                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium leading-snug ${t.estado === "hecha" ? "text-muted-foreground line-through" : ""}`}>
                          {t.titulo}
                        </p>
                        <div className="flex items-center flex-wrap gap-2 mt-1">
                          {TIPO_LABEL[t.tipo] && (
                            <Badge variant="outline" className="text-[11px] px-1.5 py-0 font-normal">
                              {TIPO_LABEL[t.tipo]}
                            </Badge>
                          )}
                          {t.fecha_vencimiento && (
                            <span
                              className={`flex items-center gap-1 text-[12px] ${vencida ? "text-destructive font-medium" : "text-muted-foreground"}`}
                            >
                              <CalendarDays className="size-3" />
                              {new Date(t.fecha_vencimiento + "T00:00:00").toLocaleDateString("es-AR", {
                                day: "2-digit",
                                month: "2-digit",
                              })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Responsable */}
                      {t.responsable_nombre ? (
                        <Avatar className="size-6 shrink-0">
                          <AvatarFallback className="text-[10px] font-semibold bg-[oklch(0.62_0.19_42)] text-white">
                            {iniciales(t.responsable_nombre)}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <span className="text-muted-foreground/40 text-[11px] shrink-0 mt-0.5">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {tareas.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm">
              Esta área todavía no tiene tareas.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              nativeButton={false}
              render={<Link href="/tablero" />}
            >
              Crear tarea en el tablero
            </Button>
          </div>
        )}
      </div>

      {/* ── Plantillas de tareas ───────────────────────────────────────────── */}
      <div className="border-t pt-6">
        <AreaPlantillas
          areaId={area.id}
          plantillasIniciales={plantillas}
          canManage={canManage}
        />
      </div>

      {/* ── Bitácora ────────────────────────────────────────────────────────── */}
      <div className="border-t pt-6">
        <AreaNotas
          areaId={area.id}
          notasIniciales={notas}
          usuarioActualId={session.user.id}
          canDelete={canManage}
        />
      </div>
    </div>
  );
}
