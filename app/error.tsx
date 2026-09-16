"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MascotaTigre } from "@/components/features/mascota-tigre";

// Blobs decorativos (círculos difuminados, no el mural completo de
// lib/fondos.ts — ese trae una base sólida pensada para cubrir toda la
// pantalla, se vería mal recortada a un círculo). Mismos tonos que los
// temas "Atardecer", "Lavanda" y "Océano" de /perfil, como color puro. La
// intensidad entre modo claro/oscuro la maneja el dark:opacity-* de cada
// blob, no el color en sí.
const BLOB_ATARDECER =
  "radial-gradient(circle, rgba(255,141,120,0.9) 0%, rgba(168,88,199,0.55) 55%, transparent 75%)";
const BLOB_LAVANDA =
  "radial-gradient(circle, rgba(160,80,220,0.9) 0%, rgba(250,181,158,0.5) 55%, transparent 75%)";
const BLOB_OCEANO =
  "radial-gradient(circle, rgba(79,172,254,0.9) 0%, rgba(0,242,254,0.5) 55%, transparent 75%)";

// Cada cuánto rota la frase de abajo, sola, mientras la pantalla de error
// sigue en pantalla (ver el useEffect en el componente).
const ROTACION_MS = 6000;

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
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const [isPending, startTransition] = useTransition();

  // retry() (Next 16.3+) reemplaza al viejo hack de router.refresh() + reset():
  // vuelve a pedir los Server Components del segmento antes de re-renderizar,
  // en vez de reusar lo que Next tenga cacheado del fallo. reset() solo
  // limpiaba el estado de error sin refetch, por eso "Reintentar" a veces no
  // hacía nada.
  const reintentar = () => {
    startTransition(() => {
      retry();
    });
  };

  // Si el navegador se quedó sin conexión, reintentar solo va a repetir el
  // mismo error — se lo decimos en vez de dejar que lo descubra a los golpes.
  const [sinConexion, setSinConexion] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine,
  );
  useEffect(() => {
    const marcarOnline = () => setSinConexion(false);
    const marcarOffline = () => setSinConexion(true);
    window.addEventListener("online", marcarOnline);
    window.addEventListener("offline", marcarOffline);
    return () => {
      window.removeEventListener("online", marcarOnline);
      window.removeEventListener("offline", marcarOffline);
    };
  }, []);

  const [quip, setQuip] = useState(() => QUIPS[Math.floor(Math.random() * QUIPS.length)]);

  // Rota sola cada ROTACION_MS mientras la pantalla siga en pie — evita
  // repetir la misma frase dos veces seguidas.
  useEffect(() => {
    const id = setInterval(() => {
      setQuip((actual) => {
        const opciones = QUIPS.filter((q) => q !== actual);
        return opciones[Math.floor(Math.random() * opciones.length)];
      });
    }, ROTACION_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Fondo animado — mismos gradientes que el fondo "glass" personal de
          /perfil, para que la pantalla de error se sienta parte de la
          misma app y no un template genérico pegado encima. */}
      <div className="absolute inset-0 -z-10 bg-background">
        <motion.div
          className="absolute -top-32 -left-32 h-96 w-96 rounded-full opacity-40 blur-3xl dark:opacity-25"
          style={{ background: BLOB_ATARDECER }}
          animate={{ x: [0, 40, -20, 0], y: [0, 30, -10, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/3 -right-40 h-[28rem] w-[28rem] rounded-full opacity-40 blur-3xl dark:opacity-20"
          style={{ background: BLOB_LAVANDA }}
          animate={{ x: [0, -30, 20, 0], y: [0, -20, 15, 0] }}
          transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[-8rem] left-1/3 h-80 w-80 rounded-full opacity-30 blur-3xl dark:opacity-15"
          style={{ background: BLOB_OCEANO }}
          animate={{ x: [0, 25, -25, 0], y: [0, -25, 10, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="border-border/60 bg-card/70 flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border px-8 py-10 text-center shadow-lg backdrop-blur-xl">
        <motion.div
          className="bg-primary/10 flex items-center justify-center rounded-full p-5"
          animate={{ y: [0, -6, 0], rotate: [0, -3, 3, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <MascotaTigre className="h-auto w-32" />
        </motion.div>

        <div className="flex flex-col gap-1.5">
          <p className="text-primary text-sm font-medium">{sinConexion ? "Sin conexión" : "Ups"}</p>
          {sinConexion ? (
            <div className="flex flex-col gap-1.5">
              <h1 className="text-xl font-semibold text-balance">Parece que no tenés internet</h1>
              <p className="text-muted-foreground max-w-xs text-sm text-balance">
                Revisá tu conexión — en cuanto vuelva, vas a poder reintentar.
              </p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={quip.titulo}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-1.5"
              >
                <h1 className="text-xl font-semibold text-balance">{quip.titulo}</h1>
                <p className="text-muted-foreground max-w-xs text-sm text-balance">{quip.texto}</p>
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <Button onClick={reintentar} disabled={isPending || sinConexion}>
            Reintentar
          </Button>
          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link href="/hoy" />}
            disabled={sinConexion}
          >
            Ir a Hoy
          </Button>
        </div>

        {!sinConexion && (
          <p className="text-muted-foreground mt-1 text-xs">
            Código 500 · si el problema sigue, contactá al desarrollador
            {error.digest ? ` (código de referencia: ${error.digest})` : ""}.
          </p>
        )}

        {process.env.NODE_ENV === "development" && !sinConexion && (
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
