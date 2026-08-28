import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import { labelTipoVisita, labelEstadoVisita } from "@/app/(app)/visitas/tipos";
import type { EstadoVisita, TipoVisita } from "@/types/database";
import { ImprimirBoton } from "./imprimir-boton";

type DetalleVisita = {
  id: string;
  fecha: string;
  colegio_nombre: string;
  ciudad: string | null;
  zona: string | null;
  tipo: TipoVisita;
  estado: EstadoVisita;
  cant_alumnos: number | null;
  contacto_nombre: string | null;
  integrantes: string[];
};

type LocalidadFila = { ciudad: string; visitas: number; alumnos: number };

// No vive bajo app/(app) a propósito: es un documento para imprimir/exportar
// a PDF, no una pantalla más del sidebar — sin el chrome de la app (menú,
// header, tema oscuro por defecto) que no tiene sentido en un papel para
// llevarle a directivos.
export default async function ReporteVisitasPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const rol = (session.user as { rol: string }).rol;
  if (rol !== "administrador") redirect("/hoy");

  const params = await searchParams;
  const anioActual = new Date().getFullYear();
  const anio =
    params.anio === "todos"
      ? 0
      : params.anio
        ? parseInt(params.anio, 10)
        : anioActual;

  const { organizacion, habilitado, stats, detalle, localidades } =
    await withUser(session.user.id, async (tx) => {
      const [organizacion] = await tx<
        [
          {
            nombre: string;
            logo_url: string | null;
            visitas_habilitado: boolean;
          },
        ]
      >`
        select nombre, logo_url, visitas_habilitado from organizacion where id = mi_organizacion_id()
      `;

      // Mismo criterio que el reporte de Informes (ver app/(app)/informes/page.tsx):
      // "viaje" = visita_colegio o feria_expo, nos_visitan es al revés (vino
      // el colegio a la facultad).
      const [stats] = await tx<
        [
          {
            visitas_realizadas: number;
            colegios_visitados: number;
            alumnos_alcanzados: number;
            veces_viajamos: number;
            veces_nos_visitaron: number;
            visitas_pendientes: number;
            visitas_canceladas: number;
          },
        ]
      >`
        select
          count(*) filter (where estado = 'realizado')::int as visitas_realizadas,
          count(distinct colegio_id) filter (where estado = 'realizado' and tipo in ('visita_colegio', 'feria_expo'))::int as colegios_visitados,
          coalesce(sum(cant_alumnos) filter (where estado = 'realizado'), 0)::int as alumnos_alcanzados,
          count(*) filter (where estado = 'realizado' and tipo in ('visita_colegio', 'feria_expo'))::int as veces_viajamos,
          count(*) filter (where estado = 'realizado' and tipo = 'nos_visitan')::int as veces_nos_visitaron,
          count(*) filter (where estado in ('pendiente', 'confirmado', 'reprogramado'))::int as visitas_pendientes,
          count(*) filter (where estado = 'cancelado')::int as visitas_canceladas
        from visita_colegio
        where organizacion_id = mi_organizacion_id()
          and (${anio} = 0 or extract(year from fecha) = ${anio})
      `;

      const detalle = await tx<DetalleVisita[]>`
        select
          v.id, v.fecha::text, c.nombre as colegio_nombre, c.ciudad, c.zona,
          v.tipo::text as tipo, v.estado::text as estado, v.cant_alumnos,
          v.contacto_nombre,
          coalesce(
            (
              select json_agg(u.nombre order by u.nombre)
              from visita_integrante vi
              join usuario u on u.id = vi.usuario_id
              where vi.visita_id = v.id
            ),
            '[]'
          ) as integrantes
        from visita_colegio v
        join colegio c on c.id = v.colegio_id
        where v.organizacion_id = mi_organizacion_id()
          and (${anio} = 0 or extract(year from v.fecha) = ${anio})
        order by v.fecha asc
      `;

      const localidades = await tx<LocalidadFila[]>`
        select c.ciudad, count(*)::int as visitas, coalesce(sum(v.cant_alumnos), 0)::int as alumnos
        from visita_colegio v
        join colegio c on c.id = v.colegio_id
        where v.organizacion_id = mi_organizacion_id()
          and v.estado = 'realizado'
          and v.tipo in ('visita_colegio', 'feria_expo')
          and c.ciudad is not null
          and (${anio} = 0 or extract(year from v.fecha) = ${anio})
        group by c.ciudad
        order by visitas desc, c.ciudad asc
      `;

      return {
        organizacion,
        habilitado: organizacion.visitas_habilitado,
        stats,
        detalle: [...detalle],
        localidades: [...localidades],
      };
    });

  if (!habilitado) redirect("/hoy");

  const tituloAnio = anio === 0 ? "Todos los años" : String(anio);

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <style>{`@page { margin: 1.5cm; }`}</style>
      <div className="mx-auto flex max-w-4xl flex-col gap-8 p-8 print:p-0">
        <div className="flex items-center justify-between gap-4 print:hidden">
          <a
            href="/informes?tab=visitas"
            className="text-sm text-neutral-500 hover:text-neutral-800"
          >
            ← Volver a Informes
          </a>
          <ImprimirBoton />
        </div>

        <header className="flex flex-col gap-1 border-b border-neutral-300 pb-4">
          {organizacion?.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={organizacion.logo_url}
              alt=""
              className="mb-2 h-12 w-auto object-contain"
            />
          )}
          <h1 className="text-2xl font-bold">Reporte de Visitas a Colegios</h1>
          <p className="text-neutral-600">
            {organizacion?.nombre} · {tituloAnio}
          </p>
          <p className="text-xs text-neutral-400">
            Generado el{" "}
            {new Date().toLocaleDateString("es-AR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        </header>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Visitas realizadas", stats.visitas_realizadas],
            ["Colegios visitados", stats.colegios_visitados],
            ["Alumnos alcanzados", stats.alumnos_alcanzados],
            ["Veces que viajamos", stats.veces_viajamos],
            ["Nos visitaron", stats.veces_nos_visitaron],
            ["Pendientes", stats.visitas_pendientes],
            ["Canceladas", stats.visitas_canceladas],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-neutral-300 p-3"
            >
              <p className="text-xs text-neutral-500">{label}</p>
              <p className="text-xl font-semibold">{value}</p>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Detalle de visitas</h2>
          {/* table-fixed + anchos por columna: sin esto una fila con un
              nombre de contacto o lista de integrantes larga estira la
              tabla más allá del contenedor centrado — visualmente "toda la
              información se va para el costado" en vez de quedar centrada
              en la hoja. overflow-x-auto es solo la red de seguridad. */}
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-xs">
              <colgroup>
                <col className="w-[8%]" />
                <col className="w-[19%]" />
                <col className="w-[12%]" />
                <col className="w-[11%]" />
                <col className="w-[9%]" />
                <col className="w-[7%]" />
                <col className="w-[19%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-neutral-400 text-left text-neutral-500">
                  <th className="py-1.5 pr-2">Fecha</th>
                  <th className="py-1.5 pr-2">Colegio</th>
                  <th className="py-1.5 pr-2">Localidad</th>
                  <th className="py-1.5 pr-2">Tipo</th>
                  <th className="py-1.5 pr-2">Estado</th>
                  <th className="py-1.5 pr-2 text-right">Alumnos</th>
                  <th className="py-1.5 pr-2">Integrantes</th>
                  <th className="py-1.5">Contacto</th>
                </tr>
              </thead>
              <tbody>
                {detalle.map((v) => (
                  <tr
                    key={v.id}
                    className="break-inside-avoid border-b border-neutral-200 align-top"
                  >
                    <td className="py-1.5 pr-2">
                      {new Date(v.fecha + "T00:00:00").toLocaleDateString(
                        "es-AR",
                      )}
                    </td>
                    <td className="py-1.5 pr-2 break-words">
                      {v.colegio_nombre}
                    </td>
                    <td className="py-1.5 pr-2 break-words">
                      {v.ciudad ?? "—"}
                    </td>
                    <td className="py-1.5 pr-2">{labelTipoVisita(v.tipo)}</td>
                    <td className="py-1.5 pr-2">
                      {labelEstadoVisita(v.estado)}
                    </td>
                    <td className="py-1.5 pr-2 text-right">
                      {v.cant_alumnos ?? "—"}
                    </td>
                    <td className="py-1.5 pr-2 break-words">
                      {v.integrantes.join(", ") || "—"}
                    </td>
                    <td className="py-1.5 break-words">
                      {v.contacto_nombre ?? "—"}
                    </td>
                  </tr>
                ))}
                {detalle.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-6 text-center text-neutral-400"
                    >
                      No hay visitas cargadas{anio !== 0 ? ` en ${anio}` : ""}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex break-inside-avoid flex-col gap-2">
          <h2 className="font-semibold">Visitas por localidad</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-400 text-left text-xs text-neutral-500">
                <th className="py-1.5 pr-2">Localidad</th>
                <th className="py-1.5 pr-2 text-right">Visitas</th>
                <th className="py-1.5 text-right">Alumnos</th>
              </tr>
            </thead>
            <tbody>
              {localidades.map((l) => (
                <tr key={l.ciudad} className="border-b border-neutral-200">
                  <td className="py-1.5 pr-2">{l.ciudad}</td>
                  <td className="py-1.5 pr-2 text-right">{l.visitas}</td>
                  <td className="py-1.5 text-right">{l.alumnos || "—"}</td>
                </tr>
              ))}
              {localidades.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-neutral-400">
                    Sin datos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
