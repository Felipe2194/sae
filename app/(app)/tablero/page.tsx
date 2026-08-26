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
  area_id: string | null;
  area_nombre: string | null;
  area_color: string | null;
  area_categoria: string | null;
  responsable_id: string | null;
  responsable_nombre: string | null;
  responsable_avatar_color: string | null;
  asignados: { id: string; nombre: string; avatar_color: string | null }[];
  subtarea_total: number;
  subtarea_hecha: number;
  comentario_count: number;
  creada_por: string;
  archivada: boolean;
  duracion_estimada_hs: number | null;
  duracion_real_hs: number | null;
  recurrencia: { frecuencia: "diaria" | "semanal" | "mensual" } | null;
};

export type AreaOption = { id: string; nombre: string; color: string };
export type UsuarioOption = {
  id: string;
  nombre: string;
  avatar_color: string | null;
};

export default async function TableroPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { tareas, areas, usuarios } = await withUser(
    session.user.id,
    async (tx) => {
      // Auto-archivado de tareas viejas: sin esto, cada tarea que se completa
      // y nunca se archiva a mano se queda para siempre en la columna "Hecha",
      // creciendo sin límite en cada carga del tablero (ver auditoría de
      // paginación). Se barre en cada visita en vez de necesitar un cron —
      // esta app corre sin infraestructura de jobs programados. No borra nada:
      // sigue completa en /informes y el historial por año de
      // cada área, solo deja de listarse en el tablero del día a día. Ventana
      // corta (1 día) a propósito: la idea es que "Hecha" muestre lo del
      // momento, no que acumule días de tareas ya resueltas.
      await tx`
      update tarea set archivada = true, archivada_en = now()
      where organizacion_id = mi_organizacion_id()
        and archivada = false
        and estado = 'hecha'
        and completada_en < now() - interval '1 day'
    `;

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
        t.recurrencia,
        a.nombre  as area_nombre,
        a.color   as area_color,
        a.categoria::text as area_categoria,
        u.nombre  as responsable_nombre,
        u.avatar_color as responsable_avatar_color,
        coalesce(
          (
            select json_agg(json_build_object('id', u2.id, 'nombre', u2.nombre, 'avatar_color', u2.avatar_color))
            from tarea_asignado ta
            join usuario u2 on u2.id = ta.usuario_id
            where ta.tarea_id = t.id
          ),
          '[]'
        ) as asignados,
        coalesce((select count(*)::int from subtarea s where s.tarea_id = t.id), 0)              as subtarea_total,
        coalesce((select count(*)::int from subtarea s where s.tarea_id = t.id and s.hecha), 0)  as subtarea_hecha,
        coalesce((select count(*)::int from comentario c where c.tarea_id = t.id), 0)            as comentario_count
      from tarea t
      left join area    a on a.id = t.area_id
      left join usuario u on u.id = t.responsable_id
      where t.organizacion_id = mi_organizacion_id() and t.archivada = false
      -- Las tareas urgentes (prioridad alta) van primero dentro de cada
      -- columna, arriba del resto — "(t.prioridad = 'alta') desc" ordena los
      -- true antes que los false. No hay drag-and-drop de posición dentro de
      -- una columna (tablero-cliente.tsx solo mueve entre columnas), así que
      -- este orden no compite con nada que el usuario reacomode a mano.
      order by (t.prioridad = 'alta') desc, t.orden asc, t.creada_en asc
    `;

      const areas = await tx<AreaOption[]>`
      select id, nombre, color
      from area
      where organizacion_id = mi_organizacion_id() and activa = true
      order by nombre asc
    `;

      const usuarios = await tx<UsuarioOption[]>`
      select id, nombre, avatar_color
      from usuario
      where organizacion_id = mi_organizacion_id() and estado = 'activo'
      order by nombre asc
    `;

      return {
        tareas: [...tareas],
        areas: [...areas],
        usuarios: [...usuarios],
      };
    },
  );

  return (
    <TableroCliente
      tareas={tareas}
      areas={areas}
      usuarios={usuarios}
      currentUserId={session.user.id}
      rol={(session.user as { rol: string }).rol}
    />
  );
}
