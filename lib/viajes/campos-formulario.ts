// Qué tan obligatorio es cada campo "secundario" del formulario público de
// inscripción a un viaje — configurable por viaje porque no todos piden lo
// mismo (ej: un viaje abierto a exalumnos no tiene legajo ni carrera
// vigente, o uno interno de la facultad no necesita pedir teléfono).
// nombre/apellido/dni quedan siempre requeridos (el dni además tiene el
// unique que evita doble inscripción) y no forman parte de esta
// configuración.

export type EstadoCampoFormularioViaje = "requerido" | "opcional" | "oculto";

export const CAMPOS_CONFIGURABLES = [
  "legajo",
  "carrera",
  "anio_cursada",
  "email",
  "telefono",
] as const;

export type CampoConfigurable = (typeof CAMPOS_CONFIGURABLES)[number];

export type CamposFormularioViaje = Record<CampoConfigurable, EstadoCampoFormularioViaje>;

// Default = comportamiento de antes de que existiera esta configuración
// (todo requerido), así los viajes ya creados no cambian de golpe.
export const CAMPOS_FORMULARIO_DEFAULT: CamposFormularioViaje = {
  legajo: "requerido",
  carrera: "requerido",
  anio_cursada: "requerido",
  email: "requerido",
  telefono: "requerido",
};

export const CAMPO_LABEL: Record<CampoConfigurable, string> = {
  legajo: "Legajo",
  carrera: "Carrera",
  anio_cursada: "Año de cursada",
  email: "Email",
  telefono: "Teléfono",
};

export const ESTADO_CAMPO_OPCIONES: { value: EstadoCampoFormularioViaje; label: string }[] = [
  { value: "requerido", label: "Requerido" },
  { value: "opcional", label: "Opcional" },
  { value: "oculto", label: "Oculto" },
];

// Completa con el default cualquier clave faltante — cubre tanto viajes
// viejos sin este JSON como un futuro campo configurable nuevo que un viaje
// existente no tenga guardado todavía.
export function normalizarCamposFormulario(
  valor: Partial<CamposFormularioViaje> | null | undefined,
): CamposFormularioViaje {
  return { ...CAMPOS_FORMULARIO_DEFAULT, ...(valor ?? {}) };
}
