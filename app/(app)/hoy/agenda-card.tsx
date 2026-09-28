import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EventoLeido } from "@/lib/google/calendar";
import { cn } from "@/lib/utils";

// Paleta de Google Calendar (colorId → hex) — misma que usa
// app/api/calendar/events/route.ts para /calendario.
const COLORES_CALENDAR: Record<string, string> = {
  "1": "#a4bdfc",
  "2": "#7ae7bf",
  "3": "#dbadff",
  "4": "#ff887c",
  "5": "#fbd75b",
  "6": "#ffb878",
  "7": "#46d6db",
  "8": "#e1e1e1",
  "9": "#5484ed",
  "10": "#51b749",
  "11": "#dc2127",
};

// Recuadro chico de "hoja de calendario" para /hoy: el día grande y la
// lista de eventos de Google Calendar de hoy, en orden. Los que ya
// terminaron quedan atenuados y el que está en curso se marca "Ahora".
// `eventos` null = no se pudo leer (sin calendario vinculado, o Google
// rechazó la consulta) — se avisa en vez de mostrar el día vacío, que
// daría a entender que no hay nada.
export function AgendaCard({
  eventos,
  zonaHoraria,
  error,
}: {
  eventos: EventoLeido[] | null;
  zonaHoraria: string;
  error: string | null;
}) {
  const ahora = new Date();
  const partes = (opciones: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("es-AR", { timeZone: zonaHoraria, ...opciones }).format(ahora);
  const diaNumero = partes({ day: "numeric" });
  const diaSemana = partes({ weekday: "long" });
  const mes = partes({ month: "long" });

  const hora = new Intl.DateTimeFormat("es-AR", {
    timeZone: zonaHoraria,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // Todo el día primero, después por hora de inicio.
  const ordenados = [...(eventos ?? [])].sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return a.inicio.localeCompare(b.inicio);
  });

  return (
    <Card>
      <CardHeader className="px-4 pt-4 pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-semibold">
          Agenda de hoy
          <Link
            href="/calendario"
            className="text-muted-foreground hover:text-foreground flex items-center gap-0.5 text-xs font-normal"
          >
            Calendario
            <ChevronRight className="size-3.5" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex gap-3 px-4 pb-4">
        {/* Hoja de calendario */}
        <div className="flex w-14 shrink-0 flex-col self-start overflow-hidden rounded-lg border text-center">
          <span className="bg-primary text-primary-foreground py-0.5 text-[10px] font-semibold tracking-wide uppercase">
            {mes.slice(0, 3)}
          </span>
          <span className="py-1 text-2xl leading-none font-bold tabular-nums">{diaNumero}</span>
          <span className="text-muted-foreground pb-1 text-[10px] capitalize">
            {diaSemana.slice(0, 3)}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {eventos === null ? (
            <p className="text-muted-foreground text-xs">
              {error ?? "No hay un Google Calendar vinculado a la organización."}
            </p>
          ) : ordenados.length === 0 ? (
            <p className="text-muted-foreground py-1 text-xs">Nada agendado para hoy.</p>
          ) : (
            <div className="flex max-h-[240px] flex-col gap-1 overflow-y-auto">
              {ordenados.map((e) => {
                const inicio = new Date(e.inicio);
                const fin = new Date(e.fin);
                const terminado = !e.allDay && fin <= ahora;
                const enCurso = !e.allDay && inicio <= ahora && ahora < fin;
                const color = (e.colorId && COLORES_CALENDAR[e.colorId]) || "var(--primary)";
                return (
                  <div
                    key={e.id}
                    className={cn(
                      "flex items-start gap-2 rounded-md px-1.5 py-1 text-xs",
                      terminado && "opacity-50",
                      enCurso && "bg-primary/10",
                    )}
                  >
                    <span
                      className="mt-0.5 h-3.5 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-muted-foreground w-10 shrink-0 tabular-nums">
                      {e.allDay ? "Día" : hora.format(inicio)}
                    </span>
                    <span
                      className={cn("min-w-0 flex-1 truncate", terminado && "line-through")}
                      title={e.titulo}
                    >
                      {e.titulo}
                    </span>
                    {enCurso && (
                      <span className="text-primary shrink-0 text-[10px] font-semibold uppercase">
                        Ahora
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
