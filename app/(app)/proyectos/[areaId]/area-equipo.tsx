import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export type MiembroResumen = {
  id: string;
  nombre: string;
  avatar_color: string | null;
  en_progreso: number;
  por_hacer: number;
  hechas: number;
  tareas_en_progreso: string[];
};

function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/);
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

const AVATAR_COLOR_DEFAULT = "oklch(0.62 0.19 42)";

export function AreaEquipo({ equipo }: { equipo: MiembroResumen[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Users className="text-muted-foreground size-4" />
          Equipo
        </CardTitle>
      </CardHeader>
      <CardContent>
        {equipo.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            Todavía no hay tareas asignadas a nadie.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {equipo.map((m) => {
              const total = m.en_progreso + m.por_hacer + m.hechas;
              const pct = total > 0 ? Math.round((m.hechas / total) * 100) : 0;
              return (
                <div key={m.id} className="flex gap-3">
                  <Avatar className="mt-0.5 size-8 shrink-0">
                    <AvatarFallback
                      className="text-[11px] font-semibold text-white"
                      style={{
                        backgroundColor: m.avatar_color ?? AVATAR_COLOR_DEFAULT,
                      }}
                    >
                      {iniciales(m.nombre)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{m.nombre}</p>
                      <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                        {m.hechas}/{total} · {pct}%
                      </span>
                    </div>
                    <div className="bg-muted mt-1.5 h-1.5 w-full overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full bg-green-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {m.tareas_en_progreso.length > 0 && (
                      <p className="text-muted-foreground mt-1.5 truncate text-xs">
                        En curso: {m.tareas_en_progreso.slice(0, 2).join(", ")}
                        {m.tareas_en_progreso.length > 2 &&
                          ` +${m.tareas_en_progreso.length - 2}`}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
