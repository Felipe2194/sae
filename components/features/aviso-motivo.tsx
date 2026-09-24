"use client";

import { useEffect } from "react";
import { toast } from "sonner";

// Mensajes para los redirect() con `motivo` de lib/redirects.ts — se
// muestran una sola vez, como toast, al llegar a /hoy o /login. Mantener las
// claves sincronizadas con ese archivo.
const MENSAJES = {
  "sin-permiso": {
    titulo: "No tenés permiso para acceder a esa sección (403)",
    descripcion: "Si creés que deberías tenerlo, pedíselo a un administrador.",
  },
  "seccion-deshabilitada": {
    titulo: "Esa sección está deshabilitada (403)",
    descripcion: "Un administrador puede activarla desde Configuración.",
  },
  "sesion-invalida": {
    titulo: "Tu sesión ya no es válida (401)",
    descripcion: "Iniciá sesión de nuevo para continuar.",
  },
  // No viene de lib/redirects.ts sino del callback signIn de auth.ts.
  "acceso-rechazado": {
    titulo: "Tu solicitud de acceso fue rechazada",
    descripcion: "Si creés que es un error, hablá con un administrador.",
  },
} as const;

type Motivo = keyof typeof MENSAJES;

function esMotivoConocido(valor: string): valor is Motivo {
  return valor in MENSAJES;
}

export function AvisoMotivo({ motivo }: { motivo?: string }) {
  useEffect(() => {
    if (!motivo || !esMotivoConocido(motivo)) return;

    const { titulo, descripcion } = MENSAJES[motivo];
    // El <Toaster/> raíz (app/layout.tsx) todavía no se suscribió al store de
    // sonner en el mismo commit en que este efecto corre — llamado en el
    // acto, el toast se pierde en silencio. Un setTimeout(0) lo empuja a la
    // siguiente vuelta del event loop, ya con el Toaster escuchando.
    setTimeout(() => {
      toast.error(titulo, { description: descripcion });
    }, 0);

    // Sin esto, un F5 en /hoy o /login repite el mismo toast.
    const url = new URL(window.location.href);
    url.searchParams.delete("motivo");
    window.history.replaceState({}, "", url);
  }, [motivo]);

  return null;
}
