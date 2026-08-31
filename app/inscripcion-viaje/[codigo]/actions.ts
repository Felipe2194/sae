"use server";

import { headers } from "next/headers";
import { sql } from "@/lib/db";
import { obtenerIp, registrarIntento, verificarLimiteIntentos } from "@/lib/rate-limit";
import type { EstadoIntegranteViaje } from "@/types/database";
import { ANIOS_CURSADA, CARRERAS } from "./opciones";
import {
  CAMPOS_CONFIGURABLES,
  CAMPO_LABEL,
  normalizarCamposFormulario,
  type CamposFormularioViaje,
} from "@/lib/viajes/campos-formulario";

// Ruta pública sin sesión (ver proxy.ts, RUTAS_PUBLICAS): igual que el
// registro de usuarios en app/(auth)/registro/actions.ts, el insert va con
// `sql` directo (superuser) en vez de `withUser` — no hay ningún usuario
// autenticado cuyo id pasarle. `viaje_integrante` no tiene policy de INSERT
// para una ruta anónima (ver comentario en 038_viajes.sql); esta acción
// bypassea RLS estructuralmente, mismo criterio que usa `usuario`.

export type InscripcionState =
  | { error: string; success: false }
  | { error: null; success: true; estado: "pendiente" | "lista_espera" }
  | null;

export async function inscribirseViaje(
  codigo: string,
  _prevState: InscripcionState,
  formData: FormData,
): Promise<InscripcionState> {
  const ip = obtenerIp(await headers());
  const claveIp = `viaje-inscripcion:ip:${ip}`;
  if (!(await verificarLimiteIntentos(claveIp, 5, 60 * 60 * 1000))) {
    return { error: "Demasiados intentos desde esta conexión. Probá de nuevo más tarde.", success: false };
  }
  await registrarIntento(claveIp);

  const nombre = (formData.get("nombre") as string | null)?.trim() ?? "";
  const apellido = (formData.get("apellido") as string | null)?.trim() ?? "";
  const dni = (formData.get("dni") as string | null)?.trim() ?? "";
  const legajo = (formData.get("legajo") as string | null)?.trim() ?? "";
  const carrera = (formData.get("carrera") as string | null)?.trim() ?? "";
  const anioCursada = (formData.get("anio_cursada") as string | null)?.trim() ?? "";
  const email = (formData.get("email") as string | null)?.trim().toLowerCase() ?? "";
  const telefono = (formData.get("telefono") as string | null)?.trim() ?? "";

  // Nombre/apellido/DNI siempre son obligatorios (no son configurables, ver
  // lib/viajes/campos-formulario.ts) — el `required` del form ya lo exige en
  // el navegador, esto es la validación real del lado del servidor.
  if (!nombre || !apellido || !dni) {
    return { error: "Completá todos los campos.", success: false };
  }
  if (!/^\d+$/.test(dni)) {
    return { error: "El DNI debe contener solo números.", success: false };
  }
  if (nombre.length > 20) {
    return { error: "El nombre no puede superar los 20 caracteres.", success: false };
  }
  if (apellido.length > 60) {
    return { error: "El apellido no puede superar los 60 caracteres.", success: false };
  }

  const [viaje] = await sql<
    [
      | {
          id: string;
          estado: string;
          cupo_maximo: number | null;
          precio: number | null;
          campos_formulario: CamposFormularioViaje;
        }
      | undefined,
    ]
  >`
    select id, estado::text as estado, cupo_maximo, precio::float8, campos_formulario
    from viaje where codigo_publico = ${codigo}
  `;

  if (!viaje || viaje.estado !== "inscripciones_abiertas") {
    return {
      error: "Este viaje no está aceptando inscripciones en este momento.",
      success: false,
    };
  }

  const camposFormulario = normalizarCamposFormulario(viaje.campos_formulario);

  const valores: Record<(typeof CAMPOS_CONFIGURABLES)[number], string> = {
    legajo,
    carrera,
    anio_cursada: anioCursada,
    email,
    telefono,
  };

  for (const campo of CAMPOS_CONFIGURABLES) {
    const estadoCampo = camposFormulario[campo];
    if (estadoCampo === "oculto") {
      valores[campo] = "";
      continue;
    }
    const valor = valores[campo];
    if (!valor) {
      if (estadoCampo === "requerido") {
        return { error: `Completá el campo "${CAMPO_LABEL[campo]}".`, success: false };
      }
      continue; // opcional y vacío: nada más que validar
    }
    // El navegador ya restringe legajo/teléfono a dígitos y carrera/año a
    // las opciones del <select>, pero eso se puede saltear — esta es la
    // validación real. Solo se corre si vino algo cargado (un opcional vacío
    // no tiene formato que validar).
    if ((campo === "legajo" || campo === "telefono") && !/^\d+$/.test(valor)) {
      return { error: `El campo "${CAMPO_LABEL[campo]}" debe contener solo números.`, success: false };
    }
    if (campo === "legajo" && valor.length > 10) {
      return { error: "El legajo no puede superar los 10 dígitos.", success: false };
    }
    if (campo === "carrera" && !(CARRERAS as readonly string[]).includes(valor)) {
      return { error: "Seleccioná una carrera válida.", success: false };
    }
    if (campo === "anio_cursada" && !(ANIOS_CURSADA as readonly string[]).includes(valor)) {
      return { error: "Seleccioná un año de cursada válido.", success: false };
    }
    if (campo === "email" && valor.length > 254) {
      return { error: "El email no puede superar los 254 caracteres.", success: false };
    }
  }

  const [{ count }] = await sql<[{ count: string }]>`
    select count(*)::text as count from viaje_integrante
    where viaje_id = ${viaje.id} and estado in ('pendiente', 'confirmado')
  `;
  const estadoFinal: EstadoIntegranteViaje =
    viaje.cupo_maximo !== null && Number(count) >= viaje.cupo_maximo
      ? "lista_espera"
      : "pendiente";

  try {
    await sql`
      insert into viaje_integrante (
        viaje_id, nombre, apellido, dni, legajo, carrera, anio_cursada,
        email, telefono, estado, monto_a_pagar
      )
      values (
        ${viaje.id}, ${nombre}, ${apellido}, ${dni},
        ${valores.legajo || null}, ${valores.carrera || null}, ${valores.anio_cursada || null},
        ${valores.email || null}, ${valores.telefono || null},
        ${estadoFinal}::estado_integrante_viaje, ${viaje.precio}
      )
    `;
  } catch (e) {
    const codigoError = (e as { code?: string }).code;
    if (codigoError === "23505") {
      return { error: "Ya te anotaste con ese DNI para este viaje.", success: false };
    }
    throw e;
  }

  return { error: null, success: true, estado: estadoFinal };
}
