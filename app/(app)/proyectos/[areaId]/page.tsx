import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  ListTodo,
  User,
  History,
} from "lucide-react";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AreaDetalleCliente } from "./area-detalle-cliente";
import {
  AreaActividad,
  type NotaRow,
  type LogEntryRow,
} from "./area-actividad";
import { AreaEquipo, type MiembroResumen } from "./area-equipo";
import { AreaDocumentos, type DocumentoRow } from "./area-documentos";
import { AreaDeadlines, type DeadlineRow } from "./area-deadlines";
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

type HistorialAnioRow = {
  anio: number;
  total: number;
  hechas: number;
  dias_promedio: number | null;
};

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
  por_hacer: {
    label: "Por hacer",
    icon: ListTodo,
    color: "text-muted-foreground",
  },
  hecha: { label: "Hechas", icon: CheckCircle2, color: "text-green-600" },
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

  const { area, tareas, usuarios, notas, logRows, documentos, historial } =
    await withUser(session.user.id, async (tx) => {
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

      if (!area) {
        return {
          area: null,
          tareas: [],
          usuarios: [],
          notas: [],
          logRows: [],
          documentos: [],
          historial: [],
        };
      }

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

      // Flujo de tareas del equipo: cambios de estado/prioridad/responsable/etc.
      // registrados automáticamente en tarea_log (ver tablero/actions.ts) —
      // se combina con la bitácora manual (nota_area) en AreaActividad.
      const logRows = await tx<LogEntryRow[]>`
      select
        l.id,
        l.campo,
        l.valor_antes,
        l.valor_despues,
        u.nombre  as autor_nombre,
        t.titulo  as tarea_titulo,
        l.creado_en::text as creada_en
      from tarea_log l
      join tarea t on t.id = l.tarea_id
      left join usuario u on u.id = l.usuario_id
      where t.area_id = ${areaId}
      order by l.creado_en desc
      limit 60
    `;

      // Documentos compartidos del área — reusa acceso_rapido (ver
      // areas/actions.ts crearAccesoArea/eliminarAccesoArea).
      const documentos = await tx<DocumentoRow[]>`
      select id, etiqueta, url
      from acceso_rapido
      where area_id = ${areaId}
      order by orden asc
    `;

      // Historial por año calendario — a diferencia de las consultas de arriba,
      // no filtra t.archivada: incluye TODO lo que pasó por el área alguna vez
      // (completadas, archivadas al cerrar una temporada, o abandonadas sin
      // marcar). Es la única forma de comparar años completos: el cierre de
      // temporada (archivarArea) solo archiva lo que quedó sin terminar, así
      // que las tareas completadas de un año no quedan marcadas de ningún otro
      // modo como "de esa temporada".
      const historial = await tx<HistorialAnioRow[]>`
      select
        extract(year from t.creada_en)::int as anio,
        count(t.id)::int                    as total,
        count(t.id) filter (where t.estado = 'hecha')::int as hechas,
        round(
          avg(extract(epoch from (t.completada_en - t.creada_en)) / 86400.0)
          filter (where t.estado = 'hecha' and t.completada_en is not null)
        )::int as dias_promedio
      from tarea t
      where t.area_id = ${areaId}
      group by extract(year from t.creada_en)
      order by anio desc
    `;

      return {
        area,
        tareas: [...tareas],
        usuarios: [...usuarios],
        notas: [...notas],
        logRows: [...logRows],
        documentos: [...documentos],
        historial: [...historial],
      };
    });

  if (!area) notFound();

  const plantillas = await fetchPlantillas(areaId);

  const pct =
    area.tareas_total > 0
      ? Math.round((area.tareas_hechas / area.tareas_total) * 100)
      : 0;

  const hoyISO = new Date().toISOString().slice(0, 10);

  const grupos = (["en_progreso", "por_hacer", "hecha"] as const).map(
    (estado) => ({
      estado,
      ...ESTADO_CONFIG[estado],
      tareas: tareas.filter((t) => t.estado === estado),
    }),
  );

  // Flujo de tareas por integrante: se arma acá mismo a partir de `tareas`
  // (ya trae responsable + estado) en vez de una consulta aparte.
  const avatarColorPorId = new Map(
    area.asignados.map((a) => [a.id, a.avatar_color]),
  );
  const equipoPorId = new Map<string, MiembroResumen>();
  for (const t of tareas) {
    if (!t.responsable_id) continue;
    if (!equipoPorId.has(t.responsable_id)) {
      equipoPorId.set(t.responsable_id, {
        id: t.responsable_id,
        nombre: t.responsable_nombre ?? "—",
        avatar_color: avatarColorPorId.get(t.responsable_id) ?? null,
        en_progreso: 0,
        por_hacer: 0,
        hechas: 0,
        tareas_en_progreso: [],
      });
    }
    const m = equipoPorId.get(t.responsable_id)!;
    if (t.estado === "en_progreso") {
      m.en_progreso++;
      m.tareas_en_progreso.push(t.titulo);
    } else if (t.estado === "por_hacer") {
      m.por_hacer++;
    } else if (t.estado === "hecha") {
      m.hechas++;
    }
  }
  const equipo = [...equipoPorId.values()].sort(
    (a, b) => b.en_progreso + b.por_hacer - (a.en_progreso + a.por_hacer),
  );

  const deadlines: DeadlineRow[] = tareas
    .filter(
      (t): t is TareaRow & { fecha_vencimiento: string } =>
        t.fecha_vencimiento !== null && t.estado !== "hecha",
    )
    .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))
    .slice(0, 8)
    .map((t) => ({
      id: t.id,
      titulo: t.titulo,
      fecha_vencimiento: t.fecha_vencimiento,
      responsable_nombre: t.responsable_nombre,
    }));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit"
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
              <h1 className="text-2xl font-semibold tracking-tight">
                {area.nombre}
              </h1>
              {!area.activa && (
                <Badge variant="outline" className="text-muted-foreground">
                  Archivada
                </Badge>
              )}
            </div>
            {area.descripcion && (
              <p className="text-muted-foreground text-sm">
                {area.descripcion}
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-1.5 text-sm">
            <ListTodo className="text-muted-foreground size-4" />
            <span className="font-semibold">{area.tareas_abiertas}</span>
            <span className="text-muted-foreground">abiertas</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <CheckCircle2 className="size-4 text-green-500" />
            <span className="font-semibold text-green-600">
              {area.tareas_hechas}
            </span>
            <span className="text-muted-foreground">completadas</span>
          </div>
          {area.responsable_nombre && (
            <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <User className="size-4" />
              <span>{area.responsable_nombre}</span>
            </div>
          )}
        </div>

        {/* Barra de progreso */}
        {area.tareas_total > 0 && (
          <div className="flex max-w-sm flex-col gap-1.5">
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>Progreso</span>
              <span className="font-medium tabular-nums">{pct}%</span>
            </div>
            <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: area.color }}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              {area.tareas_hechas} de {area.tareas_total} tareas completadas
            </p>
          </div>
        )}
      </div>

      {/* ── Tareas por estado + Equipo ────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ListTodo className="text-muted-foreground size-4" />
              Tareas por estado
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {grupos.map(
              ({ estado, label, icon: Icon, color, tareas: grupo }) => {
                if (grupo.length === 0) return null;
                return (
                  <section key={estado} className="flex flex-col gap-2">
                    <div className={`flex items-center gap-2 ${color}`}>
                      <Icon className="size-4" />
                      <h2 className="text-sm font-semibold">{label}</h2>
                      <span className="text-muted-foreground text-xs font-normal">
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
                            className="bg-card flex items-start gap-3 rounded-lg border px-4 py-3"
                          >
                            {/* Prioridad dot */}
                            <span
                              className="mt-1 size-2 shrink-0 rounded-full"
                              style={{
                                backgroundColor:
                                  PRIORIDAD_COLOR[t.prioridad] ?? "#94a3b8",
                              }}
                            />

                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-sm leading-snug font-medium ${t.estado === "hecha" ? "text-muted-foreground line-through" : ""}`}
                              >
                                {t.titulo}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                {TIPO_LABEL[t.tipo] && (
                                  <Badge
                                    variant="outline"
                                    className="px-1.5 py-0 text-[11px] font-normal"
                                  >
                                    {TIPO_LABEL[t.tipo]}
                                  </Badge>
                                )}
                                {t.fecha_vencimiento && (
                                  <span
                                    className={`flex items-center gap-1 text-[12px] ${vencida ? "text-destructive font-medium" : "text-muted-foreground"}`}
                                  >
                                    <CalendarDays className="size-3" />
                                    {new Date(
                                      t.fecha_vencimiento + "T00:00:00",
                                    ).toLocaleDateString("es-AR", {
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
                                <AvatarFallback className="bg-[oklch(0.62_0.19_42)] text-[10px] font-semibold text-white">
                                  {iniciales(t.responsable_nombre)}
                                </AvatarFallback>
                              </Avatar>
                            ) : (
                              <span className="text-muted-foreground/40 mt-0.5 shrink-0 text-[11px]">
                                —
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              },
            )}

            {tareas.length === 0 && (
              <div className="py-12 text-center">
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
          </CardContent>
        </Card>

        <AreaEquipo equipo={equipo} />
      </div>

      {/* ── Actividad del equipo ─────────────────────────────────────────────── */}
      <AreaActividad
        areaId={area.id}
        notasIniciales={notas}
        logRows={logRows}
        usuarioActualId={session.user.id}
        canDelete={canManage}
      />

      {/* ── Documentos compartidos + Fechas importantes ──────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        <AreaDocumentos
          areaId={area.id}
          documentosIniciales={documentos}
          canManage={canManage}
        />
        <AreaDeadlines deadlines={deadlines} hoyISO={hoyISO} />
      </div>

      {/* ── Historial por año ───────────────────────────────────────────────── */}
      {historial.length > 1 && (
        <div className="border-t pt-6">
          <div className="mb-3 flex items-center gap-2">
            <History className="text-muted-foreground size-4" />
            <h2 className="text-sm font-semibold">Historial por año</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs">
                  <th className="py-1.5 pr-4 font-medium">Año</th>
                  <th className="py-1.5 pr-4 font-medium">Tareas</th>
                  <th className="py-1.5 pr-4 font-medium">Completadas</th>
                  <th className="py-1.5 pr-4 font-medium">Cumplimiento</th>
                  <th className="py-1.5 font-medium">Días promedio</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((h) => {
                  const pctAnio =
                    h.total > 0 ? Math.round((h.hechas / h.total) * 100) : 0;
                  return (
                    <tr key={h.anio} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium tabular-nums">
                        {h.anio}
                      </td>
                      <td className="text-muted-foreground py-2 pr-4 tabular-nums">
                        {h.total}
                      </td>
                      <td className="text-muted-foreground py-2 pr-4 tabular-nums">
                        {h.hechas}
                      </td>
                      <td className="text-muted-foreground py-2 pr-4 tabular-nums">
                        {pctAnio}%
                      </td>
                      <td className="text-muted-foreground py-2 tabular-nums">
                        {h.dias_promedio !== null ? `${h.dias_promedio}d` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground mt-2 text-[11px]">
            Incluye todas las tareas del área alguna vez creadas ese año, estén
            archivadas o no — no se pierde nada al cerrar una temporada.
          </p>
        </div>
      )}

      {/* ── Plantillas de tareas ───────────────────────────────────────────── */}
      <div className="border-t pt-6">
        <AreaPlantillas
          areaId={area.id}
          plantillasIniciales={plantillas}
          canManage={canManage}
        />
      </div>
    </div>
  );
}
