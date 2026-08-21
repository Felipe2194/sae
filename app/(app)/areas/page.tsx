import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import { AreasCliente } from "./areas-cliente";

type AreaRow = {
  id: string;
  nombre: string;
  color: string;
  descripcion: string | null;
  responsable_id: string | null;
  responsable_nombre: string | null;
  responsable_avatar_color: string | null;
  asignados: { id: string; nombre: string; avatar_color: string | null }[];
  tareas_total: number;
  tareas_hechas: number;
  tareas_abiertas: number;
};

type UsuarioRow = { id: string; nombre: string; avatar_color: string | null };

export default async function AreasPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const rol = (session.user as { rol: string }).rol;
  const canManage = rol === "coordinador" || rol === "administrador";

  const { areas, usuarios } = await withUser(session.user.id, async (tx) => {
    const areas = await tx<AreaRow[]>`
      select
        a.id,
        a.nombre,
        a.color,
        a.descripcion,
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
        count(t.id) filter (where t.estado != 'hecha')::int as tareas_abiertas
      from area a
      left join usuario u on u.id = a.responsable_id
      left join tarea   t on t.area_id = a.id and t.archivada = false
      where a.organizacion_id = mi_organizacion_id()
        and a.activa = true
      group by a.id, a.nombre, a.color, a.descripcion, a.responsable_id, u.nombre, u.avatar_color
      order by a.nombre asc
    `;

    const usuarios = canManage
      ? await tx<UsuarioRow[]>`
          select id, nombre, avatar_color from usuario
          where organizacion_id = mi_organizacion_id() and estado = 'activo'
          order by nombre asc
        `
      : [];

    return { areas: [...areas], usuarios: [...usuarios] };
  });

  return (
    <AreasCliente
      areas={areas}
      usuarios={usuarios}
      canManage={canManage}
    />
  );
}
