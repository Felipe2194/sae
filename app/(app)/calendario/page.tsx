import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import { CalendarioCliente } from "./calendario-cliente";

export type TareaConFecha = {
  id: string;
  titulo: string;
  estado: string;
  tipo: string;
  fecha_vencimiento: string;
  area_color: string | null;
  area_nombre: string | null;
  responsable_nombre: string | null;
};

export default async function CalendarioPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const tieneCalendar = !!(
    process.env.GOOGLE_CALENDAR_API_KEY && process.env.GOOGLE_CALENDAR_ID
  );

  const tareas = await withUser(session.user.id, async (tx) => {
    return tx<TareaConFecha[]>`
      select
        t.id,
        t.titulo,
        t.estado::text,
        t.tipo::text,
        t.fecha_vencimiento::text,
        a.color  as area_color,
        a.nombre as area_nombre,
        u.nombre as responsable_nombre
      from tarea t
      left join area    a on a.id = t.area_id
      left join usuario u on u.id = t.responsable_id
      where t.organizacion_id = mi_organizacion_id()
        and t.fecha_vencimiento is not null
        and t.estado != 'hecha'
      order by t.fecha_vencimiento asc
    `;
  });

  return (
    <CalendarioCliente
      tareas={[...tareas]}
      tieneCalendar={tieneCalendar}
    />
  );
}
