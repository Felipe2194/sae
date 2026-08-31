import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import { InformesCliente } from "./informes-cliente";
import type {
  GlobalStats,
  ResumenArea,
  ResumenPersona,
  TareaAntigua,
  PrecisionEstimacion,
  SemanaTareas,
  ActividadBitacora,
  AntiguedadVencidas,
  UsoPlantilla,
  ActividadComentarios,
  AusenciaPersona,
  UltimoLogin,
  ReporteVisitas,
  LocalidadVisitas,
  IntegranteVisitas,
  ReporteViajes,
  ViajeResumenInformes,
} from "./tipos";

export default async function InformesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; anio?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const rol = (session.user as { rol: string }).rol;
  if (rol !== "administrador") redirect("/hoy");

  const params = await searchParams;
  const anioActual = new Date().getFullYear();
  const anioVisitas =
    params.anio === "todos" ? 0 : params.anio ? parseInt(params.anio, 10) : anioActual;

  const {
    global,
    resumenAreas,
    porPersona,
    tareasAntiguas,
    precisionEstimacion,
    semanas,
    actividadBitacora,
    antiguedadVencidas,
    usoPlantillas,
    actividadComentarios,
    ausencias,
    ultimosLogins,
    reporteVisitas,
    localidadesVisitas,
    integrantesVisitas,
    aniosVisitas,
    totalColegios,
    reporteViajes,
    viajesResumen,
    secciones,
  } = await withUser(session.user.id, async (tx) => {
    const [org] = await tx<
      [{ proyectos_habilitado: boolean; visitas_habilitado: boolean; viajes_habilitado: boolean }]
    >`
      select proyectos_habilitado, visitas_habilitado, viajes_habilitado from organizacion where id = mi_organizacion_id()
    `;

    // Estado general de la organización — lo primero que ve el admin al
    // entrar, antes de bajar a cualquier detalle por área o por persona.
    const [global] = await tx<[GlobalStats]>`
      select
        count(*)::int                                                            as total,
        count(*) filter (where estado = 'hecha')::int                           as hecha,
        count(*) filter (where estado = 'en_progreso')::int                     as en_progreso,
        count(*) filter (where estado = 'por_hacer')::int                       as por_hacer,
        count(*) filter (
          where estado != 'hecha'
            and fecha_vencimiento is not null
            and fecha_vencimiento < current_date
        )::int                                                                   as vencidas,
        count(*) filter (
          where estado = 'hecha' and completada_en >= now() - interval '30 days'
        )::int                                                                   as hechas_30d
      from tarea
      where organizacion_id = mi_organizacion_id()
        and archivada = false
        and activa = true
    `;

    const resumenAreas = await tx<ResumenArea[]>`
      select
        a.id,
        a.nombre,
        a.color,
        count(t.id)::int                                    as total,
        count(t.id) filter (where t.estado = 'hecha')::int  as hecha,
        count(t.id) filter (
          where t.estado != 'hecha'
            and t.fecha_vencimiento is not null
            and t.fecha_vencimiento < current_date
        )::int                                               as vencidas,
        round(
          avg(extract(epoch from (t.completada_en - t.creada_en)) / 86400.0)
          filter (where t.estado = 'hecha' and t.completada_en is not null)
        )::int                                                as dias_promedio
      from area a
      left join tarea t on t.area_id = a.id
        and t.organizacion_id = mi_organizacion_id()
        and t.archivada = false
        and t.activa = true
      where a.organizacion_id = mi_organizacion_id() and a.activa = true
      group by a.id, a.nombre, a.color
      order by count(t.id) filter (where t.estado != 'hecha') desc, a.nombre asc
    `;

    const porPersona = await tx<ResumenPersona[]>`
      select
        u.nombre,
        count(t.id)::int                                                          as total,
        count(t.id) filter (where t.estado = 'hecha')::int                       as hecha,
        count(t.id) filter (where t.estado = 'en_progreso')::int                 as en_progreso,
        count(t.id) filter (where t.estado = 'por_hacer')::int                   as por_hacer,
        count(t.id) filter (
          where t.estado != 'hecha'
            and t.fecha_vencimiento is not null
            and t.fecha_vencimiento < current_date
        )::int                                                                    as vencidas,
        round(
          avg(extract(epoch from (t.completada_en - t.creada_en)) / 86400.0)
          filter (where t.estado = 'hecha' and t.completada_en is not null)
        )::int                                                                    as dias_promedio
      from usuario u
      left join tarea t on t.responsable_id = u.id
        and t.organizacion_id = mi_organizacion_id()
        and t.archivada = false
        and t.activa = true
      where u.organizacion_id = mi_organizacion_id()
        and u.estado = 'activo'
      group by u.id, u.nombre
      having count(t.id) > 0
      order by count(t.id) filter (where t.estado != 'hecha') desc, u.nombre asc
    `;

    const tareasAntiguas = await tx<TareaAntigua[]>`
      select
        t.titulo,
        a.nombre   as area_nombre,
        a.color    as area_color,
        u.nombre   as responsable_nombre,
        (current_date - t.creada_en::date)::int as dias_abierta
      from tarea t
      left join area    a on a.id = t.area_id
      left join usuario u on u.id = t.responsable_id
      where t.organizacion_id = mi_organizacion_id()
        and t.estado != 'hecha'
        and t.archivada = false
        and t.activa = true
      order by t.creada_en asc
      limit 5
    `;

    const [precisionEstimacion] = await tx<[PrecisionEstimacion]>`
      select
        count(*)::int                          as cantidad,
        round(avg(duracion_estimada_hs), 1)     as promedio_estimado,
        round(avg(duracion_real_hs), 1)         as promedio_real
      from tarea
      where organizacion_id = mi_organizacion_id()
        and archivada = false
        and activa = true
        and duracion_estimada_hs is not null
        and duracion_real_hs is not null
    `;

    const semanas = await tx<SemanaTareas[]>`
      with semanas as (
        select (date_trunc('week', current_date)::date - (n * 7)) as inicio
        from generate_series(0, 7) as n
      ),
      creadas as (
        select date_trunc('week', creada_en)::date as semana, count(*)::int as n
        from tarea
        where organizacion_id = mi_organizacion_id()
        group by 1
      ),
      completadas as (
        select date_trunc('week', completada_en)::date as semana, count(*)::int as n
        from tarea
        where organizacion_id = mi_organizacion_id() and completada_en is not null
        group by 1
      )
      select
        s.inicio::text as semana,
        coalesce(c.n, 0) as creadas,
        coalesce(d.n, 0) as completadas
      from semanas s
      left join creadas c on c.semana = s.inicio
      left join completadas d on d.semana = s.inicio
      order by s.inicio asc
    `;

    const actividadBitacora = await tx<ActividadBitacora[]>`
      select u.nombre, count(b.id)::int as dias_cargados
      from usuario u
      left join bitacora_diaria b on b.usuario_id = u.id
        and b.fecha >= current_date - interval '30 days'
      where u.organizacion_id = mi_organizacion_id() and u.estado = 'activo'
      group by u.id, u.nombre
      order by dias_cargados desc, u.nombre asc
    `;

    const [antiguedadVencidas] = await tx<[AntiguedadVencidas]>`
      select
        count(*) filter (where current_date - fecha_vencimiento between 0 and 7)::int as b0_7,
        count(*) filter (where current_date - fecha_vencimiento between 8 and 14)::int as b8_14,
        count(*) filter (where current_date - fecha_vencimiento between 15 and 30)::int as b15_30,
        count(*) filter (where current_date - fecha_vencimiento > 30)::int as b30_mas
      from tarea
      where organizacion_id = mi_organizacion_id()
        and archivada = false
        and activa = true
        and estado != 'hecha'
        and fecha_vencimiento is not null
        and fecha_vencimiento < current_date
    `;

    const usoPlantillas = await tx<UsoPlantilla[]>`
      select p.nombre, a.nombre as area_nombre, p.veces_aplicada, p.ultima_aplicacion::text as ultima_aplicacion
      from plantilla_area p
      join area a on a.id = p.area_id
      where p.organizacion_id = mi_organizacion_id()
      order by p.veces_aplicada desc, p.nombre asc
    `;

    const actividadComentarios = await tx<ActividadComentarios[]>`
      select u.nombre, count(c.id)::int as comentarios
      from usuario u
      left join comentario c on c.autor_id = u.id and c.creado_en >= now() - interval '30 days'
      where u.organizacion_id = mi_organizacion_id() and u.estado = 'activo'
      group by u.id, u.nombre
      having count(c.id) > 0
      order by comentarios desc
    `;

    const ausencias = await tx<AusenciaPersona[]>`
      select u.nombre, count(e.id)::int as ausencias
      from usuario u
      left join excepcion_turno e on e.usuario_id = u.id
        and e.tipo = 'ausencia'
        and e.fecha >= current_date - interval '90 days'
      where u.organizacion_id = mi_organizacion_id() and u.estado = 'activo'
      group by u.id, u.nombre
      having count(e.id) > 0
      order by ausencias desc
    `;

    const ultimosLogins = await tx<UltimoLogin[]>`
      select nombre, rol, ultimo_login::text as ultimo_login
      from usuario
      where organizacion_id = mi_organizacion_id() and estado = 'activo'
      order by ultimo_login desc nulls last, nombre asc
    `;

    // ── Visitas a colegios: reporte anual ──────────────────────────────────
    // anioVisitas = 0 es el sentinel "Todos los años" (histórico completo).
    const [reporteVisitasBase] = await tx<[Omit<ReporteVisitas, "localidades_alcanzadas">]>`
      select
        count(*) filter (where estado = 'realizado')::int as visitas_realizadas,
        count(distinct colegio_id) filter (where estado = 'realizado' and tipo in ('visita_colegio', 'feria_expo'))::int as colegios_visitados,
        count(*) filter (where estado in ('pendiente', 'confirmado', 'reprogramado'))::int as visitas_pendientes,
        count(*) filter (where estado = 'cancelado')::int as visitas_canceladas,
        coalesce(sum(cant_alumnos) filter (where estado = 'realizado'), 0)::int as alumnos_alcanzados,
        count(*) filter (where estado = 'realizado' and tipo in ('visita_colegio', 'feria_expo'))::int as veces_viajamos,
        count(*) filter (where estado = 'realizado' and tipo = 'nos_visitan')::int as veces_nos_visitaron,
        count(*) filter (where estado = 'realizado' and tipo = 'feria_expo')::int as ferias_expos,
        count(*) filter (where estado = 'realizado' and tipo = 'charla_taller')::int as charlas_talleres,
        count(*) filter (where estado = 'realizado' and tipo = 'virtual')::int as virtuales,
        count(*) filter (where estado = 'realizado' and tipo = 'otro')::int as otros
      from visita_colegio
      where organizacion_id = mi_organizacion_id()
        and (${anioVisitas} = 0 or extract(year from fecha) = ${anioVisitas})
    `;

    // Solo tipo viaje (visita_colegio/feria_expo): "nos_visitan" es un
    // colegio viniendo a la facultad, no nosotros yendo a su localidad —
    // contarlo acá inflaba/mezclaba las localidades alcanzadas con las de
    // colegios que nunca viajamos a visitar.
    const [{ n: localidadesAlcanzadas }] = await tx<[{ n: number }]>`
      select count(distinct c.ciudad)::int as n
      from visita_colegio v
      join colegio c on c.id = v.colegio_id
      where v.organizacion_id = mi_organizacion_id()
        and v.estado = 'realizado'
        and v.tipo in ('visita_colegio', 'feria_expo')
        and c.ciudad is not null
        and (${anioVisitas} = 0 or extract(year from v.fecha) = ${anioVisitas})
    `;
    const reporteVisitas: ReporteVisitas = {
      ...reporteVisitasBase,
      localidades_alcanzadas: localidadesAlcanzadas,
    };

    const localidadesVisitas = await tx<LocalidadVisitas[]>`
      select c.ciudad, count(*)::int as visitas, coalesce(sum(v.cant_alumnos), 0)::int as alumnos
      from visita_colegio v
      join colegio c on c.id = v.colegio_id
      where v.organizacion_id = mi_organizacion_id()
        and v.estado = 'realizado'
        and v.tipo in ('visita_colegio', 'feria_expo')
        and c.ciudad is not null
        and (${anioVisitas} = 0 or extract(year from v.fecha) = ${anioVisitas})
      group by c.ciudad
      order by visitas desc, c.ciudad asc
    `;

    const integrantesVisitas = await tx<IntegranteVisitas[]>`
      select u.nombre, count(vi.usuario_id)::int as visitas_realizadas
      from usuario u
      left join visita_integrante vi on vi.usuario_id = u.id
      left join visita_colegio v on v.id = vi.visita_id
        and v.organizacion_id = mi_organizacion_id()
        and v.estado = 'realizado'
        and (${anioVisitas} = 0 or extract(year from v.fecha) = ${anioVisitas})
      where u.organizacion_id = mi_organizacion_id() and u.estado = 'activo'
      group by u.id, u.nombre
      having count(vi.usuario_id) > 0
      order by visitas_realizadas desc, u.nombre asc
    `;

    const aniosVisitasFilas = await tx<{ anio: number }[]>`
      select distinct extract(year from fecha)::int as anio
      from visita_colegio
      where organizacion_id = mi_organizacion_id()
      order by anio desc
    `;

    const [{ n: totalColegios }] = await tx<[{ n: number }]>`
      select count(*)::int as n from colegio where organizacion_id = mi_organizacion_id()
    `;

    const [reporteViajes] = await tx<[ReporteViajes]>`
      select
        count(*) filter (where v.estado in ('inscripciones_abiertas', 'inscripciones_cerradas', 'realizado'))::int as viajes_activos,
        coalesce((
          select count(*)::int from viaje_integrante vi
          join viaje v2 on v2.id = vi.viaje_id
          where v2.organizacion_id = mi_organizacion_id() and vi.estado = 'confirmado'
        ), 0) as inscriptos_confirmados,
        coalesce((
          select sum(vp.monto)::int from viaje_pago vp
          join viaje_integrante vi on vi.id = vp.viaje_integrante_id
          join viaje v3 on v3.id = vi.viaje_id
          where v3.organizacion_id = mi_organizacion_id()
        ), 0) as total_recaudado,
        coalesce((
          select sum(vc.monto)::int from viaje_costo vc
          join viaje v4 on v4.id = vc.viaje_id
          where v4.organizacion_id = mi_organizacion_id()
        ), 0) as total_costos
      from viaje v
      where v.organizacion_id = mi_organizacion_id()
    `;

    const viajesResumen = await tx<ViajeResumenInformes[]>`
      select
        v.id, v.nombre, v.estado::text as estado,
        count(vi.id) filter (where vi.estado = 'confirmado')::int as confirmados,
        coalesce((select sum(vp.monto)::int from viaje_pago vp join viaje_integrante vi2 on vi2.id = vp.viaje_integrante_id where vi2.viaje_id = v.id), 0) as recaudado,
        coalesce((select sum(vc.monto)::int from viaje_costo vc where vc.viaje_id = v.id), 0) as costos
      from viaje v
      left join viaje_integrante vi on vi.viaje_id = v.id
      where v.organizacion_id = mi_organizacion_id()
      group by v.id
      order by v.fecha_inicio desc
    `;

    return {
      global,
      resumenAreas,
      porPersona,
      tareasAntiguas,
      precisionEstimacion,
      semanas,
      actividadBitacora,
      antiguedadVencidas,
      usoPlantillas,
      actividadComentarios,
      ausencias,
      ultimosLogins,
      reporteVisitas,
      localidadesVisitas: [...localidadesVisitas],
      integrantesVisitas: [...integrantesVisitas],
      aniosVisitas: aniosVisitasFilas.map((a) => a.anio),
      totalColegios,
      reporteViajes,
      viajesResumen: [...viajesResumen],
      secciones: {
        proyectos: org.proyectos_habilitado,
        visitas: org.visitas_habilitado,
        viajes: org.viajes_habilitado,
      },
    };
  });

  const aniosVisitasOpciones = Array.from(
    new Set([anioActual, ...aniosVisitas, ...(anioVisitas ? [anioVisitas] : [])]),
  ).sort((a, b) => b - a);

  // Si la pestaña pedida por la URL corresponde a una sección que la
  // organización desactivó en /configuracion, se cae a "tareas" en vez de
  // mostrar una pestaña vacía o rota.
  const tabInicial =
    params.tab === "visitas" && secciones.visitas
      ? "visitas"
      : params.tab === "viajes" && secciones.viajes
        ? "viajes"
        : params.tab === "actividad"
          ? "actividad"
          : "tareas";

  return (
    <InformesCliente
      tabInicial={tabInicial}
      secciones={secciones}
      global={global}
      resumenAreas={resumenAreas}
      porPersona={porPersona}
      tareasAntiguas={tareasAntiguas}
      precisionEstimacion={precisionEstimacion}
      semanas={semanas}
      actividadBitacora={actividadBitacora}
      antiguedadVencidas={antiguedadVencidas}
      usoPlantillas={usoPlantillas}
      actividadComentarios={actividadComentarios}
      ausencias={ausencias}
      ultimosLogins={ultimosLogins}
      reporteVisitas={reporteVisitas}
      localidadesVisitas={localidadesVisitas}
      integrantesVisitas={integrantesVisitas}
      totalColegios={totalColegios}
      anioVisitas={anioVisitas}
      aniosVisitas={aniosVisitasOpciones}
      reporteViajes={reporteViajes}
      viajesResumen={viajesResumen}
    />
  );
}
