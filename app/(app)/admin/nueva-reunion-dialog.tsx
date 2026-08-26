"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { crearReunion } from "./actions";

type Usuario = { id: string; nombre: string };

// Al elegir la hora de inicio, adelanta la hora de fin en una hora como
// valor inicial cómodo — el usuario la puede pisar igual.
function sumarUnaHora(hora: string): string {
  const [h, m] = hora.split(":").map(Number);
  const hh = (h + 1) % 24;
  return `${String(hh).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function NuevaReunionDialog({ usuarios }: { usuarios: Usuario[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState("");
  const [horaInicio, setHoraInicio] = useState("10:00");
  const [horaFin, setHoraFin] = useState("11:00");
  const [responsableId, setResponsableId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const RESPONSABLE_ITEMS = {
    _none: "Sin asignar",
    ...Object.fromEntries(usuarios.map((u) => [u.id, u.nombre])),
  };

  function resetForm() {
    setTitulo("");
    setDescripcion("");
    setFecha("");
    setHoraInicio("10:00");
    setHoraFin("11:00");
    setResponsableId("");
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim() || !fecha) return;
    setError(null);
    startTransition(async () => {
      try {
        const { sincronizada, error: syncError } = await crearReunion({
          titulo: titulo.trim(),
          descripcion: descripcion.trim(),
          fecha,
          horaInicio,
          horaFin,
          responsableId: responsableId || null,
        });
        if (sincronizada) {
          toast.success("Reunión creada y agendada en Google Calendar.");
        } else if (syncError) {
          toast.warning(
            "La reunión se creó, pero no se pudo agendar en Google Calendar.",
            { description: syncError },
          );
        } else {
          toast.success(
            "Reunión creada (sin Google Calendar: no hay credenciales configuradas).",
          );
        }
        resetForm();
        setOpen(false);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "No se pudo crear la reunión.",
        );
      }
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <CalendarPlus className="size-4" />
        Nueva reunión
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva reunión</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nr-titulo" className="text-xs">
                Título *
              </Label>
              <Input
                id="nr-titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Reunión semanal de secretaría"
                required
                autoFocus
                className="h-10"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nr-fecha" className="text-xs">
                  Fecha *
                </Label>
                <Input
                  id="nr-fecha"
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  required
                  className="h-9"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nr-hora-inicio" className="text-xs">
                  Hora inicio *
                </Label>
                <Input
                  id="nr-hora-inicio"
                  type="time"
                  value={horaInicio}
                  onChange={(e) => {
                    setHoraInicio(e.target.value);
                    setHoraFin(sumarUnaHora(e.target.value));
                  }}
                  required
                  className="h-9"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nr-hora-fin" className="text-xs">
                  Hora fin *
                </Label>
                <Input
                  id="nr-hora-fin"
                  type="time"
                  value={horaFin}
                  onChange={(e) => setHoraFin(e.target.value)}
                  required
                  className="h-9"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Responsable</Label>
              <Select
                value={responsableId || "_none"}
                onValueChange={(v) =>
                  setResponsableId(!v || v === "_none" ? "" : v)
                }
                items={RESPONSABLE_ITEMS}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sin asignar</SelectItem>
                  {usuarios.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nr-desc" className="text-xs">
                Descripción / orden del día
              </Label>
              <Textarea
                id="nr-desc"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Temas a tratar..."
                rows={3}
              />
            </div>

            {error && <p className="text-destructive text-xs">{error}</p>}

            <DialogFooter>
              <Button
                type="submit"
                disabled={isPending || !titulo.trim() || !fecha}
              >
                {isPending ? "Creando..." : "Crear reunión"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
