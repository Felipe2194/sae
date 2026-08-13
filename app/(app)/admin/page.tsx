import { redirect } from "next/navigation";
import { Link2, Trash2, Calendar, CheckSquare, ExternalLink, Users } from "lucide-react";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AsignarSelect } from "./asignar-select";
import { crearAcceso, eliminarAcceso } from "./actions";
import { UsuariosTable, type UsuarioFila } from "./usuarios-table";

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

  const { tareas, usuarios, todosUsuarios, accesos } = await withUser(session.user.id, async (tx) => {
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
      where t.estado != 'hecha'
      order by t.estado desc, a.nombre asc, t.orden asc
    `;

    const usuarios = await tx<{ id: string; nombre: string }[]>`
      select id, nombre
      from usuario
      where estado = 'activo'
      order by nombre asc
    `;

    const todosUsuarios = await tx<UsuarioRow[]>`
      select id, nombre, email, rol::text as rol, estado::text as estado, creada_en::text as creada_en
      from usuario
      order by
        case estado when 'pendiente' then 0 when 'activo' then 1 else 2 end,
        nombre asc
    `;

    const accesos = await tx<AccesoRow[]>`
      select id, etiqueta, url
      from acceso_rapido
      order by orden asc
    `;

    return { tareas, usuarios, todosUsuarios, accesos };
  });

  const tieneCalendar =
    !!process.env.GOOGLE_CALENDAR_API_KEY && !!process.env.GOOGLE_CALENDAR_ID;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administración</h1>
        <p className="text-muted-foreground text-sm">
          Configuración del sistema y gestión de recursos.
        </p>
      </div>

      {/* ── Gestión de usuarios ──────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Users className="text-muted-foreground size-4" />
          <h2 className="font-semibold">Usuarios</h2>
          {todosUsuarios.filter((u) => u.estado === "pendiente").length > 0 && (
            <Badge className="bg-amber-100 text-amber-800 border-amber-200">
              {todosUsuarios.filter((u) => u.estado === "pendiente").length} pendiente
              {todosUsuarios.filter((u) => u.estado === "pendiente").length > 1 ? "s" : ""}
            </Badge>
          )}
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
                {/* Desktop: tabla */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium w-full">
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
                                <p className="font-medium leading-tight">{t.titulo}</p>
                                {t.area_nombre && (
                                  <p className="text-muted-foreground text-xs">{t.area_nombre}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <Badge variant={ESTADO_VARIANT[t.estado] ?? "outline"}>
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
                <div className="md:hidden divide-y">
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
                          <p className="font-medium leading-tight">{t.titulo}</p>
                          {t.area_nombre && (
                            <p className="text-muted-foreground text-xs">{t.area_nombre}</p>
                          )}
                        </div>
                        <Badge variant={ESTADO_VARIANT[t.estado] ?? "outline"} className="shrink-0">
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

      {/* ── Accesos rápidos ──────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Link2 className="text-muted-foreground size-4" />
          <h2 className="font-semibold">Accesos rápidos</h2>
        </div>
        <p className="text-muted-foreground text-sm -mt-1">
          Aparecen en la página de inicio de todos los miembros. Podés agregar Drive, NotebookLM, Sheets, y similares.
        </p>

        {accesos.length > 0 && (
          <Card>
            <CardContent className="divide-y p-0">
              {accesos.map((ar) => (
                <div key={ar.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{ar.etiqueta}</p>
                    <a
                      href={ar.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground flex items-center gap-1 text-xs hover:underline truncate max-w-sm"
                    >
                      <ExternalLink className="size-3 shrink-0" />
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
            <CardTitle className="text-sm font-medium">Agregar enlace</CardTitle>
            <CardDescription className="text-xs">
              Cualquier URL de trabajo: Google Drive, NotebookLM, Sheets, formularios, etc.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={crearAcceso} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex flex-col gap-1.5 flex-1">
                <Label htmlFor="etiqueta" className="text-xs">Nombre</Label>
                <Input
                  id="etiqueta"
                  name="etiqueta"
                  placeholder="Drive de la secretaría"
                  required
                  className="h-9 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <Label htmlFor="url" className="text-xs">URL</Label>
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

      {/* ── Google Calendar ───────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="text-muted-foreground size-4" />
          <h2 className="font-semibold">Google Calendar</h2>
          {tieneCalendar ? (
            <Badge className="bg-green-100 text-green-800 border-green-200">Conectado</Badge>
          ) : (
            <Badge variant="outline">Sin configurar</Badge>
          )}
        </div>

        <Card>
          <CardContent className="pt-4 flex flex-col gap-3 text-sm">
            {tieneCalendar ? (
              <p className="text-muted-foreground">
                El calendario está conectado. Los eventos de la organización aparecen en{" "}
                <strong>/calendario</strong> para todos los miembros.
              </p>
            ) : (
              <>
                <p className="text-muted-foreground">
                  Para mostrar el calendario de la organización, agregá estas variables en{" "}
                  <code className="bg-muted rounded px-1 text-xs">.env.local</code> y reiniciá el servidor:
                </p>
                <div className="bg-muted rounded-lg p-3 font-mono text-xs space-y-1">
                  <p>
                    <span className="text-blue-600 dark:text-blue-400">GOOGLE_CALENDAR_API_KEY</span>
                    =tu_api_key
                  </p>
                  <p>
                    <span className="text-blue-600 dark:text-blue-400">GOOGLE_CALENDAR_ID</span>
                    =id@group.calendar.google.com
                  </p>
                </div>
                <ol className="text-muted-foreground text-xs list-decimal list-inside space-y-1.5">
                  <li>
                    Entrá a{" "}
                    <a
                      href="https://console.cloud.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      console.cloud.google.com
                    </a>
                    , creá un proyecto y activá la <strong>Google Calendar API</strong>.
                  </li>
                  <li>
                    Creá una <strong>API Key</strong> (con restricción a Calendar API) y pegala en{" "}
                    <code className="bg-muted rounded px-1">GOOGLE_CALENDAR_API_KEY</code>.
                  </li>
                  <li>
                    El calendario compartido de la SAE debe estar en modo <strong>público</strong>.
                    En Configuración → &ldquo;Integrar calendario&rdquo; → copiá el <strong>ID del calendario</strong>{" "}
                    (termina en <code className="bg-muted rounded px-1">@group.calendar.google.com</code>).
                  </li>
                  <li>Reiniciá el servidor después de agregar las variables.</li>
                </ol>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
