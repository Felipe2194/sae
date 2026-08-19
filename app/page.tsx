import Image from "next/image";
import Link from "next/link";
import { LockKeyhole, UserPlus, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/features/theme-toggle";
import { sql } from "@/lib/db";

// Sin sesión todavía — se consulta la única organización del sistema
// directamente para reflejar su logo/color, igual que hace (auth)/layout.tsx.
// Next no detecta la query como razón para renderizar dinámico (no es fetch
// ni usa cookies()/headers()), así que se fuerza para no dejar el logo/color
// pegados al valor que tenía la organización al momento del build.
export const dynamic = "force-dynamic";

const CARDS = [
  {
    title: "Acceso restringido",
    desc: "Solo el personal autorizado por el administrador puede ingresar al sistema.",
    icon: LockKeyhole,
  },
  {
    title: "Solicitud de cuenta",
    desc: "Podés registrarte y solicitar acceso. El administrador te habilitará los permisos correspondientes.",
    icon: UserPlus,
  },
  {
    title: "Login con Google",
    desc: "Podés ingresar con tu cuenta institucional de Google (@frvm.utn.edu.ar).",
    icon: LogIn,
  },
];

export default async function HomePage() {
  const [org] = await sql<{ logo_url: string | null; color_principal: string | null }[]>`
    select logo_url, color_principal from organizacion where slug = 'sae-frvm' limit 1
  `;
  const logo = org?.logo_url || "/LogoUTN.png";
  const brandColor = org?.color_principal || "var(--primary)";

  return (
    <div className="flex flex-1 flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-lg px-2.5 py-1.5 shadow-sm shrink-0">
            <Image
              src={logo}
              alt="UTN Villa María"
              width={120}
              height={36}
              className="h-6 w-auto object-contain"
            />
          </div>
          <div className="leading-tight hidden sm:block">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              UTN Facultad Regional Villa María
            </p>
            <p className="font-semibold text-base text-foreground">
              SAE — Secretaría de Asuntos Estudiantiles
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button render={<Link href="/login" />} nativeButton={false} size="lg" className="text-base">
            Iniciar sesión
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-20 text-center gap-10 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.15]"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${brandColor}, transparent 60%)`,
          }}
        />

        <div className="flex flex-col items-center gap-6 max-w-2xl">
          <div className="bg-white rounded-2xl px-8 py-5 shadow-lg">
            <Image
              src={logo}
              alt="UTN Villa María"
              width={220}
              height={66}
              className="object-contain"
              priority
            />
          </div>
          <div className="flex flex-col items-center gap-4">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">
              Bienvenido al SAE
            </h1>
            <p className="text-xl text-muted-foreground">
              Sistema de Administración Estudiantil de la{" "}
              <span style={{ color: brandColor }} className="font-semibold">
                UTN Facultad Regional Villa María
              </span>
            </p>
            <p className="text-muted-foreground max-w-md">
              Gestioná tareas, áreas y el calendario de la secretaría en un solo
              lugar. Para acceder necesitás una cuenta aprobada por el administrador.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            render={<Link href="/login" />}
            nativeButton={false}
            size="lg"
            className="h-12 px-8 text-base"
          >
            Iniciar sesión
          </Button>
          <Button
            render={<Link href="/registro" />}
            nativeButton={false}
            variant="outline"
            size="lg"
            className="h-12 px-8 text-base"
          >
            Solicitar acceso
          </Button>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl w-full text-left">
          {CARDS.map(({ title, desc, icon: Icon }) => (
            <div
              key={title}
              className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3 transition-colors hover:border-foreground/20"
            >
              <div
                className="flex size-9 items-center justify-center rounded-lg"
                style={{ backgroundColor: `color-mix(in oklch, ${brandColor}, transparent 85%)`, color: brandColor }}
              >
                <Icon className="size-4.5" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold text-base text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 text-center text-sm text-muted-foreground">
        UTN Facultad Regional Villa María · Secretaría de Asuntos Estudiantiles
      </footer>
    </div>
  );
}
