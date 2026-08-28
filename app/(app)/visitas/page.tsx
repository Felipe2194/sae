import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import { VisitasCliente } from "./visitas-cliente";
import type { EstadoRelacionColegio, EstadoVisita, TipoVisita } from "@/types/database";

export type IntegranteAvatar = { id: string; nombre: string; avatar_color: string | null };

export type VisitaFila = {
  id: string;
  colegio_id: string;
  colegio_nombre: string;
  ciudad: string | null;
  zona: string | null;
  fecha: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  tipo: TipoVisita;
  estado: EstadoVisita;
  cant_alumnos: number | null;
  contacto_nombre: string | null;
  contacto_cargo: string | null;
  contacto_email: string | null;
  contacto_telefono: string | null;
  observaciones: string | null;
  asignado_por_id: string | null;
  asignado_por_nombre: string | null;
  google_event_id: string | null;
  creada_por: string;
  integrantes: IntegranteAvatar[];
};

export type ColegioFila = {
  id: string;
  nombre: string;
  ciudad: string | null;
  zona: string | null;
  contacto_nombre: string | null;
  contacto_cargo: string | null;
  contacto_email: string | null;
  contacto_telefono: string | null;
  estado_relacion: EstadoRelacionColegio;
  total_visitas: number;
  ultima_visita: string | null;
};

export type UsuarioOption = { id: string; nombre: string; avatar_color: string | null };

export type PresenciaFila = {
  usuario_id: string;
  nombre: string;
  avatar_color: string | null;
  visitas_registradas: number;
  visitas_realizadas: number;
};

export default async function VisitasPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const anioActual = new Date().getFullYear();
  const anio = params.anio ? parseInt(params.anio, 10) : anioActual;

  const { visitas, colegios, usuarios, presencia, anios, habilitado } = await withUser(
    session.user.id,
    async (tx) => {
      const [org] = await tx<[{ visitas_habilitado: boolean }]>`
        select visitas_habilitado from organizacion where id = mi_organizacion_id()
      `;

      const visitas = await tx<VisitaFila[]>`
        select
          v.id, v.colegio_id, c.nombre as colegio_nombre, c.ciudad, c.zona,
          v.fecha::text, v.hora_inicio::text, v.hora_fin::text,
          v.tipo::text as tipo, v.estado::text as estado, v.cant_alumnos,
          v.contacto_nombre, v.contacto_cargo, v.contacto_email, v.contacto_telefono,
          v.observaciones, v.asignado_por_id, up.nombre as asignado_por_nombre,
          v.google_event_id, v.creada_por,
          coalesce(
            (
              select json_agg(
                json_build_object('id', u.id, 'nombre', u.nombre, 'avatar_color', u.avatar_color)
                order by u.nombre
              )
              from visita_integrante vi
              join usuario u on u.id = vi.usuario_id
              where vi.visita_id = v.id
            ),
            '[]'
          ) as integrantes
        from visita_colegio v
        join colegio c on c.id = v.colegio_id
        left join usuario up on up.id = v.asignado_por_id
        where v.organizacion_id = mi_organizacion_id()
          and extract(year from v.fecha) = ${anio}
        order by v.fecha asc, v.hora_inicio asc nulls last
      `;

      const colegios = await tx<ColegioFila[]>`
        select
          c.id, c.nombre, c.ciudad, c.zona, c.contacto_nombre, c.contacto_cargo,
          c.contacto_email, c.contacto_telefono,
          c.estado_relacion::text as estado_relacion,
          count(v.id)::int as total_visitas,
          max(v.fecha)::text as ultima_visita
        from colegio c
        left join visita_colegio v on v.colegio_id = c.id
        where c.organizacion_id = mi_organizacion_id()
        group by c.id
        order by c.nombre asc
      `;

      const usuarios = await tx<UsuarioOption[]>`
        select id, nombre, avatar_color from usuario
        where organizacion_id = mi_organizacion_id() and estado = 'activo'
        order by nombre asc
      `;

      const presencia = await tx<PresenciaFila[]>`
        select
          u.id as usuario_id, u.nombre, u.avatar_color,
          count(v.id)::int as visitas_registradas,
          count(v.id) filter (where v.estado = 'realizado')::int as visitas_realizadas
        from usuario u
        left join visita_integrante vi on vi.usuario_id = u.id
        left join visita_colegio v
          on v.id = vi.visita_id
          and v.organizacion_id = mi_organizacion_id()
          and extract(year from v.fecha) = ${anio}
        where u.organizacion_id = mi_organizacion_id() and u.estado = 'activo'
        group by u.id, u.nombre, u.avatar_color
        order by visitas_registradas desc, u.nombre asc
      `;

      const aniosDisponibles = await tx<{ anio: number }[]>`
        select distinct extract(year from fecha)::int as anio
        from visita_colegio
        where organizacion_id = mi_organizacion_id()
        order by anio desc
      `;

      return {
        visitas: [...visitas],
        colegios: [...colegios],
        usuarios: [...usuarios],
        presencia: [...presencia],
        anios: aniosDisponibles.map((a) => a.anio),
        habilitado: org.visitas_habilitado,
      };
    },
  );

  if (!habilitado) redirect("/hoy");

  const aniosOpciones = Array.from(
    new Set([anioActual, ...anios, anio]),
  ).sort((a, b) => b - a);

  return (
    <VisitasCliente
      visitas={visitas}
      colegios={colegios}
      usuarios={usuarios}
      presencia={presencia}
      anio={anio}
      anios={aniosOpciones}
    />
  );
}
