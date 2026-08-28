import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import { PerfilForm } from "./perfil-form";

type UsuarioRow = {
  nombre: string;
  email: string;
  rol: string;
  playlist_url: string | null;
  avatar_color: string | null;
  fondo_tipo: "gradiente" | "imagen" | null;
  fondo_valor: string | null;
  color_principal: string | null;
  color_principal_org: string | null;
};

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [usuario] = await withUser(session.user.id, async (tx) => {
    return tx<UsuarioRow[]>`
      select
        u.nombre, u.email, u.rol::text, u.playlist_url, u.avatar_color,
        u.fondo_tipo, u.fondo_valor, u.color_principal,
        o.color_principal as color_principal_org
      from usuario u
      join organizacion o on o.id = u.organizacion_id
      where u.id = mi_usuario_id()
    `;
  });

  return (
    <PerfilForm
      nombre={usuario.nombre}
      email={usuario.email}
      rol={usuario.rol}
      playlistUrl={usuario.playlist_url}
      avatarColor={usuario.avatar_color}
      fondoTipo={usuario.fondo_tipo}
      fondoValor={usuario.fondo_valor}
      colorPrincipal={usuario.color_principal}
      colorPrincipalOrg={usuario.color_principal_org}
    />
  );
}
