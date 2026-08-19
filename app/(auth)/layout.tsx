import { sql } from "@/lib/db";

// Next no detecta la query a Postgres como razón para renderizar dinámico
// (no es fetch ni usa cookies()/headers()) y por defecto prerenderiza este
// layout como estático en el build — lo que dejaría el logo/color de
// /login y /registro pegados al valor que tenía la organización al momento
// del build, sin reflejar cambios hechos después en /admin.
export const dynamic = "force-dynamic";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Sin sesión todavía (login/registro) — se consulta la única organización
  // del sistema directamente, igual que hace registro/actions.ts al dar de
  // alta un usuario nuevo.
  const [org] = await sql<{ logo_url: string | null; color_principal: string | null }[]>`
    select logo_url, color_principal from organizacion where slug = 'sae-frvm' limit 1
  `;
  const logo = org?.logo_url || "/LogoUTN.png";
  const bgColor = org?.color_principal || "oklch(0.62 0.19 42)";

  return (
    <div className="flex flex-1 min-h-screen">
      {/* Panel izquierdo — identidad UTN */}
      <div
        className="hidden lg:flex lg:w-2/5 flex-col items-center justify-center text-white p-12 gap-8"
        style={{ backgroundColor: bgColor }}
      >
        <div className="flex flex-col items-center gap-8 text-center">
          <div className="bg-white rounded-2xl px-8 py-5 shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo}
              alt="UTN Villa María"
              width={220}
              height={56}
              style={{ objectFit: "contain", display: "block" }}
            />
          </div>
          <div className="border-t border-white/30 pt-6 w-full">
            <p className="text-lg font-semibold">SAE</p>
            <p className="text-sm opacity-75 mt-1">
              Sistema de Administración Estudiantil
            </p>
          </div>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex flex-1 flex-col items-center justify-center p-6">
        {/* Logo visible solo en mobile */}
        <div className="flex flex-col items-center gap-2 mb-8 lg:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo}
            alt="UTN Villa María"
            width={180}
            style={{ objectFit: "contain", display: "block" }}
          />
          <p className="text-muted-foreground text-sm mt-1">Sistema de Administración Estudiantil</p>
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
