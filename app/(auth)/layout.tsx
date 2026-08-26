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
  const [org] = await sql<
    { logo_url: string | null; color_principal: string | null }[]
  >`
    select logo_url, color_principal from organizacion where slug = 'sae-frvm' limit 1
  `;
  const logo = org?.logo_url || "/LogoUTN.png";
  const bgColor = org?.color_principal || "oklch(0.62 0.19 42)";

  return (
    <div className="flex min-h-screen flex-1">
      {/* Panel izquierdo — identidad UTN */}
      <div
        className="hidden flex-col items-center justify-center gap-8 p-12 text-white lg:flex lg:w-2/5"
        style={{ backgroundColor: bgColor }}
      >
        <div className="flex flex-col items-center gap-8 text-center">
          <div className="rounded-2xl bg-white px-8 py-5 shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo}
              alt="UTN Villa María"
              width={220}
              height={56}
              style={{ objectFit: "contain", display: "block" }}
            />
          </div>
          <div className="w-full border-t border-white/30 pt-6">
            <p className="text-lg font-semibold">SAE</p>
            <p className="mt-1 text-sm opacity-75">
              Sistema de Administración Estudiantil
            </p>
          </div>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex flex-1 flex-col items-center justify-center p-6">
        {/* Logo visible solo en mobile */}
        <div className="mb-8 flex flex-col items-center gap-2 lg:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo}
            alt="UTN Villa María"
            width={180}
            className={org?.logo_url ? undefined : "dark:hidden"}
            style={{ objectFit: "contain", display: "block" }}
          />
          {!org?.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/LogoUTN-dark.png"
              alt="UTN Villa María"
              width={180}
              className="hidden dark:block"
              style={{ objectFit: "contain", display: "block" }}
            />
          )}
          <p className="text-muted-foreground mt-1 text-sm">
            Sistema de Administración Estudiantil
          </p>
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
