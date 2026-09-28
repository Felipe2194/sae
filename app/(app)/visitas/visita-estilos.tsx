// Piezas visuales de una visita compartidas entre /visitas (cliente) y la
// tarjeta de visitas de /hoy (server) — sin "use client" ni hooks para que
// se puedan renderizar de los dos lados.

import {
  ArrowUpRight,
  ArrowDownLeft,
  Video,
  Presentation,
  CircleDot,
  type LucideIcon,
} from "lucide-react";
import type { EstadoVisita, TipoVisita } from "@/types/database";
import { labelTipoVisita } from "./tipos";
import { cn } from "@/lib/utils";

// El estado queda en segundo plano (un punto de color + texto chico): lo
// que se busca de un vistazo es la hora y si vamos nosotros o vienen ellos.
export const ESTADO_PUNTO: Record<EstadoVisita, string> = {
  pendiente: "bg-amber-500",
  confirmado: "bg-blue-500",
  realizado: "bg-green-500",
  cancelado: "bg-red-500",
  reprogramado: "bg-orange-500",
};

const CLASE_VAMOS =
  "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30";
const CLASE_VIENEN =
  "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30";
const CLASE_NEUTRA = "bg-muted text-foreground border-border";

// Mismo criterio que Informes ("veces viajamos" vs "nos visitaron"):
// visita a colegio y feria/expo = vamos; nos visitan = vienen.
const TIPO_ESTILO: Record<TipoVisita, { icono: LucideIcon; clase: string }> = {
  visita_colegio: { icono: ArrowUpRight, clase: CLASE_VAMOS },
  feria_expo: { icono: ArrowUpRight, clase: CLASE_VAMOS },
  nos_visitan: { icono: ArrowDownLeft, clase: CLASE_VIENEN },
  charla_taller: { icono: Presentation, clase: CLASE_NEUTRA },
  virtual: { icono: Video, clase: CLASE_NEUTRA },
  otro: { icono: CircleDot, clase: CLASE_NEUTRA },
};

export function TipoVisitaChip({ tipo }: { tipo: TipoVisita }) {
  const { icono: Icono, clase } = TIPO_ESTILO[tipo];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        clase,
      )}
    >
      <Icono className="size-3.5" />
      {labelTipoVisita(tipo)}
    </span>
  );
}

export function formatHora(hhmmss: string | null): string {
  if (!hhmmss) return "";
  return hhmmss.slice(0, 5);
}
