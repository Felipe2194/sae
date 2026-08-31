"use client";

import Link from "next/link";
import { DM_Serif_Display, Nunito_Sans } from "next/font/google";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  School,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { MascotaAranita } from "@/components/features/mascota-aranita";
import { GRADIENTES_FONDO } from "@/lib/fondos";

// Landing pública de "/" — a diferencia del resto de la app, no sigue el
// theme claro/oscuro de shadcn (mismo criterio que app/login/login-screen.tsx:
// es una pantalla de marca con look fijo). La tipografía tampoco es la
// --font-inter global: acá se usan Nunito Sans (texto/UI) y DM Serif Display
// (títulos — el propio sustituto que sugiere el moodboard de referencia para
// "new-kansas", y que además solo existe en weight 400, así que es
// literalmente imposible ponerla en negrita por accidente) cargadas acá
// mismo, sin tocar el `Inter` que usa `app/layout.tsx` en el resto del sitio.
const display = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-landing-display",
});
const body = Nunito_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-landing-body",
});

type Props = {
  logoUrl: string | null;
  brandColor: string;
};

const FUNCIONALIDADES = [
  {
    icon: FolderKanban,
    titulo: "Proyectos",
    texto: "Objetivos, responsables y avance de cada proyecto de la secretaría.",
    bg: "#f788d2",
  },
  {
    icon: ListChecks,
    titulo: "Tareas y bitácora",
    texto: "Qué se hizo, quién lo hizo y qué falta, sin perder el historial.",
    bg: "#ff9147",
  },
  {
    icon: CalendarDays,
    titulo: "Calendario y cronograma",
    texto: "Vencimientos, reuniones y eventos del equipo en una sola vista.",
    bg: "#4ad5e8",
  },
  {
    icon: BarChart3,
    titulo: "Informes",
    texto: "Reportes listos para compartir con la facultad, sin armar planillas.",
    bg: "#51b1fb",
  },
  {
    icon: School,
    titulo: "Visitas a colegios",
    texto: "Directorio de escuelas, presencia del equipo y seguimiento de cada visita.",
    bg: "#ffe747",
  },
  {
    icon: LayoutDashboard,
    titulo: "Tablero",
    texto: "El estado general del equipo y sus proyectos, de un vistazo.",
    bg: "#58df8c",
  },
] as const;

const PASOS = [
  {
    icon: UserPlus,
    titulo: "Pedí tu cuenta",
    texto: "Un administrador te da de alta o te suma directo a un proyecto.",
  },
  {
    icon: Users,
    titulo: "Sumate a tu equipo",
    texto: "Vas a ver los proyectos y tareas donde participás, nada más.",
  },
  {
    icon: Sparkles,
    titulo: "Coordiná desde Hoy",
    texto: "Tu día arranca con lo que tenés pendiente, en un solo lugar.",
  },
] as const;

export function LandingScreen({ logoUrl, brandColor }: Props) {
  const logo = logoUrl || "/LogoUTN-dark.png";

  return (
    <div
      className={`${display.variable} ${body.variable}`}
      style={{ fontFamily: "var(--font-landing-body)" }}
    >
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden text-white"
        style={{ background: GRADIENTES_FONDO.atardecer.dark }}
      >
        <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <div className="rounded-xl bg-white p-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element -- logo variable de la organización */}
                <img src={logo} alt="" className="h-6 w-auto object-contain" />
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="h-6 w-auto object-contain" />
            )}
            <div className="h-5 w-px bg-white/15" />
            <span className="text-sm font-semibold tracking-wide text-white/80">
              SAE
            </span>
          </div>
          <Link
            href="/login"
            className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#1d1d1c] transition-opacity hover:opacity-90"
          >
            Iniciar sesión
            <ArrowRight className="size-4" />
          </Link>
        </nav>

        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-6 pt-10 pb-24 text-center sm:pt-16">
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-white/70">
            UTN Facultad Regional Villa María
          </span>
          <h1
            className="mt-6 max-w-2xl text-4xl leading-[1.15] font-normal text-balance sm:text-5xl md:text-6xl"
            style={{ fontFamily: "var(--font-landing-display)", letterSpacing: "-0.02em" }}
          >
            Toda la gestión académica, en un solo lugar
          </h1>
          <p className="mt-5 max-w-xl text-base text-white/70 sm:text-lg">
            Proyectos, tareas, visitas a colegios y el día a día de la
            secretaría, coordinados desde una sola plataforma pensada para el
            equipo.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[#1d1d1c] transition-opacity hover:opacity-90"
            >
              Iniciar sesión
            </Link>
            <a
              href="#funcionalidades"
              className="rounded-xl border border-white/20 px-6 py-3 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
            >
              Ver qué incluye
            </a>
          </div>

          {/* Tarjetas flotantes — maqueta ilustrativa del producto, no datos
              reales (no hay sesión todavía en esta pantalla). */}
          <div
            aria-hidden
            className="pointer-events-none mt-10 hidden w-full max-w-2xl items-end justify-center gap-4 sm:flex"
          >
            <div className="w-40 -rotate-3 rounded-xl border border-black/5 bg-white p-4 text-left text-[#1d1d1c] shadow-xl">
              <p className="text-xs text-black/50">Proyectos activos</p>
              <p className="mt-1 text-2xl font-semibold">12</p>
            </div>
            <div className="w-48 rotate-1 rounded-xl border border-black/5 bg-white p-4 text-left text-[#1d1d1c] shadow-xl">
              <p className="text-xs text-black/50">Visitas del mes</p>
              <div className="mt-2 flex h-14 items-end gap-1.5">
                {[40, 65, 50, 90, 70].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm"
                    style={{ height: `${h}%`, background: "#ff9147" }}
                  />
                ))}
              </div>
            </div>
            <div className="w-40 rotate-2 rounded-xl border border-black/5 bg-white p-4 text-left text-[#1d1d1c] shadow-xl">
              <p className="text-xs text-black/50">Bitácora</p>
              <p className="mt-1 text-sm font-medium">Al día ✓</p>
            </div>
          </div>
        </div>

        {/* Arañito, asomando abajo a la derecha del hero. */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute right-2 bottom-0 sm:right-8"
          animate={{ y: [0, -10, 0], rotate: [0, -2, 2, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <MascotaAranita className="w-32 drop-shadow-2xl sm:w-44" />
        </motion.div>
      </div>

      {/* ── Funcionalidades ───────────────────────────────────────────── */}
      <section
        id="funcionalidades"
        className="bg-[#f8f7f4] px-6 py-20 text-[#1d1d1c]"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-xl text-center">
            <h2
              className="text-3xl font-normal sm:text-4xl"
              style={{ fontFamily: "var(--font-landing-display)" }}
            >
              Lo que hace el sistema
            </h2>
            <p className="mt-3 text-[#6b6a66]">
              Un vistazo rápido a lo que vas a encontrar apenas entrás.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FUNCIONALIDADES.map(({ icon: Icon, titulo, texto, bg }) => (
              <div
                key={titulo}
                className="rounded-xl p-5 text-[#1d1d1c]"
                style={{ backgroundColor: bg }}
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-black/10">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{titulo}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#1d1d1c]/80">
                  {texto}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cómo funciona ─────────────────────────────────────────────── */}
      <section className="bg-[#f8f7f4] px-6 pb-20 text-[#1d1d1c]">
        <div className="mx-auto max-w-4xl">
          <h2
            className="text-center text-2xl font-normal sm:text-left"
            style={{ fontFamily: "var(--font-landing-display)" }}
          >
            Cómo funciona
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {PASOS.map(({ icon: Icon, titulo, texto }, i) => (
              <div key={titulo} className="text-center sm:text-left">
                <div className="mx-auto flex size-10 items-center justify-center rounded-full border border-black/10 bg-white shadow-sm sm:mx-0">
                  <Icon className="size-5" style={{ color: brandColor }} />
                </div>
                <p className="mt-4 text-xs font-semibold tracking-wide text-[#6b6a66]">
                  PASO {i + 1}
                </p>
                <h3 className="mt-1 text-lg font-semibold">{titulo}</h3>
                <p className="mt-1.5 text-sm text-[#6b6a66]">{texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Frase institucional ───────────────────────────────────────── */}
      <section className="bg-[#f8f7f4] px-6 pb-24 text-[#1d1d1c]">
        <div className="mx-auto max-w-3xl text-center">
          <p
            className="text-2xl leading-snug font-normal text-balance sm:text-4xl"
            style={{ fontFamily: "var(--font-landing-display)" }}
          >
            &ldquo;Pensado para que la gestión de la facultad ocupe menos
            tiempo y más criterio.&rdquo;
          </p>
          <p className="mt-4 text-sm font-medium text-[#6b6a66]">
            Equipo SAE · UTN FRVM
          </p>
        </div>
      </section>

      {/* ── CTA de cierre ─────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden px-6 py-24 text-center text-white"
        style={{ background: GRADIENTES_FONDO.lavanda.dark }}
      >
        <div className="relative mx-auto flex max-w-xl flex-col items-center">
          <h2
            className="text-3xl font-normal sm:text-4xl"
            style={{ fontFamily: "var(--font-landing-display)" }}
          >
            ¿Listo para entrar?
          </h2>
          <p className="mt-3 text-white/70">
            Iniciá sesión con tu cuenta de la secretaría y seguí donde lo
            dejaste.
          </p>
          <Link
            href="/login"
            className="mt-7 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[#1d1d1c] transition-opacity hover:opacity-90"
          >
            Iniciar sesión
          </Link>
        </div>
        <motion.div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-4 sm:left-10"
          animate={{ y: [0, -8, 0], rotate: [0, 2, -2, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          <MascotaAranita className="w-20 drop-shadow-2xl sm:w-28" />
        </motion.div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="bg-[#f8f7f4] px-6 py-10 text-[#1d1d1c]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-sm text-[#6b6a66] sm:flex-row">
          <span>SAE · UTN FRVM</span>
          <Link href="/registro" className="hover:text-[#1d1d1c]">
            ¿Sos parte del equipo y no tenés cuenta? Registrate
          </Link>
        </div>
      </footer>
    </div>
  );
}
