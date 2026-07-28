import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col min-h-screen">
      {/* Header */}
      <header className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/LogoUTN.png"
            alt="Logo UTN"
            width={40}
            height={40}
            className="object-contain"
          />
          <div className="leading-tight">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              UTN Facultad Regional Villa María
            </p>
            <p className="font-semibold text-base">
              SAE — Secretaría de Asuntos Estudiantiles
            </p>
          </div>
        </div>
        <Button render={<Link href="/login" />} nativeButton={false} size="lg" className="text-base">
          Iniciar sesión
        </Button>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center gap-8">
        <div className="flex flex-col items-center gap-4 max-w-2xl">
          <div className="size-24 rounded-3xl bg-[oklch(0.62_0.19_42)] flex items-center justify-center shadow-lg">
            <Image
              src="/LogoUTN.png"
              alt="Logo UTN"
              width={72}
              height={72}
              className="object-contain brightness-0 invert"
            />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mt-2">
            Bienvenido al SAE
          </h1>
          <p className="text-xl text-muted-foreground">
            Sistema de Administración Estudiantil de la{" "}
            <span className="text-[oklch(0.62_0.19_42)] font-semibold">
              UTN Facultad Regional Villa María
            </span>
          </p>
          <p className="text-muted-foreground max-w-md">
            Gestioná tareas, áreas y el calendario de la secretaría en un solo
            lugar. Para acceder necesitás una cuenta aprobada por el administrador.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-2">
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 max-w-3xl w-full text-left">
          {[
            {
              title: "Acceso restringido",
              desc: "Solo el personal autorizado por el administrador puede ingresar al sistema.",
            },
            {
              title: "Solicitud de cuenta",
              desc: "Podés registrarte y solicitar acceso. El administrador te habilitará los permisos correspondientes.",
            },
            {
              title: "Login con Google",
              desc: "Podés ingresar con tu cuenta institucional de Google (@frvm.utn.edu.ar).",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-xl border bg-card p-5 flex flex-col gap-2"
            >
              <h3 className="font-semibold text-base">{card.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {card.desc}
              </p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-4 text-center text-sm text-muted-foreground">
        UTN Facultad Regional Villa María · Secretaría de Asuntos Estudiantiles
      </footer>
    </div>
  );
}
