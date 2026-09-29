"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EstadoVisita } from "@/types/database";
import { cambiarEstadoVisita } from "./actions";

// Solo tiene sentido en visitas de hoy o ya pasadas que siguen como
// Pendiente/Confirmado — las futuras todavía no se pueden haber hecho.
export function puedeConfirmarse(v: { estado: EstadoVisita; fecha: string }, hoy: string) {
  return (v.estado === "pendiente" || v.estado === "confirmado") && v.fecha <= hoy;
}

// Botón de un toque para marcar una visita como realizada, pensado sobre
// todo para el celular (antes había que abrir la edición, cambiar el estado
// y guardar). Un toque de más se corrige con el "Deshacer" del aviso.
export function ConfirmarVisitaButton({
  visitaId,
  className,
  compacto = false,
}: {
  visitaId: string;
  className?: string;
  // En la tabla: solo el ícono, para no ensanchar la última columna.
  compacto?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function confirmar(e: React.MouseEvent) {
    // Las tarjetas son tocables (abren la edición): que este toque no
    // dispare también eso.
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const { estadoPrevio, error } = await cambiarEstadoVisita(visitaId, "realizado");
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Visita marcada como realizada.", {
        action:
          estadoPrevio === "pendiente" || estadoPrevio === "confirmado"
            ? {
                label: "Deshacer",
                onClick: async () => {
                  const r = await cambiarEstadoVisita(visitaId, estadoPrevio);
                  if (r.error) toast.error(r.error);
                },
              }
            : undefined,
      });
    });
  }

  return (
    <Button
      type="button"
      size={compacto ? "icon" : "sm"}
      variant="outline"
      onClick={confirmar}
      disabled={isPending}
      aria-label="Marcar como realizada"
      title="Marcar como realizada"
      className={cn(
        "shrink-0 border-green-600/40 text-green-700 hover:bg-green-600/10 hover:text-green-700 dark:text-green-400",
        compacto ? "size-8" : "h-9 px-3",
        className,
      )}
    >
      <Check className="size-4" />
      {!compacto && (isPending ? "Guardando..." : "Realizada")}
    </Button>
  );
}
