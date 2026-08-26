"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Plus, Trash2, Link2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DriveIcon, esUrlDrive } from "@/components/features/drive-icon";
import { crearAcceso, eliminarAcceso } from "@/app/(app)/admin/actions";

type Acceso = { id: string; etiqueta: string; url: string };

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
  const [isPendingDel, startDel] = useTransition();

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
    startDel(() => eliminarAcceso(id));
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

        {accesos.map((ar) => (
          <div key={ar.id} className="group flex items-center gap-1">
            <a
              href={ar.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:bg-muted flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors"
            >
              {esUrlDrive(ar.url) ? (
                <DriveIcon className="size-3.5 shrink-0" />
              ) : (
                <ExternalLink className="text-muted-foreground size-3.5 shrink-0" />
              )}
              <span className="truncate">{ar.etiqueta}</span>
            </a>
            {canManage && (
              <button
                onClick={() => handleEliminar(ar.id)}
                disabled={isPendingDel}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 rounded-md p-1.5 opacity-0 transition-opacity group-hover:opacity-100"
                aria-label={`Eliminar ${ar.etiqueta}`}
              >
                <Trash2 className="size-3.5" />
              </button>
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
