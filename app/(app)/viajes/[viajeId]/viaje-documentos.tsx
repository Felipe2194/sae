"use client";

import { useState, useTransition } from "react";
import { FileText, ExternalLink, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DriveIcon, esUrlDrive } from "@/components/features/drive-icon";
import { crearAccesoViaje, eliminarAccesoViaje } from "./actions";
import type { DocumentoViajeRow } from "./page";

export function ViajeDocumentos({
  viajeId,
  documentosIniciales,
  canManage,
}: {
  viajeId: string;
  documentosIniciales: DocumentoViajeRow[];
  canManage: boolean;
}) {
  const [documentos, setDocumentos] = useState(documentosIniciales);
  const [abierto, setAbierto] = useState(false);
  const [etiqueta, setEtiqueta] = useState("");
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleAgregar(e: React.FormEvent) {
    e.preventDefault();
    if (!etiqueta.trim() || !url.trim()) return;
    const etiquetaFinal = etiqueta.trim();
    const urlFinal = url.trim();
    startTransition(async () => {
      const nuevo = await crearAccesoViaje(viajeId, etiquetaFinal, urlFinal);
      if (nuevo) {
        setDocumentos((prev) => [...prev, { id: nuevo.id, etiqueta: etiquetaFinal, url: urlFinal }]);
      }
      setEtiqueta("");
      setUrl("");
      setAbierto(false);
    });
  }

  function handleEliminar(id: string) {
    setDeletingId(id);
    setDocumentos((prev) => prev.filter((d) => d.id !== id));
    startTransition(async () => {
      await eliminarAccesoViaje(id, viajeId);
      setDeletingId(null);
    });
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileText className="text-muted-foreground size-4" />
          Documentos del viaje
        </CardTitle>
        {canManage && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => setAbierto((v) => !v)}
          >
            <Plus className="size-3.5" />
            Agregar
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {abierto && (
          <form onSubmit={handleAgregar} className="flex flex-col gap-2 rounded-lg border p-3">
            <Input
              value={etiqueta}
              onChange={(e) => setEtiqueta(e.target.value)}
              placeholder="Nombre (ej: Cronograma PDF)"
              required
              className="h-8 text-sm"
            />
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              type="url"
              placeholder="https://..."
              required
              className="h-8 text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                Guardar
              </Button>
            </div>
          </form>
        )}

        {documentos.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            No hay documentos cargados todavía.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {documentos.map((d) => (
              <div
                key={d.id}
                className="group hover:bg-muted/60 -mx-1.5 flex items-center gap-2 rounded-md px-1.5 py-1"
              >
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-sm hover:underline"
                >
                  {esUrlDrive(d.url) ? (
                    <DriveIcon className="size-3.5 shrink-0" />
                  ) : (
                    <ExternalLink className="text-muted-foreground size-3.5 shrink-0" />
                  )}
                  <span className="truncate">{d.etiqueta}</span>
                </a>
                {canManage && (
                  <button
                    onClick={() => handleEliminar(d.id)}
                    disabled={deletingId === d.id}
                    className="text-muted-foreground hover:text-destructive shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    title="Quitar"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
