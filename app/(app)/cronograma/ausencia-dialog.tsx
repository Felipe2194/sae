"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { crearExcepcion } from "./actions";

type UsuarioOpt = { id: string; nombre: string };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  usuarios: UsuarioOpt[];
  usuarioActualId: string;
  canManage: boolean;
};

const TIPO_OPTS = [
  { value: "ausencia", label: "Ausencia" },
  { value: "cambio", label: "Cambio de turno" },
];

export function AusenciaDialog({
  open,
  onOpenChange,
  usuarios,
  usuarioActualId,
  canManage,
}: Props) {
  const [pending, startTransition] = useTransition();
  const hoy = new Date().toISOString().slice(0, 10);

  // Sin permiso de gestión, solo puede marcar su propia ausencia.
  const [usuarioId, setUsuarioId] = useState(
    canManage ? "" : usuarioActualId,
  );
  const [fecha, setFecha] = useState(hoy);
  const [tipo, setTipo] = useState("ausencia");
  const [nota, setNota] = useState("");

  const opcionesUsuario = canManage
    ? usuarios
    : usuarios.filter((u) => u.id === usuarioActualId);

  const USUARIO_ITEMS = Object.fromEntries(opcionesUsuario.map((u) => [u.id, u.nombre]));
  const TIPO_ITEMS = Object.fromEntries(TIPO_OPTS.map((t) => [t.value, t.label]));

  function resetForm() {
    setUsuarioId(canManage ? "" : usuarioActualId);
    setFecha(hoy);
    setTipo("ausencia");
    setNota("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!usuarioId || !fecha) return;
    startTransition(async () => {
      await crearExcepcion({
        usuario_id: usuarioId,
        fecha,
        tipo: tipo as "ausencia" | "cambio",
        nota: nota.trim() || null,
      });
      resetForm();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Marcar ausencia</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          {canManage && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Persona</Label>
              <Select value={usuarioId} onValueChange={(v) => setUsuarioId(v ?? "")} items={USUARIO_ITEMS} required>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Seleccioná una persona" />
                </SelectTrigger>
                <SelectContent>
                  {opcionesUsuario.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Fecha</Label>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
              className="h-9 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v ?? "")} items={TIPO_ITEMS}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPO_OPTS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Nota (opcional)</Label>
            <Textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Motivo, a quién cubre, etc."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={pending || !usuarioId || !fecha}>
              {pending ? "Guardando…" : "Marcar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
