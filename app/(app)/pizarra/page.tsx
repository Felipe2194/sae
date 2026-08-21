import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { fetchNotas } from "./actions";
import { PizarraCliente } from "./pizarra-cliente";

export default async function PizarraPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const notas = await fetchNotas();
  const rol = (session.user as { rol: string }).rol;
  const canManageAll = rol === "coordinador" || rol === "administrador";

  return (
    <PizarraCliente
      notasIniciales={notas}
      sesionUsuarioId={session.user.id}
      canManageAll={canManageAll}
    />
  );
}
