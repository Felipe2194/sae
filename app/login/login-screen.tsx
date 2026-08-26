"use client";

import { useActionState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { MascotaTigre } from "@/components/features/mascota-tigre";
import { GRADIENTES_FONDO } from "@/lib/fondos";
import { login, loginWithGoogle } from "./actions";

type Props = {
  logo: string;
  brandColor: string;
};

// Pantalla de login rediseñada a pedido — ventana flotante sobre un fondo con
// glow, estética fija (no seguía el tema claro/oscuro del resto de la app;
// esta pantalla se ve igual sea cual sea el tema del que entra, como el
// panel de marca que ya tenía (auth)/layout.tsx antes de este cambio). Por
// eso todo acá es color literal, no tokens de shadcn — mezclarlos haría que
// el formulario se rompiera en modo claro.
//
// Vive fuera de (auth) porque ese layout envuelve todo con su propio panel
// de marca de dos columnas — esta pantalla ya arma las suyas, envolverla
// otra vez hubiera duplicado esa estructura. registro/ y
// pendiente-de-aprobacion/ se quedan con el layout viejo, no se tocaron.
export function LoginScreen({ logo, brandColor }: Props) {
  const [state, action, isPending] = useActionState(login, null);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#08080b] px-4 py-10">
      {/* Glow de fondo — mismos gradientes que el resto de la app usa para
          "fondo glass" (perfil, pantalla de error), para que esta pantalla
          no introduzca una paleta nueva de la nada. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <motion.div
          className="absolute top-[-14rem] left-1/2 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full opacity-50 blur-[110px]"
          style={{ background: GRADIENTES_FONDO.atardecer.dark }}
          animate={{ x: [0, 40, -30, 0], y: [0, 20, -15, 0] }}
          transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute right-[-10rem] bottom-[-10rem] h-[30rem] w-[30rem] rounded-full opacity-40 blur-[100px]"
          style={{ background: GRADIENTES_FONDO.lavanda.dark }}
          animate={{ x: [0, -25, 15, 0], y: [0, -20, 10, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-[#111114] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.6)]">
        {/* Barra tipo ventana de escritorio — puramente decorativa. */}
        <div className="flex items-center gap-1.5 border-b border-white/5 px-4 py-3">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </div>

        <div className="grid md:grid-cols-2">
          {/* ── Panel del formulario ──────────────────────────────────── */}
          <div className="flex flex-col justify-center gap-6 px-8 py-10 sm:px-12 sm:py-14">
            <div className="flex flex-col items-center gap-4 text-center md:items-start md:text-left">
              <div className="rounded-xl bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- logo variable de la organización, no un asset fijo */}
                <img
                  src={logo}
                  alt="UTN Villa María"
                  className="h-7 w-auto object-contain"
                />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-balance text-white">
                  Bienvenido de nuevo
                </h1>
                <p className="mt-1 text-sm text-white/50">
                  Entrá con tu cuenta de la secretaría para seguir.
                </p>
              </div>
            </div>

            <form action={loginWithGoogle}>
              <button
                type="submit"
                className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-white/10 bg-white/5 text-sm font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-4.5 shrink-0"
                  aria-hidden
                >
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
              </button>
            </form>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-white/40">o con tu cuenta</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <form action={action} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm text-white/70">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="nombre@frvm.utn.edu.ar"
                  required
                  className="h-11 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/30 focus-visible:border-white/30"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-sm text-white/70">
                  Contraseña
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="h-11 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus-visible:border-white/30"
                />
              </div>

              {state?.error && (
                <p className="text-sm text-red-400">{state.error}</p>
              )}

              <button
                type="submit"
                disabled={isPending}
                style={{ backgroundColor: brandColor }}
                className="mt-1 flex h-11 items-center justify-center rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 disabled:opacity-60"
              >
                {isPending ? "Ingresando…" : "Iniciar sesión"}
              </button>

              <p className="text-center text-xs text-white/40">
                ¿Olvidaste tu contraseña? Pedile a un administrador que te la
                restablezca.
              </p>
            </form>

            <p className="text-center text-sm text-white/50">
              ¿No tenés cuenta?{" "}
              <Link
                href="/registro"
                className="text-white underline underline-offset-2"
              >
                Registrate
              </Link>
            </p>
          </div>

          {/* ── Panel de ilustración ──────────────────────────────────── */}
          <div
            className="relative hidden items-center justify-center overflow-hidden md:flex"
            style={{
              background: `linear-gradient(160deg, ${brandColor}40, #16141a 75%)`,
            }}
          >
            <motion.div
              animate={{ y: [0, -10, 0], rotate: [0, -2, 2, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <MascotaTigre className="w-56 drop-shadow-2xl" />
            </motion.div>
            <div className="absolute right-4 bottom-4 rounded-full bg-black/40 px-3 py-1 text-xs text-white/80 backdrop-blur">
              SAE · UTN FRVM
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
