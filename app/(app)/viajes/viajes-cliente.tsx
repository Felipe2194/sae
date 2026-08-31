"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatarStack } from "@/components/features/user-avatar";
import { ViajeDialog } from "./viaje-dialog";
import { eliminarViaje } from "./actions";
import { labelEstadoViaje } from "./tipos";
import type { UsuarioOption, ViajeFila } from "./page";

const ESTADO_BADGE: Record<ViajeFila["estado"], string> = {
  borrador: "bg-muted text-muted-foreground border-transparent",
  inscripciones_abiertas: "bg-green-200 text-green-900 border-green-400",
  inscripciones_cerradas: "bg-amber-200 text-amber-900 border-amber-400",
  realizado: "bg-blue-100 text-blue-800 border-blue-200",
  cancelado: "bg-red-200 text-red-900 border-red-400",
};

function formatFecha(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

type Props = {
  viajes: ViajeFila[];
  usuarios: UsuarioOption[];
  currentUserId: string;
};

export function ViajesCliente({ viajes, usuarios, currentUserId }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<ViajeFila | undefined>(undefined);
  const [, startTransition] = useTransition();
  const [borrandoId, setBorrandoId] = useState<string | null>(null);

  function abrirNuevo() {
    setEditando(undefined);
    setDialogOpen(true);
  }

  function abrirEditar(v: ViajeFila, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setEditando(v);
    setDialogOpen(true);
  }

  function handleEliminar(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("¿Eliminar este viaje? Se borran también sus inscriptos, costos y pagos.")) return;
    setBorrandoId(id);
    startTransition(async () => {
      try {
        await eliminarViaje(id);
        toast.success("Viaje eliminado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo eliminar el viaje.");
      }
      setBorrandoId(null);
    });
  }

  const ordenados = [...viajes].sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio));

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Viajes</h1>
          <p className="text-muted-foreground text-sm">
            Inscripción, equipo, costos y pagos de los viajes a empresas y congresos.
          </p>
        </div>
        <Button size="sm" onClick={abrirNuevo}>
          <Plus className="size-4" />
          Nuevo viaje
        </Button>
      </div>

      {ordenados.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          Todavía no hay viajes cargados.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ordenados.map((v) => (
            <Link key={v.id} href={`/viajes/${v.id}`}>
              <Card className="hover:border-primary/50 h-full transition-colors">
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                  <CardTitle className="text-base leading-tight">{v.nombre}</CardTitle>
                  <Badge variant="outline" className={ESTADO_BADGE[v.estado]}>
                    {labelEstadoViaje(v.estado)}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                    <MapPin className="size-3.5" />
                    {v.destino}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatFecha(v.fecha_inicio)}
                    {v.fecha_fin ? ` – ${formatFecha(v.fecha_fin)}` : ""}
                  </p>
                  <p className="flex items-center gap-1.5 text-sm">
                    <Users className="text-muted-foreground size-3.5" />
                    {v.inscriptos_confirmados} confirmado{v.inscriptos_confirmados !== 1 ? "s" : ""}
                    {v.cupo_maximo ? ` / ${v.cupo_maximo}` : ""}
                    <span className="text-muted-foreground">
                      ({v.inscriptos_total} inscripto{v.inscriptos_total !== 1 ? "s" : ""})
                    </span>
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    {v.asignados.length > 0 ? (
                      <UserAvatarStack usuarios={v.asignados} size="sm" max={4} />
                    ) : (
                      <span className="text-muted-foreground text-xs">Sin equipo asignado</span>
                    )}
                    <div className="flex">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={(e) => abrirEditar(v, e)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive size-7"
                        disabled={borrandoId === v.id}
                        onClick={(e) => handleEliminar(v.id, e)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <ViajeDialog
        key={editando?.id ?? "nuevo"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        usuarios={usuarios}
        currentUserId={currentUserId}
        viajeInicial={editando}
        asignadosInicialesIds={editando?.asignados.map((a) => a.id)}
      />
    </div>
  );
}
