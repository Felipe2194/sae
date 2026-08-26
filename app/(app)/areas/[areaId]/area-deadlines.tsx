import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type DeadlineRow = {
  id: string;
  titulo: string;
  fecha_vencimiento: string;
  responsable_nombre: string | null;
};

function formatFecha(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function diasHasta(iso: string, hoyISO: string): number {
  const a = new Date(hoyISO + "T00:00:00").getTime();
  const b = new Date(iso + "T00:00:00").getTime();
  return Math.round((b - a) / 86400000);
}

export function AreaDeadlines({
  deadlines,
  hoyISO,
}: {
  deadlines: DeadlineRow[];
  hoyISO: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <CalendarClock className="text-muted-foreground size-4" />
          Fechas importantes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {deadlines.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            No hay vencimientos próximos.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {deadlines.map((d) => {
              const dias = diasHasta(d.fecha_vencimiento, hoyISO);
              const vencida = dias < 0;
              const esHoy = dias === 0;
              return (
                <div key={d.id} className="flex items-center gap-3">
                  <Badge
                    variant={
                      vencida ? "destructive" : esHoy ? "default" : "outline"
                    }
                    className="shrink-0 px-1.5 py-0 text-[10px] font-normal whitespace-nowrap"
                  >
                    {formatFecha(d.fecha_vencimiento)}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm leading-tight">{d.titulo}</p>
                    {d.responsable_nombre && (
                      <p className="text-muted-foreground text-[11px]">
                        {d.responsable_nombre}
                      </p>
                    )}
                  </div>
                  {vencida && (
                    <span className="text-destructive shrink-0 text-[11px] font-medium">
                      {-dias}d atraso
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
