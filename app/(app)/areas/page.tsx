import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { areas, tareas, usuarioPorId } from "@/lib/mock-data";

export default function AreasPage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Áreas</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {areas.map((area) => {
          const abiertas = tareas.filter(
            (t) => t.areaId === area.id && t.estado !== "hecha",
          ).length;
          const responsable = usuarioPorId(area.responsableId);

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
                    {abiertas} tarea{abiertas === 1 ? "" : "s"} abierta
                    {abiertas === 1 ? "" : "s"}
                  </span>
                  <span>
                    {responsable ? responsable.nombre : "Sin responsable"}
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
