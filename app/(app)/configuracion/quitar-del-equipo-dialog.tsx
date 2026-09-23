"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  obtenerPendientesUsuario,
  quitarDelEquipo,
  type PendientesUsuario,
} from "./actions";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const SIN_REEMPLAZO = "_nadie";

function formatFecha(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function Grupo({
  titulo,
  items,
}: {
  titulo: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  const MAX = 4;
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-sm font-medium">
        {titulo} <span className="text-muted-foreground font-normal">({items.length})</span>
      </p>
      <ul className="text-muted-foreground flex flex-col gap-0.5 text-xs">
        {items.slice(0, MAX).map((item, i) => (
          <li key={i} className="truncate">
            · {item}
          </li>
        ))}
        {items.length > MAX && <li>… y {items.length - MAX} más</li>}
      </ul>
    </div>
  );
}

export function QuitarDelEquipoDialog({
  usuario,
  activos,
  open,
  onOpenChange,
}: {
  usuario: { id: string; nombre: string };
  activos: { id: string; nombre: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pendientes, setPendientes] = useState<PendientesUsuario | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reemplazoId, setReemplazoId] = useState(SIN_REEMPLAZO);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    obtenerPendientesUsuario(usuario.id)
      .then((p) => {
        if (!cancelado) setPendientes(p);
      })
      .catch((e) => {
        if (!cancelado)
          setError(e instanceof Error ? e.message : "No se pudieron cargar los pendientes.");
      });
    return () => {
      cancelado = true;
    };
  }, [open, usuario.id]);

  const otros = activos.filter((u) => u.id !== usuario.id);
  const REEMPLAZO_ITEMS = {
    [SIN_REEMPLAZO]: "Nadie (quedan sin asignar)",
    ...Object.fromEntries(otros.map((u) => [u.id, u.nombre])),
  };

  const sinPendientes =
    pendientes !== null &&
    pendientes.turnos.length === 0 &&
    pendientes.visitas.length === 0 &&
    pendientes.tareas.length === 0 &&
    pendientes.proyectos.length === 0 &&
    pendientes.viajes.length === 0 &&
    pendientes.ausenciasFuturas === 0 &&
    pendientes.coberturasFuturas === 0;

  function confirmar() {
    setError(null);
    const reemplazo = reemplazoId === SIN_REEMPLAZO ? null : reemplazoId;
    startTransition(async () => {
      try {
        const { error: errorQuitar } = await quitarDelEquipo(usuario.id, reemplazo);
        if (errorQuitar) {
          setError(errorQuitar);
          return;
        }
        const nombreReemplazo = otros.find((u) => u.id === reemplazo)?.nombre;
        toast.success(`${usuario.nombre} ya no está en el equipo.`, {
          description: nombreReemplazo
            ? `Sus pendientes pasaron a ${nombreReemplazo}.`
            : sinPendientes
              ? undefined
              : "Sus pendientes quedaron sin asignar.",
        });
        onOpenChange(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo quitar del equipo.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quitar a {usuario.nombre} del equipo</DialogTitle>
          <DialogDescription>
            Su cuenta queda inactiva (no puede entrar) y lo que tenía pendiente
            se reasigna. Lo ya hecho queda en el historial. Se puede reactivar
            más adelante.
          </DialogDescription>
        </DialogHeader>

        {pendientes === null && !error ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            Revisando pendientes…
          </p>
        ) : pendientes && sinPendientes ? (
          <p className="text-muted-foreground text-sm">
            No tiene turnos, visitas, tareas, proyectos ni viajes pendientes.
          </p>
        ) : pendientes ? (
          <div className="flex flex-col gap-4">
            <div className="bg-muted/40 flex flex-col gap-3 rounded-lg border p-3">
              <Grupo
                titulo="Turnos del cronograma"
                items={pendientes.turnos.map(
                  (t) => `${DIAS[t.dia_semana]} ${t.hora_inicio}–${t.hora_fin}`,
                )}
              />
              <Grupo
                titulo="Visitas próximas"
                items={pendientes.visitas.map(
                  (v) => `${formatFecha(v.fecha)} · ${v.colegio_nombre}`,
                )}
              />
              <Grupo
                titulo="Tareas abiertas"
                items={pendientes.tareas.map(
                  (t) => `${t.titulo}${t.coasignado ? " (co-asignada)" : ""}`,
                )}
              />
              <Grupo
                titulo="Proyectos"
                items={pendientes.proyectos.map(
                  (p) => `${p.nombre}${p.coasignado ? " (co-asignado)" : ""}`,
                )}
              />
              <Grupo titulo="Viajes" items={pendientes.viajes.map((v) => v.nombre)} />
              {(pendientes.ausenciasFuturas > 0 || pendientes.coberturasFuturas > 0) && (
                <p className="text-muted-foreground text-xs">
                  {pendientes.ausenciasFuturas > 0 &&
                    `Se borran ${pendientes.ausenciasFuturas} ausencia(s) futura(s) suyas. `}
                  {pendientes.coberturasFuturas > 0 &&
                    `Cubría ${pendientes.coberturasFuturas} turno(s) de otra persona: vuelven a quedar como ausencia sin cubrir.`}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Pasar sus pendientes a</Label>
              <Select
                value={reemplazoId}
                onValueChange={(v) => setReemplazoId(v ?? SIN_REEMPLAZO)}
                items={REEMPLAZO_ITEMS}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_REEMPLAZO}>Nadie (quedan sin asignar)</SelectItem>
                  {otros.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Después podés redistribuir todo a mano desde{" "}
                <Link href="/cronograma" className="underline">
                  Cronograma
                </Link>
                , Visitas, Tablero y Proyectos.
              </p>
            </div>
          </div>
        ) : null}

        {error && <p className="text-destructive text-xs">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={confirmar}
            disabled={isPending || pendientes === null}
          >
            {isPending ? "Quitando..." : "Quitar del equipo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
