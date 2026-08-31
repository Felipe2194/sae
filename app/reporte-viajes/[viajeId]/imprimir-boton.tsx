"use client";

import { Printer } from "lucide-react";

// Mismo criterio que app/reporte-visitas/imprimir-boton.tsx: window.print()
// respeta el @media print de la página, no hace falta generar el PDF nosotros.
export function ImprimirBoton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 print:hidden"
    >
      <Printer className="size-4" />
      Imprimir / Guardar como PDF
    </button>
  );
}
