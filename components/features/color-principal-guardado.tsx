"use client";

import { useEffect, useState } from "react";

// El color del sistema (el de /perfil, o el default de la organización) lo
// aplica app/(app)/layout.tsx. Las pantallas de error (app/error.tsx y
// app/global-error.tsx) reemplazan ese layout cuando aparecen, así que
// quedaban con el naranja por defecto. El layout deja el color anotado acá
// y las pantallas de error lo leen.
const CLAVE = "sae:color-principal";
const HEX = /^#[0-9a-fA-F]{6}$/;

export function RecordarColorPrincipal({ color }: { color: string | null }) {
  useEffect(() => {
    try {
      if (color) window.localStorage.setItem(CLAVE, color);
      else window.localStorage.removeItem(CLAVE);
    } catch {
      // Sin almacenamiento (modo privado, bloqueado): el error queda naranja.
    }
  }, [color]);
  return null;
}

// Se lee en un efecto y no en el render inicial: error.tsx también se
// renderiza en el servidor, donde no hay localStorage, y leerlo antes
// rompería la hidratación.
export function useColorPrincipalGuardado(): string | null {
  const [color, setColor] = useState<string | null>(null);
  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(CLAVE);
      // Va dentro de un <style>: solo se acepta un hex, igual que en el layout.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (guardado && HEX.test(guardado)) setColor(guardado);
    } catch {
      // Ídem arriba.
    }
  }, []);
  return color;
}

// Mismos tokens que fija app/(app)/layout.tsx en html:root.
export function EstiloColorPrincipal({ color }: { color: string | null }) {
  if (!color) return null;
  return (
    <style>{`html:root{--primary:${color};--ring:color-mix(in oklab,${color} 40%,transparent);--sidebar-primary:${color}}`}</style>
  );
}
