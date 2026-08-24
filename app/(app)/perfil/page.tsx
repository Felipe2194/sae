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
};

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [usuario] = await withUser(session.user.id, async (tx) => {
    return tx<UsuarioRow[]>`
      select nombre, email, rol::text, playlist_url, avatar_color, fondo_tipo, fondo_valor
      from usuario
      where id = mi_usuario_id()
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
    />
  );
}
