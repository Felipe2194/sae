import Link from "next/link";
import { Libre_Franklin, IBM_Plex_Mono } from "next/font/google";

// Landing pública de "/" — rediseño 2026 (ver
// landing/Rediseño landing SAE UTN/design_handoff_landing_sae/README.md).
// Página totalmente estática: sin sesión, sin datos de la organización, sin
// interactividad más allá de anclas de scroll nativas — por eso no lleva
// "use client" ni depende de la tipografía/tema del resto de la app (mismo
// criterio que antes: pantalla de marca con look fijo, no el shadcn theme).
const sans = Libre_Franklin({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-landing-sans",
});
const mono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-landing-mono",
});

const COMPARACION = [
  {
    sin: "Las tareas viven en mails, grupos de mensajes y planillas que cada uno guarda aparte.",
    con: "Tablero con Por hacer / En progreso / Hecha, filtrable por proyecto, área y prioridad.",
  },
  {
    sin: "Lo que se hizo en el día queda en la cabeza de cada uno; al otro día nadie sabe qué quedó pendiente.",
    con: "Bitácora diaria en dos campos: qué hice y qué quedó pendiente, visible para todo el equipo.",
  },
  {
    sin: "Los turnos y las ausencias se acomodan por mensajes y nunca coinciden con la realidad.",
    con: "Cronograma semanal con el turno de cada integrante y las ausencias del período marcadas.",
  },
  {
    sin: "Cuántos colegios visitamos este año se responde juntando planillas de varias personas.",
    con: "Reporte anual de visitas listo para generar: colegios, localidades, alumnos alcanzados e integrantes.",
  },
] as const;

const MODULOS = [
  {
    numero: "01",
    titulo: "Hoy",
    texto: "Tus tareas del día, el pulso del equipo, quién está en la oficina y la bitácora.",
  },
  {
    numero: "02",
    titulo: "Tablero",
    texto: "Por hacer, en progreso y hecha, con área, prioridad, fecha y responsable.",
  },
  {
    numero: "03",
    titulo: "Calendario",
    texto: "Vencimientos, reuniones, entregas y eventos del mes en una vista.",
  },
  {
    numero: "04",
    titulo: "Cronograma",
    texto: "Turnos de la semana por integrante, más ausencias y cambios.",
  },
  {
    numero: "05",
    titulo: "Proyectos",
    texto: "Becas, tutorías, deportes, salud y cada área con su avance y responsables.",
  },
  {
    numero: "06",
    titulo: "Visitas",
    texto: "Visitas a colegios, ferias y charlas, con directorio y presencia del equipo.",
  },
  {
    numero: "07",
    titulo: "Viajes",
    texto: "Inscriptos confirmados, lo recaudado y los costos de cada viaje.",
  },
  {
    numero: "08",
    titulo: "Informes",
    texto: "Carga por persona, avance por área y reportes anuales para la facultad.",
  },
] as const;

const PANTALLAS = [
  {
    src: "/landing/sae-tablero.png",
    alt: "Tablero de tareas del sistema SAE",
    titulo: "Tablero",
    metadato: "17 por hacer · 3 en progreso",
    pie: "Las tareas del equipo por estado, con área, fecha y responsable.",
  },
  {
    src: "/landing/sae-cronograma.png",
    alt: "Cronograma semanal de turnos del equipo",
    titulo: "Cronograma",
    metadato: "semana 14–18/9",
    pie: "Turnos de la semana por integrante, con ausencias y cambios.",
  },
  {
    src: "/landing/sae-visitas.png",
    alt: "Registro de visitas a colegios",
    titulo: "Visitas a colegios",
    metadato: "24 registradas en 2026",
    pie: "Próximas y realizadas, con estado, integrantes y alumnos.",
  },
  {
    src: "/landing/sae-informes.png",
    alt: "Informes y reporte anual de visitas",
    titulo: "Informes",
    metadato: "reporte anual 2026",
    pie: "1.088 alumnos alcanzados, 8 colegios y 4 localidades, en un clic.",
  },
] as const;

const NAV_LINKS = [
  { href: "#resuelve", label: "Qué resuelve" },
  { href: "#modulos", label: "Módulos" },
  { href: "#pantallas", label: "Pantallas" },
] as const;

export function LandingScreen() {
  return (
    <div
      className={`${sans.variable} ${mono.variable} bg-[#fbf9f6] text-[#1f1a16] antialiased`}
      style={{ fontFamily: "var(--font-landing-sans), system-ui, sans-serif" }}
    >
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-[#ece5dc] bg-[rgba(251,249,246,0.93)] px-[28px] py-[13px] backdrop-blur-[8px]">
        <div className="flex min-w-0 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- asset fijo, se prioriza el crop exacto del diseño */}
          <img src="/LogoUTN.png" alt="UTN Villa María" className="block h-7 w-auto" />
          <span className="border-l border-[#e3dbd1] pl-3 text-xs text-[#6b625a]">
            SAE · Sistema de Actividades Estudiantiles
          </span>
        </div>
        <nav className="flex items-center gap-[22px]">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[13.5px] font-medium text-[#4d453d] hover:text-[#1f1a16]"
            >
              {link.label}
            </a>
          ))}
          <Link
            href="/login"
            className="rounded-md bg-[#b4530a] px-4 py-[9px] text-[13.5px] font-semibold text-white hover:bg-[#8f4108]"
          >
            Iniciar sesión
          </Link>
        </nav>
      </header>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="border-b border-[#ece5dc] bg-[linear-gradient(170deg,#fdfbf8_0%,#fdf4ec_55%,#fceadd_100%)] px-[28px] pt-[66px]">
        <div className="mx-auto flex max-w-[1140px] flex-wrap items-end gap-[52px]">
          {/* Columna de copy */}
          <div className="min-w-0 flex-[1_1_360px] pb-[66px]">
            <div
              className="inline-flex items-center gap-2 rounded-[3px] border border-[#e6ded4] bg-[rgba(255,255,255,0.7)] px-[9px] py-[5px] text-[11px] tracking-[.07em] text-[#7a7067] uppercase"
              style={{ fontFamily: "var(--font-landing-mono), monospace" }}
            >
              <span className="size-[5px] rounded-full bg-[#b4530a]" />
              Uso interno · UTN FRVM
            </div>
            <h1 className="mt-[22px] text-[length:clamp(30px,3.4vw,44px)] leading-[1.09] font-bold tracking-[-0.025em] text-balance">
              El día del equipo, con tareas, turnos y bitácora en un solo
              lugar
            </h1>
            <p className="mt-5 max-w-[48ch] text-[16.5px] leading-[1.62] text-[#554d45] text-balance">
              SAE reemplaza las planillas sueltas y los mensajes de
              seguimiento: cada tarea tiene responsable y fecha, cada jornada
              queda registrada en la bitácora y cada visita a un colegio
              queda contada para el informe anual.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-md bg-[#b4530a] px-[22px] py-[13px] text-[14.5px] font-semibold text-white hover:bg-[#8f4108]"
              >
                Iniciar sesión
              </Link>
              <a
                href="#pantallas"
                className="rounded-md border border-[#ddd4c9] bg-[rgba(255,255,255,0.75)] px-[22px] py-[13px] text-[14.5px] font-semibold text-[#1f1a16] hover:border-[#b0a598]"
              >
                Ver las pantallas
              </a>
            </div>
            <div
              className="mt-[30px] flex flex-wrap gap-6 text-[11.5px] text-[#7a7067]"
              style={{ fontFamily: "var(--font-landing-mono), monospace" }}
            >
              <span>8 módulos</span>
              <span>Bitácora diaria</span>
              <span>Reporte anual de visitas</span>
            </div>
          </div>

          {/* Columna del mock — maqueta de la pantalla "Hoy", contenido fijo */}
          <div className="min-w-0 flex-[1_1_430px] self-end">
            <div className="overflow-hidden rounded-t-[10px] border border-b-0 border-[#e3dbd1] bg-[#fffdfb] shadow-[0_-2px_30px_rgba(31,26,22,0.08)]">
              <div className="flex items-center gap-2 border-b border-[#ece5dc] bg-[#f7f1ea] px-3 py-[9px]">
                <div className="flex gap-[5px]">
                  <span className="size-[9px] rounded-full bg-[#ded5ca]" />
                  <span className="size-[9px] rounded-full bg-[#ded5ca]" />
                  <span className="size-[9px] rounded-full bg-[#ded5ca]" />
                </div>
                <div
                  className="flex-1 text-center text-[10.5px] text-[#6b625a]"
                  style={{ fontFamily: "var(--font-landing-mono), monospace" }}
                >
                  SAE · UTN FRVM — Hoy
                </div>
              </div>
              <div className="flex flex-col gap-[14px] px-5 pt-[18px] pb-6">
                <div>
                  <div className="text-[11px] text-[#6b625a]">
                    Martes, 15 de septiembre de 2026
                  </div>
                  <div className="mt-[3px] text-xl font-bold tracking-[-0.02em]">
                    Buenas tardes, Dirección
                  </div>
                  <div className="mt-[3px] text-[12.5px] text-[#7a7067]">
                    2 tareas para completar hoy.
                  </div>
                </div>

                <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
                  <div className="overflow-hidden rounded-lg border border-[#ece5dc] bg-white">
                    <div className="flex items-center justify-between border-b border-[#f3ece4] px-3 py-[9px]">
                      <span className="text-[12.5px] font-semibold">
                        Mis tareas de hoy
                      </span>
                      <span
                        className="rounded-[10px] border border-[#ece5dc] px-[7px] py-px text-[10px] text-[#6b625a]"
                        style={{ fontFamily: "var(--font-landing-mono), monospace" }}
                      >
                        2
                      </span>
                    </div>
                    {["Revisar página web", "Ajustar cronograma para las visitas"].map(
                      (t, i) => (
                        <div
                          key={t}
                          className={`flex items-center gap-[9px] px-3 py-[10px] ${i === 0 ? "border-b border-[#f7f2ec]" : ""}`}
                        >
                          <span className="size-3 flex-none rounded-[3px] border-[1.5px] border-[#d8cec2]" />
                          <span className="min-w-0 flex-1 text-xs">{t}</span>
                          <span className="size-[5px] flex-none rounded-full bg-[#d98016]" />
                        </div>
                      ),
                    )}
                  </div>

                  <div className="flex flex-col gap-[9px] rounded-lg border border-[#ece5dc] bg-white px-3 py-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-semibold">
                        Bitácora del día
                      </span>
                      <span
                        className="rounded-[10px] bg-[#fbeedd] px-[7px] py-0.5 text-[9.5px] text-[#8f4108]"
                        style={{ fontFamily: "var(--font-landing-mono), monospace" }}
                      >
                        SIN CARGAR
                      </span>
                    </div>
                    <div className="text-[11px] text-[#6b625a]">Qué hice</div>
                    <div className="h-[26px] rounded-[5px] border border-[#ece5dc] bg-[#fdfbf9]" />
                    <div className="text-[11px] text-[#6b625a]">
                      Qué quedó pendiente
                    </div>
                    <div className="h-[26px] rounded-[5px] border border-[#ece5dc] bg-[#fdfbf9]" />
                    <div className="self-end rounded-[5px] bg-[#d98016] px-[10px] py-[6px] text-[10.5px] font-semibold text-white">
                      Guardar bitácora
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
                  <div className="rounded-lg border border-[#ece5dc] bg-white px-3 py-[11px]">
                    <div className="mb-[7px] text-[12.5px] font-semibold">Pulso</div>
                    {[
                      ["Abiertas", "20", "#1f1a16"],
                      ["En progreso", "3", "#1f5fa8"],
                      ["Hoy", "1", "#1f5fa8"],
                    ].map(([label, value, color], i) => (
                      <div
                        key={label}
                        className={`flex justify-between text-[11.5px] text-[#7a7067] ${i > 0 ? "mt-1" : ""}`}
                      >
                        <span>{label}</span>
                        <span className="font-bold" style={{ color }}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg border border-[#ece5dc] bg-white px-3 py-[11px]">
                    <div className="mb-[9px] flex items-center gap-1.5 text-[12.5px] font-semibold">
                      <span className="size-1.5 rounded-full bg-[#2f9e5b]" />
                      En la oficina
                    </div>
                    <div className="flex gap-[5px]">
                      {[
                        ["CA", "#c9452c"],
                        ["FE", "#d98016"],
                        ["LE", "#b08a12"],
                      ].map(([iniciales, color]) => (
                        <span
                          key={iniciales}
                          className="grid size-6 place-items-center rounded-full text-[9.5px] font-semibold text-white"
                          style={{ background: color }}
                        >
                          {iniciales}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 text-[11px] text-[#6b625a]">
                      Cande, Felipe, Leo
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 01 · Qué resuelve ─────────────────────────────────────────── */}
      <section id="resuelve" className="border-b border-[#ece5dc] px-[28px] py-[78px]">
        <div className="mx-auto max-w-[1140px]">
          <div className="max-w-[62ch]">
            <div
              className="text-[11px] tracking-[.08em] text-[#6b625a] uppercase"
              style={{ fontFamily: "var(--font-landing-mono), monospace" }}
            >
              01 · Qué resuelve
            </div>
            <h2 className="mt-3 text-[29px] leading-[1.2] font-bold tracking-[-0.02em]">
              El problema no es la falta de trabajo: es no saber dónde quedó
            </h2>
            <p className="mt-[14px] text-[15.5px] leading-[1.62] text-[#554d45]">
              Cada cosa que hace el equipo deja rastro en un lugar distinto.
              SAE junta ese rastro en un registro único.
            </p>
          </div>

          <div className="mt-[34px] overflow-hidden rounded-[10px] border border-[#ece5dc] bg-white">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] border-b border-[#ece5dc] bg-[#faf6f1]">
              <div
                className="px-5 py-[11px] text-[10.5px] tracking-[.08em] text-[#6b625a] uppercase"
                style={{ fontFamily: "var(--font-landing-mono), monospace" }}
              >
                Sin sistema
              </div>
              <div
                className="border-l border-[#ece5dc] px-5 py-[11px] text-[10.5px] tracking-[.08em] text-[#8f4108] uppercase"
                style={{ fontFamily: "var(--font-landing-mono), monospace" }}
              >
                Con SAE
              </div>
            </div>
            {COMPARACION.map((fila, i) => (
              <div
                key={fila.sin}
                className={`grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] ${
                  i < COMPARACION.length - 1 ? "border-b border-[#f3ece4]" : ""
                }`}
              >
                <div className="px-5 py-5 text-[14.5px] leading-[1.6] text-[#7a7067]">
                  {fila.sin}
                </div>
                <div className="border-l border-[#f3ece4] px-5 py-5 text-[14.5px] leading-[1.6]">
                  {fila.con}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 02 · Módulos ──────────────────────────────────────────────── */}
      <section id="modulos" className="border-b border-[#ece5dc] bg-[#f8f4ef] px-[28px] py-[78px]">
        <div className="mx-auto max-w-[1140px]">
          <div className="flex flex-wrap items-start gap-[46px]">
            <div className="min-w-0 max-w-[340px] flex-[1_1_260px]">
              <div
                className="text-[11px] tracking-[.08em] text-[#6b625a] uppercase"
                style={{ fontFamily: "var(--font-landing-mono), monospace" }}
              >
                02 · Módulos
              </div>
              <h2 className="mt-3 text-[29px] leading-[1.2] font-bold tracking-[-0.02em]">
                Lo que hace el sistema
              </h2>
              <p className="mt-[14px] text-[15.5px] leading-[1.62] text-[#554d45]">
                Ocho secciones que comparten los mismos datos: se carga una
                vez y aparece donde hace falta.
              </p>
            </div>

            <div className="grid min-w-0 flex-[2_1_460px] grid-cols-[repeat(auto-fit,minmax(215px,1fr))] gap-px overflow-hidden rounded-[10px] border border-[#e8e1d9] bg-[#e8e1d9]">
              {MODULOS.map((m) => (
                <div key={m.numero} className="bg-white px-5 py-[22px]">
                  <div
                    className="text-[10.5px] text-[#776e66]"
                    style={{ fontFamily: "var(--font-landing-mono), monospace" }}
                  >
                    {m.numero}
                  </div>
                  <h3 className="mt-[9px] mb-1.5 text-[15.5px] font-semibold">
                    {m.titulo}
                  </h3>
                  <p className="text-[13.5px] leading-[1.55] text-[#6b625a]">
                    {m.texto}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 03 · Pantallas ────────────────────────────────────────────── */}
      <section id="pantallas" className="border-b border-[#ece5dc] px-[28px] py-[78px]">
        <div className="mx-auto max-w-[1140px]">
          <div className="max-w-[60ch]">
            <div
              className="text-[11px] tracking-[.08em] text-[#6b625a] uppercase"
              style={{ fontFamily: "var(--font-landing-mono), monospace" }}
            >
              03 · Pantallas
            </div>
            <h2 className="mt-3 text-[29px] leading-[1.2] font-bold tracking-[-0.02em]">
              Así se ve adentro
            </h2>
            <p className="mt-[14px] text-[15.5px] leading-[1.62] text-[#554d45]">
              Capturas del sistema en uso, con datos del ciclo 2026.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-7">
            {PANTALLAS.map((p) => (
              <figure key={p.titulo} className="m-0 min-w-0">
                <div className="overflow-hidden rounded-[9px] border border-[#e3dbd1] bg-white">
                  <div className="flex items-center justify-between gap-2.5 border-b border-[#ece5dc] bg-[#faf6f1] px-[13px] py-[9px]">
                    <span className="text-xs font-semibold text-[#4d453d]">
                      {p.titulo}
                    </span>
                    <span
                      className="text-[10px] text-[#776e66]"
                      style={{ fontFamily: "var(--font-landing-mono), monospace" }}
                    >
                      {p.metadato}
                    </span>
                  </div>
                  <div className="max-h-[460px] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element -- crop exacto (object-fit cover + object-position top) sobre altura variable */}
                    <img
                      src={p.src}
                      alt={p.alt}
                      className="block h-auto w-full object-cover object-top"
                    />
                  </div>
                </div>
                <figcaption className="mt-2.5 text-[12.5px] text-[#6b625a]">
                  {p.pie}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ─────────────────────────────────────────────────── */}
      <section className="px-[28px] py-[70px]">
        <div className="mx-auto flex max-w-[1140px] flex-wrap items-center justify-between gap-[26px] rounded-[10px] border border-[#ece5dc] bg-white p-8">
          <div className="min-w-0">
            <h2 className="mb-2 text-[21px] font-bold tracking-[-0.02em]">
              Acceso para el equipo del SAE
            </h2>
            <p className="text-[14.5px] text-[#554d45]">
              Las cuentas las habilita un administrador. Cada integrante ve
              los proyectos donde participa.
            </p>
          </div>
          <div className="flex flex-none flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-md bg-[#b4530a] px-[22px] py-[13px] text-[14.5px] font-semibold text-white hover:bg-[#8f4108]"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/registro"
              className="rounded-md border border-[#ddd4c9] px-[22px] py-[13px] text-[14.5px] font-semibold text-[#1f1a16] hover:border-[#b0a598]"
            >
              Pedir alta
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#ece5dc] px-[28px] py-6">
        <div className="mx-auto flex max-w-[1140px] flex-wrap items-center justify-between gap-3.5 text-[12.5px] text-[#6b625a]">
          <span style={{ fontFamily: "var(--font-landing-mono), monospace" }}>
            SAE · Sistema de Actividades Estudiantiles · UTN FRVM
          </span>
          <Link href="/registro" className="text-[12.5px] hover:text-[#1f1a16]">
            Registro de nuevos usuarios
          </Link>
        </div>
      </footer>
    </div>
  );
}
