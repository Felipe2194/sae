"use client";

import { useEffect, useState, useTransition } from "react";
import { MascotaTigre } from "@/components/features/mascota-tigre";

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
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center font-sans">
          <div className="flex items-center justify-center rounded-full bg-orange-600/10 p-5">
            <MascotaTigre className="h-auto w-32" />
          </div>
          {sinConexion ? (
            <>
              <p className="text-sm font-medium text-orange-600">Sin conexión</p>
              <h1 className="text-xl font-semibold">Parece que no tenés internet</h1>
              <p className="max-w-sm text-sm text-gray-500">
                Revisá tu conexión — en cuanto vuelva, vas a poder reintentar.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-orange-600">Ups</p>
              <h1 className="text-xl font-semibold">Algo salió mal</h1>
              <p className="max-w-sm text-sm text-gray-500">
                Ocurrió un error inesperado al cargar la aplicación.
              </p>
            </>
          )}
          <button
            onClick={reintentar}
            disabled={isPending || sinConexion}
            className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
          >
            Reintentar
          </button>
          {!sinConexion && (
            <p className="mt-1 text-xs text-gray-500">
              Código 500 · si el problema sigue, contactá al desarrollador
              {error.digest ? ` (código de referencia: ${error.digest})` : ""}.
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
