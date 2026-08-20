import { redirect } from "next/navigation";
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

  const { integrantes, logoUrl } = await withUser(session.user.id, async (tx) => {
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
    return { integrantes, logoUrl: org?.logo_url ?? null };
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl || "/LogoUTN.png"}
          alt="UTN Villa María"
          width={160}
          style={{ objectFit: "contain", display: "block" }}
        />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">¿Quién sos?</h1>
        <p className="text-muted-foreground text-sm">
          Elegí tu perfil para ver tus tareas y tu música.
        </p>
      </div>

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
                className="flex w-full flex-col items-center gap-3 rounded-xl border bg-card p-5 transition-colors hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Avatar size="lg" className="size-16">
                  <AvatarFallback
                    className="text-lg font-semibold text-white"
                    style={{ backgroundColor: u.avatar_color ?? AVATAR_COLOR_DEFAULT }}
                  >
                    {iniciales(u.nombre)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-center text-sm font-medium leading-tight">
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
