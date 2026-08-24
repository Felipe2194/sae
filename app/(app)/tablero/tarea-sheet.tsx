"use client";

import { useState, useTransition, useEffect } from "react";
import { Archive, ArchiveRestore, Plus, X, Send, Loader2, History, Paperclip, ExternalLink } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { UserAvatar } from "@/components/features/user-avatar";
import { AsignadosPicker } from "@/components/features/asignados-picker";
import {
  actualizarTarea,
  archivarTarea,
  restaurarTarea,
  fetchTareaDetalle,
  fetchTareaLog,
  crearSubtarea,
  toggleSubtarea,
  eliminarSubtarea,
  crearComentario,
  eliminarComentario,
  crearAdjunto,
  eliminarAdjunto,
  fetchAdjuntos,
} from "./actions";
import { DrivePickerButton } from "./drive-picker-button";
import type {
  TareaCard,
  AreaOption,
  UsuarioOption,
} from "./page";
import type { SubtareaRow, ComentarioRow, LogRow, AdjuntoRow } from "./actions";

const TIPO_OPTS = [
  { value: "tarea", label: "Tarea" },
  { value: "evento", label: "Evento" },
  { value: "entrega", label: "Entrega" },
  { value: "reunion", label: "Reunión" },
];

function extraerDriveFileId(url: string): string | null {
  const m = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  return m ? m[1] : null;
}

const PRIORIDAD_OPTS = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
];

const ESTADO_OPTS = [
  { value: "por_hacer", label: "Por hacer" },
  { value: "en_progreso", label: "En progreso" },
  { value: "hecha", label: "Hecha" },
];

const REPETIR_OPTS = [
  { value: "_nunca", label: "No se repite" },
  { value: "diaria", label: "Todos los días" },
  { value: "semanal", label: "Todas las semanas" },
  { value: "mensual", label: "Todos los meses" },
];

// Base UI necesita `items` para poder mostrar la etiqueta del valor
// seleccionado sin haber abierto el popup todavía (si no, muestra el value crudo).
const TIPO_ITEMS = Object.fromEntries(TIPO_OPTS.map((o) => [o.value, o.label]));
const PRIORIDAD_ITEMS = Object.fromEntries(PRIORIDAD_OPTS.map((o) => [o.value, o.label]));
const ESTADO_ITEMS = Object.fromEntries(ESTADO_OPTS.map((o) => [o.value, o.label]));
const REPETIR_ITEMS = Object.fromEntries(REPETIR_OPTS.map((o) => [o.value, o.label]));

const PRIORIDAD_COLOR: Record<string, string> = {
  baja: "bg-slate-300",
  media: "bg-amber-400",
  alta: "bg-red-500",
};

function formatRelativo(fechaISO: string): string {
  const ahora = new Date();
  const fecha = new Date(fechaISO);
  const diffMs = ahora.getTime() - fecha.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `hace ${diffD}d`;
}

type Props = {
  tarea: TareaCard;
  areas: AreaOption[];
  usuarios: UsuarioOption[];
  currentUserId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TareaSheet({
  tarea,
  areas,
  usuarios,
  open,
  onOpenChange,
}: Props) {
  // ── Form state ──────────────────────────────────────────────────────────────
  const [titulo, setTitulo] = useState(tarea.titulo);
  const [descripcion, setDescripcion] = useState(tarea.descripcion ?? "");
  const [tipo, setTipo] = useState(tarea.tipo);
  const [prioridad, setPrioridad] = useState(tarea.prioridad);
  const [areaId, setAreaId] = useState(tarea.area_id);
  const [responsableId, setResponsableId] = useState(
    tarea.responsable_id ?? "",
  );
  const [asignadosIds, setAsignadosIds] = useState<string[]>(
    tarea.asignados.map((a) => a.id),
  );
  const [fechaVencimiento, setFechaVencimiento] = useState(
    tarea.fecha_vencimiento ?? "",
  );
  const [estado, setEstado] = useState(tarea.estado);
  const [duracionEstimada, setDuracionEstimada] = useState(
    tarea.duracion_estimada_hs != null ? String(tarea.duracion_estimada_hs) : "",
  );
  const [duracionReal, setDuracionReal] = useState(
    tarea.duracion_real_hs != null ? String(tarea.duracion_real_hs) : "",
  );
  const [repetir, setRepetir] = useState(tarea.recurrencia?.frecuencia ?? "_nunca");

  // ── Detalle (subtareas + comentarios + adjuntos + log) ──────────────────────
  const [subtareas, setSubtareas] = useState<SubtareaRow[]>([]);
  const [comentarios, setComentarios] = useState<ComentarioRow[]>([]);
  const [adjuntos, setAdjuntos] = useState<AdjuntoRow[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  // ── Adjunto nuevo ───────────────────────────────────────────────────────────
  const [nuevoAdjNombre, setNuevoAdjNombre] = useState("");
  const [nuevoAdjUrl, setNuevoAdjUrl] = useState("");
  const [showAdjForm, setShowAdjForm] = useState(false);
  const [isPendingAdj, startAdj] = useTransition();
  const [previewAbierto, setPreviewAbierto] = useState<string | null>(null);

  // ── Acciones ─────────────────────────────────────────────────────────────
  const [isPendingSave, startSave] = useTransition();
  const [isPendingDelete, startDelete] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);

  // ── Subtarea nueva ──────────────────────────────────────────────────────────
  const [nuevaSubtarea, setNuevaSubtarea] = useState("");
  const [isPendingSubtarea, startSubtarea] = useTransition();

  // ── Comentario nuevo ────────────────────────────────────────────────────────
  const [nuevoComentario, setNuevoComentario] = useState("");
  const [isPendingComentario, startComentario] = useTransition();

  // Fetch detalle on open
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch de detalle al abrir el panel
    setLoadingDetalle(true);
    Promise.all([
      fetchTareaDetalle(tarea.id),
      fetchAdjuntos(tarea.id),
      fetchTareaLog(tarea.id),
    ])
      .then(([{ subtareas, comentarios }, adjRows, logRows]) => {
        setSubtareas(subtareas);
        setComentarios(comentarios);
        setAdjuntos(adjRows);
        setLog(logRows);
      })
      .finally(() => setLoadingDetalle(false));
  }, [open, tarea.id]);

  function handleAddAdjunto(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevoAdjNombre.trim() || !nuevoAdjUrl.trim()) return;
    startAdj(async () => {
      await crearAdjunto(tarea.id, { nombre: nuevoAdjNombre.trim(), url: nuevoAdjUrl.trim() });
      const updated = await fetchAdjuntos(tarea.id);
      setAdjuntos(updated);
      setNuevoAdjNombre("");
      setNuevoAdjUrl("");
      setShowAdjForm(false);
    });
  }

  function handleDeleteAdjunto(adjId: string) {
    startAdj(async () => {
      await eliminarAdjunto(adjId);
      setAdjuntos((prev) => prev.filter((a) => a.id !== adjId));
    });
  }

  function handlePickDrive(archivo: { nombre: string; url: string }) {
    startAdj(async () => {
      await crearAdjunto(tarea.id, archivo);
      const updated = await fetchAdjuntos(tarea.id);
      setAdjuntos(updated);
    });
  }

  function handleSave() {
    setErrorGuardado(null);
    startSave(async () => {
      const prev = {
        titulo: tarea.titulo,
        descripcion: tarea.descripcion ?? null,
        tipo: tarea.tipo,
        prioridad: tarea.prioridad,
        area_id: tarea.area_id,
        responsable_id: tarea.responsable_id ?? null,
        fecha_vencimiento: tarea.fecha_vencimiento ?? null,
        estado: tarea.estado,
        asignados_ids: tarea.asignados.map((a) => a.id),
      };
      try {
        await actualizarTarea(
          tarea.id,
          {
            titulo: titulo.trim() || tarea.titulo,
            descripcion: descripcion.trim() || null,
            tipo,
            prioridad,
            area_id: areaId,
            responsable_id: responsableId || null,
            asignados_ids: asignadosIds,
            fecha_vencimiento: fechaVencimiento || null,
            estado,
            duracion_estimada_hs: duracionEstimada.trim() ? Number(duracionEstimada) : null,
            duracion_real_hs: duracionReal.trim() ? Number(duracionReal) : null,
            recurrencia:
              repetir === "_nunca"
                ? null
                : { frecuencia: repetir as "diaria" | "semanal" | "mensual" },
          },
          prev,
        );
        onOpenChange(false);
      } catch (err) {
        setErrorGuardado(
          err instanceof Error ? err.message : "No se pudo guardar el cambio.",
        );
      }
    });
  }

  function handleArchivar() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    startDelete(async () => {
      await archivarTarea(tarea.id);
      onOpenChange(false);
    });
  }

  function handleRestaurar() {
    startDelete(async () => {
      await restaurarTarea(tarea.id);
      onOpenChange(false);
    });
  }

  function handleAddSubtarea(e: React.FormEvent) {
    e.preventDefault();
    const t = nuevaSubtarea.trim();
    if (!t) return;
    const optimista: SubtareaRow = { id: crypto.randomUUID(), titulo: t, hecha: false, orden: subtareas.length };
    setSubtareas((prev) => [...prev, optimista]);
    setNuevaSubtarea("");
    startSubtarea(async () => {
      await crearSubtarea(tarea.id, t);
      // Refresh real data
      fetchTareaDetalle(tarea.id).then(({ subtareas }) => setSubtareas(subtareas));
    });
  }

  function handleToggleSubtarea(s: SubtareaRow) {
    setSubtareas((prev) =>
      prev.map((x) => (x.id === s.id ? { ...x, hecha: !x.hecha } : x)),
    );
    startSubtarea(() => toggleSubtarea(s.id, !s.hecha));
  }

  function handleDeleteSubtarea(id: string) {
    setSubtareas((prev) => prev.filter((x) => x.id !== id));
    startSubtarea(() => eliminarSubtarea(id));
  }

  function handleAddComentario(e: React.FormEvent) {
    e.preventDefault();
    const c = nuevoComentario.trim();
    if (!c) return;
    const optimista: ComentarioRow = {
      id: crypto.randomUUID(),
      contenido: c,
      autor_nombre: "Vos",
      autor_avatar_color: null,
      creado_en: new Date().toISOString(),
      es_propio: true,
    };
    setComentarios((prev) => [...prev, optimista]);
    setNuevoComentario("");
    startComentario(async () => {
      await crearComentario(tarea.id, c);
      fetchTareaDetalle(tarea.id).then(({ comentarios }) =>
        setComentarios(comentarios),
      );
    });
  }

  function handleDeleteComentario(id: string) {
    setComentarios((prev) => prev.filter((x) => x.id !== id));
    startComentario(() => eliminarComentario(id));
  }

  const hechas = subtareas.filter((s) => s.hecha).length;
  const area = areas.find((a) => a.id === areaId);

  const AREA_ITEMS = Object.fromEntries(areas.map((a) => [a.id, a.nombre]));
  const RESPONSABLE_ITEMS = {
    _none: "Sin asignar",
    ...Object.fromEntries(usuarios.map((u) => [u.id, u.nombre])),
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="sm:max-w-xl flex flex-col gap-0 p-0"
        showCloseButton={false}
      >
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-3 border-b gap-2">
          <div className="flex items-start justify-between gap-3 pr-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`size-2.5 shrink-0 rounded-full mt-0.5 ${PRIORIDAD_COLOR[prioridad]}`}
              />
              {area && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="size-2 rounded-full" style={{ backgroundColor: area.color }} />
                  {area.nombre}
                </span>
              )}
              <Badge variant="secondary" className="text-xs">
                {TIPO_OPTS.find((t) => t.value === tipo)?.label ?? tipo}
              </Badge>
              <Badge
                variant={estado === "hecha" ? "default" : "outline"}
                className="text-xs"
              >
                {ESTADO_OPTS.find((e) => e.value === estado)?.label ?? estado}
              </Badge>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="shrink-0 rounded-md p-1 hover:bg-muted transition-colors"
              aria-label="Cerrar"
            >
              <X className="size-4" />
            </button>
          </div>
          <SheetTitle className="text-left text-base font-semibold leading-snug">
            {tarea.titulo}
          </SheetTitle>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">

          {/* Campos editables */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Título</Label>
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Descripción</Label>
              <Textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Agregá más contexto..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v ?? "")} items={TIPO_ITEMS}>
                  <SelectTrigger className="w-full h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPO_OPTS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Prioridad</Label>
                <Select value={prioridad} onValueChange={(v) => setPrioridad(v ?? "")} items={PRIORIDAD_ITEMS}>
                  <SelectTrigger className="w-full h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORIDAD_OPTS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        <span className="flex items-center gap-2">
                          <span className={`size-2 rounded-full ${PRIORIDAD_COLOR[o.value]}`} />
                          {o.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Área</Label>
                <Select value={areaId} onValueChange={(v) => setAreaId(v ?? "")} items={AREA_ITEMS}>
                  <SelectTrigger className="w-full h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        <span className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full" style={{ backgroundColor: a.color }} />
                          {a.nombre}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  <SelectTrigger className="w-full h-8">
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
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Colaboradores</Label>
              <AsignadosPicker
                usuarios={usuarios}
                selectedIds={asignadosIds}
                onChange={setAsignadosIds}
                placeholder="Sin colaboradores adicionales"
                permitirTodos
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Estado</Label>
                <Select value={estado} onValueChange={(v) => setEstado(v ?? "")} items={ESTADO_ITEMS}>
                  <SelectTrigger className="w-full h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADO_OPTS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Fecha de vencimiento</Label>
                <Input
                  type="date"
                  value={fechaVencimiento}
                  onChange={(e) => setFechaVencimiento(e.target.value)}
                  className="h-8"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Repetir</Label>
                <Select value={repetir} onValueChange={(v) => setRepetir(v ?? "_nunca")} items={REPETIR_ITEMS}>
                  <SelectTrigger className="w-full h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPETIR_OPTS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {repetir !== "_nunca" && !fechaVencimiento && (
                  <p className="text-[11px] text-muted-foreground">
                    Necesita fecha de vencimiento para generar la próxima.
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Horas estimadas</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="—"
                  value={duracionEstimada}
                  onChange={(e) => setDuracionEstimada(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Horas reales</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="—"
                  value={duracionReal}
                  onChange={(e) => setDuracionReal(e.target.value)}
                  className="h-8"
                />
              </div>
            </div>

            <div className="flex flex-col items-start gap-2">
              <Button
                onClick={handleSave}
                disabled={isPendingSave}
                size="sm"
                className="self-start"
              >
                {isPendingSave ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" />
                    Guardando...
                  </span>
                ) : (
                  "Guardar cambios"
                )}
              </Button>
              {errorGuardado && (
                <p className="text-destructive text-xs">{errorGuardado}</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Subtareas */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">
                Subtareas
                {subtareas.length > 0 && (
                  <span className="text-muted-foreground font-normal ml-1.5">
                    {hechas}/{subtareas.length}
                  </span>
                )}
              </h3>
            </div>

            {loadingDetalle ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="size-3.5 animate-spin" />
                Cargando...
              </div>
            ) : (
              <>
                {subtareas.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {subtareas.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-2.5 group rounded-md px-1 py-1 hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={s.hecha}
                          onCheckedChange={() => handleToggleSubtarea(s)}
                          className="shrink-0"
                        />
                        <span
                          className={`flex-1 text-sm leading-snug ${s.hecha ? "line-through text-muted-foreground" : ""}`}
                        >
                          {s.titulo}
                        </span>
                        <button
                          onClick={() => handleDeleteSubtarea(s.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          aria-label="Eliminar subtarea"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <form
                  onSubmit={handleAddSubtarea}
                  className="flex items-center gap-2"
                >
                  <Input
                    value={nuevaSubtarea}
                    onChange={(e) => setNuevaSubtarea(e.target.value)}
                    placeholder="Agregar subtarea..."
                    className="h-8 text-sm flex-1"
                    disabled={isPendingSubtarea}
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    size="icon-sm"
                    disabled={!nuevaSubtarea.trim() || isPendingSubtarea}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </form>
              </>
            )}
          </div>

          <Separator />

          {/* Adjuntos */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium flex items-center gap-1.5">
                <Paperclip className="size-3.5 text-muted-foreground" />
                Adjuntos
                {adjuntos.length > 0 && (
                  <span className="text-muted-foreground font-normal ml-0.5">{adjuntos.length}</span>
                )}
              </h3>
              <div className="flex items-center gap-3">
                <DrivePickerButton onPicked={handlePickDrive} />
                <button
                  onClick={() => setShowAdjForm((v) => !v)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <Plus className="size-3" />
                  Enlace
                </button>
              </div>
            </div>

            {showAdjForm && (
              <form onSubmit={handleAddAdjunto} className="flex flex-col gap-2">
                <input
                  value={nuevoAdjNombre}
                  onChange={(e) => setNuevoAdjNombre(e.target.value)}
                  placeholder="Nombre del enlace"
                  className="h-8 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
                  required
                />
                <input
                  value={nuevoAdjUrl}
                  onChange={(e) => setNuevoAdjUrl(e.target.value)}
                  placeholder="https://..."
                  type="url"
                  className="h-8 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
                  required
                />
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdjForm(false)}>Cancelar</Button>
                  <Button type="submit" size="sm" disabled={isPendingAdj}>Agregar</Button>
                </div>
              </form>
            )}

            {adjuntos.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {adjuntos.map((a) => {
                  const driveFileId = extraerDriveFileId(a.url);
                  return (
                    <div key={a.id} className="flex flex-col gap-1.5">
                      <div className="group flex items-center gap-2 rounded-md border px-3 py-2 hover:bg-muted/50 transition-colors">
                        <ExternalLink className="size-3.5 text-muted-foreground shrink-0" />
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 text-sm truncate hover:underline"
                        >
                          {a.nombre}
                        </a>
                        {driveFileId && (
                          <button
                            onClick={() => setPreviewAbierto((prev) => (prev === a.id ? null : a.id))}
                            className="text-muted-foreground hover:text-foreground text-xs shrink-0"
                          >
                            {previewAbierto === a.id ? "Ocultar" : "Ver"}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteAdjunto(a.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                      {driveFileId && previewAbierto === a.id && (
                        <iframe
                          src={`https://drive.google.com/file/d/${driveFileId}/preview`}
                          className="w-full rounded-md border"
                          height={300}
                          allow="autoplay"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Separator />

          {/* Comentarios */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">
              Comentarios
              {comentarios.length > 0 && (
                <span className="text-muted-foreground font-normal ml-1.5">
                  {comentarios.length}
                </span>
              )}
            </h3>

            {!loadingDetalle && comentarios.length > 0 && (
              <div className="flex flex-col gap-3">
                {comentarios.map((c) => (
                  <div key={c.id} className="flex gap-2.5 group">
                    <UserAvatar
                      nombre={c.autor_nombre}
                      avatarColor={c.autor_avatar_color}
                      size="sm"
                      className="mt-0.5 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-medium">{c.autor_nombre}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatRelativo(c.creado_en)}
                        </span>
                        {c.es_propio && (
                          <button
                            onClick={() => handleDeleteComentario(c.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive ml-auto"
                            aria-label="Eliminar comentario"
                          >
                            <X className="size-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-foreground/90 leading-snug mt-0.5 whitespace-pre-wrap">
                        {c.contenido}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleAddComentario} className="flex gap-2">
              <Textarea
                value={nuevoComentario}
                onChange={(e) => setNuevoComentario(e.target.value)}
                placeholder="Escribí un comentario..."
                rows={2}
                className="flex-1 text-sm min-h-0"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleAddComentario(e as unknown as React.FormEvent);
                  }
                }}
                disabled={isPendingComentario}
              />
              <Button
                type="submit"
                variant="outline"
                size="icon-sm"
                className="self-end"
                disabled={!nuevoComentario.trim() || isPendingComentario}
                aria-label="Enviar comentario"
              >
                <Send className="size-3.5" />
              </Button>
            </form>
          </div>

          {/* Historial */}
          {log.length > 0 && (
            <>
              <Separator />
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium flex items-center gap-1.5">
                  <History className="size-3.5 text-muted-foreground" />
                  Historial
                </h3>
                <div className="flex flex-col gap-1.5">
                  {log.map((entry) => (
                    <div key={entry.id} className="flex gap-2 text-xs text-muted-foreground">
                      <span className="shrink-0">{formatRelativo(entry.creado_en)}</span>
                      <span className="shrink-0 font-medium text-foreground/70">{entry.autor_nombre ?? "Sistema"}</span>
                      <span>cambió <span className="font-medium">{entry.campo}</span></span>
                      {entry.valor_antes && (
                        <span className="truncate">
                          de <span className="line-through opacity-60">{entry.valor_antes}</span>
                          {" "}a <span className="font-medium text-foreground/80">{entry.valor_despues}</span>
                        </span>
                      )}
                      {!entry.valor_antes && entry.valor_despues && (
                        <span>→ <span className="font-medium text-foreground/80">{entry.valor_despues}</span></span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer with archive */}
        <div className="px-5 py-3 border-t flex items-center justify-end">
          {tarea.archivada ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRestaurar}
              disabled={isPendingDelete}
            >
              <ArchiveRestore className="size-3.5" />
              {isPendingDelete ? "Restaurando..." : "Restaurar tarea"}
            </Button>
          ) : confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">¿Confirmar archivado?</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDelete(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleArchivar}
                disabled={isPendingDelete}
              >
                {isPendingDelete ? "Archivando..." : "Confirmar"}
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={handleArchivar}
            >
              <Archive className="size-3.5" />
              Archivar tarea
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
