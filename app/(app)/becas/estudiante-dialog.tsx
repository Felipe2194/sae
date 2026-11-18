"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useConfirmar } from "@/components/features/confirmar-dialog";
import { mensajeDeError } from "@/lib/errores";
import { indiceIncompatibilidades, sonIncompatibles } from "@/lib/becas/conflictos";
import {
  ESTADOS_ASIGNACION,
  labelEstadoAsignacion,
  nombreCompleto,
  type Asignacion,
  type EstadoAsignacion,
  type Estudiante,
  type HistorialBeca,
} from "@/lib/becas/tipos";
import {
  eliminarAsignacion,
  eliminarEstudiante,
  guardarAsignacion,
  guardarEstudiante,
  obtenerHistorial,
} from "./actions";
import type { DatosBecas } from "./becas-cliente";
import { CHIP_ESTADO, Selector } from "./selector";

type Props = DatosBecas & {
  // null = alta de un estudiante nuevo.
  estudiante: Estudiante | null;
  becasDelAnio: Asignacion[];
  onClose: () => void;
  onCreado: (id: string) => void;
};

const SIN_AREA = "_";

export function EstudianteDialog(props: Props) {
  const { estudiante, becasDelAnio, anio, programas, areas, incompatibilidades, esAdmin, onClose, onCreado } = props;
  const [isPending, startTransition] = useTransition();
  const [confirmar, dialogoConfirmar] = useConfirmar();

  const [form, setForm] = useState({
    dni: estudiante?.dni ?? "",
    apellido: estudiante?.apellido ?? "",
    nombre: estudiante?.nombre ?? "",
    legajo: estudiante?.legajo ?? "",
    carrera: estudiante?.carrera ?? "",
    email: estudiante?.email ?? "",
    telefono: estudiante?.telefono ?? "",
    notas: estudiante?.notas ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const campo = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // Becas de otros años: se piden al abrir (la página solo trae las del año elegido).
  const [historial, setHistorial] = useState<HistorialBeca[] | null>(null);
  const estudianteId = estudiante?.id ?? null;
  useEffect(() => {
    if (!estudianteId) return;
    let vigente = true;
    obtenerHistorial(estudianteId)
      .then((h) => {
        if (vigente) setHistorial(h);
      })
      .catch(() => {
        if (vigente) setHistorial([]);
      });
    return () => {
      vigente = false;
    };
  }, [estudianteId]);
  const otrosAnios = (historial ?? []).filter((h) => h.anio !== anio);

  const programaPorId = useMemo(() => new Map(programas.map((p) => [p.id, p])), [programas]);
  const indice = useMemo(() => indiceIncompatibilidades(incompatibilidades), [incompatibilidades]);
  const opcionesArea = [
    { value: SIN_AREA, label: "Sin área asignada" },
    ...areas.map((a) => ({
      value: a.id,
      label: a.departamento ? `${a.departamento} · ${a.nombre}` : a.nombre,
    })),
  ];
  const programasDisponibles = programas.filter(
    (p) => p.activo && !becasDelAnio.some((b) => b.programa_id === p.id),
  );

  // Alta de una beca nueva en el año elegido.
  const [nueva, setNueva] = useState<{ programa_id: string; area_id: string; modulos: string } | null>(null);

  function guardarDatos(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const r = await guardarEstudiante(estudianteId, {
          ...form,
          legajo: form.legajo || null,
          carrera: form.carrera || null,
          email: form.email || null,
          telefono: form.telefono || null,
          notas: form.notas || null,
        });
        if ("error" in r) {
          setError(r.error);
          return;
        }
        toast.success(estudianteId ? "Datos guardados." : "Estudiante creado.");
        if (!estudianteId) onCreado(r.id);
      } catch (err) {
        setError(mensajeDeError(err, "No se pudieron guardar los datos."));
      }
    });
  }

  function actualizarBeca(b: Asignacion, cambios: Partial<Pick<Asignacion, "estado" | "area_id" | "modulos">>) {
    startTransition(async () => {
      try {
        const r = await guardarAsignacion(b.id, { ...b, ...cambios });
        if ("error" in r) toast.error(r.error);
      } catch (err) {
        toast.error(mensajeDeError(err, "No se pudo guardar la beca."));
      }
    });
  }

  async function quitarBeca(b: Asignacion) {
    const ok = await confirmar({
      titulo: `¿Quitar la beca ${programaPorId.get(b.programa_id)?.nombre ?? ""} ${b.anio}?`,
      descripcion:
        "Se borra del historial junto con sus entregas marcadas. Si dejó de tenerla, conviene pasarla a Baja en vez de borrarla.",
      confirmar: "Quitar",
      destructivo: true,
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        const r = await eliminarAsignacion(b.id);
        if ("error" in r) toast.error(r.error);
      } catch (err) {
        toast.error(mensajeDeError(err, "No se pudo quitar la beca."));
      }
    });
  }

  async function agregarBeca() {
    if (!nueva || !estudianteId) return;
    const chocan = becasDelAnio
      .filter((b) => b.estado === "activa" && sonIncompatibles(indice, b.programa_id, nueva.programa_id))
      .map((b) => programaPorId.get(b.programa_id)?.nombre ?? "otra beca");
    if (chocan.length > 0) {
      const ok = await confirmar({
        titulo: "Esta beca es incompatible con otra que ya tiene",
        descripcion: `Ya tiene activa: ${chocan.join(", ")}. Si la agregás igual, va a quedar marcada como conflicto hasta que des de baja una de las dos.`,
        confirmar: "Agregar igual",
        destructivo: true,
      });
      if (!ok) return;
    }
    const modulos = nueva.modulos.trim() === "" ? null : Number(nueva.modulos);
    startTransition(async () => {
      try {
        const r = await guardarAsignacion(null, {
          estudiante_id: estudianteId,
          programa_id: nueva.programa_id,
          anio,
          condicion: null,
          estado: "activa",
          area_id: nueva.area_id === SIN_AREA ? null : nueva.area_id,
          modulos: modulos !== null && Number.isInteger(modulos) ? modulos : null,
          observaciones: null,
        });
        if ("error" in r) toast.error(r.error);
        else setNueva(null);
      } catch (err) {
        toast.error(mensajeDeError(err, "No se pudo agregar la beca."));
      }
    });
  }

  async function borrarEstudiante() {
    if (!estudiante) return;
    const ok = await confirmar({
      titulo: `¿Borrar a ${nombreCompleto(estudiante)}?`,
      descripcion: "Se borran sus datos y todas sus becas de todos los años. No se puede deshacer.",
      confirmar: "Borrar",
      destructivo: true,
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        const r = await eliminarEstudiante(estudiante.id);
        if ("error" in r) toast.error(r.error);
        else {
          toast.success("Estudiante borrado.");
          onClose();
        }
      } catch (err) {
        toast.error(mensajeDeError(err, "No se pudo borrar."));
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{estudiante ? nombreCompleto(estudiante) : "Nuevo estudiante"}</DialogTitle>
          <DialogDescription>
            {estudiante ? `DNI ${estudiante.dni}` : "El DNI identifica al estudiante en todos los listados."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={guardarDatos} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">DNI *</Label>
              <Input value={form.dni} onChange={campo("dni")} inputMode="numeric" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Apellido *</Label>
              <Input value={form.apellido} onChange={campo("apellido")} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Nombre</Label>
              <Input value={form.nombre} onChange={campo("nombre")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Legajo</Label>
              <Input value={form.legajo} onChange={campo("legajo")} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label className="text-xs">Carrera</Label>
              <Input value={form.carrera} onChange={campo("carrera")} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label className="text-xs">Mail</Label>
              <Input type="email" value={form.email} onChange={campo("email")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Teléfono</Label>
              <Input value={form.telefono} onChange={campo("telefono")} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-3">
              <Label className="text-xs">Notas</Label>
              <Textarea value={form.notas} onChange={campo("notas")} rows={2} />
            </div>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            {estudiante && esAdmin ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={borrarEstudiante}
                disabled={isPending}
              >
                <Trash2 className="size-3.5" />
                Borrar estudiante
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" size="sm" disabled={isPending || !form.dni.trim() || !form.apellido.trim()}>
              {estudiante ? "Guardar datos" : "Crear estudiante"}
            </Button>
          </div>
        </form>

        {estudiante && (
          <div className="flex flex-col gap-3 border-t pt-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium">Becas {anio}</h3>
              {!nueva && programasDisponibles.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setNueva({ programa_id: programasDisponibles[0].id, area_id: SIN_AREA, modulos: "" })
                  }
                >
                  <Plus className="size-3.5" />
                  Agregar beca
                </Button>
              )}
            </div>

            {becasDelAnio.length === 0 && !nueva && (
              <p className="text-muted-foreground text-sm">No tiene becas cargadas en {anio}.</p>
            )}

            {becasDelAnio.map((b) => {
              const chocaCon = becasDelAnio.filter(
                (o) =>
                  o.id !== b.id &&
                  b.estado === "activa" &&
                  o.estado === "activa" &&
                  sonIncompatibles(indice, b.programa_id, o.programa_id),
              );
              return (
                <div key={b.id} className="flex flex-col gap-2 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{programaPorId.get(b.programa_id)?.nombre ?? "?"}</span>
                    {b.condicion && <Badge variant="outline">{b.condicion}</Badge>}
                    {chocaCon.length > 0 && (
                      <span className="flex items-center gap-1 text-xs text-red-600">
                        <TriangleAlert className="size-3.5" />
                        Incompatible con{" "}
                        {chocaCon.map((o) => programaPorId.get(o.programa_id)?.nombre).join(", ")}
                      </span>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive ml-auto size-7"
                      aria-label="Quitar beca"
                      title="Quitar beca"
                      onClick={() => quitarBeca(b)}
                      disabled={isPending}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[9rem_1fr_6rem]">
                    <Selector
                      ariaLabel="Estado"
                      className="w-full"
                      value={b.estado}
                      onChange={(v) => actualizarBeca(b, { estado: v as EstadoAsignacion })}
                      opciones={ESTADOS_ASIGNACION}
                      disabled={isPending}
                    />
                    <Selector
                      ariaLabel="Área"
                      className="w-full"
                      value={b.area_id ?? SIN_AREA}
                      onChange={(v) => actualizarBeca(b, { area_id: v === SIN_AREA ? null : v })}
                      opciones={opcionesArea}
                      disabled={isPending}
                    />
                    <Input
                      type="number"
                      min={0}
                      max={99}
                      defaultValue={b.modulos ?? ""}
                      placeholder="Módulos"
                      aria-label="Módulos"
                      className="h-9"
                      onBlur={(e) => {
                        const v = e.target.value.trim() === "" ? null : Number(e.target.value);
                        if (v !== b.modulos && (v === null || Number.isInteger(v))) {
                          actualizarBeca(b, { modulos: v });
                        }
                      }}
                    />
                  </div>
                </div>
              );
            })}

            {nueva && (
              <div className="bg-muted/40 flex flex-col gap-2 rounded-lg border border-dashed p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_6rem]">
                  <Selector
                    ariaLabel="Programa"
                    className="w-full"
                    value={nueva.programa_id}
                    onChange={(v) => setNueva({ ...nueva, programa_id: v })}
                    opciones={programasDisponibles.map((p) => ({ value: p.id, label: p.nombre }))}
                  />
                  <Selector
                    ariaLabel="Área"
                    className="w-full"
                    value={nueva.area_id}
                    onChange={(v) => setNueva({ ...nueva, area_id: v })}
                    opciones={opcionesArea}
                  />
                  <Input
                    type="number"
                    min={0}
                    max={99}
                    value={nueva.modulos}
                    onChange={(e) => setNueva({ ...nueva, modulos: e.target.value })}
                    placeholder="Módulos"
                    aria-label="Módulos"
                    className="h-9"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setNueva(null)}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={agregarBeca} disabled={isPending}>
                    Agregar
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <h3 className="text-sm font-medium">Otros años</h3>
              {historial === null ? (
                <p className="text-muted-foreground text-sm">Cargando…</p>
              ) : otrosAnios.length === 0 ? (
                <p className="text-muted-foreground text-sm">Sin becas en otros años.</p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {otrosAnios.map((h) => (
                    <li key={h.id} className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground w-10 tabular-nums">{h.anio}</span>
                      <Badge variant="outline" className={CHIP_ESTADO[h.estado]}>
                        {h.programa}
                      </Badge>
                      {h.estado !== "activa" && (
                        <span className="text-muted-foreground text-xs">{labelEstadoAsignacion(h.estado)}</span>
                      )}
                      {h.area && <span className="text-muted-foreground text-xs">{h.area}</span>}
                      {h.tutor && <span className="text-muted-foreground text-xs">· {h.tutor}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        {dialogoConfirmar}
      </DialogContent>
    </Dialog>
  );
}
