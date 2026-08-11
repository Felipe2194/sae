"use client";

import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { crearTurno, actualizarTurno } from "./actions";
import type { TurnoData } from "./page";

const DIAS = [
  { value: 0, label: "Lunes" },
  { value: 1, label: "Martes" },
  { value: 2, label: "Miércoles" },
  { value: 3, label: "Jueves" },
  { value: 4, label: "Viernes" },
];

type UsuarioOpt = { id: string; nombre: string };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  turno?: TurnoData | null; // null = crear nuevo
  usuarios: UsuarioOpt[];
};

export function TurnoDialog({ open, onOpenChange, turno, usuarios }: Props) {
  const esEdicion = !!turno?.id;
  const [pending, startTransition] = useTransition();

  const hoy = new Date().toISOString().slice(0, 10);

  const [usuarioId, setUsuarioId] = useState(turno?.usuario_id ?? "");
  const [dia, setDia] = useState(String(turno?.dia_semana ?? 0));
  const [inicio, setInicio] = useState(turno?.hora_inicio ?? "08:00");
  const [fin, setFin] = useState(turno?.hora_fin ?? "12:00");
  const [desde, setDesde] = useState(turno?.vigente_desde ?? hoy);
  const [hasta, setHasta] = useState(turno?.vigente_hasta ?? "");

  // Resetear cuando cambia el turno
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset de formulario al cambiar de turno
    setUsuarioId(turno?.usuario_id ?? "");
    setDia(String(turno?.dia_semana ?? 0));
    setInicio(turno?.hora_inicio ?? "08:00");
    setFin(turno?.hora_fin ?? "12:00");
    setDesde(turno?.vigente_desde ?? hoy);
    setHasta(turno?.vigente_hasta ?? "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turno]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!usuarioId) return;

    const data = {
      usuario_id: usuarioId,
      dia_semana: Number(dia),
      hora_inicio: inicio,
      hora_fin: fin,
      vigente_desde: desde,
      vigente_hasta: hasta || null,
    };

    startTransition(async () => {
      if (esEdicion && turno?.id) {
        await actualizarTurno(turno.id, data);
      } else {
        await crearTurno(data);
      }
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{esEdicion ? "Editar turno" : "Nuevo turno"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          {/* Usuario */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Persona</Label>
            <Select value={usuarioId} onValueChange={(v) => setUsuarioId(v ?? "")} required>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Seleccioná una persona" />
              </SelectTrigger>
              <SelectContent>
                {usuarios.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Día */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Día</Label>
            <Select value={dia} onValueChange={(v) => setDia(v ?? "")}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIAS.map((d) => (
                  <SelectItem key={d.value} value={String(d.value)}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Horario */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Hora inicio</Label>
              <Input
                type="time"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                required
                className="h-9 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Hora fin</Label>
              <Input
                type="time"
                value={fin}
                onChange={(e) => setFin(e.target.value)}
                required
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* Vigencia */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Vigente desde</Label>
              <Input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                required
                className="h-9 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Vigente hasta <span className="text-muted-foreground">(opcional)</span></Label>
              <Input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={pending || !usuarioId}>
              {pending ? "Guardando…" : esEdicion ? "Guardar cambios" : "Crear turno"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
