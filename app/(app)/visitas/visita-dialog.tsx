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
import { ColegioCombobox, type ColegioOption } from "@/components/features/colegio-combobox";
import { SugerenciaInput } from "@/components/features/sugerencia-input";
import type { EstadoVisita, TipoVisita } from "@/types/database";
import { crearVisita, actualizarVisita, type VisitaInput } from "./actions";
import {
  TIPOS_VISITA,
  ESTADOS_VISITA,
  CARGOS_CONTACTO_SUGERIDOS,
} from "./tipos";
import type { ColegioFila, UsuarioOption, VisitaFila } from "./page";

const SIN_ASIGNAR = "_none";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  colegios: ColegioFila[];
  usuarios: UsuarioOption[];
  visitaInicial?: VisitaFila;
};

export function VisitaDialog({
  open,
  onOpenChange,
  colegios,
  usuarios,
  visitaInicial,
}: Props) {
  const isEdit = !!visitaInicial;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [colegioId, setColegioId] = useState<string | null>(
    visitaInicial?.colegio_id ?? null,
  );
  const [colegioNombre, setColegioNombre] = useState(
    visitaInicial?.colegio_nombre ?? "",
  );
  const [ciudad, setCiudad] = useState(visitaInicial?.ciudad ?? "");
  const [zona, setZona] = useState(visitaInicial?.zona ?? "");
  const [fecha, setFecha] = useState(visitaInicial?.fecha ?? "");
  const [horaInicio, setHoraInicio] = useState(
    visitaInicial?.hora_inicio?.slice(0, 5) ?? "",
  );
  const [horaFin, setHoraFin] = useState(
    visitaInicial?.hora_fin?.slice(0, 5) ?? "",
  );
  const [tipo, setTipo] = useState<TipoVisita>(
    visitaInicial?.tipo ?? "visita_colegio",
  );
  const [estado, setEstado] = useState<EstadoVisita>(
    visitaInicial?.estado ?? "pendiente",
  );
  const [cantAlumnos, setCantAlumnos] = useState(
    visitaInicial?.cant_alumnos?.toString() ?? "",
  );
  // Vacío por defecto: quiénes participaron se sabe recién cuando la visita
  // se hizo, no al agendarla — ver bloque condicionado a estado==='realizado'
  // más abajo.
  const [integrantesIds, setIntegrantesIds] = useState<string[]>(
    visitaInicial?.integrantes.map((i) => i.id) ?? [],
  );
  const [asignadoPorId, setAsignadoPorId] = useState(
    visitaInicial?.asignado_por_id ?? "",
  );
  const [contactoNombre, setContactoNombre] = useState(
    visitaInicial?.contacto_nombre ?? "",
  );
  const [contactoCargo, setContactoCargo] = useState(
    visitaInicial?.contacto_cargo ?? "",
  );
  const [contactoEmail, setContactoEmail] = useState(
    visitaInicial?.contacto_email ?? "",
  );
  const [contactoTelefono, setContactoTelefono] = useState(
    visitaInicial?.contacto_telefono ?? "",
  );
  const [observaciones, setObservaciones] = useState(
    visitaInicial?.observaciones ?? "",
  );

  const TIPO_ITEMS = Object.fromEntries(TIPOS_VISITA.map((t) => [t.value, t.label]));
  const ESTADO_ITEMS = Object.fromEntries(
    ESTADOS_VISITA.map((e) => [e.value, e.label]),
  );
  const ASIGNADO_ITEMS = {
    [SIN_ASIGNAR]: "Sin asignar",
    ...Object.fromEntries(usuarios.map((u) => [u.id, u.nombre])),
  };
  const colegioOptions: ColegioOption[] = colegios.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    ciudad: c.ciudad,
    zona: c.zona,
  }));
  // Sugerencias de ciudad/zona: lo que ya se cargó en otros colegios, para
  // no terminar con variantes de escritura de la misma localidad.
  const ciudadesSugeridas = colegios
    .map((c) => c.ciudad)
    .filter((c): c is string => !!c);
  const zonasSugeridas = colegios
    .map((c) => c.zona)
    .filter((z): z is string => !!z);

  function seleccionarColegio(c: ColegioOption) {
    setColegioId(c.id);
    setColegioNombre(c.nombre);
    setCiudad(c.ciudad ?? "");
    setZona(c.zona ?? "");
  }

  function cambiarNombreColegio(texto: string) {
    setColegioNombre(texto);
    // Cualquier edición manual del nombre invalida la selección previa: si
    // el texto ya no coincide con el colegio elegido, tratamos esto como
    // "todavía sin resolver" hasta que el usuario elija o cree uno nuevo.
    setColegioId(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fecha || !colegioNombre.trim()) return;
    setError(null);

    const payload: VisitaInput = {
      colegioId,
      colegioNombreNuevo: colegioId ? undefined : colegioNombre.trim(),
      ciudad: ciudad.trim() || null,
      zona: zona.trim() || null,
      fecha,
      horaInicio: horaInicio || null,
      horaFin: horaFin || null,
      tipo,
      estado,
      cantAlumnos: cantAlumnos ? parseInt(cantAlumnos, 10) : null,
      contactoNombre: contactoNombre.trim() || null,
      contactoCargo: contactoCargo.trim() || null,
      contactoEmail: contactoEmail.trim() || null,
      contactoTelefono: contactoTelefono.trim() || null,
      observaciones: observaciones.trim() || null,
      asignadoPorId: asignadoPorId === SIN_ASIGNAR || !asignadoPorId ? null : asignadoPorId,
      integrantesIds,
    };

    startTransition(async () => {
      try {
        const { sincronizada, error: syncError } = isEdit
          ? await actualizarVisita(visitaInicial.id, payload)
          : await crearVisita(payload);

        if (syncError) {
          toast.warning("La visita se guardó, pero no se pudo sincronizar con Google Calendar.", {
            description: syncError,
          });
        } else if (sincronizada) {
          toast.success("Visita guardada y sincronizada en Google Calendar.");
        } else {
          toast.success("Visita guardada.");
        }
        onOpenChange(false);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "No se pudo guardar la visita.",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {isEdit ? "Editar visita" : "Nueva visita"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-1 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Colegio / Evento *</Label>
            <ColegioCombobox
              colegios={colegioOptions}
              nombre={colegioNombre}
              colegioSeleccionadoId={colegioId}
              onChangeNombre={cambiarNombreColegio}
              onSeleccionar={seleccionarColegio}
              onNuevo={(nombre) => {
                setColegioId(null);
                setColegioNombre(nombre);
              }}
            />
            <p className="text-muted-foreground text-xs">
              {colegioId
                ? "Colegio existente — se completan ciudad y zona si ya las tenía cargadas."
                : colegioNombre.trim()
                  ? "Se va a crear como colegio/evento nuevo."
                  : "Escribí para buscar en el directorio o cargar uno nuevo."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Ciudad / Localidad</Label>
              <SugerenciaInput
                value={ciudad}
                onChange={setCiudad}
                sugerencias={ciudadesSugeridas}
                placeholder="Ej: Villa María"
                className="h-11 text-base"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Zona / Región</Label>
              <SugerenciaInput
                value={zona}
                onChange={setZona}
                sugerencias={zonasSugeridas}
                className="h-11 text-base"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Fecha *</Label>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
                className="h-11 text-base"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Hora inicio</Label>
              <Input
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                className="h-11 text-base"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Hora fin</Label>
              <Input
                type="time"
                value={horaFin}
                onChange={(e) => setHoraFin(e.target.value)}
                className="h-11 text-base"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Tipo de visita</Label>
              <Select
                value={tipo}
                onValueChange={(v) => setTipo((v ?? "visita_colegio") as TipoVisita)}
                items={TIPO_ITEMS}
              >
                <SelectTrigger className="h-11 w-full text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_VISITA.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Estado</Label>
              <Select
                value={estado}
                onValueChange={(v) => setEstado((v ?? "pendiente") as EstadoVisita)}
                items={ESTADO_ITEMS}
              >
                <SelectTrigger className="h-11 w-full text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS_VISITA.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Cant. alumnos contactados</Label>
              <Input
                type="number"
                min={0}
                value={cantAlumnos}
                onChange={(e) => setCantAlumnos(e.target.value)}
                className="h-11 text-base"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Asignó (coordinó)</Label>
              <Select
                value={asignadoPorId || SIN_ASIGNAR}
                onValueChange={(v) => setAsignadoPorId(v ?? SIN_ASIGNAR)}
                items={ASIGNADO_ITEMS}
              >
                <SelectTrigger className="h-11 w-full text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_ASIGNAR}>Sin asignar</SelectItem>
                  {usuarios.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Integrante(s) SAE</Label>
            <AsignadosPicker
              usuarios={usuarios}
              selectedIds={integrantesIds}
              onChange={setIntegrantesIds}
              placeholder="¿Quiénes van a ir? (si ya se sabe)"
            />
            <p className="text-muted-foreground text-xs">
              Si todavía no está definido, se puede dejar vacío y completarlo
              cuando se marque la visita como Realizado.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Nombre del contacto</Label>
              <Input
                value={contactoNombre}
                onChange={(e) => setContactoNombre(e.target.value)}
                className="h-11 text-base"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Cargo</Label>
              <Input
                value={contactoCargo}
                onChange={(e) => setContactoCargo(e.target.value)}
                list="cargos-contacto-sugeridos"
                className="h-11 text-base"
              />
              <datalist id="cargos-contacto-sugeridos">
                {CARGOS_CONTACTO_SUGERIDOS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Email del contacto</Label>
              <Input
                type="email"
                value={contactoEmail}
                onChange={(e) => setContactoEmail(e.target.value)}
                className="h-11 text-base"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Teléfono del contacto</Label>
              <Input
                value={contactoTelefono}
                onChange={(e) => setContactoTelefono(e.target.value)}
                className="h-11 text-base"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Observaciones</Label>
            <Textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              className="text-base"
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <DialogFooter>
            <Button
              type="submit"
              size="lg"
              className="h-11 text-base"
              disabled={isPending || !fecha || !colegioNombre.trim()}
            >
              {isPending
                ? "Guardando..."
                : isEdit
                  ? "Guardar cambios"
                  : "Crear visita"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
