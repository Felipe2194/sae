"use client";

import { Printer } from "lucide-react";

// window.print() respeta el @media print de la página (ver page.tsx) — el
// browser ya sabe qué ocultar (este botón, el link "Volver") y deja pasar
// todo lo demás. "Guardar como PDF" es una opción del propio diálogo de
// impresión del sistema, no hace falta generar el PDF nosotros.
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
