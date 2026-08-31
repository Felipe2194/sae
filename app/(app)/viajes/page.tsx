import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import { ViajesCliente } from "./viajes-cliente";
import type { EstadoViaje } from "@/types/database";
import { normalizarCamposFormulario, type CamposFormularioViaje } from "@/lib/viajes/campos-formulario";

export type ViajeFila = {
  id: string;
  nombre: string;
  destino: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  cupo_maximo: number | null;
  precio: number | null;
  estado: EstadoViaje;
  codigo_publico: string;
  descripcion_publica: string | null;
  info_participantes: string | null;
  campos_formulario: CamposFormularioViaje;
  creada_por: string;
  inscriptos_total: number;
  inscriptos_confirmados: number;
  asignados: { id: string; nombre: string; avatar_color: string | null }[];
};

export type UsuarioOption = { id: string; nombre: string; avatar_color: string | null };

export default async function ViajesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { viajes, usuarios, habilitado } = await withUser(session.user.id, async (tx) => {
    const [org] = await tx<[{ viajes_habilitado: boolean }]>`
      select viajes_habilitado from organizacion where id = mi_organizacion_id()
    `;

    const viajes = await tx<ViajeFila[]>`
      select
        v.id, v.nombre, v.destino, v.fecha_inicio::text, v.fecha_fin::text,
        v.cupo_maximo, v.precio::float8, v.estado::text as estado, v.codigo_publico,
        v.descripcion_publica, v.info_participantes, v.campos_formulario,
        v.creada_por,
        count(vi.id)::int as inscriptos_total,
        count(vi.id) filter (where vi.estado = 'confirmado')::int as inscriptos_confirmados,
        coalesce(
          (
            select json_agg(json_build_object('id', u2.id, 'nombre', u2.nombre, 'avatar_color', u2.avatar_color))
            from viaje_asignado va
            join usuario u2 on u2.id = va.usuario_id
            where va.viaje_id = v.id
          ),
          '[]'
        ) as asignados
      from viaje v
      left join viaje_integrante vi on vi.viaje_id = v.id
      where v.organizacion_id = mi_organizacion_id()
      group by v.id
      order by v.fecha_inicio desc
    `;

    const usuarios = await tx<UsuarioOption[]>`
      select id, nombre, avatar_color from usuario
      where organizacion_id = mi_organizacion_id() and estado = 'activo'
      order by nombre asc
    `;

    return {
      viajes: viajes.map((v) => ({ ...v, campos_formulario: normalizarCamposFormulario(v.campos_formulario) })),
      usuarios: [...usuarios],
      habilitado: org.viajes_habilitado,
    };
  });

  if (!habilitado) redirect("/hoy");

  return (
    <ViajesCliente viajes={viajes} usuarios={usuarios} currentUserId={session.user.id} />
  );
}
