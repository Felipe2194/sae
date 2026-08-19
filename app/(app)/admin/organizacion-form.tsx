"use client";

import { useState, useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { actualizarOrganizacion } from "./actions";

const COLOR_PRINCIPAL_OPTS = [
  "#E05B22", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6",
];

// Zonas horarias de Argentina — la app hoy solo se usa en el país, por eso
// una lista curada en vez de Intl.supportedValuesOf("timeZone") completo.
const ZONAS_HORARIAS = [
  { value: "America/Argentina/Cordoba", label: "Córdoba" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires" },
  { value: "America/Argentina/Mendoza", label: "Mendoza" },
  { value: "America/Argentina/Salta", label: "Salta" },
  { value: "America/Argentina/Ushuaia", label: "Ushuaia" },
];

type Props = {
  organizacion: {
    nombre: string;
    logo_url: string | null;
    color_principal: string | null;
    zona_horaria: string;
  };
};

export function OrganizacionForm({ organizacion }: Props) {
  const [isPending, startTransition] = useTransition();
  const [nombre, setNombre] = useState(organizacion.nombre);
  const [logoUrl, setLogoUrl] = useState(organizacion.logo_url ?? "");
  const [colorPrincipal, setColorPrincipal] = useState(organizacion.color_principal);
  const [zonaHoraria, setZonaHoraria] = useState(organizacion.zona_horaria);
  const [guardado, setGuardado] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setGuardado(false);
    startTransition(async () => {
      await actualizarOrganizacion({
        nombre: nombre.trim(),
        logo_url: logoUrl.trim() || null,
        color_principal: colorPrincipal,
        zona_horaria: zonaHoraria,
      });
      setGuardado(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="org-nombre" className="text-xs">Nombre</Label>
        <Input
          id="org-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          className="h-9"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="org-logo" className="text-xs">URL del logo</Label>
        <Input
          id="org-logo"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          type="url"
          placeholder="https://..."
          className="h-9"
        />
        <p className="text-muted-foreground text-xs">
          Vacío = se usa el logo por defecto de UTN Villa María.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Color principal</Label>
        <div className="flex flex-wrap items-center gap-2">
          {COLOR_PRINCIPAL_OPTS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColorPrincipal(c)}
              className="size-7 rounded-full transition-all hover:scale-110 flex items-center justify-center"
              style={{ backgroundColor: c }}
              aria-label={c}
            >
              {colorPrincipal === c && (
                <span className="size-2.5 rounded-full bg-white/80 shadow-sm" />
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setColorPrincipal(null)}
            className="text-muted-foreground hover:text-foreground text-xs underline ml-1"
          >
            Restablecer
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Zona horaria</Label>
        <Select
          value={zonaHoraria}
          onValueChange={(v) => v && setZonaHoraria(v)}
          items={Object.fromEntries(ZONAS_HORARIAS.map((z) => [z.value, z.label]))}
        >
          <SelectTrigger className="w-full h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ZONAS_HORARIAS.map((z) => (
              <SelectItem key={z.value} value={z.value}>
                {z.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          Se usa para calcular &ldquo;hoy&rdquo; en la bitácora, el cronograma y los informes.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={isPending || !nombre.trim()} className="w-fit">
          {isPending ? "Guardando..." : "Guardar cambios"}
        </Button>
        {guardado && !isPending && (
          <span className="text-muted-foreground text-xs">Guardado.</span>
        )}
      </div>
    </form>
  );
}
