"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Check, Copy, Pencil, RefreshCw, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/features/user-avatar";
import { cn } from "@/lib/utils";
import { ViajeDialog } from "../viaje-dialog";
import { regenerarCodigoPublico, actualizarCodigoPublico } from "../actions";
import { labelEstadoViaje } from "../tipos";
import { ViajeDocumentos } from "./viaje-documentos";
import { CostosTab } from "./costos-tab";
import { InscriptosTab } from "./inscriptos-tab";
import { PagosTab } from "./pagos-tab";
import type { UsuarioOption } from "../page";
import type {
  CostoRow,
  DocumentoViajeRow,
  IntegranteViajeRow,
  PagoRow,
  TareaCostoRow,
  ViajeDetalle,
} from "./page";

const ESTADO_BADGE: Record<ViajeDetalle["estado"], string> = {
  borrador: "bg-muted text-muted-foreground border-transparent",
  inscripciones_abiertas: "bg-green-200 text-green-900 border-green-400",
  inscripciones_cerradas: "bg-amber-200 text-amber-900 border-amber-400",
  realizado: "bg-blue-100 text-blue-800 border-blue-200",
  cancelado: "bg-red-200 text-red-900 border-red-400",
};

function formatFecha(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

type Asignado = { id: string; nombre: string; avatar_color: string | null };
type Pestaña = "inscriptos" | "equipo" | "costos" | "pagos" | "documentos";

const PESTAÑAS: { value: Pestaña; label: string }[] = [
  { value: "inscriptos", label: "Inscriptos" },
  { value: "equipo", label: "Equipo" },
  { value: "costos", label: "Costos" },
  { value: "pagos", label: "Pagos" },
  { value: "documentos", label: "Documentos" },
];

type Props = {
  viaje: ViajeDetalle;
  asignados: Asignado[];
  usuarios: UsuarioOption[];
  documentos: DocumentoViajeRow[];
  tareasCosteo: TareaCostoRow[];
  costos: CostoRow[];
  integrantes: IntegranteViajeRow[];
  pagos: PagoRow[];
  canManage: boolean;
  currentUserId: string;
};

export function ViajeDetalleCliente({
  viaje,
  asignados,
  usuarios,
  documentos,
  tareasCosteo,
  costos,
  integrantes,
  pagos,
  canManage,
  currentUserId,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pestaña, setPestaña] = useState<Pestaña>("inscriptos");
  const [regenerando, setRegenerando] = useState(false);
  const [codigo, setCodigo] = useState(viaje.codigo_publico);
  const [editandoCodigo, setEditandoCodigo] = useState(false);
  const [codigoInput, setCodigoInput] = useState(viaje.codigo_publico);
  const [guardandoCodigo, setGuardandoCodigo] = useState(false);

  function abrirEdicionCodigo() {
    setCodigoInput(codigo);
    setEditandoCodigo(true);
  }

  function handleGuardarCodigo() {
    if (codigoInput.trim() === codigo) {
      setEditandoCodigo(false);
      return;
    }
    setGuardandoCodigo(true);
    actualizarCodigoPublico(viaje.id, codigoInput)
      .then((resultado) => {
        if ("error" in resultado) {
          toast.error(resultado.error);
          return;
        }
        setCodigo(resultado.codigo);
        setEditandoCodigo(false);
        toast.success("Se actualizó el link de inscripción.");
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar el código.");
      })
      .finally(() => setGuardandoCodigo(false));
  }

  function copiarLinkPublico() {
    const url = `${window.location.origin}/inscripcion-viaje/${codigo}`;
    navigator.clipboard.writeText(url);
    toast.success("Link de inscripción copiado al portapapeles.");
  }

  function handleRegenerarCodigo() {
    if (
      !confirm(
        "El link anterior deja de funcionar. ¿Regenerar el código de inscripción?",
      )
    ) {
      return;
    }
    setRegenerando(true);
    regenerarCodigoPublico(viaje.id)
      .then(({ codigo }) => {
        setCodigo(codigo);
        toast.success("Se generó un nuevo link de inscripción.");
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "No se pudo regenerar el código.");
      })
      .finally(() => setRegenerando(false));
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <Link
        href="/viajes"
        className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-3.5" />
        Viajes
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{viaje.nombre}</h1>
            <Badge variant="outline" className={ESTADO_BADGE[viaje.estado]}>
              {labelEstadoViaje(viaje.estado)}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            {viaje.destino} · {formatFecha(viaje.fecha_inicio)}
            {viaje.fecha_fin ? ` – ${formatFecha(viaje.fecha_fin)}` : ""}
            {viaje.precio ? ` · $${viaje.precio.toLocaleString("es-AR")}` : ""}
          </p>
        </div>
        {canManage && (
          <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
            <Pencil className="size-3.5" />
            Editar viaje
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Link de inscripción</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          {editandoCodigo ? (
            <>
              <span className="text-muted-foreground text-xs whitespace-nowrap">
                /inscripcion-viaje/
              </span>
              <Input
                value={codigoInput}
                onChange={(e) => setCodigoInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleGuardarCodigo();
                  if (e.key === "Escape") setEditandoCodigo(false);
                }}
                autoFocus
                className="h-8 w-40 text-xs"
              />
              <Button size="icon" variant="ghost" className="size-8" disabled={guardandoCodigo} onClick={handleGuardarCodigo}>
                <Check className="size-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="size-8" onClick={() => setEditandoCodigo(false)}>
                <X className="size-3.5" />
              </Button>
            </>
          ) : (
            <>
              <code className="bg-muted rounded px-2 py-1 text-xs">
                /inscripcion-viaje/{codigo}
              </code>
              {canManage && (
                <Button size="icon" variant="ghost" className="size-7" onClick={abrirEdicionCodigo} title="Editar link">
                  <Pencil className="size-3.5" />
                </Button>
              )}
            </>
          )}
          <Button size="sm" variant="outline" onClick={copiarLinkPublico}>
            <Copy className="size-3.5" />
            Copiar link
          </Button>
          {canManage && (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              disabled={regenerando}
              onClick={handleRegenerarCodigo}
            >
              <RefreshCw className="size-3.5" />
              Generar al azar
            </Button>
          )}
          {viaje.estado !== "inscripciones_abiertas" && (
            <p className="text-muted-foreground w-full text-xs">
              El link no acepta nuevos inscriptos: el viaje no está en
              &quot;Inscripciones abiertas&quot;.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="bg-muted flex w-fit items-center gap-1 rounded-lg p-1">
        {PESTAÑAS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPestaña(p.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              pestaña === p.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {pestaña === "inscriptos" && (
        <InscriptosTab viajeId={viaje.id} integrantesIniciales={integrantes} canManage={canManage} />
      )}

      {pestaña === "equipo" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="text-muted-foreground size-4" />
              Equipo organizador
            </CardTitle>
            {canManage && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setDialogOpen(true)}
              >
                <Pencil className="size-3.5" />
                Editar
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {asignados.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                Todavía no hay nadie asignado a este viaje.
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {asignados.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 text-sm">
                    <UserAvatar nombre={a.nombre} avatarColor={a.avatar_color} size="sm" />
                    {a.nombre}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {pestaña === "costos" && (
        <CostosTab
          viajeId={viaje.id}
          tareasIniciales={tareasCosteo}
          costosIniciales={costos}
          canManage={canManage}
        />
      )}

      {pestaña === "pagos" && (
        <PagosTab viajeId={viaje.id} integrantes={integrantes} pagosIniciales={pagos} canManage={canManage} />
      )}

      {pestaña === "documentos" && (
        <ViajeDocumentos viajeId={viaje.id} documentosIniciales={documentos} canManage={canManage} />
      )}

      <ViajeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        usuarios={usuarios}
        currentUserId={currentUserId}
        viajeInicial={viaje}
        asignadosInicialesIds={asignados.map((a) => a.id)}
      />
    </div>
  );
}
