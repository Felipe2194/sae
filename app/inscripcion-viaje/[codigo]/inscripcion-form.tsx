"use client";

import { useActionState } from "react";
import { inscribirseViaje, type InscripcionState } from "./actions";
import { ANIOS_CURSADA, ANIOS_CURSADA_LABEL, CARRERAS_GRADO, CARRERAS_PREGRADO } from "./opciones";
import type { CamposFormularioViaje } from "@/lib/viajes/campos-formulario";

// Solo dígitos en DNI/legajo/teléfono: se filtra en cada tecleo (no alcanza
// con type="number" — agrega flechas y permite notación científica/"e", y
// además rompería el 0 inicial de algunos legajos) en vez de validar recién
// al enviar, para que el usuario vea al toque que la letra no entró.
function soloDigitos(e: React.ChangeEvent<HTMLInputElement>) {
  e.target.value = e.target.value.replace(/\D/g, "");
}

// Elementos nativos con estilos explícitos (no los de components/ui, que
// leen los tokens bg-background/text-foreground/dark: del tema global) — la
// página fuerza un look claro fijo sin importar el tema del sistema de quien
// la abre (ver comentario en page.tsx), y esos componentes no se pueden
// "aislar" del modo oscuro solo pisando variables CSS porque varios usan
// clases dark: literales, atadas a la clase .dark del <html>, no a las
// variables.
// font-sans explícito (no alcanza con heredarlo del <html>): Chrome/Edge en
// Windows renderizan el <select> cerrado con el font-family heredado, pero
// sin esta clase directa en el propio elemento algunos navegadores lo pintan
// con el font-family del sistema en vez de Inter — se nota comparado con los
// inputs de al lado.
const campoClase =
  "h-10 rounded-lg border border-neutral-300 bg-white px-3 font-sans text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200";
const labelClase = "text-sm font-medium text-neutral-700";

export function InscripcionForm({
  codigo,
  colorAccento,
  camposFormulario,
}: {
  codigo: string;
  colorAccento: string;
  camposFormulario: CamposFormularioViaje;
}) {
  const inscribirseConCodigo = inscribirseViaje.bind(null, codigo);
  const [state, action, isPending] = useActionState<InscripcionState, FormData>(
    inscribirseConCodigo,
    null,
  );

  // legajo/carrera/año/email/teléfono son configurables por viaje (ver
  // lib/viajes/campos-formulario.ts) — nombre/apellido/DNI siempre van.
  const mostrarLegajo = camposFormulario.legajo !== "oculto";
  const mostrarCarrera = camposFormulario.carrera !== "oculto";
  const mostrarAnio = camposFormulario.anio_cursada !== "oculto";
  const mostrarEmail = camposFormulario.email !== "oculto";
  const mostrarTelefono = camposFormulario.telefono !== "oculto";
  const requiereLegajo = camposFormulario.legajo === "requerido";
  const requiereCarrera = camposFormulario.carrera === "requerido";
  const requiereAnio = camposFormulario.anio_cursada === "requerido";
  const requiereEmail = camposFormulario.email === "requerido";
  const requiereTelefono = camposFormulario.telefono === "requerido";

  if (state?.success) {
    return (
      <div className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm">
        <p className="font-medium text-neutral-900">¡Listo, quedaste anotado/a!</p>
        <p className="mt-1 text-neutral-600">
          {state.estado === "lista_espera"
            ? "El cupo está completo por ahora — quedaste en lista de espera. Te van a contactar si se libera un lugar."
            : "El equipo va a revisar tu inscripción y te va a contactar con los próximos pasos."}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nombre" className={labelClase}>Nombre *</label>
          <input id="nombre" name="nombre" required maxLength={20} className={campoClase} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="apellido" className={labelClase}>Apellido *</label>
          <input id="apellido" name="apellido" required maxLength={60} className={campoClase} />
        </div>
      </div>

      <div className={mostrarLegajo ? "grid grid-cols-2 gap-3" : "flex flex-col gap-3"}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="dni" className={labelClase}>DNI *</label>
          <input
            id="dni"
            name="dni"
            required
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={8}
            onChange={soloDigitos}
            className={campoClase}
          />
        </div>
        {mostrarLegajo && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="legajo" className={labelClase}>
              Legajo{requiereLegajo ? " *" : ""}
            </label>
            <input
              id="legajo"
              name="legajo"
              required={requiereLegajo}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={10}
              onChange={soloDigitos}
              className={campoClase}
            />
          </div>
        )}
      </div>

      {(mostrarCarrera || mostrarAnio) && (
        <div
          className={
            mostrarCarrera && mostrarAnio ? "grid grid-cols-2 gap-3" : "flex flex-col gap-3"
          }
        >
          {mostrarCarrera && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="carrera" className={labelClase}>
                Carrera{requiereCarrera ? " *" : ""}
              </label>
              <select
                id="carrera"
                name="carrera"
                required={requiereCarrera}
                defaultValue=""
                className={campoClase}
              >
                <option value="" disabled>Seleccioná tu carrera</option>
                <optgroup label="Carreras de grado">
                  {CARRERAS_GRADO.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </optgroup>
                <optgroup label="Carreras de pregrado">
                  {CARRERAS_PREGRADO.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          )}
          {mostrarAnio && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="anio_cursada" className={labelClase}>
                Año de cursada{requiereAnio ? " *" : ""}
              </label>
              <select
                id="anio_cursada"
                name="anio_cursada"
                required={requiereAnio}
                defaultValue=""
                className={campoClase}
              >
                <option value="" disabled>Seleccioná el año</option>
                {ANIOS_CURSADA.map((a) => (
                  <option key={a} value={a}>{ANIOS_CURSADA_LABEL[a]}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {mostrarEmail && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className={labelClase}>
            Email{requiereEmail ? " *" : ""}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required={requiereEmail}
            maxLength={254}
            className={campoClase}
          />
        </div>
      )}

      {mostrarTelefono && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="telefono" className={labelClase}>
            Teléfono{requiereTelefono ? " *" : ""}
          </label>
          <input
            id="telefono"
            name="telefono"
            required={requiereTelefono}
            inputMode="tel"
            pattern="[0-9]*"
            maxLength={15}
            onChange={soloDigitos}
            className={campoClase}
          />
        </div>
      )}

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        style={{ backgroundColor: colorAccento }}
        className="mt-2 h-11 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? "Enviando..." : "Anotarme"}
      </button>
    </form>
  );
}
