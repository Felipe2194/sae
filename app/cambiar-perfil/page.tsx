import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cambiarPerfil } from "./actions";

const AVATAR_COLOR_DEFAULT = "oklch(0.62 0.19 42)";

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export default async function CambiarPerfilPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (!session.user.puedeCambiarPerfil) redirect("/hoy");

  const { integrantes, logoUrl, cuentaGenerica } = await withUser(
    session.user.id,
    async (tx) => {
      const integrantes = await tx<
        { id: string; nombre: string; avatar_color: string | null }[]
      >`
      select id, nombre, avatar_color
      from usuario
      where organizacion_id = mi_organizacion_id()
        and estado = 'activo'
        and es_cuenta_generica = false
        and id != mi_usuario_id()
      order by nombre asc
    `;
      const [org] = await tx<{ logo_url: string | null }[]>`
      select logo_url from organizacion where id = mi_organizacion_id()
    `;
      // La cuenta genérica (de oficina) de la organización — no está en
      // `integrantes` (se filtra ahí a propósito). Se usa para ofrecer
      // "seguir/volver a la cuenta de oficina" además de elegir un
      // integrante: sin esto, una vez que se cambiaba a un perfil no había
      // forma de volver a actuar como esa cuenta (la administradora de una
      // organización nueva) salvo desloguearse y volver a entrar — lo que
      // mandaba de nuevo acá, en un loop.
      const [cuentaGenerica] = await tx<
        { id: string; nombre: string; avatar_color: string | null }[]
      >`
      select id, nombre, avatar_color
      from usuario
      where organizacion_id = mi_organizacion_id()
        and estado = 'activo'
        and es_cuenta_generica = true
      limit 1
    `;
      return { integrantes, logoUrl: org?.logo_url ?? null, cuentaGenerica: cuentaGenerica ?? null };
    },
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl || "/LogoUTN.png"}
          alt="UTN Villa María"
          width={160}
          className={logoUrl ? "block" : "block dark:hidden"}
          style={{ objectFit: "contain" }}
        />
        {/* display no puede ir en `style` inline: le gana en especificidad a
            dark:hidden/dark:block y las dos imágenes quedaban visibles a la
            vez sin importar el tema. */}
        {!logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/LogoUTN-dark.png"
            alt="UTN Villa María"
            width={160}
            className="hidden dark:block"
            style={{ objectFit: "contain" }}
          />
        )}
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          ¿Quién sos?
        </h1>
        <p className="text-muted-foreground text-sm">
          Elegí tu perfil para ver tus tareas y tu música.
        </p>
      </div>

      {/* Seguir/volver a la cuenta de oficina — no es "elegir un perfil" así
          que se muestra aparte del resto, con otro ícono. Si la sesión
          actual YA es la cuenta genérica, es la salida para no quedar
          forzado a elegir a alguien más; si es un perfil ya cambiado, es la
          forma de volver a ella para tareas administrativas. */}
      {cuentaGenerica && (
        <form action={cambiarPerfil.bind(null, cuentaGenerica.id)}>
          <button
            type="submit"
            className="bg-card hover:border-primary hover:bg-accent focus-visible:ring-ring flex items-center gap-3 rounded-xl border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-full">
              <Building2 className="size-5" />
            </div>
            <span className="text-sm font-medium">
              {session.user.esCuentaGenerica
                ? `Seguir como ${cuentaGenerica.nombre}`
                : `Volver a la cuenta de oficina (${cuentaGenerica.nombre})`}
            </span>
          </button>
        </form>
      )}

      {integrantes.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No hay otros perfiles activos en la organización.
        </p>
      ) : (
        <div className="grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {integrantes.map((u) => (
            <form key={u.id} action={cambiarPerfil.bind(null, u.id)}>
              <button
                type="submit"
                className="bg-card hover:border-primary hover:bg-accent focus-visible:ring-ring flex w-full flex-col items-center gap-3 rounded-xl border p-5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <Avatar size="lg" className="size-16">
                  <AvatarFallback
                    className="text-lg font-semibold text-white"
                    style={{
                      backgroundColor: u.avatar_color ?? AVATAR_COLOR_DEFAULT,
                    }}
                  >
                    {iniciales(u.nombre)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-center text-sm leading-tight font-medium">
                  {u.nombre}
                </span>
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
