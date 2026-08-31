import { sql } from "@/lib/db";
import { ShieldCheck } from "lucide-react";
import { InscripcionForm } from "./inscripcion-form";
import { normalizarCamposFormulario, type CamposFormularioViaje } from "@/lib/viajes/campos-formulario";

// Sin caché estática: el estado del viaje (abierto/cerrado, cupo) tiene que
// reflejarse al toque, no quedar pegado al build.
export const dynamic = "force-dynamic";

type ViajePublico = {
  nombre: string;
  destino: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  estado: string;
  descripcion_publica: string | null;
  organizacion_nombre: string;
  logo_url: string | null;
  color_principal: string | null;
  campos_formulario: CamposFormularioViaje;
};

function formatFecha(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

// Look & feel deliberadamente distinto del resto de la app (que es oscura):
// esta página la abre gente ajena al sistema desde un link de WhatsApp, sin
// ningún otro indicio de que es "oficial" — un fondo claro con el logo de la
// facultad se lee como un formulario institucional de verdad, en vez de una
// pantalla oscura genérica que puede tipear cualquiera. Colores explícitos
// (no tokens bg-card/text-foreground) a propósito: tiene que verse igual sin
// importar el tema del sistema de quien lo abre, mismo criterio que
// app/reporte-visitas y app/reporte-viajes.
export default async function InscripcionViajePage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;

  // Ruta pública, sin sesión: `sql` directo (superuser), nunca `withUser` —
  // no hay ningún usuario autenticado acá. Ver actions.ts para el mismo
  // criterio en el insert.
  const [viaje] = await sql<[ViajePublico | undefined]>`
    select
      v.nombre, v.destino, v.fecha_inicio::text, v.fecha_fin::text,
      v.estado::text as estado, v.descripcion_publica, v.campos_formulario,
      o.nombre as organizacion_nombre, o.logo_url, o.color_principal
    from viaje v
    join organizacion o on o.id = v.organizacion_id
    where v.codigo_publico = ${codigo}
  `;

  const colorAccento = viaje?.color_principal || "#f97316";
  const logo = viaje?.logo_url || "/LogoUTN.png";

  return (
    <div
      className="flex flex-1 items-center justify-center bg-cover bg-center p-4 sm:p-6"
      style={{
        // Overlay oscuro sobre la foto para que la tarjeta blanca del
        // formulario destaque con buen contraste sin importar cuán clara la
        // foto sea de fondo.
        backgroundImage:
          "linear-gradient(180deg, rgba(17,24,39,0.55) 0%, rgba(17,24,39,0.65) 100%), url(/fondo-inscripcion-viaje.jpg)",
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
        <div style={{ backgroundColor: colorAccento }} className="h-2 w-full" />

        <div className="flex flex-col items-center gap-2 px-6 pt-6 pb-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" width={180} className="object-contain" />
          <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
            {viaje?.organizacion_nombre ?? "SAE FRVM"}
          </p>
        </div>

        <div className="flex flex-col gap-4 px-6 pb-6">
          {!viaje ? (
            <p className="py-6 text-center text-sm text-neutral-500">
              No encontramos este link de inscripción. Verificá que esté completo.
            </p>
          ) : viaje.estado !== "inscripciones_abiertas" ? (
            <>
              <h1 className="text-xl font-bold text-neutral-900">{viaje.nombre}</h1>
              <p className="text-sm text-neutral-600">
                Las inscripciones para este viaje no están abiertas en este momento.
              </p>
            </>
          ) : (
            <>
              <div className="border-t border-neutral-200 pt-4 text-center">
                <h1 className="text-xl font-bold text-neutral-900">{viaje.nombre}</h1>
                <p className="mt-1 text-sm text-neutral-600">
                  {viaje.destino} · {formatFecha(viaje.fecha_inicio)}
                  {viaje.fecha_fin ? ` – ${formatFecha(viaje.fecha_fin)}` : ""}
                </p>
              </div>

              {viaje.descripcion_publica && (
                <p className="rounded-lg bg-neutral-50 p-3 text-sm whitespace-pre-wrap text-neutral-700">
                  {viaje.descripcion_publica}
                </p>
              )}

              <InscripcionForm
                codigo={codigo}
                colorAccento={colorAccento}
                camposFormulario={normalizarCamposFormulario(viaje.campos_formulario)}
              />

              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-neutral-400">
                <ShieldCheck className="size-3.5 shrink-0" />
                Formulario oficial de {viaje.organizacion_nombre} — tus datos solo se usan para organizar este viaje.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
