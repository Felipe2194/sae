// Constantes compartidas entre server actions y componentes cliente de
// /visitas. Separado de actions.ts porque un archivo "use server" solo puede
// exportar funciones async — estas listas y helpers los necesitan también
// los componentes cliente (dropdowns, formato de fecha/hora).

import type {
  EstadoRelacionColegio,
  EstadoVisita,
  TipoVisita,
} from "@/types/database";

export const TIPOS_VISITA: { value: TipoVisita; label: string }[] = [
  { value: "visita_colegio", label: "Visita a colegio" },
  { value: "nos_visitan", label: "Nos visitan" },
  { value: "feria_expo", label: "Feria/Expo" },
  { value: "charla_taller", label: "Charla/Taller" },
  { value: "virtual", label: "Virtual" },
  { value: "otro", label: "Otro" },
];

export const ESTADOS_VISITA: { value: EstadoVisita; label: string }[] = [
  { value: "pendiente", label: "Pendiente" },
  { value: "confirmado", label: "Confirmado" },
  { value: "realizado", label: "Realizado" },
  { value: "cancelado", label: "Cancelado" },
  { value: "reprogramado", label: "Reprogramado" },
];

// Estados que se sincronizan a Google Calendar (mismo criterio que el Sheet:
// cancelado/reprogramado no aparecen en el Calendar).
export const ESTADOS_VISITA_SINCRONIZABLES: EstadoVisita[] = [
  "pendiente",
  "confirmado",
  "realizado",
];

export const ESTADOS_RELACION_COLEGIO: {
  value: EstadoRelacionColegio;
  label: string;
}[] = [
  { value: "nuevo", label: "Nuevo" },
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
];

// Sugerencias para el campo de cargo del contacto — texto libre (ver
// justificación en db/migrations/030_visitas_colegios.sql), no un enum.
// Profesor/a y Directivo/a (director/a) primero: son los cargos más comunes
// entre los contactos de un colegio.
export const CARGOS_CONTACTO_SUGERIDOS = [
  "Profesora",
  "Profesor",
  "Directivo/a",
  "Director",
  "Directora",
  "Administración",
  "Preceptor",
  "Preceptora",
  "Otro",
];

// Provincias argentinas, para el select de provincia del colegio (ver
// db/migrations/045_colegio_provincia.sql) — reemplaza el campo de texto
// libre "Zona / Región" al crear una visita: lo que el equipo necesita
// distinguir rápido es si el colegio es de Córdoba o del resto del país.
export const PROVINCIAS_ARGENTINAS = [
  "Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Ciudad Autónoma de Buenos Aires",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
] as const;

// Horario de trabajo del equipo: mañana 8 a 12, tarde 14 a 21 (con el
// mediodía como corte de almuerzo). Las visitas solo se pueden agendar
// dentro de estas franjas.
export const FRANJAS_HORARIAS_TRABAJO: { desde: string; hasta: string }[] = [
  { desde: "08:00", hasta: "12:00" },
  { desde: "14:00", hasta: "21:00" },
];

function minutosDesdeMedianoche(hora: string): number {
  const [h, m] = hora.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

// Genera los horarios seleccionables (cada `pasoMinutos`) dentro de las
// franjas de trabajo, para usar como opciones de un <Select> en vez de un
// <input type="time"> libre.
export function generarOpcionesHorario(pasoMinutos = 30): string[] {
  const opciones: string[] = [];
  for (const { desde, hasta } of FRANJAS_HORARIAS_TRABAJO) {
    let minutos = minutosDesdeMedianoche(desde);
    const minutosFin = minutosDesdeMedianoche(hasta);
    while (minutos <= minutosFin) {
      const h = Math.floor(minutos / 60).toString().padStart(2, "0");
      const m = (minutos % 60).toString().padStart(2, "0");
      opciones.push(`${h}:${m}`);
      minutos += pasoMinutos;
    }
  }
  return opciones;
}

// Valida que una hora (si se cargó) caiga dentro de alguna franja de
// trabajo — se usa tanto en el cliente como en el server action, ya que este
// último puede recibir datos de una llamada directa sin pasar por el select.
export function horaDentroDeFranjaLaboral(hora: string | null | undefined): boolean {
  if (!hora) return true;
  const minutos = minutosDesdeMedianoche(hora);
  return FRANJAS_HORARIAS_TRABAJO.some(
    ({ desde, hasta }) =>
      minutos >= minutosDesdeMedianoche(desde) && minutos <= minutosDesdeMedianoche(hasta),
  );
}

// Formato laxo: alcanza con "algo@algo.algo" — no vale la pena una regex
// estricta de RFC 5322 para un dato que igual se va a poder guardar vacío.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Dígitos, espacios, +, - y paréntesis (código de país, característica,
// separadores) — entre 6 y 20 caracteres.
const TELEFONO_REGEX = /^[0-9+\-()\s]{6,20}$/;

export function emailValido(valor: string | null | undefined): boolean {
  const v = valor?.trim();
  if (!v) return true;
  return EMAIL_REGEX.test(v);
}

export function telefonoValido(valor: string | null | undefined): boolean {
  const v = valor?.trim();
  if (!v) return true;
  return TELEFONO_REGEX.test(v);
}

export function labelTipoVisita(tipo: TipoVisita): string {
  return TIPOS_VISITA.find((t) => t.value === tipo)?.label ?? tipo;
}

export function labelEstadoVisita(estado: EstadoVisita): string {
  return ESTADOS_VISITA.find((e) => e.value === estado)?.label ?? estado;
}
