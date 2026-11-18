import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import { redirectSeccionDeshabilitada, redirectSesionInvalida } from "@/lib/redirects";
import type {
  Area,
  Asignacion,
  Entrega,
  EntregaMarcada,
  Estudiante,
  Incompatibilidad,
  Programa,
} from "@/lib/becas/tipos";
import { BecasCliente } from "./becas-cliente";

export default async function BecasPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const params = await searchParams;

  const datos = await withUser(session.user.id, async (tx) => {
    const [org] = await tx<[{ habilitado: boolean; anio_actual: number }?]>`
      select
        seccion_visible(becas_habilitado, secciones_solo_admin, 'becas') as habilitado,
        extract(year from current_date)::int as anio_actual
      from organizacion where id = mi_organizacion_id()
    `;
    // Sesión vieja que ya no resuelve a ningún usuario/organización real.
    if (!org) redirectSesionInvalida();
    if (!org.habilitado) return null;

    const pedido = Number(params.anio);
    const anio = Number.isInteger(pedido) && pedido >= 2000 && pedido <= 2100 ? pedido : org.anio_actual;

    // Consultas independientes: en Promise.all postgres.js las manda en un
    // solo pipeline sobre la conexión de la transacción.
    const [programas, incompatibilidades, areas, estudiantes, asignaciones, entregas, marcadas, anios] =
      await Promise.all([
        tx<Programa[]>`
          select id, nombre, origen, horas_por_modulo, activo
          from beca_programa
          where organizacion_id = mi_organizacion_id()
          order by case origen when 'nacional' then 0 when 'facultad' then 1 else 2 end, nombre
        `,
        tx<Incompatibilidad[]>`
          select i.programa_a, i.programa_b
          from beca_incompatibilidad i
          join beca_programa p on p.id = i.programa_a
          where p.organizacion_id = mi_organizacion_id()
        `,
        tx<Area[]>`
          select id, anio, departamento, nombre, tipo, tutor_nombre, tutor_email,
                 tutor_telefono, modulos_cupo, perfil
          from beca_area
          where organizacion_id = mi_organizacion_id() and anio = ${anio}
          order by departamento nulls last, nombre
        `,
        tx<Estudiante[]>`
          select id, dni, apellido, nombre, legajo, carrera, email, telefono, notas
          from estudiante
          where organizacion_id = mi_organizacion_id()
          order by apellido, nombre
        `,
        tx<Asignacion[]>`
          select id, estudiante_id, programa_id, anio, condicion, estado, area_id, modulos, observaciones
          from beca_asignacion
          where organizacion_id = mi_organizacion_id() and anio = ${anio}
        `,
        tx<Entrega[]>`
          select id, programa_id, anio, nombre, vence_el::text, a_cargo
          from beca_entrega
          where organizacion_id = mi_organizacion_id() and anio = ${anio}
          order by vence_el nulls last, creado_en
        `,
        tx<EntregaMarcada[]>`
          select es.asignacion_id, es.entrega_id, es.estado, es.observacion
          from beca_entrega_estado es
          join beca_asignacion a on a.id = es.asignacion_id
          where a.organizacion_id = mi_organizacion_id() and a.anio = ${anio}
        `,
        tx<{ anio: number }[]>`
          select anio from beca_asignacion where organizacion_id = mi_organizacion_id()
          union
          select anio from beca_area where organizacion_id = mi_organizacion_id()
        `,
      ]);

    // Años para el selector: los que tienen datos, el actual, el siguiente
    // (para ir armando el ciclo que viene) y el que se está mirando.
    const aniosDisponibles = [
      ...new Set([...anios.map((a) => a.anio), org.anio_actual, org.anio_actual + 1, anio]),
    ].sort((a, b) => b - a);

    return {
      anio,
      aniosDisponibles,
      programas: [...programas],
      incompatibilidades: [...incompatibilidades],
      areas: [...areas],
      estudiantes: [...estudiantes],
      asignaciones: [...asignaciones],
      entregas: [...entregas],
      marcadas: [...marcadas],
    };
  });

  if (!datos) redirectSeccionDeshabilitada();

  return <BecasCliente {...datos} esAdmin={session.user.rol === "administrador"} />;
}
