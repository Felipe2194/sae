import { CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  tareas,
  areaPorId,
  usuarioPorId,
  type EstadoTarea,
} from "@/lib/mock-data";

const columnas: { estado: EstadoTarea; titulo: string }[] = [
  { estado: "por_hacer", titulo: "Por hacer" },
  { estado: "en_progreso", titulo: "En progreso" },
  { estado: "hecha", titulo: "Hecha" },
];

export default function TableroPage() {
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
              {tareasColumna.map((t) => {
                const area = areaPorId(t.areaId);
                const responsable = usuarioPorId(t.responsableId);
                return (
                  <Card key={t.id} className="gap-2 py-3">
                    <CardHeader className="px-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: area?.color }}
                        />
                        <span className="text-muted-foreground text-xs">
                          {area?.nombre}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between gap-2 px-3">
                      <p className="text-sm leading-snug">{t.titulo}</p>
                    </CardContent>
                    <CardContent className="flex items-center justify-between px-3">
                      {t.fechaVencimiento ? (
                        <span className="text-muted-foreground flex items-center gap-1 text-xs">
                          <CalendarDays className="size-3.5" />
                          {new Date(t.fechaVencimiento).toLocaleDateString(
                            "es-AR",
                            { day: "2-digit", month: "2-digit" },
                          )}
                        </span>
                      ) : (
                        <span />
                      )}
                      {responsable && (
                        <Avatar className="size-6">
                          <AvatarFallback className="text-[10px]">
                            {responsable.iniciales}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {tareasColumna.length === 0 && (
                <p className="text-muted-foreground px-1 text-sm">
                  Sin tareas.
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
