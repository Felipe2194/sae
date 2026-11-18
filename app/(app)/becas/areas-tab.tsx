"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { CopyPlus, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useConfirmar } from "@/components/features/confirmar-dialog";
import { mensajeDeError } from "@/lib/errores";
import type { Area } from "@/lib/becas/tipos";
import { copiarAreasDeAnio, eliminarArea, guardarArea } from "./actions";
import type { DatosBecas } from "./becas-cliente";

export function AreasTab({ anio, areas, asignaciones }: DatosBecas) {
  const [isPending, startTransition] = useTransition();
  const [confirmar, dialogoConfirmar] = useConfirmar();
  // Área en edición, "nueva" para el alta, null cerrado.
  const [editando, setEditando] = useState<Area | "nueva" | null>(null);

  // Becarios activos y módulos ocupados por área.
  const ocupacion = useMemo(() => {
    const mapa = new Map<string, { becarios: number; modulos: number }>();
    for (const a of asignaciones) {
      if (!a.area_id || a.estado !== "activa") continue;
      const o = mapa.get(a.area_id) ?? { becarios: 0, modulos: 0 };
      o.becarios++;
      o.modulos += a.modulos ?? 0;
      mapa.set(a.area_id, o);
    }
    return mapa;
  }, [asignaciones]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, Area[]>();
    for (const a of areas) {
      const clave = a.departamento ?? "Sin departamento";
      const lista = mapa.get(clave);
      if (lista) lista.push(a);
      else mapa.set(clave, [a]);
    }
    return [...mapa.entries()];
  }, [areas]);

  function copiar() {
    startTransition(async () => {
      try {
        const r = await copiarAreasDeAnio(anio - 1, anio);
        if ("error" in r) toast.error(r.error);
        else if (r.copiadas === 0) toast.info(`No había áreas de ${anio - 1} para copiar.`);
        else toast.success(`${r.copiadas} área${r.copiadas !== 1 ? "s copiadas" : " copiada"} de ${anio - 1}.`);
      } catch (err) {
        toast.error(mensajeDeError(err, "No se pudieron copiar las áreas."));
      }
    });
  }

  async function borrar(area: Area) {
    const o = ocupacion.get(area.id);
    const ok = await confirmar({
      titulo: `¿Eliminar el área "${area.nombre}"?`,
      descripcion: o
        ? `Tiene ${o.becarios} becario${o.becarios !== 1 ? "s" : ""}, que quedan sin área asignada.`
        : "No tiene becarios asignados.",
      confirmar: "Eliminar",
      destructivo: true,
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        const r = await eliminarArea(area.id);
        if ("error" in r) toast.error(r.error);
      } catch (err) {
        toast.error(mensajeDeError(err, "No se pudo eliminar el área."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-sm">
          {areas.length} área{areas.length !== 1 ? "s" : ""} en {anio}
        </span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" className="h-9" onClick={copiar} disabled={isPending}>
            <CopyPlus className="size-4" />
            Copiar de {anio - 1}
          </Button>
          <Button size="sm" variant="outline" className="h-9" onClick={() => setEditando("nueva")}>
            <Plus className="size-4" />
            Nueva área
          </Button>
        </div>
      </div>

      {areas.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Todavía no hay áreas en {anio}. Se crean solas al importar un listado que traiga la columna
            Área, o las podés cargar a mano o copiar del año anterior.
          </CardContent>
        </Card>
      ) : (
        grupos.map(([departamento, lista]) => (
          <Card key={departamento}>
            <CardContent className="p-0">
              <p className="border-b px-3 py-2 text-sm font-medium">{departamento}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b text-left text-xs">
                      <th className="px-3 py-2 font-medium">Área</th>
                      <th className="px-3 py-2 font-medium">Tutor</th>
                      <th className="px-3 py-2 font-medium">Becarios</th>
                      <th className="px-3 py-2 font-medium">Módulos</th>
                      <th className="px-3 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((a) => {
                      const o = ocupacion.get(a.id) ?? { becarios: 0, modulos: 0 };
                      const excedido = a.modulos_cupo !== null && o.modulos > a.modulos_cupo;
                      return (
                        <tr key={a.id} className="border-b last:border-0">
                          <td className="px-3 py-2">
                            <p className="font-medium">{a.nombre}</p>
                            {a.tipo && <p className="text-muted-foreground text-xs">{a.tipo}</p>}
                          </td>
                          <td className="px-3 py-2">
                            {a.tutor_nombre ?? <span className="text-muted-foreground">Sin tutor</span>}
                            {a.tutor_email && <p className="text-muted-foreground text-xs">{a.tutor_email}</p>}
                          </td>
                          <td className="px-3 py-2 tabular-nums">{o.becarios}</td>
                          <td className={`px-3 py-2 tabular-nums ${excedido ? "font-medium text-red-600" : ""}`}>
                            {o.modulos}
                            {a.modulos_cupo !== null ? ` / ${a.modulos_cupo}` : ""}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex justify-end">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7"
                                aria-label={`Editar ${a.nombre}`}
                                title="Editar"
                                onClick={() => setEditando(a)}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-muted-foreground hover:text-destructive size-7"
                                aria-label={`Eliminar ${a.nombre}`}
                                title="Eliminar"
                                disabled={isPending}
                                onClick={() => borrar(a)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {editando && (
        <AreaDialog
          key={editando === "nueva" ? "nueva" : editando.id}
          anio={anio}
          area={editando === "nueva" ? null : editando}
          onClose={() => setEditando(null)}
        />
      )}
      {dialogoConfirmar}
    </div>
  );
}

function AreaDialog({ anio, area, onClose }: { anio: number; area: Area | null; onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    departamento: area?.departamento ?? "",
    nombre: area?.nombre ?? "",
    tipo: area?.tipo ?? "",
    tutor_nombre: area?.tutor_nombre ?? "",
    tutor_email: area?.tutor_email ?? "",
    tutor_telefono: area?.tutor_telefono ?? "",
    modulos_cupo: area?.modulos_cupo?.toString() ?? "",
    perfil: area?.perfil ?? "",
  });
  const campo = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cupo = form.modulos_cupo.trim() === "" ? null : Number(form.modulos_cupo);
    startTransition(async () => {
      try {
        const r = await guardarArea(area?.id ?? null, {
          anio,
          departamento: form.departamento || null,
          nombre: form.nombre,
          tipo: form.tipo || null,
          tutor_nombre: form.tutor_nombre || null,
          tutor_email: form.tutor_email || null,
          tutor_telefono: form.tutor_telefono || null,
          modulos_cupo: cupo !== null && Number.isInteger(cupo) ? cupo : null,
          perfil: form.perfil || null,
        });
        if ("error" in r) setError(r.error);
        else onClose();
      } catch (err) {
        setError(mensajeDeError(err, "No se pudo guardar el área."));
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{area ? "Editar área" : `Nueva área ${anio}`}</DialogTitle>
        </DialogHeader>
        <form onSubmit={guardar} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label className="text-xs">Nombre del área *</Label>
              <Input value={form.nombre} onChange={campo("nombre")} required placeholder="Ej: Laboratorio Electrónica" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Departamento</Label>
              <Input value={form.departamento} onChange={campo("departamento")} placeholder="Ej: Electrónica" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Tipo</Label>
              <Input value={form.tipo} onChange={campo("tipo")} placeholder="Investigación, Servicio…" />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label className="text-xs">Tutor/a</Label>
              <Input value={form.tutor_nombre} onChange={campo("tutor_nombre")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Mail del tutor</Label>
              <Input type="email" value={form.tutor_email} onChange={campo("tutor_email")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Teléfono del tutor</Label>
              <Input value={form.tutor_telefono} onChange={campo("tutor_telefono")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Cupo de módulos</Label>
              <Input type="number" min={0} value={form.modulos_cupo} onChange={campo("modulos_cupo")} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label className="text-xs">Perfil de estudiante</Label>
              <Textarea value={form.perfil} onChange={campo("perfil")} rows={2} />
            </div>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending || !form.nombre.trim()}>
              {isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
