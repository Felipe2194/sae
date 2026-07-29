import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Clock, ListTodo, Users, Layers3 } from "lucide-react";

type ResumenPersona = {
  nombre: string;
  total: number;
  hecha: number;
  en_progreso: number;
  por_hacer: number;
};

type ResumenArea = {
  nombre: string;
  color: string;
  total: number;
  hecha: number;
  en_progreso: number;
  por_hacer: number;
};

type StatGlobal = {
  total: number;
  hecha: number;
  en_progreso: number;
  por_hacer: number;
};

function PorcentajeBar({ hecha, total }: { hecha: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((hecha / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-green-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">
        {pct}%
      </span>
    </div>
  );
}

export default async function CoordinacionPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const rol = (session.user as { rol: string }).rol;
  if (rol === "miembro") redirect("/hoy");

  const { global: stat, porPersona, porArea } = await withUser(
    session.user.id,
    async (tx) => {
      const [global] = await tx<[StatGlobal]>`
        select
          count(*)::int                                              as total,
          count(*) filter (where estado = 'hecha')::int             as hecha,
          count(*) filter (where estado = 'en_progreso')::int       as en_progreso,
          count(*) filter (where estado = 'por_hacer')::int         as por_hacer
        from tarea
        where organizacion_id = mi_organizacion_id()
      `;

      const porPersona = await tx<ResumenPersona[]>`
        select
          u.nombre,
          count(t.id)::int                                            as total,
          count(t.id) filter (where t.estado = 'hecha')::int         as hecha,
          count(t.id) filter (where t.estado = 'en_progreso')::int   as en_progreso,
          count(t.id) filter (where t.estado = 'por_hacer')::int     as por_hacer
        from usuario u
        left join tarea t on t.responsable_id = u.id
          and t.organizacion_id = mi_organizacion_id()
        where u.organizacion_id = mi_organizacion_id()
          and u.estado = 'activo'
        group by u.id, u.nombre
        having count(t.id) > 0
        order by count(t.id) filter (where t.estado != 'hecha') desc, u.nombre asc
      `;

      const porArea = await tx<ResumenArea[]>`
        select
          a.nombre,
          a.color,
          count(t.id)::int                                            as total,
          count(t.id) filter (where t.estado = 'hecha')::int         as hecha,
          count(t.id) filter (where t.estado = 'en_progreso')::int   as en_progreso,
          count(t.id) filter (where t.estado = 'por_hacer')::int     as por_hacer
        from area a
        left join tarea t on t.area_id = a.id
          and t.organizacion_id = mi_organizacion_id()
        where a.organizacion_id = mi_organizacion_id()
          and a.activa = true
        group by a.id, a.nombre, a.color
        order by count(t.id) filter (where t.estado != 'hecha') desc, a.nombre asc
      `;

      return { global, porPersona, porArea };
    },
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Coordinación</h1>
        <p className="text-muted-foreground text-sm">
          Estado general de tareas, carga por persona y avance por área.
        </p>
      </div>

      {/* ── Estadísticas globales ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ListTodo className="size-3.5" />
              <span className="text-xs">Total</span>
            </div>
            <p className="text-2xl font-bold tabular-nums">{stat.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <CheckSquare className="size-3.5" />
              <span className="text-xs">Completadas</span>
            </div>
            <p className="text-2xl font-bold tabular-nums text-green-600">
              {stat.hecha}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="size-3.5" />
              <span className="text-xs">En progreso</span>
            </div>
            <p className="text-2xl font-bold tabular-nums text-blue-600">
              {stat.en_progreso}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ListTodo className="size-3.5" />
              <span className="text-xs">Por hacer</span>
            </div>
            <p className="text-2xl font-bold tabular-nums text-muted-foreground">
              {stat.por_hacer}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Por persona ────────────────────────────────────────────────── */}
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
                    <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium w-full">
                      Miembro
                    </th>
                    <th className="text-muted-foreground px-3 py-3 text-center text-xs font-medium whitespace-nowrap">
                      Abiertas
                    </th>
                    <th className="text-muted-foreground px-3 py-3 text-center text-xs font-medium whitespace-nowrap">
                      Hechas
                    </th>
                    <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium min-w-[120px]">
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
                            <Badge variant="secondary" className="text-xs px-1.5 py-0">
                              {p.en_progreso} progreso
                            </Badge>
                          )}
                          {p.por_hacer > 0 && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0">
                              {p.por_hacer} por hacer
                            </Badge>
                          )}
                          {p.en_progreso === 0 && p.por_hacer === 0 && (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-green-600 font-medium">
                        {p.hecha}
                      </td>
                      <td className="px-4 py-2.5">
                        <PorcentajeBar hecha={p.hecha} total={p.total} />
                      </td>
                    </tr>
                  ))}
                  {porPersona.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
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

      {/* ── Por área ───────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Layers3 className="text-muted-foreground size-4" />
          <h2 className="font-semibold">Avance por área</h2>
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium w-full">
                      Área
                    </th>
                    <th className="text-muted-foreground px-3 py-3 text-center text-xs font-medium whitespace-nowrap">
                      Total
                    </th>
                    <th className="text-muted-foreground px-3 py-3 text-center text-xs font-medium whitespace-nowrap">
                      Hechas
                    </th>
                    <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium min-w-[120px]">
                      Progreso
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {porArea.map((a) => (
                    <tr key={a.nombre} className="border-b last:border-0">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: a.color }}
                          />
                          <span className="font-medium">{a.nombre}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">
                        {a.total}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-green-600 font-medium">
                        {a.hecha}
                      </td>
                      <td className="px-4 py-2.5">
                        <PorcentajeBar hecha={a.hecha} total={a.total} />
                      </td>
                    </tr>
                  ))}
                  {porArea.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
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
    </div>
  );
}
