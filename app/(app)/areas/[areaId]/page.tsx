import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type AreaRow = {
  id: string;
  nombre: string;
  color: string;
};

type TareaRow = {
  id: string;
  titulo: string;
  estado: string;
  responsable_nombre: string | null;
};

export default async function AreaDetallePage({
  params,
}: {
  params: Promise<{ areaId: string }>;
}) {
  const { areaId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { area, tareas } = await withUser(session.user.id, async (tx) => {
    const [area] = await tx<AreaRow[]>`
      select id, nombre, color
      from area
      where id = ${areaId}
        and activa = true
      limit 1
    `;

    if (!area) return { area: null, tareas: [] };

    const tareas = await tx<TareaRow[]>`
      select
        t.id,
        t.titulo,
        t.estado,
        u.nombre as responsable_nombre
      from tarea t
      left join usuario u on u.id = t.responsable_id
      where t.area_id = ${areaId}
      order by t.orden asc, t.creada_en asc
    `;

    return { area, tareas };
  });

  if (!area) notFound();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        nativeButton={false}
        render={<Link href="/areas" />}
      >
        <ArrowLeft />
        Áreas
      </Button>
      <div className="flex items-center gap-2">
        <span
          className="size-3 shrink-0 rounded-full"
          style={{ backgroundColor: area.color }}
        />
        <h1 className="text-2xl font-semibold tracking-tight">{area.nombre}</h1>
      </div>

      <Card>
        <CardContent className="divide-y">
          {tareas.length === 0 ? (
            <p className="text-muted-foreground py-4 text-sm">
              Esta área todavía no tiene tareas.
            </p>
          ) : (
            tareas.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <span
                  className={`text-sm ${t.estado === "hecha" ? "text-muted-foreground line-through" : ""}`}
                >
                  {t.titulo}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline">
                    {t.responsable_nombre ?? "Sin responsable"}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
