"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfirmar } from "@/components/features/confirmar-dialog";
import { mensajeDeError } from "@/lib/errores";
import { indiceIncompatibilidades, sonIncompatibles } from "@/lib/becas/conflictos";
import {
  ORIGENES,
  labelOrigen,
  type ACargoEntrega,
  type OrigenPrograma,
  type Programa,
} from "@/lib/becas/tipos";
import {
  definirIncompatibilidad,
  eliminarEntrega,
  eliminarPrograma,
  guardarEntrega,
  guardarPrograma,
} from "./actions";
import type { DatosBecas } from "./becas-cliente";
import { Selector } from "./selector";

function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

export function ProgramasTab({ anio, programas, incompatibilidades, entregas, asignaciones }: DatosBecas) {
  const [isPending, startTransition] = useTransition();
  const [confirmar, dialogoConfirmar] = useConfirmar();
  const [editando, setEditando] = useState<Programa | "nuevo" | null>(null);
  const indice = useMemo(() => indiceIncompatibilidades(incompatibilidades), [incompatibilidades]);

  const becadosPorPrograma = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const a of asignaciones) {
      if (a.estado === "activa") mapa.set(a.programa_id, (mapa.get(a.programa_id) ?? 0) + 1);
    }
    return mapa;
  }, [asignaciones]);

  // Todos los pares de programas, para tildar cuáles son incompatibles.
  const pares = useMemo(() => {
    const lista: [Programa, Programa][] = [];
    for (let i = 0; i < programas.length; i++) {
      for (let j = i + 1; j < programas.length; j++) lista.push([programas[i], programas[j]]);
    }
    return lista;
  }, [programas]);

  function ejecutar(accion: () => Promise<{ ok: true } | { error: string }>, respaldo: string) {
    startTransition(async () => {
      try {
        const r = await accion();
        if ("error" in r) toast.error(r.error);
      } catch (err) {
        toast.error(mensajeDeError(err, respaldo));
      }
    });
  }

  async function borrarPrograma(p: Programa) {
    const ok = await confirmar({
      titulo: `¿Eliminar el programa "${p.nombre}"?`,
      descripcion: "Solo se puede eliminar si no tiene becas cargadas en ningún año.",
      confirmar: "Eliminar",
      destructivo: true,
    });
    if (ok) ejecutar(() => eliminarPrograma(p.id), "No se pudo eliminar el programa.");
  }

  // Alta de una entrega.
  const conEntregas = programas.filter((p) => p.origen !== "externa");
  const [nueva, setNueva] = useState<{ programa_id: string; nombre: string; vence_el: string; a_cargo: ACargoEntrega }>({
    programa_id: conEntregas[0]?.id ?? "",
    nombre: "",
    vence_el: "",
    a_cargo: "becario",
  });

  function agregarEntrega(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const r = await guardarEntrega(null, {
          programa_id: nueva.programa_id,
          anio,
          nombre: nueva.nombre,
          vence_el: nueva.vence_el || null,
          a_cargo: nueva.a_cargo,
        });
        if ("error" in r) toast.error(r.error);
        else setNueva((n) => ({ ...n, nombre: "", vence_el: "" }));
      } catch (err) {
        toast.error(mensajeDeError(err, "No se pudo agregar la entrega."));
      }
    });
  }

  async function borrarEntrega(id: string, nombre: string) {
    const ok = await confirmar({
      titulo: `¿Eliminar la entrega "${nombre}"?`,
      descripcion: "Se pierde lo que ya estaba tildado como recibido u observado para esa entrega.",
      confirmar: "Eliminar",
      destructivo: true,
    });
    if (ok) ejecutar(() => eliminarEntrega(id), "No se pudo eliminar la entrega.");
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Programas ───────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Programas</h2>
          <Button size="sm" variant="outline" onClick={() => setEditando("nuevo")}>
            <Plus className="size-4" />
            Nuevo programa
          </Button>
        </div>
        <Card>
          <CardContent className="flex flex-col divide-y p-0">
            {programas.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                <span className={`font-medium ${p.activo ? "" : "text-muted-foreground line-through"}`}>
                  {p.nombre}
                </span>
                <Badge variant="outline">{labelOrigen(p.origen)}</Badge>
                {p.horas_por_modulo !== null && (
                  <span className="text-muted-foreground text-xs">{p.horas_por_modulo} h semanales por módulo</span>
                )}
                {!p.activo && <span className="text-muted-foreground text-xs">Inactivo</span>}
                <span className="text-muted-foreground ml-auto text-xs">
                  {becadosPorPrograma.get(p.id) ?? 0} activos en {anio}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  aria-label={`Editar ${p.nombre}`}
                  title="Editar"
                  onClick={() => setEditando(p)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive size-7"
                  aria-label={`Eliminar ${p.nombre}`}
                  title="Eliminar"
                  disabled={isPending}
                  onClick={() => borrarPrograma(p)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* ── Incompatibilidades ──────────────────────────────────────────── */}
      {pares.length > 0 && (
        <section className="flex flex-col gap-2">
          <div>
            <h2 className="font-semibold">Incompatibilidades</h2>
            <p className="text-muted-foreground text-sm">
              Tildá los pares de becas que un mismo estudiante no puede tener a la vez. Quien tenga las
              dos activas en un año aparece en Conflictos.
            </p>
          </div>
          <Card>
            <CardContent className="grid grid-cols-1 gap-x-6 gap-y-1 py-3 sm:grid-cols-2">
              {pares.map(([a, b]) => {
                const marcado = sonIncompatibles(indice, a.id, b.id);
                return (
                  <label key={`${a.id}|${b.id}`} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
                    <input
                      type="checkbox"
                      checked={marcado}
                      disabled={isPending}
                      onChange={(e) =>
                        ejecutar(
                          () => definirIncompatibilidad(a.id, b.id, e.target.checked),
                          "No se pudo guardar la incompatibilidad.",
                        )
                      }
                      className="accent-primary size-4"
                    />
                    <span>
                      {a.nombre} <span className="text-muted-foreground">con</span> {b.nombre}
                    </span>
                  </label>
                );
              })}
            </CardContent>
          </Card>
        </section>
      )}

      {/* ── Entregas ────────────────────────────────────────────────────── */}
      {conEntregas.length > 0 && (
        <section className="flex flex-col gap-2">
          <div>
            <h2 className="font-semibold">Entregas {anio}</h2>
            <p className="text-muted-foreground text-sm">
              Lo que tiene que presentar cada becario (o su tutor) en el año. Se tildan en la pestaña
              Entregas. Los programas sin entregas son solo padrón.
            </p>
          </div>
          <Card>
            <CardContent className="flex flex-col gap-3 py-3">
              {conEntregas.map((p) => {
                const lista = entregas.filter((e) => e.programa_id === p.id);
                if (lista.length === 0) return null;
                return (
                  <div key={p.id} className="flex flex-col gap-1">
                    <p className="text-sm font-medium">{p.nombre}</p>
                    {lista.map((e) => (
                      <div key={e.id} className="flex items-center gap-2 text-sm">
                        <span>{e.nombre}</span>
                        <span className="text-muted-foreground text-xs">
                          {[e.vence_el ? `vence ${fechaCorta(e.vence_el)}` : null, e.a_cargo === "tutor" ? "la presenta el tutor" : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-muted-foreground hover:text-destructive ml-auto size-7"
                          aria-label={`Eliminar ${e.nombre}`}
                          title="Eliminar"
                          disabled={isPending}
                          onClick={() => borrarEntrega(e.id, e.nombre)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                );
              })}
              {entregas.length === 0 && (
                <p className="text-muted-foreground text-sm">Todavía no hay entregas definidas para {anio}.</p>
              )}

              <form onSubmit={agregarEntrega} className="grid grid-cols-1 items-end gap-2 border-t pt-3 sm:grid-cols-[1fr_1fr_9rem_9rem_auto]">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Programa</Label>
                  <Selector
                    ariaLabel="Programa"
                    className="w-full"
                    value={nueva.programa_id}
                    onChange={(v) => setNueva((n) => ({ ...n, programa_id: v }))}
                    opciones={conEntregas.map((p) => ({ value: p.id, label: p.nombre }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Entrega</Label>
                  <Input
                    value={nueva.nombre}
                    onChange={(e) => setNueva((n) => ({ ...n, nombre: e.target.value }))}
                    placeholder="Ej: Informe septiembre"
                    className="h-9"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Vence</Label>
                  <Input
                    type="date"
                    value={nueva.vence_el}
                    onChange={(e) => setNueva((n) => ({ ...n, vence_el: e.target.value }))}
                    className="h-9"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">La presenta</Label>
                  <Selector
                    ariaLabel="Quién la presenta"
                    className="w-full"
                    value={nueva.a_cargo}
                    onChange={(v) => setNueva((n) => ({ ...n, a_cargo: v as ACargoEntrega }))}
                    opciones={[
                      { value: "becario", label: "El becario" },
                      { value: "tutor", label: "El tutor" },
                    ]}
                  />
                </div>
                <Button type="submit" size="sm" className="h-9" disabled={isPending || !nueva.nombre.trim()}>
                  <Plus className="size-4" />
                  Agregar
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
      )}

      {editando && (
        <ProgramaDialog
          key={editando === "nuevo" ? "nuevo" : editando.id}
          programa={editando === "nuevo" ? null : editando}
          onClose={() => setEditando(null)}
        />
      )}
      {dialogoConfirmar}
    </div>
  );
}

function ProgramaDialog({ programa, onClose }: { programa: Programa | null; onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState(programa?.nombre ?? "");
  const [origen, setOrigen] = useState<OrigenPrograma>(programa?.origen ?? "facultad");
  const [horas, setHoras] = useState(programa?.horas_por_modulo?.toString() ?? "");
  const [activo, setActivo] = useState(programa?.activo ?? true);

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const h = horas.trim() === "" ? null : Number(horas);
    startTransition(async () => {
      try {
        const r = await guardarPrograma(programa?.id ?? null, {
          nombre,
          origen,
          horas_por_modulo: h !== null && Number.isInteger(h) ? h : null,
          activo,
        });
        if ("error" in r) setError(r.error);
        else onClose();
      } catch (err) {
        setError(mensajeDeError(err, "No se pudo guardar el programa."));
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{programa ? "Editar programa" : "Nuevo programa"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={guardar} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Nombre *</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Origen</Label>
            <Selector
              ariaLabel="Origen"
              className="w-full"
              value={origen}
              onChange={(v) => setOrigen(v as OrigenPrograma)}
              opciones={ORIGENES.map((o) => ({ value: o.value, label: o.label }))}
            />
            <p className="text-muted-foreground text-xs">{ORIGENES.find((o) => o.value === origen)?.ayuda}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Horas semanales por módulo</Label>
            <Input type="number" min={0} max={60} value={horas} onChange={(e) => setHoras(e.target.value)} />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
              className="accent-primary size-4"
            />
            Activo (se puede elegir al importar o al agregar una beca)
          </label>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending || !nombre.trim()}>
              {isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
