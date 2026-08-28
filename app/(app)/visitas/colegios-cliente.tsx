"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Mail, Copy, ClipboardCopy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { actualizarColegio, type ColegioUpdateInput } from "./actions";
import { ESTADOS_RELACION_COLEGIO } from "./tipos";
import type { ColegioFila } from "./page";

const ESTADO_RELACION_BADGE: Record<
  ColegioFila["estado_relacion"],
  string
> = {
  nuevo: "bg-blue-100 text-blue-800 border-blue-200",
  activo: "bg-green-100 text-green-800 border-green-200",
  inactivo: "bg-muted text-muted-foreground",
};

function formatFecha(iso: string | null): string {
  if (!iso) return "Sin visitas";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function ColegioEditDialog({
  colegio,
  open,
  onOpenChange,
}: {
  colegio: ColegioFila;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [nombre, setNombre] = useState(colegio.nombre);
  const [ciudad, setCiudad] = useState(colegio.ciudad ?? "");
  const [zona, setZona] = useState(colegio.zona ?? "");
  const [contactoNombre, setContactoNombre] = useState(colegio.contacto_nombre ?? "");
  const [contactoCargo, setContactoCargo] = useState(colegio.contacto_cargo ?? "");
  const [contactoEmail, setContactoEmail] = useState(colegio.contacto_email ?? "");
  const [contactoTelefono, setContactoTelefono] = useState(colegio.contacto_telefono ?? "");
  const [estadoRelacion, setEstadoRelacion] = useState(colegio.estado_relacion);

  const ESTADO_ITEMS = Object.fromEntries(
    ESTADOS_RELACION_COLEGIO.map((e) => [e.value, e.label]),
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    const payload: ColegioUpdateInput = {
      nombre: nombre.trim(),
      ciudad: ciudad.trim() || null,
      zona: zona.trim() || null,
      contactoNombre: contactoNombre.trim() || null,
      contactoCargo: contactoCargo.trim() || null,
      contactoEmail: contactoEmail.trim() || null,
      contactoTelefono: contactoTelefono.trim() || null,
      estadoRelacion,
    };
    startTransition(async () => {
      await actualizarColegio(colegio.id, payload);
      toast.success("Colegio actualizado.");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar colegio</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-1 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Nombre *</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              className="h-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Ciudad / Localidad</Label>
              <Input
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Zona / Región</Label>
              <Input
                value={zona}
                onChange={(e) => setZona(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Contacto</Label>
              <Input
                value={contactoNombre}
                onChange={(e) => setContactoNombre(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Cargo</Label>
              <Input
                value={contactoCargo}
                onChange={(e) => setContactoCargo(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={contactoEmail}
                onChange={(e) => setContactoEmail(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Teléfono</Label>
              <Input
                value={contactoTelefono}
                onChange={(e) => setContactoTelefono(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Estado de la relación</Label>
            <Select
              value={estadoRelacion}
              onValueChange={(v) =>
                setEstadoRelacion((v ?? "nuevo") as ColegioFila["estado_relacion"])
              }
              items={ESTADO_ITEMS}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS_RELACION_COLEGIO.map((e) => (
                  <SelectItem key={e.value} value={e.value}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending || !nombre.trim()}>
              {isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function copiarTexto(texto: string, mensaje: string) {
  navigator.clipboard.writeText(texto);
  toast.success(mensaje);
}

// Barra sobre la tabla para llegar rápido a los emails de contacto — son el
// dato que más se va a necesitar más adelante para mandarles información a
// los colegios, así que "copiar todos" tiene que estar a un click, no
// escondido adentro de cada fila.
function BarraEmails({ colegios }: { colegios: ColegioFila[] }) {
  const emails = Array.from(
    new Set(
      colegios
        .map((c) => c.contacto_email?.trim())
        .filter((e): e is string => !!e),
    ),
  );

  return (
    <div className="bg-muted/30 flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Mail className="size-3.5" />
        {emails.length} de {colegios.length} colegios con email cargado
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        disabled={emails.length === 0}
        onClick={() =>
          copiarTexto(
            emails.join(", "),
            `${emails.length} email${emails.length !== 1 ? "s" : ""} copiado${emails.length !== 1 ? "s" : ""} al portapapeles.`,
          )
        }
      >
        <ClipboardCopy className="size-3.5" />
        Copiar todos los emails
      </Button>
    </div>
  );
}

export function ColegiosCliente({ colegios }: { colegios: ColegioFila[] }) {
  const [editando, setEditando] = useState<ColegioFila | null>(null);

  if (colegios.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        Todavía no hay colegios cargados — se agregan solos al crear una visita.
      </p>
    );
  }

  return (
    <div>
      <BarraEmails colegios={colegios} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs">
              <th className="px-3 py-2 font-medium">Colegio</th>
              <th className="px-3 py-2 font-medium">Ciudad / Zona</th>
              <th className="hidden px-3 py-2 font-medium sm:table-cell">Contacto</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="hidden px-3 py-2 font-medium sm:table-cell">Total visitas</th>
              <th className="hidden px-3 py-2 font-medium sm:table-cell">Última visita</th>
              <th className="hidden px-3 py-2 font-medium sm:table-cell">Relación</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {colegios.map((c) => (
              <tr key={c.id} className="hover:bg-muted/40 border-b last:border-0">
                <td className="px-3 py-2 font-medium">{c.nombre}</td>
                <td className="text-muted-foreground px-3 py-2">
                  {[c.ciudad, c.zona].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="text-muted-foreground hidden px-3 py-2 sm:table-cell">
                  {c.contacto_nombre ? (
                    <>
                      {c.contacto_nombre}
                      {c.contacto_cargo ? ` (${c.contacto_cargo})` : ""}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2">
                  {c.contacto_email ? (
                    <div className="flex items-center gap-1">
                      <a
                        href={`mailto:${c.contacto_email}`}
                        className="text-primary block max-w-20 truncate hover:underline sm:max-w-40"
                        title={c.contacto_email}
                      >
                        {c.contacto_email}
                      </a>
                      <button
                        type="button"
                        onClick={() =>
                          copiarTexto(c.contacto_email!, "Email copiado al portapapeles.")
                        }
                        className="text-muted-foreground hover:text-foreground hidden shrink-0 sm:inline"
                        title="Copiar email"
                      >
                        <Copy className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
                <td className="hidden px-3 py-2 sm:table-cell">{c.total_visitas}</td>
                <td className="text-muted-foreground hidden px-3 py-2 sm:table-cell">
                  {formatFecha(c.ultima_visita)}
                </td>
                <td className="hidden px-3 py-2 sm:table-cell">
                  <Badge
                    variant="outline"
                    className={ESTADO_RELACION_BADGE[c.estado_relacion]}
                  >
                    {ESTADOS_RELACION_COLEGIO.find((e) => e.value === c.estado_relacion)?.label}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={() => setEditando(c)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editando && (
        <ColegioEditDialog
          colegio={editando}
          open={!!editando}
          onOpenChange={(v) => !v && setEditando(null)}
        />
      )}
    </div>
  );
}
