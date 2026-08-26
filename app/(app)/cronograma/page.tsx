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

export type ExcepcionData = {
  id: string;
  usuario_id: string;
  usuario_nombre: string;
  fecha: string;
  tipo: string;
  nota: string | null;
  usuario_reemplazo_id: string | null;
  usuario_reemplazo_nombre: string | null;
};

export default async function CronogramaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const rol = (session.user as { rol: string }).rol;
  const canManage = rol === "administrador";

  const { turnos, usuarios, excepciones } = await withUser(
    session.user.id,
    async (tx) => {
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

      // Se usa tanto para asignar turnos (administrador) como para que
      // cualquiera pueda marcar su propia ausencia — se trae siempre.
      const usuarios = await tx<UsuarioOpt[]>`
      select id, nombre from usuario
      where organizacion_id = mi_organizacion_id() and estado = 'activo'
      order by nombre asc
    `;

      // Ventana razonable para navegar semanas hacia atrás/adelante sin recargar.
      const excepciones = await tx<ExcepcionData[]>`
      select
        e.id,
        e.usuario_id,
        u.nombre    as usuario_nombre,
        e.fecha::text,
        e.tipo::text,
        e.nota,
        e.usuario_reemplazo_id,
        ur.nombre   as usuario_reemplazo_nombre
      from excepcion_turno e
      join usuario u on u.id = e.usuario_id
      left join usuario ur on ur.id = e.usuario_reemplazo_id
      where e.organizacion_id = mi_organizacion_id()
        and e.fecha between (current_date - interval '14 days') and (current_date + interval '90 days')
      order by e.fecha asc
    `;

      return {
        turnos: [...turnos],
        usuarios: [...usuarios],
        excepciones: [...excepciones],
      };
    },
  );

  return (
    <CronogramaCliente
      turnos={turnos}
      usuarios={usuarios}
      excepciones={excepciones}
      sesionUsuarioId={session.user.id}
      canManage={canManage}
    />
  );
}
