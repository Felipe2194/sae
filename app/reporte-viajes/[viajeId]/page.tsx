import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import { ImprimirBoton } from "./imprimir-boton";

type ViajeInfo = {
  nombre: string;
  destino: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  organizacion_nombre: string;
  logo_url: string | null;
};

type ConfirmadoFila = {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  legajo: string | null;
  monto_a_pagar: number | null;
};

function formatFecha(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-AR");
}

// No vive bajo app/(app) a propósito, mismo criterio que
// app/reporte-visitas/page.tsx: es un documento para imprimir/pasarle a
// cooperadora, sin el chrome de la app. A diferencia de reporte-visitas
// (admin-only), acá cualquier usuario autenticado de la organización puede
// generarlo — mismo criterio de visibilidad org-wide que el resto de Viajes.
export default async function ReporteViajePage({
  params,
}: {
  params: Promise<{ viajeId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { viajeId } = await params;

  const { viaje, confirmados } = await withUser(session.user.id, async (tx) => {
    const [viaje] = await tx<[ViajeInfo | undefined]>`
      select
        v.nombre, v.destino, v.fecha_inicio::text, v.fecha_fin::text,
        o.nombre as organizacion_nombre, o.logo_url
      from viaje v
      join organizacion o on o.id = v.organizacion_id
      where v.id = ${viajeId} and v.organizacion_id = mi_organizacion_id()
    `;

    if (!viaje) return { viaje: undefined, confirmados: [] };

    const confirmados = await tx<ConfirmadoFila[]>`
      select id, nombre, apellido, dni, legajo, monto_a_pagar::float8
      from viaje_integrante
      where viaje_id = ${viajeId} and estado = 'confirmado'
      order by apellido asc, nombre asc
    `;

    return { viaje, confirmados: [...confirmados] };
  });

  if (!viaje) notFound();

  const total = confirmados.reduce((acc, c) => acc + (c.monto_a_pagar ?? 0), 0);

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <style>{`@page { margin: 1.5cm; }`}</style>
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8 print:p-0">
        <div className="flex items-center justify-between gap-4 print:hidden">
          <a href={`/viajes/${viajeId}`} className="text-sm text-neutral-500 hover:text-neutral-800">
            ← Volver al viaje
          </a>
          <ImprimirBoton />
        </div>

        <header className="flex flex-col gap-1 border-b border-neutral-300 pb-4">
          {viaje.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={viaje.logo_url} alt="" className="mb-2 h-12 w-auto object-contain" />
          )}
          <h1 className="text-2xl font-bold">Cupón de pago — {viaje.nombre}</h1>
          <p className="text-neutral-600">
            {viaje.organizacion_nombre} · {viaje.destino} · {formatFecha(viaje.fecha_inicio)}
            {viaje.fecha_fin ? ` – ${formatFecha(viaje.fecha_fin)}` : ""}
          </p>
          <p className="text-xs text-neutral-400">
            Generado el{" "}
            {new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </header>

        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Viajantes confirmados ({confirmados.length})</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-400 text-left text-xs text-neutral-500">
                <th className="py-1.5 pr-2">Apellido y nombre</th>
                <th className="py-1.5 pr-2">DNI</th>
                <th className="py-1.5 pr-2">Legajo</th>
                <th className="py-1.5 text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {confirmados.map((c) => (
                <tr key={c.id} className="break-inside-avoid border-b border-neutral-200">
                  <td className="py-1.5 pr-2">{c.apellido}, {c.nombre}</td>
                  <td className="py-1.5 pr-2">{c.dni}</td>
                  <td className="py-1.5 pr-2">{c.legajo ?? "—"}</td>
                  <td className="py-1.5 text-right">
                    {c.monto_a_pagar ? `$${c.monto_a_pagar.toLocaleString("es-AR")}` : "—"}
                  </td>
                </tr>
              ))}
              {confirmados.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-neutral-400">
                    Todavía no hay inscriptos confirmados.
                  </td>
                </tr>
              )}
            </tbody>
            {confirmados.length > 0 && (
              <tfoot>
                <tr className="border-t border-neutral-400 font-semibold">
                  <td className="py-1.5 pr-2" colSpan={3}>Total</td>
                  <td className="py-1.5 text-right">${total.toLocaleString("es-AR")}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </section>
      </div>
    </div>
  );
}
