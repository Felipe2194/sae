import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AreaRow = {
  id: string;
  nombre: string;
  color: string;
  responsable_nombre: string | null;
  tareas_abiertas: string; // bigint viene como string en postgres.js
};

export default async function AreasPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const areas = await withUser(session.user.id, async (tx) => {
    return tx<AreaRow[]>`
      select
        a.id,
        a.nombre,
        a.color,
        u.nombre as responsable_nombre,
        count(t.id) filter (where t.estado != 'hecha') as tareas_abiertas
      from area a
      left join usuario u on u.id = a.responsable_id
      left join tarea   t on t.area_id = a.id
      where a.activa = true
      group by a.id, a.nombre, a.color, u.nombre
      order by a.nombre asc
    `;
  });

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Áreas</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {areas.map((area) => {
          const abiertas = Number(area.tareas_abiertas);
          return (
            <Link key={area.id} href={`/areas/${area.id}`}>
              <Card className="hover:bg-accent/50 h-full transition-colors">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: area.color }}
                    />
                    <CardTitle className="text-base">{area.nombre}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="text-muted-foreground flex items-center justify-between text-sm">
                  <span>
                    {abiertas} tarea{abiertas === 1 ? "" : "s"} abierta{abiertas === 1 ? "" : "s"}
                  </span>
                  <span>{area.responsable_nombre ?? "Sin responsable"}</span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
