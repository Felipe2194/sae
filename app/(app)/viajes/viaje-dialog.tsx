"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
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
import { AsignadosPicker } from "@/components/features/asignados-picker";
import type { EstadoViaje } from "@/types/database";
import { crearViaje, actualizarViaje, type ViajeInput } from "./actions";
import { ESTADOS_VIAJE } from "./tipos";
import type { UsuarioOption } from "./page";
import {
  CAMPOS_CONFIGURABLES,
  CAMPOS_FORMULARIO_DEFAULT,
  CAMPO_LABEL,
  ESTADO_CAMPO_OPCIONES,
  normalizarCamposFormulario,
  type CamposFormularioViaje,
  type EstadoCampoFormularioViaje,
} from "@/lib/viajes/campos-formulario";

export type ViajeDialogInicial = {
  id: string;
  nombre: string;
  destino: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  cupo_maximo: number | null;
  precio: number | null;
  estado: EstadoViaje;
  descripcion_publica: string | null;
  info_participantes: string | null;
  campos_formulario: CamposFormularioViaje;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  usuarios: UsuarioOption[];
  currentUserId: string;
  viajeInicial?: ViajeDialogInicial;
  asignadosInicialesIds?: string[];
};

export function ViajeDialog({
  open,
  onOpenChange,
  usuarios,
  currentUserId,
  viajeInicial,
  asignadosInicialesIds,
}: Props) {
  const isEdit = !!viajeInicial;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState(viajeInicial?.nombre ?? "");
  const [destino, setDestino] = useState(viajeInicial?.destino ?? "");
  const [fechaInicio, setFechaInicio] = useState(viajeInicial?.fecha_inicio ?? "");
  const [fechaFin, setFechaFin] = useState(viajeInicial?.fecha_fin ?? "");
  const [cupoMaximo, setCupoMaximo] = useState(viajeInicial?.cupo_maximo?.toString() ?? "");
  const [precio, setPrecio] = useState(viajeInicial?.precio?.toString() ?? "");
  const [estado, setEstado] = useState<EstadoViaje>(viajeInicial?.estado ?? "borrador");
  const [descripcionPublica, setDescripcionPublica] = useState(
    viajeInicial?.descripcion_publica ?? "",
  );
  const [infoParticipantes, setInfoParticipantes] = useState(
    viajeInicial?.info_participantes ?? "",
  );
  const [camposFormulario, setCamposFormulario] = useState<CamposFormularioViaje>(
    normalizarCamposFormulario(viajeInicial?.campos_formulario),
  );
  const [asignadosIds, setAsignadosIds] = useState<string[]>(
    asignadosInicialesIds ?? (isEdit ? [] : [currentUserId]),
  );

  const ESTADO_ITEMS = Object.fromEntries(ESTADOS_VIAJE.map((e) => [e.value, e.label]));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !destino.trim() || !fechaInicio) return;
    setError(null);

    const payload: ViajeInput = {
      nombre: nombre.trim(),
      destino: destino.trim(),
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin || null,
      cupo_maximo: cupoMaximo ? parseInt(cupoMaximo, 10) : null,
      precio: precio ? parseFloat(precio) : null,
      estado,
      descripcion_publica: descripcionPublica.trim() || null,
      info_participantes: infoParticipantes.trim() || null,
      campos_formulario: camposFormulario,
      asignados_ids: asignadosIds,
    };

    startTransition(async () => {
      try {
        if (isEdit) {
          await actualizarViaje(viajeInicial.id, payload);
          toast.success("Viaje actualizado.");
        } else {
          await crearViaje(payload);
          toast.success("Viaje creado.");
        }
        onOpenChange(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar el viaje.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {isEdit ? "Editar viaje" : "Nuevo viaje"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-1 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Nombre *</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Congreso Nacional 2026"
              required
              className="h-11 text-base"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Destino *</Label>
            <Input
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              placeholder="Ej: Neuquén"
              required
              className="h-11 text-base"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Fecha de inicio *</Label>
              <Input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                required
                className="h-11 text-base"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Fecha de fin</Label>
              <Input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="h-11 text-base"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Cupo máximo</Label>
              <Input
                type="number"
                min={0}
                value={cupoMaximo}
                onChange={(e) => setCupoMaximo(e.target.value)}
                placeholder="Sin límite"
                className="h-11 text-base"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Precio del viaje</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                placeholder="Ej: 200000"
                className="h-11 text-base"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Estado</Label>
            <Select
              value={estado}
              onValueChange={(v) => setEstado((v ?? "borrador") as EstadoViaje)}
              items={ESTADO_ITEMS}
            >
              <SelectTrigger className="h-11 w-full text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS_VIAJE.map((e) => (
                  <SelectItem key={e.value} value={e.value}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Solo con &quot;Inscripciones abiertas&quot; el link público acepta anotados nuevos.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Equipo organizador</Label>
            <AsignadosPicker
              usuarios={usuarios}
              selectedIds={asignadosIds}
              onChange={setAsignadosIds}
              placeholder="¿Quién organiza este viaje?"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-sm">Campos del formulario público</Label>
            <p className="text-muted-foreground -mt-1 text-xs">
              Nombre, apellido y DNI siempre se piden. Elegí qué hacer con el resto.
            </p>
            <div className="flex flex-col gap-2">
              {CAMPOS_CONFIGURABLES.map((campo) => {
                const items = Object.fromEntries(
                  ESTADO_CAMPO_OPCIONES.map((o) => [o.value, o.label]),
                );
                return (
                  <div key={campo} className="flex items-center justify-between gap-3">
                    <span className="text-sm">{CAMPO_LABEL[campo]}</span>
                    <Select
                      value={camposFormulario[campo]}
                      onValueChange={(v) =>
                        setCamposFormulario((prev) => ({
                          ...prev,
                          [campo]: (v ?? CAMPOS_FORMULARIO_DEFAULT[campo]) as EstadoCampoFormularioViaje,
                        }))
                      }
                      items={items}
                    >
                      <SelectTrigger className="h-9 w-40 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ESTADO_CAMPO_OPCIONES.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Descripción pública</Label>
            <Textarea
              value={descripcionPublica}
              onChange={(e) => setDescripcionPublica(e.target.value)}
              rows={2}
              placeholder="Lo que ve quien se quiere anotar (link público)"
              className="text-base"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Info para confirmados</Label>
            <Textarea
              value={infoParticipantes}
              onChange={(e) => setInfoParticipantes(e.target.value)}
              rows={2}
              placeholder="Link de WhatsApp, cronograma, notas internas"
              className="text-base"
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <DialogFooter>
            <Button
              type="submit"
              size="lg"
              className="h-11 text-base"
              disabled={isPending || !nombre.trim() || !destino.trim() || !fechaInicio}
            >
              {isPending ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear viaje"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
