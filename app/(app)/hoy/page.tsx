import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ListTodo,
  Sunrise,
  Sun,
  Moon,
  Megaphone,
} from "lucide-react";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import { redirectSesionInvalida } from "@/lib/redirects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TareaFila } from "./tarea-fila";
import { AccesosCard } from "./accesos-card";
import { BitacoraCard } from "./bitacora-card";
import { BitacoraEquipoCard } from "./bitacora-equipo-card";
import { MisTareasHoy } from "./mis-tareas-hoy";
import { VisitasCard, type VisitaHoyRow } from "./visitas-card";
import { AgendaCard } from "./agenda-card";
import { listarEventosCalendar, type EventoLeido } from "@/lib/google/calendar";
import { AvisoMotivo } from "@/components/features/aviso-motivo";

// ── Helpers ───────────────────────────────────────────────────────────────────

function saludo(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

function formatFechaRelativaCorta(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "recién";
  if (mins < 60) return `hace ${mins} min`;
  const hs = Math.floor(mins / 60);
  if (hs < 24) return `hace ${hs} h`;
  const dias = Math.floor(hs / 24);
  return `hace ${dias} d`;
}

function SaludoIcono({ className }: { className?: string }) {
  const h = new Date().getHours();
  if (h < 9) return <Sunrise className={className} />;
  if (h < 20) return <Sun className={className} />;
  return <Moon className={className} />;
}

function fechaLarga(): string {
  const s = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fechaRelativa(fechaISO: string, hoyISO: string): string {
  const diff = Math.round(
    (new Date(fechaISO + "T00:00:00").getTime() -
      new Date(hoyISO + "T00:00:00").getTime()) /
      86400000,
  );
  if (diff < 0)
    return `hace ${Math.abs(diff)} ${Math.abs(diff) === 1 ? "día" : "días"}`;
  if (diff === 0) return "hoy";
  if (diff === 1) return "mañana";
  if (diff < 7) return `en ${diff} días`;
  return new Date(fechaISO + "T00:00:00").toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
  });
}

const PALETTE = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

function colorParaNombre(nombre: string, todos: string[]): string {
  const sorted = [...todos].sort();
  const idx = sorted.indexOf(nombre);
  return PALETTE[idx % PALETTE.length];
}

function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/);
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

type TareaRow = {
  id: string;
  titulo: string;
  estado: string;
  prioridad: string;
  tipo: string;
  fecha_vencimiento: string | null;
  area_color: string | null;
  area_nombre: string | null;
  para_todos: boolean;
};

type StatRow = {
  abiertas: number;
  en_progreso: number;
  completadas_hoy: number;
};

type PersonaRow = { nombre: string; avatar_color: string | null };

type AccesoRow = { id: string; etiqueta: string; url: string };

type BitacoraHoyRow = {
  hecho: string | null;
  pendiente: string | null;
  observaciones: string | null;
};

type BitacoraEquipoRow = {
  nombre: string;
  avatar_color: string | null;
  hecho: string | null;
  pendiente: string | null;
  observaciones: string | null;
  hora: string;
};

type NovedadRow = {
  contenido: string;
  area_nombre: string;
  area_color: string;
  autor_nombre: string;
  creada_en: string;
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function HoyPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const rol = (session.user as { rol: string }).rol;
  const canManage = rol === "administrador";
  const hoyISO = new Date().toISOString().slice(0, 10);

  const {
    tareas,
    stats,
    enOficina,
    accesos,
    bitacoraHoy,
    bitacoraEquipo,
    prefillHecho,
    novedad,
    tableroHabilitado,
    miNombre,
    visitasHabilitado,
    agenda,
    visitas,
    hoyVisitas,
    mananaVisitas,
  } = await withUser(session.user.id, async (tx) => {
    // mi_nombre de la base y no de la sesión: si se cambió en /perfil, la
    // sesión lo sigue teniendo viejo por un rato.
    const [org] = await tx<
      [
        {
          tablero_habilitado: boolean;
          visitas_habilitado: boolean;
          calendario_habilitado: boolean;
          google_calendar_id: string | null;
          zona_horaria: string;
          dia_desde: Date;
          dia_hasta: Date;
          mi_nombre: string;
        },
      ]
    >`
      select
        seccion_visible(tablero_habilitado, secciones_solo_admin, 'tablero') as tablero_habilitado,
        seccion_visible(visitas_habilitado, secciones_solo_admin, 'visitas') as visitas_habilitado,
        seccion_visible(calendario_habilitado, secciones_solo_admin, 'calendario') as calendario_habilitado,
        google_calendar_id, zona_horaria,
        -- Medianoche de hoy y de mañana en la zona horaria de la
        -- organización (withUser la fija por transacción): el rango de la
        -- agenda del día, sin depender de la zona del servidor.
        current_date::timestamptz as dia_desde,
        (current_date + 1)::timestamptz as dia_hasta,
        (select nombre from usuario where id = mi_usuario_id()) as mi_nombre
      from organizacion where id = mi_organizacion_id()
    `;
    // session.user.id no resuelve a ningún usuario/organización real (sesión
    // vieja de una cuenta borrada, o base de datos reseteada sin recargar la
    // sesión) — es una sesión inválida, no un caso de "organización sin
    // configurar" como en app/(app)/layout.tsx.
    if (!org) redirectSesionInvalida();

    // Visitas de hoy y mañana (solo si la sección está visible). Antes de
    // leerlas, las que ya cerraron su día sin confirmar pasan solas a
    // Realizado (ver 051_visitas_auto_realizadas.sql). Va aparte del
    // Promise.all de abajo porque tiene que correr antes que el select.
    let visitas: VisitaHoyRow[] = [];
    let hoyVisitas = hoyISO;
    let mananaVisitas = hoyISO;
    if (org.visitas_habilitado) {
      const [, filas, [dias]] = await Promise.all([
        tx`select marcar_visitas_realizadas()`,
        tx<VisitaHoyRow[]>`
          select
            v.id, v.fecha::text, c.nombre as colegio_nombre, c.ciudad,
            v.hora_inicio::text, v.hora_fin::text,
            v.tipo::text as tipo, v.estado::text as estado,
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
          where v.organizacion_id = mi_organizacion_id()
            and v.fecha between current_date and current_date + 1
          order by v.fecha asc, v.hora_inicio asc nulls last
        `,
        // current_date en la zona horaria de la organización (withUser), no
        // la del servidor — la misma "hoy" que usa el filtro de arriba.
        tx<[{ hoy: string; manana: string }]>`
          select current_date::text as hoy, (current_date + 1)::text as manana
        `,
      ]);
      visitas = [...filas];
      hoyVisitas = dias.hoy;
      mananaVisitas = dias.manana;
    }

    // Ninguna de estas 9 queries depende del resultado de otra — van todas
    // juntas en Promise.all para que postgres.js las pipelinee en un solo
    // round-trip de red en vez de nueve (esta página es la que más se
    // visita, y contra una base remota cada round-trip se nota al navegar).
    const [
      tareas,
      [stats],
      enOficina,
      accesos,
      [novedad],
      [bitacoraHoy],
      bitacoraEquipo,
      tareasCompletadasHoy,
      subtareasCompletadasHoy,
      comentariosHoy,
    ] = await Promise.all([
      tx<TareaRow[]>`
        select
          t.id,
          t.titulo,
          t.estado::text,
          t.prioridad::text,
          t.tipo::text,
          t.fecha_vencimiento::text,
          a.color as area_color,
          a.nombre as area_nombre,
          t.para_todos
        from tarea t
        left join area a on a.id = t.area_id
        where (
            t.responsable_id = mi_usuario_id()
            or exists (select 1 from tarea_asignado ta where ta.tarea_id = t.id and ta.usuario_id = mi_usuario_id())
            or t.para_todos = true
          )
          and t.estado != 'hecha'
          and t.archivada = false
          and t.activa = true
        order by t.fecha_vencimiento asc nulls last, t.orden asc
      `,

      tx<[StatRow]>`
        select
          count(*)         filter (where estado != 'hecha')::int                           as abiertas,
          count(*)         filter (where estado = 'en_progreso')::int                      as en_progreso,
          count(*)         filter (where estado = 'hecha'
            and completada_en::date = current_date)::int                                   as completadas_hoy
        from tarea
        where organizacion_id = mi_organizacion_id()
          and archivada = false
          and activa = true
      `,

      // "En la oficina ahora": excluye a quien marcó ausencia o cambio de
      // turno hoy — si es cambio, se suma más abajo a quien lo cubre en vez
      // de a quien tenía el turno original. Es un reemplazo puntual: el
      // turno fijo (tabla turno) no se toca, mañana vuelve a figurar la
      // persona de siempre.
      tx<PersonaRow[]>`
        with turno_activo as (
          select t.usuario_id
          from turno t
          where t.organizacion_id = mi_organizacion_id()
            and t.dia_semana = (extract(isodow from current_date)::int - 1)
            and t.hora_inicio <= current_time
            and t.hora_fin    >  current_time
            and t.vigente_desde <= current_date
            and (t.vigente_hasta is null or t.vigente_hasta >= current_date)
        )
        select u.nombre, u.avatar_color
        from turno_activo ta
        join usuario u on u.id = ta.usuario_id
        where u.estado = 'activo'
          and not exists (
          select 1 from excepcion_turno e
          where e.usuario_id = ta.usuario_id
            and e.tipo in ('ausencia', 'cambio')
            and e.fecha = current_date
        )
        union
        select ur.nombre, ur.avatar_color
        from turno_activo ta
        join excepcion_turno e
          on e.usuario_id = ta.usuario_id and e.tipo = 'cambio' and e.fecha = current_date
        join usuario ur on ur.id = e.usuario_reemplazo_id
        order by nombre asc
      `,

      tx<AccesoRow[]>`
        select id, etiqueta, url
        from acceso_rapido
        where organizacion_id = mi_organizacion_id()
          and area_id is null
          and viaje_id is null
        order by orden asc
      `,

      // Última novedad de cualquier área — banner discreto para que no haga
      // falta entrar a cada área a ver si hay algo nuevo.
      tx<NovedadRow[]>`
        select
          n.contenido,
          a.nombre  as area_nombre,
          a.color   as area_color,
          u.nombre  as autor_nombre,
          n.creada_en::text
        from nota_area n
        join area    a on a.id = n.area_id
        join usuario u on u.id = n.autor_id
        where a.organizacion_id = mi_organizacion_id()
        order by n.creada_en desc
        limit 1
      `,

      tx<BitacoraHoyRow[]>`
        select hecho, pendiente, observaciones
        from bitacora_diaria
        where usuario_id = mi_usuario_id() and fecha = current_date
      `,

      // Bitácora del resto del equipo, hoy — para que el turno siguiente vea
      // acá qué se hizo y qué quedó pendiente en vez de por WhatsApp. La
      // propia no se repite (ya está arriba, en bitacoraHoy).
      tx<BitacoraEquipoRow[]>`
        select
          u.nombre, u.avatar_color,
          b.hecho, b.pendiente, b.observaciones,
          to_char(b.creada_en, 'HH24:MI') as hora
        from bitacora_diaria b
        join usuario u on u.id = b.usuario_id
        where b.organizacion_id = mi_organizacion_id()
          and b.fecha = current_date
          and b.usuario_id != mi_usuario_id()
        order by b.creada_en asc
      `,

      tx<{ titulo: string }[]>`
        select titulo
        from tarea t
        where (
            t.responsable_id = mi_usuario_id()
            or exists (select 1 from tarea_asignado ta where ta.tarea_id = t.id and ta.usuario_id = mi_usuario_id())
          )
          and t.estado = 'hecha'
          and t.completada_en::date = current_date
          and t.archivada = false
        order by t.completada_en asc
      `,

      // Subtareas que el usuario resolvió hoy en sus propias tareas — evita
      // que tenga que reescribir a mano el avance que ya quedó registrado.
      tx<{ titulo: string; tarea_titulo: string }[]>`
        select s.titulo, t.titulo as tarea_titulo
        from subtarea s
        join tarea t on t.id = s.tarea_id
        where (
            t.responsable_id = mi_usuario_id()
            or exists (select 1 from tarea_asignado ta where ta.tarea_id = t.id and ta.usuario_id = mi_usuario_id())
          )
          and s.hecha = true
          and s.completada_en::date = current_date
        order by s.completada_en asc
      `,

      // Comentarios que el usuario dejó hoy en cualquier tarea.
      tx<{ contenido: string; tarea_titulo: string }[]>`
        select c.contenido, t.titulo as tarea_titulo
        from comentario c
        join tarea t on t.id = c.tarea_id
        where c.autor_id = mi_usuario_id()
          and c.creado_en::date = current_date
        order by c.creado_en asc
      `,
    ]);

    const lineasHecho = [
      ...tareasCompletadasHoy.map((t) => `- ${t.titulo}`),
      ...subtareasCompletadasHoy.map(
        (s) => `- ${s.titulo} (en "${s.tarea_titulo}")`,
      ),
      ...comentariosHoy.map(
        (c) =>
          `- Comentario en "${c.tarea_titulo}": ${
            c.contenido.length > 80
              ? c.contenido.slice(0, 80) + "…"
              : c.contenido
          }`,
      ),
    ];

    return {
      tareas: [...tareas],
      stats,
      enOficina: [...enOficina],
      accesos: [...accesos],
      bitacoraHoy: bitacoraHoy ?? null,
      bitacoraEquipo: [...bitacoraEquipo],
      prefillHecho: lineasHecho.join("\n"),
      novedad: novedad ?? null,
      tableroHabilitado: org.tablero_habilitado,
      miNombre: org.mi_nombre,
      visitasHabilitado: org.visitas_habilitado,
      agenda: org.calendario_habilitado
        ? {
            calendarId: org.google_calendar_id ?? process.env.GOOGLE_CALENDAR_ID ?? null,
            zonaHoraria: org.zona_horaria,
            desde: org.dia_desde.toISOString(),
            hasta: org.dia_hasta.toISOString(),
          }
        : null,
      visitas,
      hoyVisitas,
      mananaVisitas,
    };
  });

  // Agenda del día desde Google Calendar — fuera de withUser para no
  // retener la conexión a la base mientras se espera a Google (la lectura
  // se cachea 5 min, ver listarEventosCalendar). Si falla, /hoy se muestra
  // igual y la tarjeta avisa; nunca rompe la página.
  let eventosHoy: EventoLeido[] | null = null;
  let errorAgenda: string | null = null;
  if (agenda) {
    try {
      eventosHoy = await listarEventosCalendar(agenda.calendarId, agenda.desde, agenda.hasta);
    } catch {
      errorAgenda = "No se pudo leer el Google Calendar ahora.";
    }
  }

  // Clasificar tareas
  const vencidas = tareas.filter(
    (t) => t.fecha_vencimiento !== null && t.fecha_vencimiento < hoyISO,
  );
  const paraHoy = tareas.filter(
    (t) =>
      t.estado === "en_progreso" ||
      t.fecha_vencimiento === hoyISO ||
      (t.fecha_vencimiento === null && vencidas.every((v) => v.id !== t.id)),
  );
  const proximas = tareas.filter(
    (t) =>
      t.fecha_vencimiento !== null &&
      t.fecha_vencimiento > hoyISO &&
      t.estado !== "en_progreso",
  );

  const nombresPaleta = enOficina.map((p) => p.nombre);

  const subtituloHoy =
    paraHoy.length === 0 && vencidas.length === 0
      ? "Estás al día por hoy."
      : vencidas.length > 0
        ? `${vencidas.length} tarea${vencidas.length > 1 ? "s" : ""} vencida${vencidas.length > 1 ? "s" : ""} — revisalas.`
        : `${paraHoy.length} tarea${paraHoy.length > 1 ? "s" : ""} para completar hoy.`;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <AvisoMotivo motivo={motivo} />
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">{fechaLarga()}</p>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <SaludoIcono className="text-muted-foreground size-5" />
          {saludo()}, {(miNombre ?? session.user.name).split(" ")[0]}
        </h1>
        <p
          className={`text-sm ${vencidas.length > 0 ? "text-destructive font-medium" : "text-muted-foreground"}`}
        >
          {subtituloHoy}
        </p>
      </div>

      {/* ── Última novedad ────────────────────────────────────────────────── */}
      {novedad && (
        <div
          className="flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm"
          style={{ borderLeftColor: novedad.area_color, borderLeftWidth: 3 }}
        >
          <Megaphone className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          <p className="min-w-0 flex-1">
            <span className="font-medium">{novedad.area_nombre}</span>
            <span className="text-muted-foreground">
              {" "}
              · {novedad.autor_nombre}{" "}
            </span>
            <span className="text-muted-foreground text-xs">
              ({formatFechaRelativaCorta(novedad.creada_en)})
            </span>
            <br />
            <span className="text-muted-foreground">{novedad.contenido}</span>
          </p>
        </div>
      )}

      {/* ── Body 2-col ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_320px]">
        {/* ── Columna izquierda ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Vencidas */}
          {vencidas.length > 0 && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardHeader className="px-4 pt-4 pb-2">
                <CardTitle className="text-destructive flex items-center gap-2 text-sm font-semibold">
                  <AlertCircle className="size-4" />
                  Vencidas
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-destructive/10 divide-y px-4 pb-3">
                {vencidas.map((t) => (
                  <TareaFila
                    key={t.id}
                    id={t.id}
                    titulo={t.titulo}
                    estado={t.estado}
                    prioridad={t.prioridad}
                    tipo={t.tipo}
                    areaColor={t.area_color}
                    areaNombre={t.area_nombre}
                    fecha={t.fecha_vencimiento}
                    fechaRelativa={
                      t.fecha_vencimiento
                        ? fechaRelativa(t.fecha_vencimiento, hoyISO)
                        : null
                    }
                    paraTodos={t.para_todos}
                    vencida
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Mis tareas de hoy */}
          <Card>
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="flex items-center justify-between text-sm font-semibold">
                Mis tareas de hoy
                {paraHoy.length > 0 && (
                  <Badge variant="outline">{paraHoy.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {paraHoy.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <CheckCircle2 className="size-8 text-green-500 opacity-60" />
                  <p className="text-muted-foreground text-sm">
                    No tenés nada pendiente para hoy.
                  </p>
                  {tableroHabilitado && (
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<Link href="/tablero" />}
                    >
                      Ver tablero completo
                    </Button>
                  )}
                </div>
              ) : (
                // Alto acotado + scroll propio: con muchas tareas para hoy
                // esta card crecía sin límite y estiraba toda la columna
                // izquierda de "Hoy" (mismo criterio que Accesos rápidos, ver
                // accesos-card.tsx) — a partir de ~5 tareas se navega adentro
                // de la card, no scrolleando toda la página.
                <div className="max-h-[300px] divide-y overflow-x-hidden overflow-y-auto">
                  <MisTareasHoy
                    tareas={paraHoy.map((t) => ({
                      id: t.id,
                      titulo: t.titulo,
                      estado: t.estado,
                      prioridad: t.prioridad,
                      tipo: t.tipo,
                      areaColor: t.area_color,
                      areaNombre: t.area_nombre,
                      fecha: t.fecha_vencimiento,
                      fechaRelativa: t.fecha_vencimiento
                        ? fechaRelativa(t.fecha_vencimiento, hoyISO)
                        : null,
                      paraTodos: t.para_todos,
                    }))}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Visitas de hoy y mañana */}
          {visitasHabilitado && (
            <VisitasCard
              visitas={visitas}
              hoy={hoyVisitas}
              manana={mananaVisitas}
            />
          )}

          {/* Pulso + En la oficina ahora: fila horizontal debajo de las
              tareas de hoy. Accesos rápidos vive en la columna derecha, donde
              puede crecer a lo alto. La música vive en un reproductor global
              (ver components/features/music-player.tsx). */}
          <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
            <Card>
              <CardHeader className="px-4 pt-4 pb-2">
                <CardTitle className="text-sm font-semibold">Pulso</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5 px-4 pb-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                    <ListTodo className="size-3 shrink-0" />
                    Abiertas
                  </span>
                  <span className="text-xs font-semibold tabular-nums">
                    {stats.abiertas}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                    <Clock className="size-3 shrink-0" />
                    En progreso
                  </span>
                  <span className="text-xs font-semibold text-blue-600 tabular-nums">
                    {stats.en_progreso}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                    <CheckCircle2 className="size-3 shrink-0" />
                    Hoy
                  </span>
                  <span className="text-xs font-semibold text-green-600 tabular-nums">
                    {stats.completadas_hoy}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="px-4 pt-4 pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <span
                    className={`size-2 rounded-full ${enOficina.length > 0 ? "bg-green-500" : "bg-muted-foreground/40"}`}
                  />
                  En la oficina
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {enOficina.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    Fuera del horario de oficina.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {enOficina.map((p) => (
                        <Avatar key={p.nombre} className="size-8">
                          <AvatarFallback
                            className="text-[11px] font-semibold text-white"
                            style={{
                              // El color que cada quien eligió en /perfil;
                              // la paleta queda solo para quien no eligió.
                              backgroundColor:
                                p.avatar_color ??
                                colorParaNombre(p.nombre, nombresPaleta),
                            }}
                          >
                            {iniciales(p.nombre)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {enOficina.map((p) => p.nombre.split(" ")[0]).join(", ")}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Próximamente */}
          {proximas.length > 0 && (
            <Collapsible defaultOpen={proximas.length <= 5}>
              <Card>
                <CollapsibleTrigger
                  nativeButton={false}
                  render={
                    <CardHeader className="cursor-pointer px-4 pt-4 pb-2 select-none" />
                  }
                >
                  <CardTitle className="flex items-center justify-between text-sm font-semibold">
                    Próximamente
                    <Badge variant="outline">{proximas.length}</Badge>
                  </CardTitle>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="divide-y px-4 pb-3">
                    {proximas.map((t) => (
                      <TareaFila
                        key={t.id}
                        id={t.id}
                        titulo={t.titulo}
                        estado={t.estado}
                        prioridad={t.prioridad}
                        tipo={t.tipo}
                        areaColor={t.area_color}
                        areaNombre={t.area_nombre}
                        fecha={t.fecha_vencimiento}
                        fechaRelativa={
                          t.fecha_vencimiento
                            ? fechaRelativa(t.fecha_vencimiento, hoyISO)
                            : null
                        }
                        paraTodos={t.para_todos}
                        vencida={false}
                      />
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}
        </div>

        {/* ── Columna derecha ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Agenda de hoy (Google Calendar) — vistazo rápido del día */}
          {agenda && (
            <AgendaCard
              eventos={eventosHoy}
              zonaHoraria={agenda.zonaHoraria}
              error={errorAgenda}
            />
          )}

          {/* Bitácora del día */}
          <div id="bitacora" className="scroll-mt-4">
            <BitacoraCard
              bitacoraHoy={bitacoraHoy}
              prefillHecho={prefillHecho}
            />
          </div>

          {/* Accesos rápidos: al costado para que la lista crezca a lo alto */}
          <AccesosCard accesos={accesos} canManage={canManage} />

          {/* Bitácora del resto del equipo, hoy — para el handoff entre turnos */}
          <BitacoraEquipoCard entradas={bitacoraEquipo} />
        </div>
      </div>
    </div>
  );
}
