import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import { TableroCliente } from "./tablero-cliente";

export type TareaCard = {
  id: string;
  titulo: string;
  estado: string;
  prioridad: string;
  tipo: string;
  descripcion: string | null;
  fecha_vencimiento: string | null;
  area_id: string;
  area_nombre: string | null;
  area_color: string | null;
  responsable_id: string | null;
  responsable_nombre: string | null;
  subtarea_total: number;
  subtarea_hecha: number;
  comentario_count: number;
  creada_por: string;
  archivada: boolean;
  duracion_estimada_hs: number | null;
  duracion_real_hs: number | null;
};

export type AreaOption = { id: string; nombre: string; color: string };
export type UsuarioOption = { id: string; nombre: string };

export default async function TableroPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { tareas, areas, usuarios } = await withUser(session.user.id, async (tx) => {
    const tareas = await tx<TareaCard[]>`
      select
        t.id,
        t.titulo,
        t.estado::text,
        t.prioridad::text,
        t.tipo::text,
        t.descripcion,
        t.fecha_vencimiento::text,
        t.area_id,
        t.responsable_id,
        t.creada_por,
        t.archivada,
        t.duracion_estimada_hs,
        t.duracion_real_hs,
        a.nombre  as area_nombre,
        a.color   as area_color,
        u.nombre  as responsable_nombre,
        coalesce((select count(*)::int from subtarea s where s.tarea_id = t.id), 0)              as subtarea_total,
        coalesce((select count(*)::int from subtarea s where s.tarea_id = t.id and s.hecha), 0)  as subtarea_hecha,
        coalesce((select count(*)::int from comentario c where c.tarea_id = t.id), 0)            as comentario_count
      from tarea t
      left join area    a on a.id = t.area_id
      left join usuario u on u.id = t.responsable_id
      where t.organizacion_id = mi_organizacion_id() and t.archivada = false
      order by t.orden asc, t.creada_en asc
    `;

    const areas = await tx<AreaOption[]>`
      select id, nombre, color
      from area
      where organizacion_id = mi_organizacion_id() and activa = true
      order by nombre asc
    `;

    const usuarios = await tx<UsuarioOption[]>`
      select id, nombre
      from usuario
      where organizacion_id = mi_organizacion_id() and estado = 'activo'
      order by nombre asc
    `;

    return { tareas: [...tareas], areas: [...areas], usuarios: [...usuarios] };
  });

  return (
    <TableroCliente
      tareas={tareas}
      areas={areas}
      usuarios={usuarios}
      currentUserId={session.user.id}
    />
  );
}
