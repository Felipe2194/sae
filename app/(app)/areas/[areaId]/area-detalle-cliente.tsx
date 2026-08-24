"use client";

import { useState, useTransition } from "react";
import { Pencil, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AreaDialog, type UsuarioOption } from "../area-dialog";
import { ReactivarAreaBoton } from "../reactivar-area-boton";
import { archivarArea } from "../actions";

type Props = {
  area: {
    id: string;
    nombre: string;
    descripcion: string | null;
    color: string;
    responsable_id: string | null;
    activa: boolean;
    asignados: { id: string; nombre: string; avatar_color: string | null }[];
  };
  usuarios: UsuarioOption[];
  canManage: boolean;
};

export function AreaDetalleCliente({ area, usuarios, canManage }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmArchivar, setConfirmArchivar] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!canManage) return null;

  function handleArchivar() {
    if (!confirmArchivar) {
      setConfirmArchivar(true);
      return;
    }
    startTransition(async () => {
      await archivarArea(area.id);
      setConfirmArchivar(false);
    });
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="size-3.5" />
          Editar área
        </Button>

        {area.activa ? (
          confirmArchivar ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                ¿Archivar área? Sus tareas sin terminar se archivan con ella.
              </span>
              <Button variant="outline" size="sm" onClick={() => setConfirmArchivar(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" size="sm" onClick={handleArchivar} disabled={isPending}>
                {isPending ? "Archivando..." : "Confirmar"}
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={handleArchivar}
            >
              <Archive className="size-3.5" />
              Archivar área
            </Button>
          )
        ) : (
          <ReactivarAreaBoton
            areaId={area.id}
            label="Reactivar área"
            labelPendiente="Reactivando..."
          />
        )}
      </div>

      <AreaDialog
        open={open}
        onOpenChange={setOpen}
        usuarios={usuarios}
        areaInicial={area}
      />
    </>
  );
}
