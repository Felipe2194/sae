"use client";

import { useEffect, useState, useTransition } from "react";
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
import {
  crearVisita,
  actualizarVisita,
  obtenerVisitasDelDia,
  type VisitaInput,
  type VisitaDelDia,
} from "./actions";
import {
  TIPOS_VISITA,
  ESTADOS_VISITA,
  CARGOS_CONTACTO_SUGERIDOS,
  PROVINCIAS_ARGENTINAS,
  generarOpcionesHorario,
  emailValido,
  telefonoValido,
} from "./tipos";
import type { ColegioFila, UsuarioOption, VisitaFila } from "./page";

const SIN_PROVINCIA = "_none";
const SIN_HORA = "_none";
const HORARIOS_DISPONIBLES = generarOpcionesHorario();
// Al crear, solo Pendiente/Confirmado tienen sentido — Realizado, Cancelado
// y Reprogramado son estados a los que se llega *después*, editando la
// visita, y solo estorban en el alta (ver pedido del equipo).
const ESTADOS_VISITA_CREACION = ESTADOS_VISITA.filter(
  (e) => e.value === "pendiente" || e.value === "confirmado",
);

function formatHora(hora: string | null): string {
  return hora ? hora.slice(0, 5) : "";
}

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
  const [provincia, setProvincia] = useState(visitaInicial?.provincia ?? "");
  const [fecha, setFecha] = useState(visitaInicial?.fecha ?? "");
  const [horaInicio, setHoraInicio] = useState(
    formatHora(visitaInicial?.hora_inicio ?? null),
  );
  const [horaFin, setHoraFin] = useState(
    formatHora(visitaInicial?.hora_fin ?? null),
  );
  const [tipo, setTipo] = useState<TipoVisita>(
    visitaInicial?.tipo ?? "visita_colegio",
  );
  // Al crear, arranca en Confirmado: anotar la visita ya implica que quedó
  // acordada con el colegio — Pendiente queda como excepción manual.
  const [estado, setEstado] = useState<EstadoVisita>(
    visitaInicial?.estado ?? "confirmado",
  );
  const [visitasDelDia, setVisitasDelDia] = useState<VisitaDelDia[]>([]);
  const [cantAlumnos, setCantAlumnos] = useState(
    visitaInicial?.cant_alumnos?.toString() ?? "",
  );
  // Vacío por defecto: quiénes participaron se sabe recién cuando la visita
  // se hizo, no al agendarla — ver bloque condicionado a estado==='realizado'
  // más abajo.
  const [integrantesIds, setIntegrantesIds] = useState<string[]>(
    visitaInicial?.integrantes.map((i) => i.id) ?? [],
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

  const emailInvalido = !emailValido(contactoEmail);
  const telefonoInvalido = !telefonoValido(contactoTelefono);

  const TIPO_ITEMS = Object.fromEntries(TIPOS_VISITA.map((t) => [t.value, t.label]));
  const ESTADOS_VISITA_MOSTRADOS = isEdit ? ESTADOS_VISITA : ESTADOS_VISITA_CREACION;
  const ESTADO_ITEMS = Object.fromEntries(
    ESTADOS_VISITA_MOSTRADOS.map((e) => [e.value, e.label]),
  );
  const PROVINCIA_ITEMS = {
    [SIN_PROVINCIA]: "Sin definir",
    ...Object.fromEntries(PROVINCIAS_ARGENTINAS.map((p) => [p, p])),
  };
  const HORA_ITEMS = {
    [SIN_HORA]: "Sin definir",
    ...Object.fromEntries(HORARIOS_DISPONIBLES.map((h) => [h, h])),
  };
  const colegioOptions: ColegioOption[] = colegios.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    ciudad: c.ciudad,
    provincia: c.provincia,
  }));
  // Sugerencias de ciudad: lo que ya se cargó en otros colegios, para no
  // terminar con variantes de escritura de la misma localidad.
  const ciudadesSugeridas = colegios
    .map((c) => c.ciudad)
    .filter((c): c is string => !!c);

  function seleccionarColegio(c: ColegioOption) {
    setColegioId(c.id);
    setColegioNombre(c.nombre);
    setCiudad(c.ciudad ?? "");
    setProvincia(c.provincia ?? "");
  }

  function cambiarNombreColegio(texto: string) {
    setColegioNombre(texto);
    // Cualquier edición manual del nombre invalida la selección previa: si
    // el texto ya no coincide con el colegio elegido, tratamos esto como
    // "todavía sin resolver" hasta que el usuario elija o cree uno nuevo.
    setColegioId(null);
  }

  // Al elegir la fecha, avisa qué otras visitas ya están anotadas ese día y
  // en qué horario, para no terminar pisando un horario ya ocupado.
  useEffect(() => {
    let cancelado = false;
    const promesa = fecha
      ? obtenerVisitasDelDia(fecha, visitaInicial?.id)
      : Promise.resolve([]);
    promesa.then((filas) => {
      if (!cancelado) setVisitasDelDia(filas);
    });
    return () => {
      cancelado = true;
    };
  }, [fecha, visitaInicial?.id]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fecha || !colegioNombre.trim() || emailInvalido || telefonoInvalido) return;
    setError(null);

    const payload: VisitaInput = {
      colegioId,
      colegioNombreNuevo: colegioId ? undefined : colegioNombre.trim(),
      ciudad: ciudad.trim() || null,
      provincia: provincia || null,
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
                ? "Colegio existente — se completan ciudad y provincia si ya las tenía cargadas."
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
              <Label className="text-sm">Provincia</Label>
              <Select
                value={provincia || SIN_PROVINCIA}
                onValueChange={(v) => setProvincia(v === SIN_PROVINCIA ? "" : (v ?? ""))}
                items={PROVINCIA_ITEMS}
              >
                <SelectTrigger className="h-11 w-full text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_PROVINCIA}>Sin definir</SelectItem>
                  {PROVINCIAS_ARGENTINAS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Select
                value={horaInicio || SIN_HORA}
                onValueChange={(v) => setHoraInicio(v === SIN_HORA ? "" : (v ?? ""))}
                items={HORA_ITEMS}
              >
                <SelectTrigger className="h-11 w-full text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_HORA}>Sin definir</SelectItem>
                  {HORARIOS_DISPONIBLES.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Hora fin</Label>
              <Select
                value={horaFin || SIN_HORA}
                onValueChange={(v) => setHoraFin(v === SIN_HORA ? "" : (v ?? ""))}
                items={HORA_ITEMS}
              >
                <SelectTrigger className="h-11 w-full text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_HORA}>Sin definir</SelectItem>
                  {HORARIOS_DISPONIBLES.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {visitasDelDia.length > 0 && (
            <div className="rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-amber-900">
              <p className="text-xs font-medium">
                Ya hay {visitasDelDia.length} visita
                {visitasDelDia.length !== 1 ? "s" : ""} registrada
                {visitasDelDia.length !== 1 ? "s" : ""} ese día:
              </p>
              <ul className="mt-1 flex flex-col gap-0.5 text-xs">
                {visitasDelDia.map((v) => (
                  <li key={v.id}>
                    {v.hora_inicio ? formatHora(v.hora_inicio) : "sin hora"}
                    {v.hora_fin ? `–${formatHora(v.hora_fin)}` : ""} · {v.colegio_nombre}
                  </li>
                ))}
              </ul>
            </div>
          )}

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
                onValueChange={(v) => setEstado((v ?? "confirmado") as EstadoVisita)}
                items={ESTADO_ITEMS}
              >
                <SelectTrigger className="h-11 w-full text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS_VISITA_MOSTRADOS.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isEdit && (
                <p className="text-muted-foreground text-xs">
                  Realizado, Cancelado y Reprogramado se cambian después,
                  editando la visita.
                </p>
              )}
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
            {/* Quien coordinó la visita es quien la cargó: se asigna solo al
                crearla (ver crearVisita) y no se puede cambiar. */}
            {isEdit && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">Cargada por</Label>
                <p className="text-muted-foreground flex h-11 items-center text-base">
                  {visitaInicial.asignado_por_nombre ?? "—"}
                </p>
              </div>
            )}
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
              {emailInvalido && (
                <p className="text-destructive text-xs">Email inválido.</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Teléfono del contacto</Label>
              <Input
                type="tel"
                value={contactoTelefono}
                onChange={(e) => setContactoTelefono(e.target.value)}
                className="h-11 text-base"
              />
              {telefonoInvalido && (
                <p className="text-destructive text-xs">Teléfono inválido.</p>
              )}
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
              disabled={
                isPending ||
                !fecha ||
                !colegioNombre.trim() ||
                emailInvalido ||
                telefonoInvalido
              }
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
