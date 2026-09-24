"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { desbloquearSolicitud } from "./actions";

export type SolicitudRechazadaFila = {
  id: string;
  nombre: string;
  email: string;
  rechazada_en: string;
};

// Emails a los que se les rechazó el acceso (ver 049_solicitud_rechazada.sql).
// Plegada por defecto: se consulta poco, solo para deshacer un rechazo por error.
export function SolicitudesRechazadas({ filas }: { filas: SolicitudRechazadaFila[] }) {
  if (filas.length === 0) return null;

  return (
    <details className="text-sm">
      <summary className="text-muted-foreground cursor-pointer select-none">
        Solicitudes rechazadas ({filas.length})
      </summary>
      <ul className="mt-2 flex flex-col divide-y rounded-lg border">
        {filas.map((f) => (
          <Fila key={f.id} fila={f} />
        ))}
      </ul>
    </details>
  );
}

function Fila({ fila }: { fila: SolicitudRechazadaFila }) {
  const [pending, startTransition] = useTransition();

  function desbloquear() {
    startTransition(async () => {
      const { error } = await desbloquearSolicitud(fila.id);
      if (error) toast.error(error);
      else toast.success(`${fila.email} puede volver a pedir acceso.`);
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{fila.nombre}</p>
        <p className="text-muted-foreground truncate text-xs">
          {fila.email} · rechazada el{" "}
          {new Date(fila.rechazada_en).toLocaleDateString("es-AR")}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={desbloquear}
        disabled={pending}
        className="h-8 text-xs"
      >
        Desbloquear
      </Button>
    </li>
  );
}
