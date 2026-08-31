import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import { ViajeDetalleCliente } from "./viaje-detalle-cliente";
import type { EstadoIntegranteViaje, EstadoViaje } from "@/types/database";
import type { UsuarioOption } from "../page";
import { normalizarCamposFormulario, type CamposFormularioViaje } from "@/lib/viajes/campos-formulario";

export type ViajeDetalle = {
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
};

export type DocumentoViajeRow = { id: string; etiqueta: string; url: string };

export type TareaCostoRow = {
  id: string;
  titulo: string;
  estado: string;
  responsable_id: string | null;
  responsable_nombre: string | null;
  ya_fijada: boolean;
};

export type CostoRow = {
  id: string;
  concepto: string;
  monto: number;
  tarea_id: string | null;
  fijado_en: string;
};

export type IntegranteViajeRow = {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  legajo: string | null;
  carrera: string | null;
  anio_cursada: string | null;
  email: string | null;
  telefono: string | null;
  estado: EstadoIntegranteViaje;
  monto_a_pagar: number | null;
  notas_internas: string | null;
  creado_en: string;
};

export type PagoRow = {
  id: string;
  viaje_integrante_id: string;
  integrante_nombre: string;
  monto: number;
  medio_pago: string | null;
  fecha_pago: string;
  registrado_por_nombre: string;
};

export default async function ViajeDetallePage({
  params,
}: {
  params: Promise<{ viajeId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { viajeId } = await params;
  const rol = (session.user as { rol: string }).rol;

  const {
    viaje,
    asignados,
    usuarios,
    documentos,
    tareasCosteo,
    costos,
    integrantes,
    pagos,
    canManage,
    habilitado,
  } = await withUser(session.user.id, async (tx) => {
      const [org] = await tx<[{ viajes_habilitado: boolean }]>`
        select viajes_habilitado from organizacion where id = mi_organizacion_id()
      `;

      const [viajeRow] = await tx<[ViajeDetalle | undefined]>`
        select
          id, nombre, destino, fecha_inicio::text, fecha_fin::text,
          cupo_maximo, precio::float8, estado::text as estado, codigo_publico,
          descripcion_publica, info_participantes, campos_formulario, creada_por
        from viaje
        where id = ${viajeId} and organizacion_id = mi_organizacion_id()
      `;
      const viaje = viajeRow
        ? { ...viajeRow, campos_formulario: normalizarCamposFormulario(viajeRow.campos_formulario) }
        : undefined;

      if (!viaje) {
        return {
          viaje: undefined,
          asignados: [],
          usuarios: [],
          documentos: [],
          tareasCosteo: [],
          costos: [],
          integrantes: [],
          pagos: [],
          canManage: false,
          habilitado: org.viajes_habilitado,
        };
      }

      const asignados = await tx<{ id: string; nombre: string; avatar_color: string | null }[]>`
        select u.id, u.nombre, u.avatar_color
        from viaje_asignado va
        join usuario u on u.id = va.usuario_id
        where va.viaje_id = ${viajeId}
        order by u.nombre asc
      `;

      const usuarios = await tx<UsuarioOption[]>`
        select id, nombre, avatar_color from usuario
        where organizacion_id = mi_organizacion_id() and estado = 'activo'
        order by nombre asc
      `;

      const documentos = await tx<DocumentoViajeRow[]>`
        select id, etiqueta, url from acceso_rapido
        where viaje_id = ${viajeId}
        order by orden asc
      `;

      const tareasCosteo = await tx<TareaCostoRow[]>`
        select
          t.id, t.titulo, t.estado::text as estado,
          t.responsable_id, u.nombre as responsable_nombre,
          exists(select 1 from viaje_costo vc where vc.tarea_id = t.id) as ya_fijada
        from tarea t
        left join usuario u on u.id = t.responsable_id
        where t.viaje_id = ${viajeId} and t.archivada = false
        order by t.creada_en asc
      `;

      const costos = await tx<CostoRow[]>`
        select id, concepto, monto::float8, tarea_id, fijado_en::text
        from viaje_costo
        where viaje_id = ${viajeId}
        order by fijado_en asc
      `;

      const integrantes = await tx<IntegranteViajeRow[]>`
        select
          id, nombre, apellido, dni, legajo, carrera, anio_cursada,
          email, telefono, estado::text as estado, monto_a_pagar::float8,
          notas_internas, creado_en::text
        from viaje_integrante
        where viaje_id = ${viajeId}
        order by creado_en asc
      `;

      const pagos = await tx<PagoRow[]>`
        select
          vp.id, vp.viaje_integrante_id,
          vi.nombre || ' ' || vi.apellido as integrante_nombre,
          vp.monto::float8, vp.medio_pago, vp.fecha_pago::text,
          u.nombre as registrado_por_nombre
        from viaje_pago vp
        join viaje_integrante vi on vi.id = vp.viaje_integrante_id
        join usuario u on u.id = vp.registrado_por
        where vi.viaje_id = ${viajeId}
        order by vp.fecha_pago desc, vp.creado_en desc
      `;

      const canManage =
        rol === "administrador" ||
        viaje.creada_por === session.user.id ||
        asignados.some((a) => a.id === session.user.id);

      return {
        viaje,
        asignados: [...asignados],
        usuarios: [...usuarios],
        documentos: [...documentos],
        tareasCosteo: [...tareasCosteo],
        costos: [...costos],
        integrantes: [...integrantes],
        pagos: [...pagos],
        canManage,
        habilitado: org.viajes_habilitado,
      };
    });

  if (!habilitado) redirect("/hoy");
  if (!viaje) notFound();

  return (
    <ViajeDetalleCliente
      viaje={viaje}
      asignados={asignados}
      usuarios={usuarios}
      documentos={documentos}
      tareasCosteo={tareasCosteo}
      costos={costos}
      integrantes={integrantes}
      pagos={pagos}
      canManage={canManage}
      currentUserId={session.user.id}
    />
  );
}
