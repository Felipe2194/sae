"use client";

import { useState } from "react";
import { Users2, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type Entrada = {
  nombre: string;
  avatar_color: string | null;
  hecho: string | null;
  pendiente: string | null;
  observaciones: string | null;
  hora: string;
};

type Props = { entradas: Entrada[] };

function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/);
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

// Lo que cargó el resto del equipo hoy — para que el turno siguiente vea acá
// qué se hizo y qué quedó pendiente, en vez de tener que leerlo en el grupo
// de WhatsApp. Colapsable y arranca abierta cuando hay algo para leer, igual
// que el resto de los widgets de /hoy.
export function BitacoraEquipoCard({ entradas }: Props) {
  const [abierta, setAbierta] = useState(true);

  if (entradas.length === 0) return null;

  return (
    <Collapsible open={abierta} onOpenChange={setAbierta}>
      <Card>
        <CollapsibleTrigger
          nativeButton={false}
          render={<CardHeader className="cursor-pointer select-none pb-2 pt-4 px-4" />}
        >
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Users2 className="size-4 text-muted-foreground shrink-0" />
            Bitácora del equipo
            <span className="ml-auto flex items-center gap-1.5 shrink-0">
              <Badge variant="outline">{entradas.length}</Badge>
              <ChevronDown
                className={`size-4 text-muted-foreground transition-transform ${abierta ? "rotate-180" : ""}`}
              />
            </span>
          </CardTitle>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="flex flex-col gap-3 px-4 pb-4 pt-1">
            {entradas.map((e, i) => (
              <div key={i} className="flex gap-2.5 border-t pt-3 first:border-t-0 first:pt-0">
                <Avatar className="size-7 shrink-0">
                  <AvatarFallback
                    className="text-[10px] font-semibold text-white"
                    style={{ backgroundColor: e.avatar_color ?? "#94a3b8" }}
                  >
                    {iniciales(e.nombre)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 flex flex-col gap-1">
                  <p className="text-xs font-medium">
                    {e.nombre.split(" ")[0]}
                    <span className="text-muted-foreground font-normal"> · {e.hora}</span>
                  </p>
                  {e.hecho && (
                    <p className="text-xs text-muted-foreground whitespace-pre-line">
                      <span className="font-medium text-foreground">Hizo: </span>
                      {e.hecho}
                    </p>
                  )}
                  {e.pendiente && (
                    <p className="text-xs text-muted-foreground whitespace-pre-line">
                      <span className="font-medium text-foreground">Quedó pendiente: </span>
                      {e.pendiente}
                    </p>
                  )}
                  {e.observaciones && (
                    <p className="text-xs text-muted-foreground whitespace-pre-line">
                      <span className="font-medium text-foreground">Observaciones: </span>
                      {e.observaciones}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
