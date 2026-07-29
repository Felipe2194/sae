import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import { CronogramaCliente } from "./cronograma-cliente";

export type TurnoData = {
  usuario_id: string;
  usuario_nombre: string;
  dia_semana: number; // 0=Lun … 4=Vie
  hora_inicio: string; // "08:00"
  hora_fin: string;   // "12:00"
};

export default async function CronogramaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const turnos = await withUser(session.user.id, async (tx) => {
    return tx<TurnoData[]>`
      select
        t.usuario_id,
        u.nombre                              as usuario_nombre,
        t.dia_semana::int                     as dia_semana,
        substring(t.hora_inicio::text, 1, 5) as hora_inicio,
        substring(t.hora_fin::text, 1, 5)    as hora_fin
      from turno t
      join usuario u on u.id = t.usuario_id
      where t.vigente_desde <= current_date
        and (t.vigente_hasta is null or t.vigente_hasta >= current_date)
      order by t.dia_semana, t.hora_inicio, u.nombre
    `;
  });

  return (
    <CronogramaCliente
      turnos={turnos}
      sesionUsuarioId={session.user.id}
    />
  );
}
