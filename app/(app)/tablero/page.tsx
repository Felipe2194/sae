import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const columnas = [
  { estado: "por_hacer", titulo: "Por hacer" },
  { estado: "en_progreso", titulo: "En progreso" },
  { estado: "hecha", titulo: "Hecha" },
] as const;

type TareaRow = {
  id: string;
  titulo: string;
  estado: string;
  fecha_vencimiento: string | null;
  area_nombre: string | null;
  area_color: string | null;
  responsable_iniciales: string | null;
};

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export default async function TableroPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const tareas = await withUser(session.user.id, async (tx) => {
    return tx<TareaRow[]>`
      select
        t.id,
        t.titulo,
        t.estado,
        t.fecha_vencimiento::text,
        a.nombre as area_nombre,
        a.color  as area_color,
        u.nombre as responsable_iniciales
      from tarea t
      left join area     a on a.id = t.area_id
      left join usuario  u on u.id = t.responsable_id
      order by t.orden asc, t.creada_en asc
    `;
  });

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {columnas.map((col) => {
        const tareasColumna = tareas.filter((t) => t.estado === col.estado);
        return (
          <div key={col.estado} className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-medium">{col.titulo}</h2>
              <Badge variant="outline">{tareasColumna.length}</Badge>
            </div>
            <div className="flex flex-col gap-2">
              {tareasColumna.map((t) => (
                <Card key={t.id} className="gap-2 py-3">
                  <CardHeader className="px-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: t.area_color ?? "#94a3b8" }}
                      />
                      <span className="text-muted-foreground text-xs">
                        {t.area_nombre}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-2 px-3">
                    <p className="text-sm leading-snug">{t.titulo}</p>
                  </CardContent>
                  <CardContent className="flex items-center justify-between px-3">
                    {t.fecha_vencimiento ? (
                      <span className="text-muted-foreground flex items-center gap-1 text-xs">
                        <CalendarDays className="size-3.5" />
                        {new Date(t.fecha_vencimiento + "T00:00:00").toLocaleDateString("es-AR", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </span>
                    ) : (
                      <span />
                    )}
                    {t.responsable_iniciales && (
                      <Avatar className="size-6">
                        <AvatarFallback className="text-[10px]">
                          {iniciales(t.responsable_iniciales)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </CardContent>
                </Card>
              ))}
              {tareasColumna.length === 0 && (
                <p className="text-muted-foreground px-1 text-sm">Sin tareas.</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
