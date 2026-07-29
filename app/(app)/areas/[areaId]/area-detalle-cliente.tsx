"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AreaDialog, type UsuarioOption } from "../area-dialog";

type Props = {
  area: {
    id: string;
    nombre: string;
    descripcion: string | null;
    color: string;
    responsable_id: string | null;
  };
  usuarios: UsuarioOption[];
  canManage: boolean;
};

export function AreaDetalleCliente({ area, usuarios, canManage }: Props) {
  const [open, setOpen] = useState(false);

  if (!canManage) return null;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="size-3.5" />
        Editar área
      </Button>

      <AreaDialog
        open={open}
        onOpenChange={setOpen}
        usuarios={usuarios}
        areaInicial={area}
      />
    </>
  );
}
