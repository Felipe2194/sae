"use client";

import { useEffect, useState, useTransition } from "react";
import { MascotaTigre } from "@/components/features/mascota-tigre";
import { useColorPrincipalGuardado } from "@/components/features/color-principal-guardado";

// Naranja UTN por defecto (el --primary de globals.css), si la persona no
// eligió otro color o no hay nada guardado.
const COLOR_POR_DEFECTO = "#ea580c";

export default function GlobalError({
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
  // Esta pantalla reemplaza hasta el layout raíz, así que no cuenta con las
  // variables de globals.css: el color va inline.
  const color = useColorPrincipalGuardado() ?? COLOR_POR_DEFECTO;

  // Ver comentario equivalente en app/error.tsx: retry() (Next 16.3+)
  // re-pide los Server Components antes de re-renderizar; reset() solo
  // limpiaba el estado sin refetch, por eso "Reintentar" no siempre andaba.
  const reintentar = () => {
    startTransition(() => {
      retry();
    });
  };

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

  return (
    <html lang="es">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-4 text-center font-sans">
          <div
            className="flex items-center justify-center rounded-full p-5"
            style={{ backgroundColor: `color-mix(in oklab, ${color} 10%, transparent)` }}
          >
            <MascotaTigre className="h-auto w-36" />
          </div>
          {sinConexion ? (
            <>
              <p className="text-base font-semibold" style={{ color }}>
                Sin conexión
              </p>
              <h1 className="text-2xl font-semibold">Parece que no tenés internet</h1>
              <p className="max-w-md text-base text-gray-500">
                Revisá tu conexión — en cuanto vuelva, vas a poder reintentar.
              </p>
            </>
          ) : (
            <>
              <p className="text-base font-semibold" style={{ color }}>
                Ups
              </p>
              <h1 className="text-2xl font-semibold">Algo salió mal</h1>
              <p className="max-w-md text-base text-gray-500">
                Ocurrió un error inesperado al cargar la aplicación.
              </p>
            </>
          )}
          <button
            onClick={reintentar}
            disabled={isPending || sinConexion}
            style={{ backgroundColor: color }}
            className="rounded-lg px-6 py-3 text-base font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            Reintentar
          </button>
          {!sinConexion && (
            <p className="mt-1 text-sm text-gray-500">
              Código 500 · si el problema sigue, contactá al desarrollador
              {error.digest ? ` (código de referencia: ${error.digest})` : ""}.
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
