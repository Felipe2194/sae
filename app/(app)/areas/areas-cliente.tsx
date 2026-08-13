"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, User, Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AreaDialog, type UsuarioOption } from "./area-dialog";
import { fetchAreasArchivadas, reactivarArea, type AreaArchivadaRow } from "./actions";

type Area = {
  id: string;
  nombre: string;
  color: string;
  descripcion: string | null;
  responsable_nombre: string | null;
  tareas_total: number;
  tareas_hechas: number;
  tareas_abiertas: number;
};

type Props = {
  areas: Area[];
  usuarios: UsuarioOption[];
  canManage: boolean;
};

export function AreasCliente({ areas, usuarios, canManage }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showArchivadas, setShowArchivadas] = useState(false);
  const [archivadas, setArchivadas] = useState<AreaArchivadaRow[] | null>(null);
  const [, startTransition] = useTransition();

  function toggleArchivadas() {
    const next = !showArchivadas;
    setShowArchivadas(next);
    if (next && archivadas === null) {
      startTransition(async () => {
        const rows = await fetchAreasArchivadas();
        setArchivadas(rows);
      });
    }
  }

  function handleReactivar(areaId: string) {
    setArchivadas((prev) => prev?.filter((a) => a.id !== areaId) ?? prev);
    startTransition(() => reactivarArea(areaId));
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Áreas</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {areas.length} {areas.length === 1 ? "área activa" : "áreas activas"}
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            Nueva área
          </Button>
        )}
      </div>

      {areas.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-muted-foreground text-sm">
            No hay áreas creadas todavía.
          </p>
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" />
              Crear primera área
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map((area) => {
            const pct =
              area.tareas_total > 0
                ? Math.round((area.tareas_hechas / area.tareas_total) * 100)
                : 0;

            return (
              <Link key={area.id} href={`/areas/${area.id}`} className="group">
                <div className="bg-card border rounded-xl overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col">
                  {/* Barra de color superior */}
                  <div className="h-1.5 w-full" style={{ backgroundColor: area.color }} />

                  <div className="flex flex-col gap-3 p-4 flex-1">
                    {/* Nombre */}
                    <div className="flex items-start gap-2">
                      <span
                        className="mt-1 size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: area.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm leading-tight group-hover:text-foreground">
                          {area.nombre}
                        </p>
                        {area.descripcion && (
                          <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2">
                            {area.descripcion}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex-1" />

                    {/* Barra de progreso */}
                    {area.tareas_total > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{area.tareas_abiertas} abiertas</span>
                          <span className="tabular-nums">{pct}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: area.color,
                              opacity: 0.8,
                            }}
                          />
                        </div>
                        <p className="text-[12px] text-muted-foreground">
                          {area.tareas_hechas} de {area.tareas_total} completadas
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Sin tareas aún</p>
                    )}

                    {/* Responsable */}
                    {area.responsable_nombre && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground border-t pt-3">
                        <User className="size-3 shrink-0" />
                        <span className="truncate">{area.responsable_nombre}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {canManage && (
        <div className="border-t pt-4">
          <button
            onClick={toggleArchivadas}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Archive className="size-3.5" />
            {showArchivadas ? "Ocultar áreas archivadas" : "Ver áreas archivadas"}
          </button>
          {showArchivadas && (
            <div className="mt-3 flex flex-col gap-1.5">
              {archivadas === null ? (
                <p className="text-xs text-muted-foreground">Cargando...</p>
              ) : archivadas.length === 0 ? (
                <p className="text-xs text-muted-foreground">No hay áreas archivadas.</p>
              ) : (
                archivadas.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: a.color }}
                    />
                    <Link
                      href={`/areas/${a.id}`}
                      className="min-w-0 flex-1 truncate text-sm hover:underline"
                    >
                      {a.nombre}
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 text-xs"
                      onClick={() => handleReactivar(a.id)}
                    >
                      <ArchiveRestore className="size-3.5" />
                      Reactivar
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {canManage && (
        <AreaDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          usuarios={usuarios}
        />
      )}
    </div>
  );
}
