"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { registrarPago, eliminarPago } from "./actions";
import type { IntegranteViajeRow, PagoRow } from "./page";

function formatMonto(n: number): string {
  return `$${n.toLocaleString("es-AR")}`;
}

export function PagosTab({
  viajeId,
  integrantes,
  pagosIniciales,
  canManage,
}: {
  viajeId: string;
  integrantes: IntegranteViajeRow[];
  pagosIniciales: PagoRow[];
  canManage: boolean;
}) {
  const [pagos, setPagos] = useState(pagosIniciales);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [integranteId, setIntegranteId] = useState("");
  const [monto, setMonto] = useState("");
  const [medioPago, setMedioPago] = useState("");
  const [fechaPago, setFechaPago] = useState(() => new Date().toISOString().slice(0, 10));
  const [, startTransition] = useTransition();

  // Solo tiene sentido registrar pagos de gente que efectivamente va —
  // cancelados/rechazados quedan afuera del selector.
  const integrantesActivos = integrantes.filter(
    (i) => i.estado === "confirmado" || i.estado === "pendiente",
  );
  const INTEGRANTE_ITEMS = Object.fromEntries(
    integrantesActivos.map((i) => [i.id, `${i.nombre} ${i.apellido}`]),
  );

  const saldos = useMemo(() => {
    return integrantesActivos.map((i) => {
      const pagado = pagos
        .filter((p) => p.viaje_integrante_id === i.id)
        .reduce((acc, p) => acc + p.monto, 0);
      const debe = i.monto_a_pagar ?? 0;
      return { integrante: i, pagado, saldo: debe - pagado };
    });
  }, [integrantesActivos, pagos]);

  function abrirDialog() {
    setIntegranteId(integrantesActivos[0]?.id ?? "");
    setMonto("");
    setMedioPago("");
    setFechaPago(new Date().toISOString().slice(0, 10));
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const montoNum = parseFloat(monto);
    if (!integranteId || !(montoNum > 0) || !fechaPago) return;
    startTransition(async () => {
      try {
        const nuevo = await registrarPago(viajeId, {
          viajeIntegranteId: integranteId,
          monto: montoNum,
          medioPago: medioPago.trim() || null,
          fechaPago,
        });
        if (nuevo) {
          const integrante = integrantes.find((i) => i.id === integranteId);
          setPagos((prev) => [
            {
              id: nuevo.id,
              viaje_integrante_id: integranteId,
              integrante_nombre: integrante ? `${integrante.nombre} ${integrante.apellido}` : "",
              monto: montoNum,
              medio_pago: medioPago.trim() || null,
              fecha_pago: fechaPago,
              registrado_por_nombre: "",
            },
            ...prev,
          ]);
        }
        setDialogOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo registrar el pago.");
      }
    });
  }

  function handleEliminar(id: string) {
    if (!confirm("¿Eliminar este pago?")) return;
    setPagos((prev) => prev.filter((p) => p.id !== id));
    startTransition(async () => {
      await eliminarPago(id, viajeId);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Saldo por persona</CardTitle>
          {canManage && integrantesActivos.length > 0 && (
            <Button size="sm" onClick={abrirDialog}>
              <Plus className="size-3.5" />
              Registrar pago
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {saldos.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              No hay inscriptos activos todavía.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {saldos.map(({ integrante, pagado, saldo }) => (
                <div key={integrante.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                  <span className="font-medium">{integrante.nombre} {integrante.apellido}</span>
                  <div className="text-muted-foreground flex items-center gap-3 text-xs">
                    <span>Pagado {formatMonto(pagado)}</span>
                    <span className={saldo > 0 ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>
                      {saldo > 0 ? `Debe ${formatMonto(saldo)}` : "Al día"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Historial de pagos</CardTitle>
        </CardHeader>
        <CardContent>
          {pagos.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              Todavía no se registró ningún pago.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {pagos.map((p) => (
                <div key={p.id} className="group flex items-center justify-between gap-2 py-1 text-sm">
                  <div className="flex min-w-0 flex-col">
                    <span className="font-medium">{p.integrante_nombre}</span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(p.fecha_pago + "T00:00:00").toLocaleDateString("es-AR")}
                      {p.medio_pago ? ` · ${p.medio_pago}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatMonto(p.monto)}</span>
                    {canManage && (
                      <button
                        onClick={() => handleEliminar(p.id)}
                        className="text-muted-foreground hover:text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg">Registrar pago</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="mt-1 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Inscripto</Label>
              <Select value={integranteId} onValueChange={(v) => v && setIntegranteId(v)} items={INTEGRANTE_ITEMS}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {integrantesActivos.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.nombre} {i.apellido}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Monto</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                required
                className="h-10"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Medio de pago</Label>
              <Input
                value={medioPago}
                onChange={(e) => setMedioPago(e.target.value)}
                placeholder="Efectivo, transferencia..."
                className="h-10"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Fecha</Label>
              <Input
                type="date"
                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
                required
                className="h-10"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!integranteId || !monto || !fechaPago}>
                Guardar pago
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
