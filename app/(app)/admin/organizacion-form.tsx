"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
import { GRADIENTES_FONDO, type GradienteFondoKey } from "@/lib/fondos";
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
    fondo_tipo: "gradiente" | "imagen" | null;
    fondo_valor: string | null;
  };
};

export function OrganizacionForm({ organizacion }: Props) {
  const [isPending, startTransition] = useTransition();
  const [nombre, setNombre] = useState(organizacion.nombre);
  const [logoUrl, setLogoUrl] = useState(organizacion.logo_url ?? "");
  const [colorPrincipal, setColorPrincipal] = useState(organizacion.color_principal);
  const [zonaHoraria, setZonaHoraria] = useState(organizacion.zona_horaria);
  const [fondoTipo, setFondoTipo] = useState<"ninguno" | "gradiente" | "imagen">(
    organizacion.fondo_tipo ?? "ninguno",
  );
  const [fondoGradiente, setFondoGradiente] = useState<GradienteFondoKey | null>(
    organizacion.fondo_tipo === "gradiente" ? (organizacion.fondo_valor as GradienteFondoKey) : null,
  );
  const [fondoImagenUrl, setFondoImagenUrl] = useState(
    organizacion.fondo_tipo === "imagen" ? (organizacion.fondo_valor ?? "") : "",
  );
  const [guardado, setGuardado] = useState(false);

  // Vista previa en vivo del fondo (sin guardar): se pinta directo sobre el
  // wrapper del sidebar, el mismo nodo donde el layout aplica el fondo real
  // (ver app/(app)/layout.tsx). Al guardar, el revalidate del server action
  // pisa este estilo manual con el valor confirmado — no hace falta limpiarlo
  // a mano. Si se navega afuera sin guardar, el cleanup del primer efecto lo
  // restaura al valor original.
  const fondoWrapperRef = useRef<HTMLElement | null>(null);
  const fondoOriginalRef = useRef<string>("");

  useEffect(() => {
    const el = document.querySelector<HTMLElement>('[data-slot="sidebar-wrapper"]');
    fondoWrapperRef.current = el;
    fondoOriginalRef.current = el?.style.background ?? "";
    return () => {
      if (fondoWrapperRef.current) fondoWrapperRef.current.style.background = fondoOriginalRef.current;
    };
  }, []);

  useEffect(() => {
    const el = fondoWrapperRef.current;
    if (!el) return;
    if (fondoTipo === "gradiente" && fondoGradiente) {
      el.style.background = GRADIENTES_FONDO[fondoGradiente].css;
    } else if (fondoTipo === "ninguno") {
      el.style.background = "";
    }
  }, [fondoTipo, fondoGradiente]);

  // Imagen aparte y con debounce: sin esto, cada tecla tipeada dispara una
  // carga de imagen con la URL a medio escribir — además de inútil, algunos
  // hosts (ej. Imgur) empiezan a devolver 429/503 si les llegan demasiadas
  // pedidos fallidos seguidos por el mismo recurso.
  useEffect(() => {
    if (fondoTipo !== "imagen") return;
    const el = fondoWrapperRef.current;
    if (!el || !fondoImagenUrl.trim()) return;
    const id = setTimeout(() => {
      el.style.background = `url("${fondoImagenUrl.trim()}") center / cover no-repeat fixed`;
    }, 600);
    return () => clearTimeout(id);
  }, [fondoTipo, fondoImagenUrl]);

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
        fondo_tipo: fondoTipo === "ninguno" ? null : fondoTipo,
        fondo_valor:
          fondoTipo === "gradiente"
            ? fondoGradiente
            : fondoTipo === "imagen"
              ? fondoImagenUrl.trim() || null
              : null,
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

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Fondo (efecto glass)</Label>
        <p className="text-muted-foreground text-xs -mt-1">
          Se pinta detrás de toda la app — las tarjetas quedan translúcidas por encima.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { value: "ninguno", label: "Ninguno" },
              { value: "gradiente", label: "Gradiente" },
              { value: "imagen", label: "Imagen propia" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setFondoTipo(opt.value);
                // Sin esto, pasar a "Gradiente" sin elegir ninguno todavía
                // guardaba fondo_valor null — quedaba sin fondo, en silencio.
                if (opt.value === "gradiente" && !fondoGradiente) {
                  setFondoGradiente(Object.keys(GRADIENTES_FONDO)[0] as GradienteFondoKey);
                }
              }}
              className={`h-8 rounded-md border px-3 text-xs font-medium transition-colors ${
                fondoTipo === opt.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {fondoTipo === "gradiente" && (
          <div className="mt-1 grid grid-cols-4 gap-2 sm:grid-cols-8">
            {Object.entries(GRADIENTES_FONDO).map(([key, g]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFondoGradiente(key as GradienteFondoKey)}
                className={`h-12 rounded-lg transition-all hover:scale-105 ${
                  fondoGradiente === key ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                }`}
                style={{ background: g.css }}
                aria-label={g.label}
                title={g.label}
              />
            ))}
          </div>
        )}

        {fondoTipo === "imagen" && (
          <Input
            value={fondoImagenUrl}
            onChange={(e) => setFondoImagenUrl(e.target.value)}
            type="url"
            placeholder="https://..."
            className="h-9"
          />
        )}
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
