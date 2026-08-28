import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import { AreasCliente } from "./areas-cliente";

type AreaRow = {
  id: string;
  nombre: string;
  color: string;
  descripcion: string | null;
  tipo: "continua" | "evento";
  categoria: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  responsable_id: string | null;
  responsable_nombre: string | null;
  responsable_avatar_color: string | null;
  asignados: { id: string; nombre: string; avatar_color: string | null }[];
  tareas_total: number;
  tareas_hechas: number;
  tareas_abiertas: number;
  vencidas_0_7: number;
  vencidas_8_14: number;
  vencidas_15_30: number;
  vencidas_30_mas: number;
  proximos: { id: string; titulo: string; fecha_vencimiento: string }[];
};

type UsuarioRow = { id: string; nombre: string; avatar_color: string | null };

export default async function AreasPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const rol = (session.user as { rol: string }).rol;
  const canManage = rol === "administrador";

  const { areas, usuarios, habilitado } = await withUser(session.user.id, async (tx) => {
    const [org] = await tx<[{ proyectos_habilitado: boolean }]>`
      select proyectos_habilitado from organizacion where id = mi_organizacion_id()
    `;

    const areas = await tx<AreaRow[]>`
      select
        a.id,
        a.nombre,
        a.color,
        a.descripcion,
        a.tipo::text as tipo,
        a.categoria::text as categoria,
        a.fecha_inicio::text,
        a.fecha_fin::text,
        a.responsable_id,
        u.nombre  as responsable_nombre,
        u.avatar_color as responsable_avatar_color,
        coalesce(
          (
            select json_agg(json_build_object('id', u2.id, 'nombre', u2.nombre, 'avatar_color', u2.avatar_color))
            from area_asignado aa
            join usuario u2 on u2.id = aa.usuario_id
            where aa.area_id = a.id
          ),
          '[]'
        ) as asignados,
        count(t.id)::int                                  as tareas_total,
        count(t.id) filter (where t.estado = 'hecha')::int  as tareas_hechas,
        count(t.id) filter (where t.estado != 'hecha')::int as tareas_abiertas,
        count(t.id) filter (
          where t.estado != 'hecha' and t.fecha_vencimiento < current_date
            and current_date - t.fecha_vencimiento between 0 and 7
        )::int as vencidas_0_7,
        count(t.id) filter (
          where t.estado != 'hecha' and t.fecha_vencimiento < current_date
            and current_date - t.fecha_vencimiento between 8 and 14
        )::int as vencidas_8_14,
        count(t.id) filter (
          where t.estado != 'hecha' and t.fecha_vencimiento < current_date
            and current_date - t.fecha_vencimiento between 15 and 30
        )::int as vencidas_15_30,
        count(t.id) filter (
          where t.estado != 'hecha' and t.fecha_vencimiento < current_date
            and current_date - t.fecha_vencimiento > 30
        )::int as vencidas_30_mas,
        coalesce(
          (
            select json_agg(x order by (x->>'fecha_vencimiento') asc)
            from (
              select json_build_object(
                'id', t3.id, 'titulo', t3.titulo, 'fecha_vencimiento', t3.fecha_vencimiento::text
              ) as x
              from tarea t3
              where t3.area_id = a.id
                and t3.archivada = false
                and t3.estado != 'hecha'
                and t3.fecha_vencimiento >= current_date
                and t3.fecha_vencimiento <= current_date + 7
              order by t3.fecha_vencimiento asc
              limit 3
            ) sub
          ),
          '[]'
        ) as proximos
      from area a
      left join usuario u on u.id = a.responsable_id
      left join tarea   t on t.area_id = a.id and t.archivada = false
      where a.organizacion_id = mi_organizacion_id()
        and a.activa = true
      group by a.id, a.nombre, a.color, a.descripcion, a.tipo, a.categoria,
        a.fecha_inicio, a.fecha_fin, a.responsable_id, u.nombre, u.avatar_color
      order by a.nombre asc
    `;

    const usuarios = canManage
      ? await tx<UsuarioRow[]>`
          select id, nombre, avatar_color from usuario
          where organizacion_id = mi_organizacion_id() and estado = 'activo'
          order by nombre asc
        `
      : [];

    return { areas: [...areas], usuarios: [...usuarios], habilitado: org.proyectos_habilitado };
  });

  if (!habilitado) redirect("/hoy");

  return (
    <AreasCliente
      areas={areas}
      usuarios={usuarios}
      canManage={canManage}
      currentUserId={session.user.id}
    />
  );
}
