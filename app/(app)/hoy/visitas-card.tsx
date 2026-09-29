import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatarStack } from "@/components/features/user-avatar";
import { labelEstadoVisita, puedeConfirmarse } from "@/app/(app)/visitas/tipos";
import {
  ESTADO_PUNTO,
  TipoVisitaChip,
  formatHora,
} from "@/app/(app)/visitas/visita-estilos";
import { ConfirmarVisitaButton } from "@/app/(app)/visitas/confirmar-visita-button";
import { cn } from "@/lib/utils";
import type { EstadoVisita, TipoVisita } from "@/types/database";

export type VisitaHoyRow = {
  id: string;
  fecha: string;
  colegio_nombre: string;
  ciudad: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  tipo: TipoVisita;
  estado: EstadoVisita;
  integrantes: { id: string; nombre: string; avatar_color: string | null }[];
};

// Mismo formato que la tarjeta "Hoy" de /visitas, en versión compacta y
// con dos días: qué visitas hay hoy y cuáles mañana, para organizarse sin
// tener que entrar a Visitas. Cada visita abre su edición en /visitas.
export function VisitasCard({
  visitas,
  hoy,
  manana,
}: {
  visitas: VisitaHoyRow[];
  hoy: string;
  manana: string;
}) {
  const dias = [
    { titulo: "Hoy", fecha: hoy },
    { titulo: "Mañana", fecha: manana },
  ].map((d) => ({ ...d, visitas: visitas.filter((v) => v.fecha === d.fecha) }));

  return (
    <Card>
      <CardHeader className="px-4 pt-4 pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-semibold">
          <span className="flex items-center gap-2">
            <CalendarDays className="text-primary size-4" />
            Visitas
          </span>
          <Link
            href="/visitas"
            className="text-muted-foreground hover:text-foreground flex items-center gap-0.5 text-xs font-normal"
          >
            Ver todas
            <ChevronRight className="size-3.5" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-4 pb-4">
        {dias.map((d) => (
          <div key={d.fecha} className="flex flex-col gap-1.5">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {d.titulo}
            </p>
            {d.visitas.length === 0 ? (
              <p className="text-muted-foreground text-sm">Sin visitas.</p>
            ) : (
              d.visitas.map((v) => (
                // El botón "Realizada" va al lado del link, no adentro (un
                // <a> no puede contener un <button>).
                <div
                  key={v.id}
                  className={cn(
                    "hover:bg-muted/50 flex items-center gap-2 rounded-xl border pr-2.5 transition-colors",
                    v.estado === "cancelado" && "opacity-50",
                  )}
                >
                  <Link
                    href={`/visitas?visita=${v.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 p-2.5"
                  >
                    <div className="w-14 shrink-0 text-center">
                      <p className="text-xl leading-none font-bold tabular-nums">
                        {v.hora_inicio ? formatHora(v.hora_inicio) : "—"}
                      </p>
                      {v.hora_fin && (
                        <p className="text-muted-foreground mt-1 text-[11px] tabular-nums">
                          a {formatHora(v.hora_fin)}
                        </p>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-sm font-semibold",
                          v.estado === "cancelado" && "line-through",
                        )}
                      >
                        {v.colegio_nombre}
                      </p>
                      {v.ciudad && (
                        <p className="text-muted-foreground truncate text-xs">
                          {v.ciudad}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <TipoVisitaChip tipo={v.tipo} />
                        <span className="text-muted-foreground flex items-center gap-1 text-xs">
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              ESTADO_PUNTO[v.estado],
                            )}
                          />
                          {labelEstadoVisita(v.estado)}
                        </span>
                      </div>
                    </div>
                    {v.integrantes.length > 0 && (
                      <div
                        className={cn(
                          "shrink-0",
                          puedeConfirmarse(v, hoy) && "hidden sm:block",
                        )}
                      >
                        <UserAvatarStack
                          usuarios={v.integrantes}
                          size="sm"
                          max={3}
                        />
                      </div>
                    )}
                  </Link>
                  {puedeConfirmarse(v, hoy) && (
                    <ConfirmarVisitaButton visitaId={v.id} />
                  )}
                </div>
              ))
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
