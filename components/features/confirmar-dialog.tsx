"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Opciones = {
  titulo: string;
  descripcion?: string;
  // Texto del botón que confirma ("Eliminar", "Regenerar"…).
  confirmar?: string;
  // Acción destructiva: el botón de confirmar va en rojo.
  destructivo?: boolean;
};

// Reemplazo del confirm() nativo del navegador, que rompía con el resto de
// la interfaz (otra tipografía, otro idioma según el sistema, sin tema
// oscuro) y en el celular tapa la pantalla entera.
//
//   const [confirmar, dialogoConfirmar] = useConfirmar();
//   …
//   if (!(await confirmar({ titulo: "¿Eliminar este pago?", destructivo: true }))) return;
//   …
//   return (<>… {dialogoConfirmar}</>);
export function useConfirmar(): [
  (opciones: Opciones) => Promise<boolean>,
  React.ReactNode,
] {
  const [opciones, setOpciones] = useState<Opciones | null>(null);
  const [abierto, setAbierto] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirmar = useCallback((o: Opciones) => {
    setOpciones(o);
    setAbierto(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function cerrar(ok: boolean) {
    setAbierto(false);
    resolver.current?.(ok);
    resolver.current = null;
  }

  const dialogo = (
    <Dialog
      open={abierto}
      onOpenChange={(o) => {
        if (!o) cerrar(false);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{opciones?.titulo}</DialogTitle>
          {opciones?.descripcion && (
            <DialogDescription>{opciones.descripcion}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => cerrar(false)}>
            Cancelar
          </Button>
          <Button
            variant={opciones?.destructivo ? "destructive" : "default"}
            onClick={() => cerrar(true)}
          >
            {opciones?.confirmar ?? "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return [confirmar, dialogo];
}
