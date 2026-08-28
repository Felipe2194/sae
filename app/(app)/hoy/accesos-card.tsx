"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Plus, Trash2, Link2, X, ChevronUp, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DriveIcon, esUrlDrive } from "@/components/features/drive-icon";
import { crearAcceso, eliminarAcceso, moverAcceso } from "@/app/(app)/configuracion/actions";

type Acceso = { id: string; etiqueta: string; url: string };

// Favicon real del sitio en vez de un ícono genérico — con varios accesos en
// la lista (varios sistemas distintos que se usan a diario) un ícono propio
// por cada uno se reconoce de un vistazo mucho más rápido que leer la
// etiqueta cada vez. Se pide vía /api/favicon (que a su vez pega contra el
// servicio de favicons de Google) en vez de apuntar el <img> directo ahí,
// porque la CSP de la app solo permite imágenes 'self' (ver next.config.ts)
// — si falla (sitio raro, sin favicon) cae al ícono genérico de antes.
function SitioIcon({ url }: { url: string }) {
  const [error, setError] = useState(false);
  if (esUrlDrive(url)) return <DriveIcon className="size-4 shrink-0" />;
  if (error) {
    return <ExternalLink className="text-muted-foreground size-4 shrink-0" />;
  }
  let dominio: string;
  try {
    dominio = new URL(url).hostname;
  } catch {
    return <ExternalLink className="text-muted-foreground size-4 shrink-0" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- favicon vía proxy propio, no una imagen del proyecto
    <img
      src={`/api/favicon?dominio=${encodeURIComponent(dominio)}`}
      alt=""
      width={16}
      height={16}
      className="size-4 shrink-0 rounded-[3px]"
      onError={() => setError(true)}
    />
  );
}

type Props = {
  accesos: Acceso[];
  canManage: boolean;
};

export function AccesosCard({ accesos: inicial, canManage }: Props) {
  const [accesos, setAccesos] = useState(inicial);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [etiqueta, setEtiqueta] = useState("");
  const [url, setUrl] = useState("");
  const [isPendingAdd, startAdd] = useTransition();
  const [isPendingMutacion, startMutacion] = useTransition();

  function handleAgregar(e: React.FormEvent) {
    e.preventDefault();
    const et = etiqueta.trim();
    const ur = url.trim();
    if (!et || !ur) return;

    const fd = new FormData();
    fd.append("etiqueta", et);
    fd.append("url", ur);

    startAdd(async () => {
      await crearAcceso(fd);
      setEtiqueta("");
      setUrl("");
      setMostrarForm(false);
      // La revalidación recarga la página; actualizar local state optimistamente
      setAccesos((prev) => [
        ...prev,
        { id: crypto.randomUUID(), etiqueta: et, url: ur },
      ]);
    });
  }

  function handleEliminar(id: string) {
    setAccesos((prev) => prev.filter((a) => a.id !== id));
    startMutacion(() => eliminarAcceso(id));
  }

  function handleMover(id: string, direccion: "arriba" | "abajo") {
    setAccesos((prev) => {
      const idx = prev.findIndex((a) => a.id === id);
      const vecino = direccion === "arriba" ? idx - 1 : idx + 1;
      if (idx === -1 || vecino < 0 || vecino >= prev.length) return prev;
      const copia = [...prev];
      [copia[idx], copia[vecino]] = [copia[vecino], copia[idx]];
      return copia;
    });
    startMutacion(() => moverAcceso(id, direccion));
  }

  if (accesos.length === 0 && !canManage) return null;

  return (
    <Card>
      <CardHeader className="px-4 pt-4 pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-semibold">
          Accesos rápidos
          {canManage && (
            <button
              onClick={() => setMostrarForm((v) => !v)}
              className="text-muted-foreground hover:text-foreground rounded-md p-0.5 transition-colors"
              aria-label={mostrarForm ? "Cancelar" : "Agregar acceso"}
            >
              {mostrarForm ? (
                <X className="size-3.5" />
              ) : (
                <Plus className="size-3.5" />
              )}
            </button>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-1 px-4 pb-4">
        {accesos.length === 0 && !mostrarForm && (
          <p className="text-muted-foreground py-1 text-xs">
            No hay accesos configurados.
          </p>
        )}

        {accesos.map((ar, i) => (
          <div key={ar.id} className="group flex items-center gap-1">
            <a
              href={ar.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:bg-muted flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-2.5 text-sm transition-colors"
            >
              <SitioIcon url={ar.url} />
              <span className="truncate">{ar.etiqueta}</span>
            </a>
            {canManage && (
              <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => handleMover(ar.id, "arriba")}
                  disabled={isPendingMutacion || i === 0}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-30 rounded-md p-1.5"
                  aria-label={`Mover ${ar.etiqueta} arriba`}
                >
                  <ChevronUp className="size-3.5" />
                </button>
                <button
                  onClick={() => handleMover(ar.id, "abajo")}
                  disabled={isPendingMutacion || i === accesos.length - 1}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-30 rounded-md p-1.5"
                  aria-label={`Mover ${ar.etiqueta} abajo`}
                >
                  <ChevronDown className="size-3.5" />
                </button>
                <button
                  onClick={() => handleEliminar(ar.id)}
                  disabled={isPendingMutacion}
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md p-1.5"
                  aria-label={`Eliminar ${ar.etiqueta}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}

        {canManage && mostrarForm && (
          <form
            onSubmit={handleAgregar}
            className="mt-2 flex flex-col gap-2 border-t pt-2"
          >
            <Input
              value={etiqueta}
              onChange={(e) => setEtiqueta(e.target.value)}
              placeholder="Nombre (ej: Drive SAE)"
              required
              autoFocus
              className="h-8 text-xs"
            />
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              type="url"
              required
              className="h-8 text-xs"
            />
            <Button
              type="submit"
              size="sm"
              disabled={isPendingAdd || !etiqueta.trim() || !url.trim()}
              className="h-7 self-end text-xs"
            >
              <Link2 className="size-3" />
              {isPendingAdd ? "Guardando..." : "Agregar"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
