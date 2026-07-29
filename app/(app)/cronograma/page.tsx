import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import { CronogramaCliente } from "./cronograma-cliente";

export type TurnoData = {
  id: string;
  usuario_id: string;
  usuario_nombre: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  vigente_desde: string;
  vigente_hasta: string | null;
};

export type UsuarioOpt = { id: string; nombre: string };

export default async function CronogramaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const rol = (session.user as { rol: string }).rol;
  const canManage = rol === "coordinador" || rol === "administrador";

  const { turnos, usuarios } = await withUser(session.user.id, async (tx) => {
    const turnos = await tx<TurnoData[]>`
      select
        t.id,
        t.usuario_id,
        u.nombre                              as usuario_nombre,
        t.dia_semana::int                     as dia_semana,
        substring(t.hora_inicio::text, 1, 5) as hora_inicio,
        substring(t.hora_fin::text, 1, 5)    as hora_fin,
        t.vigente_desde::text                as vigente_desde,
        t.vigente_hasta::text                as vigente_hasta
      from turno t
      join usuario u on u.id = t.usuario_id
      where t.vigente_desde <= current_date
        and (t.vigente_hasta is null or t.vigente_hasta >= current_date)
      order by t.dia_semana, t.hora_inicio, u.nombre
    `;

    const usuarios = canManage
      ? await tx<UsuarioOpt[]>`
          select id, nombre from usuario
          where organizacion_id = mi_organizacion_id() and estado = 'activo'
          order by nombre asc
        `
      : [];

    return { turnos: [...turnos], usuarios: [...usuarios] };
  });

  return (
    <CronogramaCliente
      turnos={turnos}
      usuarios={usuarios}
      sesionUsuarioId={session.user.id}
      canManage={canManage}
    />
  );
}
