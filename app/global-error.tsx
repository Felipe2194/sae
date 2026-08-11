"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center font-sans">
          <p className="text-sm font-medium text-orange-600">Ups</p>
          <h1 className="text-xl font-semibold">Algo salió mal</h1>
          <p className="max-w-sm text-sm text-gray-500">
            Ocurrió un error inesperado al cargar la aplicación.
          </p>
          <button
            onClick={() => reset()}
            className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
