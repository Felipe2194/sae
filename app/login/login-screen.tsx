"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { login, loginWithGoogle } from "./actions";

type Props = {
  logoUrl: string | null;
  brandColor: string;
};

// Pantalla de login — siempre clara, sin importar el tema del resto de la
// app (que por defecto es oscuro, ver DEFAULT_THEME en theme-provider.tsx).
// El panel de marca usa el color de la organización tal cual (es un color
// saturado, se sostiene solo); el panel del formulario fuerza el tema claro
// con la clase `light` más abajo, para no quedar oscuro cuando el resto de la
// app lo está.
//
// Vive fuera de (auth) porque ese layout envuelve todo con su propio panel
// de marca de dos columnas — esta pantalla ya arma las suyas, envolverla
// otra vez hubiera duplicado esa estructura. registro/ y
// pendiente-de-aprobacion/ se quedan con el layout viejo, no se tocaron.
export function LoginScreen({ logoUrl, brandColor }: Props) {
  const [state, action, isPending] = useActionState(login, null);
  const [verPassword, setVerPassword] = useState(false);
  // Velo de color de marca semitransparente sobre la foto de la sede — deja
  // verse el edificio pero mantiene suficiente contraste para que el logo y
  // el texto blanco de encima sigan siendo legibles con cualquier color de
  // organización.
  const brandGradient = `linear-gradient(160deg, color-mix(in oklch, ${brandColor}, transparent 22%) 0%, color-mix(in oklch, ${brandColor}, black 55%) 100%)`;

  // El login siempre se ve claro, sin importar el tema (oscuro por defecto)
  // del resto de la app: la clase `light` (app/globals.css) trae todos los
  // tokens del tema claro, fija el color de texto y color-scheme, y apaga las
  // variantes dark: de los componentes (Input, Button outline). Antes se
  // pisaban solo algunas variables a mano y quedaban etiquetas, texto
  // tipeado y el botón de Google en blanco sobre fondo claro.
  return (
    <div
      className="light flex min-h-screen items-center justify-center bg-cover bg-center bg-fixed bg-background px-4 py-10"
      style={{
        // Misma foto que el panel de marca, pero de fondo de toda la
        // pantalla — un velo casi opaco del --background claro encima para
        // que la tarjeta del formulario (blanca, sin foto detrás) siga
        // teniendo contraste y no compita visualmente con la imagen.
        backgroundImage:
          "linear-gradient(oklch(0.974 0.009 70 / 92%), oklch(0.974 0.009 70 / 92%)), url('/login-fondo.jpg')",
      }}
    >
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-border bg-card shadow-xl md:grid-cols-2">
        {/* ── Panel de marca ──────────────────────────────────────────── */}
        <div
          className="relative hidden flex-col justify-between bg-cover bg-center p-10 text-white md:flex"
          style={{
            backgroundImage: `${brandGradient}, url('/login-fondo.jpg')`,
          }}
        >
          <Link href="/" aria-label="Volver a la página principal" className="w-fit">
            {logoUrl ? (
              // Logo subido por la organización: caja blanca siempre, sea
              // cual sea el tema — no sabemos si el logo tiene texto oscuro.
              <div className="w-fit rounded-xl bg-white px-5 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- logo variable de la organización, no un asset fijo */}
                <img
                  src={logoUrl}
                  alt="UTN Villa María"
                  className="h-9 w-auto object-contain"
                />
              </div>
            ) : (
              // Sin logo propio: el panel de marca ya es un color saturado,
              // así que alcanza con la variante de texto blanco del logo UTN
              // (public/LogoUTN-dark.png) sin caja — no depende del tema de
              // la app porque este panel no lo sigue (ver comentario arriba).
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/LogoUTN-dark.png"
                alt="UTN Villa María"
                className="h-9 w-auto object-contain"
              />
            )}
          </Link>
          <p className="text-sm font-medium text-white/70">
            Sistema de Administración Estudiantil
          </p>
        </div>

        {/* ── Panel del formulario ────────────────────────────────────── */}
        <div className="flex flex-col justify-center gap-6 px-8 py-10 sm:px-12 sm:py-14">
          {/* Logo visible solo en mobile, donde el panel de marca está oculto */}
          <div className="flex justify-center md:hidden">
            <Link href="/" aria-label="Volver a la página principal">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="UTN Villa María"
                  className="h-9 w-auto object-contain"
                />
              ) : (
                // Panel siempre claro (clase `light` más arriba): alcanza con
                // la variante de texto oscuro del logo UTN, sin toggle de tema.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/LogoUTN.png"
                  alt="UTN Villa María"
                  className="h-9 w-auto object-contain"
                />
              )}
            </Link>
          </div>

          <div className="text-center md:text-left">
            <h1 className="text-2xl font-semibold text-balance text-foreground">
              Bienvenido de nuevo
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Entrá con tu cuenta de la secretaría para seguir.
            </p>
          </div>

          <form action={loginWithGoogle}>
            <Button
              type="submit"
              variant="outline"
              size="lg"
              className="h-11 w-full gap-3 text-sm"
            >
              <svg viewBox="0 0 24 24" className="size-4.5 shrink-0" aria-hidden>
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continuar con Google
            </Button>
          </form>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">o con tu cuenta</span>
            <Separator className="flex-1" />
          </div>

          <form action={action} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="nombre@frvm.utn.edu.ar"
                required
                maxLength={254}
                autoComplete="email"
                className="h-11"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={verPassword ? "text" : "password"}
                  required
                  maxLength={72}
                  autoComplete="current-password"
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setVerPassword((v) => !v)}
                  className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-10 items-center justify-center"
                  aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  tabIndex={-1}
                >
                  {verPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {state?.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}

            <button
              type="submit"
              disabled={isPending}
              style={{ backgroundColor: brandColor }}
              className="mt-1 flex h-11 items-center justify-center rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
            >
              {isPending ? "Ingresando…" : "Iniciar sesión"}
            </button>

            <p className="text-center text-xs text-muted-foreground">
              ¿Olvidaste tu contraseña? Pedile a un administrador que te la
              restablezca.
            </p>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            ¿No tenés cuenta?{" "}
            <Link
              href="/registro"
              className="text-foreground underline underline-offset-2"
            >
              Registrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
