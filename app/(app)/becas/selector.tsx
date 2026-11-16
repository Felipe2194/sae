"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type Opcion = { value: string; label: string };

// Select de una lista de opciones {value, label}. Envuelve el de Base UI,
// que necesita el mapa `items` aparte para poder mostrar la etiqueta (y no
// el value) en el botón. Los valores nunca son "" — Base UI lo trata como
// "sin selección"; para "todos"/"ninguno" usar un centinela (p. ej. "_").
export function Selector({
  value,
  onChange,
  opciones,
  className,
  ariaLabel,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  opciones: Opcion[];
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const items = Object.fromEntries(opciones.map((o) => [o.value, o.label]));
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange((v ?? opciones[0]?.value ?? "") as string)}
      items={items}
      disabled={disabled}
    >
      <SelectTrigger className={cn("h-9 text-sm", className)} aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {opciones.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Clases del chip de una beca según su estado.
export const CHIP_ESTADO = {
  activa: "bg-green-100 text-green-900 border-green-300 dark:bg-green-950 dark:text-green-200 dark:border-green-800",
  rechazada: "bg-red-100 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-200 dark:border-red-800",
  baja: "bg-muted text-muted-foreground border-transparent line-through",
} as const;
