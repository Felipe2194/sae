"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Camera, RotateCcw } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { GRADIENTES_FONDO, type GradienteFondoKey } from "@/lib/fondos";
import { actualizarNombre } from "./actions";

const COLORES = [
  { hex: "#E05B22", label: "Naranja UTN" },
  { hex: "#3b82f6", label: "Azul" },
  { hex: "#22c55e", label: "Verde" },
  { hex: "#a855f7", label: "Violeta" },
  { hex: "#ec4899", label: "Rosa" },
  { hex: "#14b8a6", label: "Teal" },
  { hex: "#f59e0b", label: "Ámbar" },
  { hex: "#6366f1", label: "Índigo" },
  { hex: "#ef4444", label: "Rojo" },
  { hex: "#64748b", label: "Slate" },
];

const ROL_LABEL: Record<string, string> = {
  miembro: "Miembro",
  administrador: "Administrador/a",
};

type Props = {
  nombre: string;
  email: string;
  rol: string;
  playlistUrl: string | null;
  avatarColor: string | null;
  fondoTipo: "gradiente" | "imagen" | null;
  fondoValor: string | null;
  colorPrincipal: string | null;
  colorPrincipalOrg: string | null;
};

export function PerfilForm({
  nombre: nombreInicial,
  email,
  rol,
  playlistUrl,
  avatarColor,
  fondoTipo: fondoTipoInicial,
  fondoValor: fondoValorInicial,
  colorPrincipal: colorPrincipalInicial,
  colorPrincipalOrg,
}: Props) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [playlistUrlValue, setPlaylistUrlValue] = useState(playlistUrl ?? "");
  const [color, setColor] = useState(avatarColor ?? COLORES[0].hex);
  const [colorPrincipal, setColorPrincipal] = useState<string | null>(
    colorPrincipalInicial,
  );
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [fondoTipo, setFondoTipo] = useState<
    "ninguno" | "gradiente" | "imagen"
  >(fondoTipoInicial ?? "ninguno");
  const [fondoGradiente, setFondoGradiente] =
    useState<GradienteFondoKey | null>(
      fondoTipoInicial === "gradiente"
        ? (fondoValorInicial as GradienteFondoKey)
        : null,
    );
  const [fondoImagenUrl, setFondoImagenUrl] = useState(
    fondoTipoInicial === "imagen" ? (fondoValorInicial ?? "") : "",
  );

  // Vista previa en vivo del fondo (sin guardar): se pinta directo sobre el
  // wrapper del sidebar, el mismo nodo donde el layout aplica el fondo real
  // (ver app/(app)/layout.tsx). Al guardar, el revalidate del server action
  // pisa este estilo manual con el valor confirmado — no hace falta limpiarlo
  // a mano. Si se navega afuera sin guardar, el cleanup del primer efecto lo
  // restaura al valor original (se guarda cssText completo, no solo
  // `background`, porque el gradiente vive en --fondo-light/--fondo-dark).
  const fondoWrapperRef = useRef<HTMLElement | null>(null);
  const fondoOriginalRef = useRef<string>("");

  useEffect(() => {
    const el = document.querySelector<HTMLElement>(
      '[data-slot="sidebar-wrapper"]',
    );
    fondoWrapperRef.current = el;
    fondoOriginalRef.current = el?.style.cssText ?? "";
    return () => {
      if (fondoWrapperRef.current)
        fondoWrapperRef.current.style.cssText = fondoOriginalRef.current;
    };
  }, []);

  useEffect(() => {
    const el = fondoWrapperRef.current;
    if (!el) return;
    if (fondoTipo === "gradiente" && fondoGradiente) {
      const g = GRADIENTES_FONDO[fondoGradiente];
      el.style.background = "";
      el.style.setProperty("--fondo-light", g.light);
      el.style.setProperty("--fondo-dark", g.dark);
    } else if (fondoTipo === "ninguno") {
      el.style.background = "";
      el.style.removeProperty("--fondo-light");
      el.style.removeProperty("--fondo-dark");
    }
  }, [fondoTipo, fondoGradiente]);

  // Vista previa en vivo del color del sistema — mismo criterio que el
  // fondo: se pinta directo sobre el mismo wrapper (--primary vive ahí
  // también, ver app/(app)/layout.tsx). null = "Restablecer": se previsualiza
  // el color de la organización, no el que tenía guardado antes de tocar
  // nada (eso lo maneja el cleanup del primer efecto si se navega sin
  // guardar).
  useEffect(() => {
    const el = fondoWrapperRef.current;
    if (!el) return;
    if (colorPrincipal) {
      el.style.setProperty("--primary", colorPrincipal);
    } else if (colorPrincipalOrg) {
      el.style.setProperty("--primary", colorPrincipalOrg);
    } else {
      el.style.removeProperty("--primary");
    }
  }, [colorPrincipal, colorPrincipalOrg]);

  // Imagen aparte y con debounce: sin esto, cada tecla tipeada dispara una
  // carga de imagen con la URL a medio escribir — además de inútil, algunos
  // hosts (ej. Imgur) empiezan a devolver 429/503 si les llegan demasiados
  // pedidos fallidos seguidos por el mismo recurso.
  useEffect(() => {
    if (fondoTipo !== "imagen") return;
    const el = fondoWrapperRef.current;
    if (!el || !fondoImagenUrl.trim()) return;
    const id = setTimeout(() => {
      el.style.removeProperty("--fondo-light");
      el.style.removeProperty("--fondo-dark");
      el.style.background = `url("${fondoImagenUrl.trim()}") center / cover no-repeat fixed`;
    }, 600);
    return () => clearTimeout(id);
  }, [fondoTipo, fondoImagenUrl]);

  const iniciales = nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  function handleGuardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await actualizarNombre(fd);
        setGuardado(true);
        setTimeout(() => setGuardado(false), 2500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar");
      }
    });
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Personalizá tu cuenta y cómo te ven los demás en el sistema.
        </p>
      </div>

      {/* Avatar + color */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Avatar</CardTitle>
          <CardDescription>
            Elegí un color para tu avatar. La foto de perfil estará disponible
            próximamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar className="size-20" style={{ backgroundColor: color }}>
                <AvatarFallback
                  className="text-2xl font-bold text-white"
                  style={{ backgroundColor: color }}
                >
                  {iniciales}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                className="bg-card border-border hover:bg-muted absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full border transition-colors"
                aria-label="Subir foto (próximamente)"
              >
                <Camera className="text-muted-foreground size-3.5" />
              </button>
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-base font-semibold">{nombre.split(" ")[0]}</p>
              <p className="text-muted-foreground text-sm">{email}</p>
              <Badge variant="secondary" className="mt-1 w-fit text-xs">
                {ROL_LABEL[rol] ?? rol}
              </Badge>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-sm">Color del avatar</Label>
            <div className="flex flex-wrap gap-2.5">
              {COLORES.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  title={c.label}
                  className="flex size-8 items-center justify-center rounded-full transition-all hover:scale-110"
                  style={{ backgroundColor: c.hex }}
                  aria-label={c.label}
                >
                  {color === c.hex && (
                    <Check
                      className="size-4 text-white drop-shadow"
                      strokeWidth={3}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Color del sistema (acento de botones y links en toda la app) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Color del sistema</CardTitle>
          <CardDescription>
            El color de los botones y acentos en toda la app. Por defecto es
            el de la organización — acá podés usar el tuyo propio, solo lo ve
            tu sesión.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => setColorPrincipal(null)}
              title="Color de la organización (por defecto)"
              className="border-border bg-muted hover:bg-muted/70 flex size-8 items-center justify-center rounded-full border transition-all hover:scale-110"
              style={
                colorPrincipalOrg
                  ? { backgroundColor: colorPrincipalOrg }
                  : undefined
              }
              aria-label="Restablecer al color de la organización"
            >
              {colorPrincipal === null ? (
                <Check
                  className="size-4 text-white drop-shadow"
                  strokeWidth={3}
                />
              ) : (
                <RotateCcw className="text-muted-foreground size-3.5" />
              )}
            </button>
            {COLORES.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => setColorPrincipal(c.hex)}
                title={c.label}
                className="flex size-8 items-center justify-center rounded-full transition-all hover:scale-110"
                style={{ backgroundColor: c.hex }}
                aria-label={c.label}
              >
                {colorPrincipal === c.hex && (
                  <Check
                    className="size-4 text-white drop-shadow"
                    strokeWidth={3}
                  />
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Fondo (efecto glass) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fondo</CardTitle>
          <CardDescription>
            Se pinta detrás de toda la app cuando entrás vos — las tarjetas
            quedan translúcidas por encima. Es solo tuyo, no lo ven las demás
            personas.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
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
                    setFondoGradiente(
                      Object.keys(GRADIENTES_FONDO)[0] as GradienteFondoKey,
                    );
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
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {Object.entries(GRADIENTES_FONDO).map(([key, g]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFondoGradiente(key as GradienteFondoKey)}
                  className={`fondo-mesh h-12 rounded-lg transition-all hover:scale-105 ${
                    fondoGradiente === key
                      ? "ring-primary ring-offset-background ring-2 ring-offset-2"
                      : ""
                  }`}
                  style={
                    {
                      "--fondo-light": g.light,
                      "--fondo-dark": g.dark,
                    } as React.CSSProperties
                  }
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
        </CardContent>
      </Card>

      {/* Información personal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información personal</CardTitle>
          <CardDescription>
            El email y el rol solo puede modificarlos el administrador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGuardar} className="flex flex-col gap-4">
            <input type="hidden" name="avatar_color" value={color} />
            <input
              type="hidden"
              name="color_principal"
              value={colorPrincipal ?? ""}
            />
            <input
              type="hidden"
              name="fondo_tipo"
              value={fondoTipo === "ninguno" ? "" : fondoTipo}
            />
            <input
              type="hidden"
              name="fondo_valor"
              value={
                fondoTipo === "gradiente"
                  ? (fondoGradiente ?? "")
                  : fondoTipo === "imagen"
                    ? fondoImagenUrl
                    : ""
              }
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="nombre">Nombre completo</Label>
                <Input
                  id="nombre"
                  name="nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre y apellido"
                  className="h-11"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Email</Label>
                <Input value={email} disabled className="h-11 opacity-60" />
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:w-1/2">
              <Label>Rol</Label>
              <Input
                value={ROL_LABEL[rol] ?? rol}
                disabled
                className="h-11 opacity-60"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="playlist_url">Tu playlist (opcional)</Label>
              <Input
                id="playlist_url"
                name="playlist_url"
                type="url"
                value={playlistUrlValue}
                onChange={(e) => setPlaylistUrlValue(e.target.value)}
                placeholder="https://music.youtube.com/playlist?list=..."
                className="h-11"
              />
              <p className="text-muted-foreground text-xs">
                Un link de YouTube o YouTube Music. Va a aparecer como opción
                para elegir en el widget de música de &ldquo;Hoy&rdquo;.
              </p>
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <div className="mt-2 flex items-center gap-3">
              <Button
                type="submit"
                className="h-11 px-6 text-base"
                disabled={isPending}
              >
                {guardado ? (
                  <span className="flex items-center gap-2">
                    <Check className="size-4" />
                    Guardado
                  </span>
                ) : (
                  "Guardar cambios"
                )}
              </Button>
              {guardado && (
                <p className="text-muted-foreground text-sm">
                  Los cambios se aplicaron correctamente.
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
