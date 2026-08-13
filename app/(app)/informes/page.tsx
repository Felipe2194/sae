import { redirect } from "next/navigation";
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
} from "lucide-react";

// Paleta validada (dataviz skill): CVD-safe y con contraste suficiente en
// claro y oscuro, node scripts/validate_palette.js "#2563eb,#16a34a" --mode
// light|dark → ALL CHECKS PASS en ambos modos con el mismo par de colores.
const COLOR_CREADAS = "#2563eb";
const COLOR_COMPLETADAS = "#16a34a";

type SemanaTareas = { semana: string; creadas: number; completadas: number };
type RitmoArea = {
  id: string;
  nombre: string;
  color: string;
  hechas_total: number;
  hechas_30d: number;
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
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
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
      <div className="flex items-end gap-0.5 h-20">
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

function BarraSimple({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: COLOR_COMPLETADAS }}
        />
      </div>
      <span className="text-muted-foreground w-9 shrink-0 text-right text-xs tabular-nums">{pct}%</span>
    </div>
  );
}

export default async function InformesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const rol = (session.user as { rol: string }).rol;
  if (rol === "miembro") redirect("/hoy");

  const {
    semanas,
    ritmoAreas,
    actividadBitacora,
    antiguedadVencidas,
    usoPlantillas,
    actividadComentarios,
    ausencias,
    ultimosLogins,
  } = await withUser(session.user.id, async (tx) => {
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

    const ritmoAreas = await tx<RitmoArea[]>`
      select
        a.id,
        a.nombre,
        a.color,
        count(t.id) filter (where t.estado = 'hecha')::int as hechas_total,
        count(t.id) filter (
          where t.estado = 'hecha' and t.completada_en >= now() - interval '30 days'
        )::int as hechas_30d
      from area a
      left join tarea t on t.area_id = a.id
        and t.organizacion_id = mi_organizacion_id()
        and t.archivada = false
      where a.organizacion_id = mi_organizacion_id() and a.activa = true
      group by a.id, a.nombre, a.color
      order by hechas_30d desc, hechas_total desc
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
      semanas,
      ritmoAreas,
      actividadBitacora,
      antiguedadVencidas,
      usoPlantillas,
      actividadComentarios,
      ausencias,
      ultimosLogins,
    };
  });

  const vencidasTotal =
    antiguedadVencidas.b0_7 + antiguedadVencidas.b8_14 + antiguedadVencidas.b15_30 + antiguedadVencidas.b30_mas;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Informes</h1>
        <p className="text-muted-foreground text-sm">
          Analíticas de uso del sistema: carga de trabajo, actividad y adopción.
        </p>
      </div>

      {/* ── Tareas por semana ──────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="text-muted-foreground size-4" />
          <h2 className="font-semibold">Tareas por semana</h2>
        </div>
        <Card>
          <CardContent className="pt-4 flex flex-col gap-3">
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
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
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

      {/* ── Ritmo de cierre por área ───────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Layers3 className="text-muted-foreground size-4" />
          <h2 className="font-semibold">Ritmo de cierre por área</h2>
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium w-full">Área</th>
                    <th className="text-muted-foreground px-3 py-3 text-center text-xs font-medium whitespace-nowrap">
                      Cerradas (30d)
                    </th>
                    <th className="text-muted-foreground px-4 py-3 text-center text-xs font-medium whitespace-nowrap">
                      Cerradas (total)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ritmoAreas.map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2 font-medium">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: a.color }} />
                          {a.nombre}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-green-600 font-medium">
                        {a.hechas_30d}
                      </td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-muted-foreground">
                        {a.hechas_total}
                      </td>
                    </tr>
                  ))}
                  {ritmoAreas.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-muted-foreground px-4 py-6 text-center text-sm">
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

      {/* ── Actividad de bitácora ──────────────────────────────────────── */}
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
                  <span className="flex-1 min-w-0 truncate text-sm font-medium">{p.nombre}</span>
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

      {/* ── Antigüedad de tareas vencidas ──────────────────────────────── */}
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
                    <span
                      className={`text-2xl font-bold tabular-nums ${b.n > 0 ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {b.n}
                    </span>
                    <span className="text-muted-foreground text-[11px] text-center">{b.label}</span>
                  </div>
                ))}
              </div>
            )}
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
                    <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium w-full">Plantilla</th>
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
                        <span className="text-muted-foreground text-xs"> · {p.area_nombre}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums">
                        {p.veces_aplicada > 0 ? (
                          <Badge variant="secondary">{p.veces_aplicada}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground text-xs tabular-nums">
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

      {/* ── Actividad de comentarios ───────────────────────────────────── */}
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
                  <span className="flex-1 min-w-0 truncate text-sm font-medium">{p.nombre}</span>
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
          <h2 className="font-semibold">Ausencias por persona (últimos 90 días)</h2>
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {ausencias.map((p) => (
                <div key={p.nombre} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex-1 min-w-0 truncate text-sm font-medium">{p.nombre}</span>
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
                    <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium w-full">Usuario</th>
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
                      <td className="px-4 py-2.5 text-right text-muted-foreground text-xs tabular-nums">
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
  );
}
