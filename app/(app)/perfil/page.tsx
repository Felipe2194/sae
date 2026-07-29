import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import { PerfilForm } from "./perfil-form";

type UsuarioRow = {
  nombre: string;
  email: string;
  rol: string;
};

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [usuario] = await withUser(session.user.id, async (tx) => {
    return tx<UsuarioRow[]>`
      select nombre, email, rol::text
      from usuario
      where id = mi_usuario_id()
    `;
  });

  return (
    <PerfilForm
      nombre={usuario.nombre}
      email={usuario.email}
      rol={usuario.rol}
    />
  );
}
