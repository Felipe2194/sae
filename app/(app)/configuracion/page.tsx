import { redirect } from "next/navigation";
import {
  Link2,
  Trash2,
  Calendar,
  CheckSquare,
  ExternalLink,
  Users,
  Building2,
  LayoutPanelTop,
  History,
} from "lucide-react";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DriveIcon, esUrlDrive } from "@/components/features/drive-icon";
import { AsignarSelect } from "./asignar-select";
import { crearAcceso, eliminarAcceso } from "./actions";
import { UsuariosTable, type UsuarioFila } from "./usuarios-table";
import { AuditoriaTable, type AuditoriaFila } from "./auditoria-table";
import { OrganizacionForm } from "./organizacion-form";
import { SeccionesForm } from "./secciones-form";
import { CrearUsuarioDialog } from "./crear-usuario-dialog";
import { NuevaReunionDialog } from "./nueva-reunion-dialog";
import { GoogleCalendarForm } from "./google-calendar-form";
import { tieneServicioCalendar } from "@/lib/google/calendar";

type UsuarioRow = UsuarioFila;

type TareaRow = {
  id: string;
  titulo: string;
  estado: string;
  area_nombre: string | null;
  area_color: string | null;
  responsable_id: string | null;
};

type AccesoRow = {
  id: string;
  etiqueta: string;
  url: string;
};

const ESTADO_LABEL: Record<string, string> = {
  por_hacer: "Por hacer",
  en_progreso: "En progreso",
};

const ESTADO_VARIANT: Record<string, "outline" | "secondary"> = {
  por_hacer: "outline",
  en_progreso: "secondary",
};

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const rol = (session.user as { rol: string }).rol;
  if (rol !== "administrador") redirect("/hoy");

  const { tareas, usuarios, todosUsuarios, auditoria, accesos, organizacion } =
    await withUser(session.user.id, async (tx) => {
      const tareas = await tx<TareaRow[]>`
      select
        t.id,
        t.titulo,
        t.estado,
        a.nombre  as area_nombre,
        a.color   as area_color,
        t.responsable_id
      from tarea t
      left join area a on a.id = t.area_id
      where t.estado != 'hecha' and t.activa = true
      order by t.estado desc, a.nombre asc, t.orden asc
    `;

      const usuarios = await tx<{ id: string; nombre: string }[]>`
      select id, nombre
      from usuario
      where estado = 'activo'
      order by nombre asc
    `;

      const todosUsuarios = await tx<UsuarioRow[]>`
      select id, nombre, email, rol::text as rol, estado::text as estado, creada_en::text as creada_en, es_cuenta_generica
      from usuario
      order by
        case estado when 'pendiente' then 0 when 'activo' then 1 else 2 end,
        nombre asc
    `;

      const auditoria = await tx<AuditoriaFila[]>`
      select
        a.id, a.creado_en::text, u.nombre as autor_nombre,
        a.entidad, a.entidad_nombre, a.campo, a.valor_antes, a.valor_despues
      from auditoria a
      left join usuario u on u.id = a.usuario_id
      order by a.creado_en desc
      limit 100
    `;

      const accesos = await tx<AccesoRow[]>`
      select id, etiqueta, url
      from acceso_rapido
      where area_id is null
        and viaje_id is null
      order by orden asc
    `;

      const [organizacion] = await tx<
        {
          nombre: string;
          logo_url: string | null;
          color_principal: string | null;
          zona_horaria: string;
          calendario_habilitado: boolean;
          cronograma_habilitado: boolean;
          proyectos_habilitado: boolean;
          visitas_habilitado: boolean;
          tablero_habilitado: boolean;
          viajes_habilitado: boolean;
          google_calendar_id: string | null;
        }[]
      >`
      select
        nombre, logo_url, color_principal, zona_horaria,
        calendario_habilitado, cronograma_habilitado,
        proyectos_habilitado, visitas_habilitado, tablero_habilitado,
        viajes_habilitado, google_calendar_id
      from organizacion
      where id = mi_organizacion_id()
    `;

      return { tareas, usuarios, todosUsuarios, auditoria, accesos, organizacion };
    });

  // El calendarId ahora vive por organización (ver 034_google_calendar_
  // organizacion.sql); GOOGLE_CALENDAR_ID sigue como fallback legacy para la
  // organización que ya dependía de esa variable antes de este cambio.
  const calendarId = organizacion.google_calendar_id ?? process.env.GOOGLE_CALENDAR_ID ?? null;
  const emailServicio = process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL ?? null;
  const tieneServicio = tieneServicioCalendar();
  const tienePlataforma = tieneServicio || !!process.env.GOOGLE_CALENDAR_API_KEY;
  const tieneCalendar = tienePlataforma && !!calendarId;
  const tieneEscrituraCalendar = tieneServicio && !!calendarId;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Configuración
        </h1>
        <p className="text-muted-foreground text-sm">
          Configuración del sistema y gestión de recursos.
        </p>
      </div>

      {/* ── Organización ─────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="text-muted-foreground size-4" />
          <h2 className="font-semibold">Organización</h2>
        </div>
        <Card>
          <CardContent className="pt-4">
            <OrganizacionForm organizacion={organizacion} />
          </CardContent>
        </Card>
      </section>

      {/* ── Secciones ────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <LayoutPanelTop className="text-muted-foreground size-4" />
          <h2 className="font-semibold">Secciones</h2>
        </div>
        <p className="text-muted-foreground -mt-1 text-sm">
          Elegí qué secciones ve el equipo en el menú lateral. Hoy siempre
          está disponible.
        </p>
        <Card>
          <CardContent className="pt-4">
            <SeccionesForm
              secciones={{
                tablero: organizacion.tablero_habilitado,
                calendario: organizacion.calendario_habilitado,
                cronograma: organizacion.cronograma_habilitado,
                proyectos: organizacion.proyectos_habilitado,
                visitas: organizacion.visitas_habilitado,
                viajes: organizacion.viajes_habilitado,
              }}
            />
          </CardContent>
        </Card>
      </section>

      {/* ── Gestión de usuarios ──────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Users className="text-muted-foreground size-4" />
          <h2 className="font-semibold">Usuarios</h2>
          {todosUsuarios.filter((u) => u.estado === "pendiente").length > 0 && (
            <Badge className="border-amber-200 bg-amber-100 text-amber-800">
              {todosUsuarios.filter((u) => u.estado === "pendiente").length}{" "}
              pendiente
              {todosUsuarios.filter((u) => u.estado === "pendiente").length > 1
                ? "s"
                : ""}
            </Badge>
          )}
          <div className="ml-auto">
            <CrearUsuarioDialog />
          </div>
        </div>
        <Card>
          <CardContent className="p-0">
            <UsuariosTable usuarios={todosUsuarios} selfId={session.user.id} />
          </CardContent>
        </Card>
      </section>

      {/* ── Asignación de tareas ─────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <CheckSquare className="text-muted-foreground size-4" />
          <h2 className="font-semibold">Asignar tareas</h2>
          <Badge variant="outline">{tareas.length} abiertas</Badge>
        </div>

        <Card>
          <CardContent className="p-0">
            {tareas.length === 0 ? (
              <p className="text-muted-foreground px-4 py-6 text-center text-sm">
                No hay tareas abiertas.
              </p>
            ) : (
              <>
                {/* Desktop: tabla — alto acotado con scroll interno, para que
                    muchas tareas abiertas no estiren toda la página. */}
                <div className="hidden max-h-96 overflow-auto md:block">
                  <table className="w-full text-sm">
                    <thead className="bg-card sticky top-0 z-10">
                      <tr className="border-b">
                        <th className="text-muted-foreground w-full px-4 py-3 text-left text-xs font-medium">
                          Tarea
                        </th>
                        <th className="text-muted-foreground px-3 py-3 text-left text-xs font-medium whitespace-nowrap">
                          Estado
                        </th>
                        <th className="text-muted-foreground px-3 py-3 text-left text-xs font-medium whitespace-nowrap">
                          Responsable
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tareas.map((t) => (
                        <tr key={t.id} className="border-b last:border-0">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              {t.area_color && (
                                <span
                                  className="size-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: t.area_color }}
                                />
                              )}
                              <div>
                                <p className="leading-tight font-medium">
                                  {t.titulo}
                                </p>
                                {t.area_nombre && (
                                  <p className="text-muted-foreground text-xs">
                                    {t.area_nombre}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <Badge
                              variant={ESTADO_VARIANT[t.estado] ?? "outline"}
                            >
                              {ESTADO_LABEL[t.estado] ?? t.estado}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5">
                            <AsignarSelect
                              tareaId={t.id}
                              responsableId={t.responsable_id}
                              usuarios={usuarios}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile: tarjetas — Responsable no entra sin cortar en una tabla de 3 columnas */}
                <div className="max-h-96 divide-y overflow-y-auto md:hidden">
                  {tareas.map((t) => (
                    <div key={t.id} className="flex flex-col gap-2 p-4">
                      <div className="flex items-start gap-2">
                        {t.area_color && (
                          <span
                            className="mt-1.5 size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: t.area_color }}
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="leading-tight font-medium">
                            {t.titulo}
                          </p>
                          {t.area_nombre && (
                            <p className="text-muted-foreground text-xs">
                              {t.area_nombre}
                            </p>
                          )}
                        </div>
                        <Badge
                          variant={ESTADO_VARIANT[t.estado] ?? "outline"}
                          className="shrink-0"
                        >
                          {ESTADO_LABEL[t.estado] ?? t.estado}
                        </Badge>
                      </div>
                      <AsignarSelect
                        tareaId={t.id}
                        responsableId={t.responsable_id}
                        usuarios={usuarios}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Auditoría ────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <History className="text-muted-foreground size-4" />
          <h2 className="font-semibold">Auditoría</h2>
        </div>
        <p className="text-muted-foreground -mt-1 text-sm">
          Quién cambió qué: reasignaciones de tareas, cambios de rol o estado
          de usuarios, proyectos archivados y visitas canceladas.
        </p>
        <Card>
          <CardContent className="p-0">
            <AuditoriaTable entradas={auditoria} />
          </CardContent>
        </Card>
      </section>

      {/* ── Accesos rápidos ──────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Link2 className="text-muted-foreground size-4" />
          <h2 className="font-semibold">Accesos rápidos</h2>
        </div>
        <p className="text-muted-foreground -mt-1 text-sm">
          Aparecen en la página de inicio de todos los miembros. Podés agregar
          Drive, NotebookLM, Sheets, y similares.
        </p>

        {accesos.length > 0 && (
          <Card>
            <CardContent className="divide-y p-0">
              {accesos.map((ar) => (
                <div
                  key={ar.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{ar.etiqueta}</p>
                    <a
                      href={ar.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground flex max-w-sm items-center gap-1 truncate text-xs hover:underline"
                    >
                      {esUrlDrive(ar.url) ? (
                        <DriveIcon className="size-3 shrink-0" />
                      ) : (
                        <ExternalLink className="size-3 shrink-0" />
                      )}
                      {ar.url}
                    </a>
                  </div>
                  <form action={eliminarAcceso.bind(null, ar.id)}>
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive shrink-0"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </form>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Agregar enlace
            </CardTitle>
            <CardDescription className="text-xs">
              Cualquier URL de trabajo: Google Drive, NotebookLM, Sheets,
              formularios, etc.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={crearAcceso}
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="etiqueta" className="text-xs">
                  Nombre
                </Label>
                <Input
                  id="etiqueta"
                  name="etiqueta"
                  placeholder="Drive de la secretaría"
                  required
                  className="h-9 text-sm"
                />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="url" className="text-xs">
                  URL
                </Label>
                <Input
                  id="url"
                  name="url"
                  type="url"
                  placeholder="https://drive.google.com/..."
                  required
                  className="h-9 text-sm"
                />
              </div>
              <Button type="submit" size="sm" className="shrink-0">
                Agregar
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      {/* ── Reuniones ────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="text-muted-foreground size-4" />
          <h2 className="font-semibold">Reuniones</h2>
          {tieneEscrituraCalendar ? (
            <Badge className="border-green-200 bg-green-100 text-green-800">
              Sincroniza con Google Calendar
            </Badge>
          ) : (
            <Badge variant="outline">Solo se crea en el sistema</Badge>
          )}
        </div>
        <Card>
          <CardContent className="flex flex-col items-start gap-3 pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground">
              Crea una tarea de tipo &ldquo;Reunión&rdquo; con hora y duración
              {tieneEscrituraCalendar
                ? ", y la agenda como evento en tu Google Calendar."
                : tieneServicio
                  ? ". Para que además quede agendada en Google Calendar, vinculá tu calendario más abajo."
                  : ". La sincronización con Google Calendar todavía no está configurada en esta plataforma."}
            </p>
            <NuevaReunionDialog usuarios={usuarios} />
          </CardContent>
        </Card>
      </section>

      {/* ── Google Calendar ───────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="text-muted-foreground size-4" />
          <h2 className="font-semibold">Google Calendar</h2>
          {tieneCalendar ? (
            <Badge className="border-green-200 bg-green-100 text-green-800">
              Conectado
            </Badge>
          ) : (
            <Badge variant="outline">Sin configurar</Badge>
          )}
        </div>
        <p className="text-muted-foreground -mt-1 text-sm">
          Vinculá tu propio Google Calendar: sus eventos aparecen en{" "}
          <strong>/calendario</strong> para todo el equipo, y las reuniones y
          visitas que agendás desde acá se sincronizan con él.
        </p>

        <Card>
          <CardContent className="flex flex-col gap-3 pt-4 text-sm">
            {tienePlataforma ? (
              <GoogleCalendarForm
                calendarIdInicial={organizacion.google_calendar_id}
                emailServicio={tieneServicio ? emailServicio : null}
              />
            ) : (
              <>
                <p className="text-muted-foreground">
                  Todavía no hay ninguna integración de Google Calendar
                  configurada en esta plataforma. Quien administra el
                  despliegue tiene que agregar estas variables en{" "}
                  <code className="bg-muted rounded px-1 text-xs">
                    .env.local
                  </code>{" "}
                  y reiniciar el servidor:
                </p>
                <div className="bg-muted space-y-1 rounded-lg p-3 font-mono text-xs">
                  <p>
                    <span className="text-blue-600 dark:text-blue-400">
                      GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL
                    </span>
                    =...@...iam.gserviceaccount.com
                  </p>
                  <p>
                    <span className="text-blue-600 dark:text-blue-400">
                      GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY
                    </span>
                    =&ldquo;-----BEGIN PRIVATE KEY-----...&rdquo;
                  </p>
                </div>
                <p className="text-muted-foreground text-xs">
                  Es una única cuenta de servicio para toda la plataforma
                  (Google Cloud Console → crear proyecto → activar Google
                  Calendar API → crear cuenta de servicio). Una vez
                  configurada, cada organización vincula su propio calendario
                  desde acá, compartiéndolo con esa cuenta.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
