"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cambiarEstadoIntegrante, actualizarIntegrante, eliminarIntegrante } from "./actions";
import { ESTADOS_INTEGRANTE_VIAJE, labelEstadoIntegranteViaje } from "../tipos";
import type { EstadoIntegranteViaje } from "@/types/database";
import type { IntegranteViajeRow } from "./page";

const ESTADO_BADGE: Record<EstadoIntegranteViaje, string> = {
  pendiente: "bg-amber-200 text-amber-900 border-amber-400",
  confirmado: "bg-green-200 text-green-900 border-green-400",
  lista_espera: "bg-blue-100 text-blue-800 border-blue-200",
  rechazado: "bg-red-200 text-red-900 border-red-400",
  cancelado: "bg-muted text-muted-foreground border-transparent",
};

const ESTADO_ITEMS = Object.fromEntries(
  ESTADOS_INTEGRANTE_VIAJE.map((e) => [e.value, e.label]),
);

export function InscriptosTab({
  viajeId,
  integrantesIniciales,
  canManage,
}: {
  viajeId: string;
  integrantesIniciales: IntegranteViajeRow[];
  canManage: boolean;
}) {
  const [integrantes, setIntegrantes] = useState(integrantesIniciales);
  const [filtro, setFiltro] = useState<EstadoIntegranteViaje | "todos">("todos");
  const [, startTransition] = useTransition();

  const confirmados = integrantes.filter((i) => i.estado === "confirmado").length;

  const lista = useMemo(
    () => (filtro === "todos" ? integrantes : integrantes.filter((i) => i.estado === filtro)),
    [integrantes, filtro],
  );

  function handleCambiarEstado(id: string, estado: EstadoIntegranteViaje) {
    setIntegrantes((prev) => prev.map((i) => (i.id === id ? { ...i, estado } : i)));
    startTransition(async () => {
      try {
        await cambiarEstadoIntegrante(id, viajeId, estado);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar el estado.");
      }
    });
  }

  function handleMontoBlur(id: string, valor: string) {
    const integrante = integrantes.find((i) => i.id === id);
    if (!integrante) return;
    const monto = valor.trim() === "" ? null : parseFloat(valor);
    if (monto === integrante.monto_a_pagar) return;
    setIntegrantes((prev) => prev.map((i) => (i.id === id ? { ...i, monto_a_pagar: monto } : i)));
    startTransition(async () => {
      await actualizarIntegrante(id, viajeId, { montoAPagar: monto, notasInternas: integrante.notas_internas });
    });
  }

  function handleEliminar(id: string) {
    if (!confirm("¿Quitar a esta persona de la lista de inscriptos?")) return;
    setIntegrantes((prev) => prev.filter((i) => i.id !== id));
    startTransition(async () => {
      await eliminarIntegrante(id, viajeId);
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(["todos", ...ESTADOS_INTEGRANTE_VIAJE.map((e) => e.value)] as const).map((v) => (
              <button
                key={v}
                onClick={() => setFiltro(v)}
                className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  filtro === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {v === "todos" ? "Todos" : labelEstadoIntegranteViaje(v)}
              </button>
            ))}
          </div>
          {integrantes.length > 0 && (
            <Link href={`/reporte-viajes/${viajeId}`} target="_blank" className="text-xs underline">
              Reporte para cooperadora ({confirmados} confirmados)
            </Link>
          )}
        </div>

        {lista.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No hay inscriptos {filtro !== "todos" ? "con este estado" : "todavía"}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs">
                  <th className="px-2 py-2 font-medium">Nombre</th>
                  <th className="px-2 py-2 font-medium">DNI</th>
                  <th className="hidden px-2 py-2 font-medium sm:table-cell">Legajo</th>
                  <th className="hidden px-2 py-2 font-medium md:table-cell">Contacto</th>
                  <th className="px-2 py-2 font-medium">Estado</th>
                  <th className="px-2 py-2 font-medium">Monto</th>
                  <th className="px-2 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {lista.map((i) => (
                  <tr key={i.id} className="hover:bg-muted/40 border-b last:border-0">
                    <td className="px-2 py-2">
                      <p className="font-medium">{i.nombre} {i.apellido}</p>
                      {i.carrera && <p className="text-muted-foreground text-xs">{i.carrera}</p>}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">{i.dni}</td>
                    <td className="hidden px-2 py-2 sm:table-cell">{i.legajo ?? "—"}</td>
                    <td className="hidden px-2 py-2 md:table-cell">
                      <p className="text-xs">{i.email}</p>
                      <p className="text-muted-foreground text-xs">{i.telefono}</p>
                    </td>
                    <td className="px-2 py-2">
                      {canManage ? (
                        <Select
                          value={i.estado}
                          onValueChange={(v) => v && handleCambiarEstado(i.id, v as EstadoIntegranteViaje)}
                          items={ESTADO_ITEMS}
                        >
                          <SelectTrigger className="h-7 w-32 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ESTADOS_INTEGRANTE_VIAJE.map((e) => (
                              <SelectItem key={e.value} value={e.value}>
                                {e.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={ESTADO_BADGE[i.estado]}>
                          {labelEstadoIntegranteViaje(i.estado)}
                        </Badge>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {canManage ? (
                        <Input
                          type="number"
                          defaultValue={i.monto_a_pagar ?? ""}
                          onBlur={(e) => handleMontoBlur(i.id, e.target.value)}
                          className="h-7 w-24 text-xs"
                        />
                      ) : (
                        i.monto_a_pagar ? `$${i.monto_a_pagar.toLocaleString("es-AR")}` : "—"
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {canManage && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-muted-foreground hover:text-destructive size-7"
                          onClick={() => handleEliminar(i.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
