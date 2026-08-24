"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Ghost } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GRADIENTES_FONDO } from "@/lib/fondos";

// Variaciones del mensaje — una se elige al azar en cada montaje (cada vez
// que se dispara un error nuevo, o se reintenta y vuelve a fallar), en vez
// de mostrar siempre el mismo texto. Guiños al vocabulario propio de SAE
// (cronograma, área, turno) en vez de humor genérico.
const QUIPS = [
  {
    titulo: "Uy, esto no estaba en el cronograma",
    texto: "Algo se cruzó de cable en el camino. Probá de nuevo — a veces alcanza con eso.",
  },
  {
    titulo: "Se nos escapó un bug por el pasillo",
    texto: "Ya salimos a buscarlo. Mientras tanto, podés reintentar.",
  },
  {
    titulo: "Turno técnico no planificado",
    texto: "No figura en el cronograma, pero pasó. Probá de nuevo en un momento.",
  },
  {
    titulo: "Parece que alguien tocó el cable que no era",
    texto: "Estamos en eso. Reintentá en unos segundos.",
  },
  {
    titulo: "El sistema pidió el día",
    texto: "No se lo aprobamos, pero bueno. Probá de nuevo.",
  },
  {
    titulo: "Algo se trabó ahí adentro",
    texto: "Como la puerta de la oficina en invierno. Reintentá.",
  },
  {
    titulo: "Esto no lo vimos venir",
    texto: "Ni con la mejor planificación de área. Probá de nuevo.",
  },
];

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const [quip] = useState(() => QUIPS[Math.floor(Math.random() * QUIPS.length)]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Fondo animado — mismos gradientes que el fondo "glass" personal de
          /perfil, para que la pantalla de error se sienta parte de la
          misma app y no un template genérico pegado encima. */}
      <div className="absolute inset-0 -z-10 bg-background">
        <motion.div
          className="absolute -top-32 -left-32 h-96 w-96 rounded-full opacity-40 blur-3xl dark:opacity-25"
          style={{ background: GRADIENTES_FONDO.atardecer.css }}
          animate={{ x: [0, 40, -20, 0], y: [0, 30, -10, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/3 -right-40 h-[28rem] w-[28rem] rounded-full opacity-40 blur-3xl dark:opacity-20"
          style={{ background: GRADIENTES_FONDO.lavanda.css }}
          animate={{ x: [0, -30, 20, 0], y: [0, -20, 15, 0] }}
          transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[-8rem] left-1/3 h-80 w-80 rounded-full opacity-30 blur-3xl dark:opacity-15"
          style={{ background: GRADIENTES_FONDO.oceano.css }}
          animate={{ x: [0, 25, -25, 0], y: [0, -25, 10, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="border-border/60 bg-card/70 flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border px-8 py-10 text-center shadow-lg backdrop-blur-xl">
        <motion.div
          className="bg-primary/10 flex size-14 items-center justify-center rounded-full"
          animate={{ y: [0, -6, 0], rotate: [0, -4, 4, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <Ghost className="text-primary size-7" />
        </motion.div>

        <div className="flex flex-col gap-1.5">
          <p className="text-primary text-sm font-medium">Ups</p>
          <h1 className="text-xl font-semibold text-balance">{quip.titulo}</h1>
          <p className="text-muted-foreground max-w-xs text-sm text-balance">{quip.texto}</p>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <Button onClick={() => reset()}>Reintentar</Button>
          <Button variant="ghost" nativeButton={false} render={<Link href="/hoy" />}>
            Ir a Hoy
          </Button>
        </div>

        {process.env.NODE_ENV === "development" && (
          <details className="text-muted-foreground mt-2 w-full text-left text-xs">
            <summary className="cursor-pointer select-none">Detalle (solo en desarrollo)</summary>
            <pre className="bg-muted mt-1 overflow-x-auto rounded-md p-2 whitespace-pre-wrap break-words">
              {error.message}
              {error.digest ? `\n${error.digest}` : ""}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
