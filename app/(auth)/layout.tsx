import { sql } from "@/lib/db";

// Next no detecta la query a Postgres como razón para renderizar dinámico
// (no es fetch ni usa cookies()/headers()) y por defecto prerenderiza este
// layout como estático en el build — lo que dejaría el logo/color de
// /login y /registro pegados al valor que tenía la organización al momento
// del build, sin reflejar cambios hechos después en /configuracion.
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
          {/* Organización sin logo propio: el logo por defecto tiene texto
              negro, ilegible sobre este panel de color en modo oscuro — se
              muestra sin la caja blanca y con la variante de texto blanco
              (public/LogoUTN-dark.png), igual que en el sidebar. Un logo
              subido por la organización mantiene siempre la caja blanca. */}
          <div
            className={
              org?.logo_url
                ? "rounded-2xl bg-white px-8 py-5 shadow-lg"
                : "rounded-2xl bg-white px-8 py-5 shadow-lg dark:bg-transparent dark:shadow-none"
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo}
              alt="UTN Villa María"
              width={220}
              height={56}
              className={org?.logo_url ? "block" : "block dark:hidden"}
              style={{ objectFit: "contain" }}
            />
            {/* display no puede ir en `style` inline: le gana en especificidad
                a dark:hidden/dark:block y las dos imágenes quedaban visibles
                a la vez sin importar el tema. */}
            {!org?.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/LogoUTN-dark.png"
                alt="UTN Villa María"
                width={220}
                height={56}
                className="hidden dark:block"
                style={{ objectFit: "contain" }}
              />
            )}
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
            className={org?.logo_url ? "block" : "block dark:hidden"}
            style={{ objectFit: "contain" }}
          />
          {/* display no puede ir en `style` inline: le gana en especificidad
              a dark:hidden/dark:block y las dos imágenes quedaban visibles a
              la vez sin importar el tema. */}
          {!org?.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/LogoUTN-dark.png"
              alt="UTN Villa María"
              width={180}
              className="hidden dark:block"
              style={{ objectFit: "contain" }}
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
