"use client";

import { useState, useTransition } from "react";
import { ArchiveRestore, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchTareasCierre,
  reactivarArea,
  type TareaCierreRow,
} from "./actions";

type Props = {
  areaId: string;
  label: string;
  labelPendiente: string;
  variant?: "ghost" | "outline";
  size?: "sm";
  className?: string;
  onReactivada?: () => void;
};

// Botón de "Reactivar área" compartido entre la lista de áreas archivadas
// (/proyectos) y el detalle de un proyecto (/proyectos/[areaId]). Antes de reactivar,
// busca si el área tiene tareas del último cierre de temporada
// (fetchTareasCierre) para ofrecer repetirlas o arrancar en blanco — si no
// hay nada que ofrecer, reactiva directo sin mostrar el diálogo.
export function ReactivarAreaBoton({
  areaId,
  label,
  labelPendiente,
  variant = "outline",
  size = "sm",
  className,
  onReactivada,
}: Props) {
  const [buscando, setBuscando] = useState(false);
  const [open, setOpen] = useState(false);
  const [sugeridas, setSugeridas] = useState<TareaCierreRow[]>([]);
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  async function handleClick() {
    setBuscando(true);
    const rows = await fetchTareasCierre(areaId);
    setBuscando(false);
    if (rows.length === 0) {
      startTransition(async () => {
        await reactivarArea(areaId);
        onReactivada?.();
      });
      return;
    }
    setSugeridas(rows);
    setSeleccionadas(new Set(rows.map((r) => r.id)));
    setOpen(true);
  }

  function toggle(id: string) {
    setSeleccionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirmar(conTareas: boolean) {
    const titulos = conTareas
      ? sugeridas.filter((r) => seleccionadas.has(r.id)).map((r) => r.titulo)
      : [];
    startTransition(async () => {
      await reactivarArea(areaId, titulos);
      setOpen(false);
      onReactivada?.();
    });
  }

  const pendiente = buscando || isPending;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleClick}
        disabled={pendiente}
      >
        {pendiente ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <ArchiveRestore className="size-3.5" />
        )}
        {pendiente ? labelPendiente : label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reactivar área</DialogTitle>
            <DialogDescription>
              La última vez que se cerró esta área quedaron {sugeridas.length}{" "}
              {sugeridas.length === 1
                ? "tarea sin terminar"
                : "tareas sin terminar"}
              . Elegí cuáles recrear para esta temporada, o arrancá en blanco.
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
            {sugeridas.map((t) => (
              <label
                key={t.id}
                className="hover:bg-muted/50 flex items-center gap-2.5 rounded-md px-1.5 py-1 text-sm"
              >
                <Checkbox
                  checked={seleccionadas.has(t.id)}
                  onCheckedChange={() => toggle(t.id)}
                />
                <span className="min-w-0 flex-1 truncate">{t.titulo}</span>
              </label>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => confirmar(false)}
              disabled={isPending}
            >
              Empezar en blanco
            </Button>
            <Button
              size="sm"
              onClick={() => confirmar(true)}
              disabled={isPending || seleccionadas.size === 0}
            >
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                `Reactivar con ${seleccionadas.size} ${seleccionadas.size === 1 ? "tarea" : "tareas"}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
