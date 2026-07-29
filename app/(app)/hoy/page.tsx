import { redirect } from "next/navigation";
import { Link2 } from "lucide-react";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { TareaFila } from "./tarea-fila";

function saludo(): string {
  const hora = new Date().getHours();
  if (hora < 12) return "Buenos días";
  if (hora < 20) return "Buenas tardes";
  return "Buenas noches";
}

function fechaLarga(): string {
  const texto = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

type TareaRow = {
  id: string;
  titulo: string;
  estado: string;
  fecha_vencimiento: string | null;
  area_color: string | null;
};

type AccesoRow = {
  id: string;
  etiqueta: string;
  url: string;
};

export default async function HoyPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const hoyISO = new Date().toISOString().slice(0, 10);

  const { tareas, accesos } = await withUser(session.user.id, async (tx) => {
    const tareas = await tx<TareaRow[]>`
      select
        t.id,
        t.titulo,
        t.estado,
        t.fecha_vencimiento::text,
        a.color as area_color
      from tarea t
      left join area a on a.id = t.area_id
      where t.responsable_id = mi_usuario_id()
        and t.estado != 'hecha'
      order by t.fecha_vencimiento asc nulls last, t.orden asc
    `;

    const accesos = await tx<AccesoRow[]>`
      select id, etiqueta, url
      from acceso_rapido
      where organizacion_id = mi_organizacion_id()
      order by orden asc
    `;

    return { tareas, accesos };
  });

  const misTareasHoy = tareas.filter(
    (t) => t.estado === "en_progreso" || (t.fecha_vencimiento !== null && t.fecha_vencimiento <= hoyISO),
  );

  const estaSemana = tareas.filter(
    (t) => t.fecha_vencimiento !== null && t.fecha_vencimiento > hoyISO,
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <p className="text-muted-foreground text-sm">{fechaLarga()}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {saludo()}, {session.user.name.split(" ")[0]}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mis tareas de hoy</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {misTareasHoy.length === 0 ? (
            <p className="text-muted-foreground py-4 text-sm">
              No tenés nada pendiente para hoy.
            </p>
          ) : (
            misTareasHoy.map((t) => (
              <TareaFila
                key={t.id}
                id={t.id}
                titulo={t.titulo}
                estado={t.estado}
                areaColor={t.area_color}
                vencida={
                  t.fecha_vencimiento !== null && t.fecha_vencimiento < hoyISO
                }
              />
            ))
          )}
        </CardContent>
      </Card>

      <Collapsible defaultOpen={false}>
        <Card>
          <CollapsibleTrigger
            nativeButton={false}
            render={<CardHeader className="cursor-pointer select-none" />}
          >
            <CardTitle className="flex items-center justify-between text-base">
              Esta semana
              <Badge variant="outline">{estaSemana.length}</Badge>
            </CardTitle>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="divide-y">
              {estaSemana.length === 0 ? (
                <p className="text-muted-foreground py-4 text-sm">
                  No hay nada próximo a vencer.
                </p>
              ) : (
                estaSemana.map((t) => (
                  <TareaFila
                    key={t.id}
                    id={t.id}
                    titulo={t.titulo}
                    estado={t.estado}
                    areaColor={t.area_color}
                    vencida={false}
                  />
                ))
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {accesos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Accesos rápidos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {accesos.map((ar) => (
              <Button
                key={ar.id}
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <a href={ar.url} target="_blank" rel="noopener noreferrer" />
                }
              >
                <Link2 />
                {ar.etiqueta}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
