import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

// Paleta validada (dataviz skill): CVD-safe y con contraste suficiente en
// claro y oscuro, node scripts/validate_palette.js "#2563eb,#16a34a" --mode
// light|dark → ALL CHECKS PASS en ambos modos con el mismo par de colores.
const COLOR_CREADAS = "#2563eb";
const COLOR_COMPLETADAS = "#16a34a";

type SemanaTareas = { semana: string; creadas: number; completadas: number };

type GlobalStats = {
  total: number;
  hecha: number;
  en_progreso: number;
  por_hacer: number;
  vencidas: number;
  hechas_30d: number;
};

type ResumenArea = {
  id: string;
  nombre: string;
  color: string;
  total: number;
  hecha: number;
  vencidas: number;
  dias_promedio: number | null;
};

type ResumenPersona = {
  nombre: string;
  total: number;
  hecha: number;
  en_progreso: number;
  por_hacer: number;
  vencidas: number;
  dias_promedio: number | null;
};

type TareaAntigua = {
  titulo: string;
  area_nombre: string | null;
  area_color: string | null;
  responsable_nombre: string | null;
  dias_abierta: number;
};

type PrecisionEstimacion = {
  cantidad: number;
  promedio_estimado: number | null;
  promedio_real: number | null;
};

type ActividadBitacora = { nombre: string; dias_cargados: number };
type AntiguedadVencidas = {
  b0_7: number;
  b8_14: number;
  b15_30: number;
  b30_mas: number;
};
type UsoPlantilla = {
  nombre: string;
  area_nombre: string;
  veces_aplicada: number;
  ultima_aplicacion: string | null;
};
type ActividadComentarios = { nombre: string; comentarios: number };
type AusenciaPersona = { nombre: string; ausencias: number };
type UltimoLogin = { nombre: string; rol: string; ultimo_login: string | null };

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
}: {
  label: string;
  value: string;
  colorClass?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border p-4">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={`text-2xl font-semibold ${colorClass ?? ""}`}>
        {value}
      </span>
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
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="max-w-[6.5rem] truncate text-xs font-medium">
          {nombre}
        </span>
      </span>
    </Link>
  );
}

function BarraSimple({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(pct, 100)}%`,
            backgroundColor: COLOR_COMPLETADAS,
          }}
        />
      </div>
      <span className="text-muted-foreground w-9 shrink-0 text-right text-xs tabular-nums">
        {pct}%
      </span>
    </div>
  );
}

export default async function InformesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const rol = (session.user as { rol: string }).rol;
  if (rol !== "administrador") redirect("/hoy");

  const {
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
  } = await withUser(session.user.id, async (tx) => {
    // Estado general de la organización — lo primero que ve el admin al
    // entrar, antes de bajar a cualquier detalle por área o por persona.
    const [global] = await tx<[GlobalStats]>`
      select
        count(*)::int                                                            as total,
        count(*) filter (where estado = 'hecha')::int                           as hecha,
        count(*) filter (where estado = 'en_progreso')::int                     as en_progreso,
        count(*) filter (where estado = 'por_hacer')::int                       as por_hacer,
        count(*) filter (
          where estado != 'hecha'
            and fecha_vencimiento is not null
            and fecha_vencimiento < current_date
        )::int                                                                   as vencidas,
        count(*) filter (
          where estado = 'hecha' and completada_en >= now() - interval '30 days'
        )::int                                                                   as hechas_30d
      from tarea
      where organizacion_id = mi_organizacion_id()
        and archivada = false
        and activa = true
    `;

    const resumenAreas = await tx<ResumenArea[]>`
      select
        a.id,
        a.nombre,
        a.color,
        count(t.id)::int                                    as total,
        count(t.id) filter (where t.estado = 'hecha')::int  as hecha,
        count(t.id) filter (
          where t.estado != 'hecha'
            and t.fecha_vencimiento is not null
            and t.fecha_vencimiento < current_date
        )::int                                               as vencidas,
        round(
          avg(extract(epoch from (t.completada_en - t.creada_en)) / 86400.0)
          filter (where t.estado = 'hecha' and t.completada_en is not null)
        )::int                                                as dias_promedio
      from area a
      left join tarea t on t.area_id = a.id
        and t.organizacion_id = mi_organizacion_id()
        and t.archivada = false
        and t.activa = true
      where a.organizacion_id = mi_organizacion_id() and a.activa = true
      group by a.id, a.nombre, a.color
      order by count(t.id) filter (where t.estado != 'hecha') desc, a.nombre asc
    `;

    const porPersona = await tx<ResumenPersona[]>`
      select
        u.nombre,
        count(t.id)::int                                                          as total,
        count(t.id) filter (where t.estado = 'hecha')::int                       as hecha,
        count(t.id) filter (where t.estado = 'en_progreso')::int                 as en_progreso,
        count(t.id) filter (where t.estado = 'por_hacer')::int                   as por_hacer,
        count(t.id) filter (
          where t.estado != 'hecha'
            and t.fecha_vencimiento is not null
            and t.fecha_vencimiento < current_date
        )::int                                                                    as vencidas,
        round(
          avg(extract(epoch from (t.completada_en - t.creada_en)) / 86400.0)
          filter (where t.estado = 'hecha' and t.completada_en is not null)
        )::int                                                                    as dias_promedio
      from usuario u
      left join tarea t on t.responsable_id = u.id
        and t.organizacion_id = mi_organizacion_id()
        and t.archivada = false
        and t.activa = true
      where u.organizacion_id = mi_organizacion_id()
        and u.estado = 'activo'
      group by u.id, u.nombre
      having count(t.id) > 0
      order by count(t.id) filter (where t.estado != 'hecha') desc, u.nombre asc
    `;

    const tareasAntiguas = await tx<TareaAntigua[]>`
      select
        t.titulo,
        a.nombre   as area_nombre,
        a.color    as area_color,
        u.nombre   as responsable_nombre,
        (current_date - t.creada_en::date)::int as dias_abierta
      from tarea t
      left join area    a on a.id = t.area_id
      left join usuario u on u.id = t.responsable_id
      where t.organizacion_id = mi_organizacion_id()
        and t.estado != 'hecha'
        and t.archivada = false
        and t.activa = true
      order by t.creada_en asc
      limit 5
    `;

    const [precisionEstimacion] = await tx<[PrecisionEstimacion]>`
      select
        count(*)::int                          as cantidad,
        round(avg(duracion_estimada_hs), 1)     as promedio_estimado,
        round(avg(duracion_real_hs), 1)         as promedio_real
      from tarea
      where organizacion_id = mi_organizacion_id()
        and archivada = false
        and activa = true
        and duracion_estimada_hs is not null
        and duracion_real_hs is not null
    `;

    const semanas = await tx<SemanaTareas[]>`
      with semanas as (
        select (date_trunc('week', current_date)::date - (n * 7)) as inicio
        from generate_series(0, 7) as n
      ),
      creadas as (
        select date_trunc('week', creada_en)::date as semana, count(*)::int as n
        from tarea
        where organizacion_id = mi_organizacion_id()
        group by 1
      ),
      completadas as (
        select date_trunc('week', completada_en)::date as semana, count(*)::int as n
        from tarea
        where organizacion_id = mi_organizacion_id() and completada_en is not null
        group by 1
      )
      select
        s.inicio::text as semana,
        coalesce(c.n, 0) as creadas,
        coalesce(d.n, 0) as completadas
      from semanas s
      left join creadas c on c.semana = s.inicio
      left join completadas d on d.semana = s.inicio
      order by s.inicio asc
    `;

    const actividadBitacora = await tx<ActividadBitacora[]>`
      select u.nombre, count(b.id)::int as dias_cargados
      from usuario u
      left join bitacora_diaria b on b.usuario_id = u.id
        and b.fecha >= current_date - interval '30 days'
      where u.organizacion_id = mi_organizacion_id() and u.estado = 'activo'
      group by u.id, u.nombre
      order by dias_cargados desc, u.nombre asc
    `;

    const [antiguedadVencidas] = await tx<[AntiguedadVencidas]>`
      select
        count(*) filter (where current_date - fecha_vencimiento between 0 and 7)::int as b0_7,
        count(*) filter (where current_date - fecha_vencimiento between 8 and 14)::int as b8_14,
        count(*) filter (where current_date - fecha_vencimiento between 15 and 30)::int as b15_30,
        count(*) filter (where current_date - fecha_vencimiento > 30)::int as b30_mas
      from tarea
      where organizacion_id = mi_organizacion_id()
        and archivada = false
        and activa = true
        and estado != 'hecha'
        and fecha_vencimiento is not null
        and fecha_vencimiento < current_date
    `;

    const usoPlantillas = await tx<UsoPlantilla[]>`
      select p.nombre, a.nombre as area_nombre, p.veces_aplicada, p.ultima_aplicacion::text as ultima_aplicacion
      from plantilla_area p
      join area a on a.id = p.area_id
      where p.organizacion_id = mi_organizacion_id()
      order by p.veces_aplicada desc, p.nombre asc
    `;

    const actividadComentarios = await tx<ActividadComentarios[]>`
      select u.nombre, count(c.id)::int as comentarios
      from usuario u
      left join comentario c on c.autor_id = u.id and c.creado_en >= now() - interval '30 days'
      where u.organizacion_id = mi_organizacion_id() and u.estado = 'activo'
      group by u.id, u.nombre
      having count(c.id) > 0
      order by comentarios desc
    `;

    const ausencias = await tx<AusenciaPersona[]>`
      select u.nombre, count(e.id)::int as ausencias
      from usuario u
      left join excepcion_turno e on e.usuario_id = u.id
        and e.tipo = 'ausencia'
        and e.fecha >= current_date - interval '90 days'
      where u.organizacion_id = mi_organizacion_id() and u.estado = 'activo'
      group by u.id, u.nombre
      having count(e.id) > 0
      order by ausencias desc
    `;

    const ultimosLogins = await tx<UltimoLogin[]>`
      select nombre, rol, ultimo_login::text as ultimo_login
      from usuario
      where organizacion_id = mi_organizacion_id() and estado = 'activo'
      order by ultimo_login desc nulls last, nombre asc
    `;

    return {
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
    };
  });

  const vencidasTotal =
    antiguedadVencidas.b0_7 +
    antiguedadVencidas.b8_14 +
    antiguedadVencidas.b15_30 +
    antiguedadVencidas.b30_mas;

  const avanceGeneralPct =
    global.total > 0 ? Math.round((global.hecha / global.total) * 100) : 0;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Informes</h1>
        <p className="text-muted-foreground text-sm">
          Cómo viene la organización: carga de trabajo, avance por área y por
          persona, y actividad del sistema — de un pantallazo.
        </p>
      </div>

      {/* ── Estado general ────────────────────────────────────────────── */}
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
          <StatTile
            label="Completadas"
            value={String(global.hecha)}
            colorClass="text-green-600"
          />
          <StatTile label="Avance general" value={`${avanceGeneralPct}%`} />
        </div>
      </section>

      {/* ── Avance por área (de un pantallazo) ───────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Layers3 className="text-muted-foreground size-4" />
          <h2 className="font-semibold">Avance por área</h2>
        </div>

        {resumenAreas.length === 0 ? (
          <p className="text-muted-foreground px-1 text-sm">
            No hay áreas activas.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {resumenAreas.map((a) => (
              <MedidorArea
                key={a.id}
                id={a.id}
                nombre={a.nombre}
                color={a.color}
                hechas={a.hecha}
                total={a.total}
              />
            ))}
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-muted-foreground w-full px-4 py-3 text-left text-xs font-medium">
                      Área
                    </th>
                    <th className="text-muted-foreground px-3 py-3 text-center text-xs font-medium whitespace-nowrap">
                      Total
                    </th>
                    <th className="text-muted-foreground px-3 py-3 text-center text-xs font-medium whitespace-nowrap">
                      Vencidas
                    </th>
                    <th className="text-muted-foreground px-3 py-3 text-center text-xs font-medium whitespace-nowrap">
                      Hechas
                    </th>
                    <th className="text-muted-foreground hidden px-3 py-3 text-center text-xs font-medium whitespace-nowrap sm:table-cell">
                      Prom. días
                    </th>
                    <th className="text-muted-foreground min-w-[120px] px-4 py-3 text-left text-xs font-medium">
                      Progreso
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {resumenAreas.map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/proyectos/${a.id}`}
                          className="flex items-center gap-2 hover:underline"
                        >
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: a.color }}
                          />
                          <span className="font-medium">{a.nombre}</span>
                        </Link>
                      </td>
                      <td className="text-muted-foreground px-3 py-2.5 text-center tabular-nums">
                        {a.total}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums">
                        {a.vencidas > 0 ? (
                          <span className="text-destructive font-medium">
                            {a.vencidas}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center font-medium text-green-600 tabular-nums">
                        {a.hecha}
                      </td>
                      <td className="text-muted-foreground hidden px-3 py-2.5 text-center text-xs tabular-nums sm:table-cell">
                        {a.dias_promedio != null ? `${a.dias_promedio}d` : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <BarraSimple
                          pct={
                            a.total > 0
                              ? Math.round((a.hecha / a.total) * 100)
                              : 0
                          }
                        />
                      </td>
                    </tr>
                  ))}
                  {resumenAreas.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-muted-foreground px-4 py-6 text-center text-sm"
                      >
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

      {/* ── Carga por persona ─────────────────────────────────────────── */}
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
                    <th className="text-muted-foreground w-full px-4 py-3 text-left text-xs font-medium">
                      Miembro
                    </th>
                    <th className="text-muted-foreground px-3 py-3 text-center text-xs font-medium whitespace-nowrap">
                      Abiertas
                    </th>
                    <th className="text-muted-foreground px-3 py-3 text-center text-xs font-medium whitespace-nowrap">
                      Vencidas
                    </th>
                    <th className="text-muted-foreground px-3 py-3 text-center text-xs font-medium whitespace-nowrap">
                      Hechas
                    </th>
                    <th className="text-muted-foreground hidden px-3 py-3 text-center text-xs font-medium whitespace-nowrap sm:table-cell">
                      Prom. días
                    </th>
                    <th className="text-muted-foreground min-w-[120px] px-4 py-3 text-left text-xs font-medium">
                      Progreso
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {porPersona.map((p) => (
                    <tr key={p.nombre} className="border-b last:border-0">
                      <td className="px-4 py-2.5 font-medium">{p.nombre}</td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {p.en_progreso > 0 && (
                            <Badge
                              variant="secondary"
                              className="px-1.5 py-0 text-xs"
                            >
                              {p.en_progreso}
                            </Badge>
                          )}
                          {p.por_hacer > 0 && (
                            <Badge
                              variant="outline"
                              className="px-1.5 py-0 text-xs"
                            >
                              {p.por_hacer}
                            </Badge>
                          )}
                          {p.en_progreso === 0 && p.por_hacer === 0 && (
                            <span className="text-muted-foreground text-xs">
                              —
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums">
                        {p.vencidas > 0 ? (
                          <span className="text-destructive font-medium">
                            {p.vencidas}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center font-medium text-green-600 tabular-nums">
                        {p.hecha}
                      </td>
                      <td className="text-muted-foreground hidden px-3 py-2.5 text-center text-xs tabular-nums sm:table-cell">
                        {p.dias_promedio != null ? `${p.dias_promedio}d` : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <BarraSimple
                          pct={
                            p.total > 0
                              ? Math.round((p.hecha / p.total) * 100)
                              : 0
                          }
                        />
                      </td>
                    </tr>
                  ))}
                  {porPersona.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-muted-foreground px-4 py-6 text-center text-sm"
                      >
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

      {/* ── Tareas más antiguas abiertas ──────────────────────────────── */}
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
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: t.area_color }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.titulo}</p>
                      <p className="text-muted-foreground text-xs">
                        {t.area_nombre ?? "Sin área"}
                        {t.responsable_nombre && ` · ${t.responsable_nombre}`}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        t.dias_abierta > 14
                          ? "border-destructive/40 text-destructive"
                          : ""
                      }
                    >
                      {t.dias_abierta}d
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ── Antigüedad de tareas vencidas ──────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-muted-foreground size-4" />
          <h2 className="font-semibold">Antigüedad de tareas vencidas</h2>
        </div>
        <Card>
          <CardContent className="pt-4">
            {vencidasTotal === 0 ? (
              <p className="text-muted-foreground text-sm">
                No hay tareas vencidas. 🎉
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "0–7 días", n: antiguedadVencidas.b0_7 },
                  { label: "8–14 días", n: antiguedadVencidas.b8_14 },
                  { label: "15–30 días", n: antiguedadVencidas.b15_30 },
                  { label: "30+ días", n: antiguedadVencidas.b30_mas },
                ].map((b) => (
                  <div
                    key={b.label}
                    className="flex flex-col items-center gap-1 rounded-md border p-3"
                  >
                    <span
                      className={`text-2xl font-bold tabular-nums ${b.n > 0 ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {b.n}
                    </span>
                    <span className="text-muted-foreground text-center text-[11px]">
                      {b.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Precisión de estimación ────────────────────────────────────── */}
      {precisionEstimacion.cantidad > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Timer className="text-muted-foreground size-4" />
            <h2 className="font-semibold">Precisión de estimación</h2>
          </div>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-6 pt-4 text-sm">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">
                  Promedio estimado
                </span>
                <span className="text-xl font-bold tabular-nums">
                  {precisionEstimacion.promedio_estimado}h
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">
                  Promedio real
                </span>
                <span className="text-xl font-bold tabular-nums">
                  {precisionEstimacion.promedio_real}h
                </span>
              </div>
              <p className="text-muted-foreground text-xs">
                Basado en {precisionEstimacion.cantidad} tarea
                {precisionEstimacion.cantidad !== 1 ? "s" : ""} con ambos datos
                cargados.
              </p>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ── Tareas por semana ──────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="text-muted-foreground size-4" />
          <h2 className="font-semibold">Tareas por semana</h2>
        </div>
        <Card>
          <CardContent className="flex flex-col gap-3 pt-4">
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: COLOR_CREADAS }}
                />
                Creadas
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: COLOR_COMPLETADAS }}
                />
                Completadas
              </span>
            </div>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
              {semanas.map((s) => (
                <BarraDoble
                  key={s.semana}
                  label={new Date(s.semana).toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                  a={s.creadas}
                  b={s.completadas}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Actividad de bitácora ──────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <NotebookPen className="text-muted-foreground size-4" />
          <h2 className="font-semibold">
            Actividad de bitácora (últimos 30 días)
          </h2>
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {actividadBitacora.map((p) => (
                <div
                  key={p.nombre}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {p.nombre}
                  </span>
                  <div className="w-40">
                    <BarraSimple
                      pct={Math.round((p.dias_cargados / 30) * 100)}
                    />
                  </div>
                </div>
              ))}
              {actividadBitacora.length === 0 && (
                <p className="text-muted-foreground px-4 py-6 text-center text-sm">
                  No hay usuarios activos.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Uso de plantillas ──────────────────────────────────────────── */}
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
                    <th className="text-muted-foreground w-full px-4 py-3 text-left text-xs font-medium">
                      Plantilla
                    </th>
                    <th className="text-muted-foreground px-3 py-3 text-center text-xs font-medium whitespace-nowrap">
                      Veces aplicada
                    </th>
                    <th className="text-muted-foreground px-4 py-3 text-right text-xs font-medium whitespace-nowrap">
                      Última vez
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {usoPlantillas.map((p, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-4 py-2.5">
                        <span className="font-medium">{p.nombre}</span>
                        <span className="text-muted-foreground text-xs">
                          {" "}
                          · {p.area_nombre}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums">
                        {p.veces_aplicada > 0 ? (
                          <Badge variant="secondary">{p.veces_aplicada}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            —
                          </span>
                        )}
                      </td>
                      <td className="text-muted-foreground px-4 py-2.5 text-right text-xs tabular-nums">
                        {formatFecha(p.ultima_aplicacion)}
                      </td>
                    </tr>
                  ))}
                  {usoPlantillas.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="text-muted-foreground px-4 py-6 text-center text-sm"
                      >
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

      {/* ── Actividad de comentarios ───────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="text-muted-foreground size-4" />
          <h2 className="font-semibold">
            Colaboración: comentarios (últimos 30 días)
          </h2>
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {actividadComentarios.map((p) => (
                <div
                  key={p.nombre}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {p.nombre}
                  </span>
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

      {/* ── Ausencias por persona ──────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <CalendarOff className="text-muted-foreground size-4" />
          <h2 className="font-semibold">
            Ausencias por persona (últimos 90 días)
          </h2>
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {ausencias.map((p) => (
                <div
                  key={p.nombre}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {p.nombre}
                  </span>
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

      {/* ── Última conexión ────────────────────────────────────────────── */}
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
                    <th className="text-muted-foreground w-full px-4 py-3 text-left text-xs font-medium">
                      Usuario
                    </th>
                    <th className="text-muted-foreground px-3 py-3 text-center text-xs font-medium whitespace-nowrap">
                      Rol
                    </th>
                    <th className="text-muted-foreground px-4 py-3 text-right text-xs font-medium whitespace-nowrap">
                      Último acceso
                    </th>
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
                      <td
                        colSpan={3}
                        className="text-muted-foreground px-4 py-6 text-center text-sm"
                      >
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
  );
}
