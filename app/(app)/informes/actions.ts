"use server";

import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import type { LogIntegranteItem } from "./tipos";

// /informes ya redirige a los no-administradores en el server component,
// pero esta action es invocable directamente — sin este chequeo, cualquier
// usuario autenticado podría pedir el detalle de otro integrante.
async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");
  const rol = (session.user as { rol: string }).rol;
  if (rol !== "administrador") throw new Error("No autorizado");
  return session;
}

// Detalle que se muestra al expandir un integrante en "Actividad por
// integrante": tareas que creó + tareas que tiene asignadas, mezcladas en
// una sola línea de tiempo (una persona puede aparecer en ambos roles para
// la misma tarea si se la asignó a sí misma).
export async function fetchLogIntegrante(
  usuarioId: string,
): Promise<LogIntegranteItem[]> {
  const session = await requireAdmin();
  return withUser(session.user.id, async (tx) => {
    const rows = await tx<LogIntegranteItem[]>`
      select * from (
        select
          t.id, t.titulo, t.estado::text as estado,
          a.nombre as area_nombre, a.color as area_color,
          t.creada_en::text as fecha, 'creada' as rol
        from tarea t
        left join area a on a.id = t.area_id
        where t.organizacion_id = mi_organizacion_id()
          and t.creada_por = ${usuarioId}
          and t.archivada = false and t.activa = true
        union all
        select
          t.id, t.titulo, t.estado::text as estado,
          a.nombre as area_nombre, a.color as area_color,
          t.creada_en::text as fecha, 'asignada' as rol
        from tarea t
        left join area a on a.id = t.area_id
        where t.organizacion_id = mi_organizacion_id()
          and t.responsable_id = ${usuarioId}
          and t.archivada = false and t.activa = true
      ) log
      order by fecha desc
      limit 40
    `;
    return [...rows];
  });
}
