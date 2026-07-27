import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { areas, tareas, usuarioPorId } from "@/lib/mock-data";

export default async function AreaDetallePage({
  params,
}: {
  params: Promise<{ areaId: string }>;
}) {
  const { areaId } = await params;
  const area = areas.find((a) => a.id === areaId);
  if (!area) notFound();

  const tareasArea = tareas.filter((t) => t.areaId === area.id);

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
          {tareasArea.length === 0 ? (
            <p className="text-muted-foreground py-4 text-sm">
              Esta área todavía no tiene tareas.
            </p>
          ) : (
            tareasArea.map((t) => {
              const responsable = usuarioPorId(t.responsableId);
              return (
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
                      {responsable ? responsable.nombre : "Sin responsable"}
                    </Badge>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
