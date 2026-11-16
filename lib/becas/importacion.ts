// Lectura de los listados de becas que vienen en Excel. Todo acá es lógica
// pura sobre una hoja ya leída (matriz de celdas): se usa en el navegador
// para armar la vista previa y en el servidor para volver a validar lo que
// llega (una Server Action es un endpoint: no se confía en lo que manda el
// cliente).
//
// Los listados reales son muy desparejos: el DNI viene como número, con
// puntos o dentro de un CUIL; el nombre a veces en dos columnas y a veces en
// una; hay filas de título y de subtotal en el medio. Por eso la regla
// general es "una fila vale si tiene un DNI válido"; el resto se descarta.

import type { EstadoAsignacion } from "./tipos";

export type Celda = string | number | boolean | Date | null | undefined;

export type CampoImportable =
  | "dni"
  | "apellido"
  | "nombre"
  | "apellido_nombre"
  | "legajo"
  | "carrera"
  | "email"
  | "telefono"
  | "condicion"
  | "area"
  | "departamento"
  | "tutor"
  | "modulos";

export const CAMPOS_IMPORTABLES: { campo: CampoImportable; label: string }[] = [
  { campo: "dni", label: "DNI" },
  { campo: "apellido", label: "Apellido" },
  { campo: "nombre", label: "Nombre" },
  { campo: "apellido_nombre", label: "Apellido y nombre (una sola columna)" },
  { campo: "legajo", label: "Legajo" },
  { campo: "carrera", label: "Carrera" },
  { campo: "email", label: "Mail" },
  { campo: "telefono", label: "Teléfono" },
  { campo: "condicion", label: "Condición (nuevo, renovante, rechazado)" },
  { campo: "area", label: "Área" },
  { campo: "departamento", label: "Departamento" },
  { campo: "tutor", label: "Tutor" },
  { campo: "modulos", label: "Módulos" },
];

export type MapeoColumnas = Record<CampoImportable, number | null>;

export type FilaImportada = {
  // Número de fila en la planilla (1 = primera), para poder ubicarla.
  fila: number;
  dni: string;
  apellido: string;
  nombre: string;
  legajo: string | null;
  carrera: string | null;
  email: string | null;
  telefono: string | null;
  condicion: string | null;
  estado: EstadoAsignacion;
  area: string | null;
  departamento: string | null;
  tutor: string | null;
  modulos: number | null;
};

export const MAX_FILAS_IMPORTACION = 3000;

// ── celdas ───────────────────────────────────────────────────────────────────

export function textoCelda(valor: Celda): string | null {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : valor.toISOString().slice(0, 10);
  }
  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) return null;
    // 16965 y no "16965.0"; los enteros grandes (teléfonos) sin notación científica.
    return Number.isInteger(valor) ? valor.toFixed(0) : String(valor);
  }
  if (typeof valor === "boolean") return valor ? "Sí" : "No";
  const t = String(valor).replace(/\s+/g, " ").trim();
  return t === "" ? null : t;
}

// DNI como texto de solo dígitos, o null si la celda no tiene uno.
// Acepta 43929086, "43.929.086", "43929086.0" y un CUIL ("20-45090375-3",
// 20450903753), del que se queda con los ocho dígitos del medio.
export function normalizarDni(valor: Celda): string | null {
  const texto = textoCelda(valor);
  if (!texto) return null;
  // Un valor con letras no es un DNI (evita tomar "Legajo 123" o un mail).
  if (/[a-zA-Z@]/.test(texto)) return null;
  const digitos = texto.replace(/\.0+$/, "").replace(/\D/g, "");
  if (digitos.length === 11) return digitos.slice(2, 10).replace(/^0+/, "") || null;
  if (digitos.length < 7 || digitos.length > 9) return null;
  return digitos.replace(/^0+/, "") || null;
}

function enteroCelda(valor: Celda): number | null {
  const texto = textoCelda(valor);
  if (!texto) return null;
  const n = Number(texto.replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 99) return null;
  return Math.round(n);
}

// ── encabezados ──────────────────────────────────────────────────────────────

function normalizarEncabezado(valor: Celda): string {
  return (textoCelda(valor) ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Orden importa: "apellido y nombre" se prueba antes que "apellido" y
// "nombre" sueltos, y cada columna se asigna a un solo campo.
const PATRONES: { campo: CampoImportable; patron: RegExp }[] = [
  { campo: "apellido_nombre", patron: /^(apellido(s)? y nombre(s)?|nombre(s)? y apellido(s)?|nombre completo)$/ },
  { campo: "dni", patron: /^(dni|d n i( n)?|nro doc|n doc|numero de documento|documento|doc)$/ },
  { campo: "apellido", patron: /^apellido(s)?$/ },
  { campo: "nombre", patron: /^nombre(s)?$/ },
  { campo: "legajo", patron: /^(legajo|leg|n leg|nro leg|n de legajo|numero de legajo)$/ },
  { campo: "carrera", patron: /^(carrera|titulo|especialidad|esp)$/ },
  { campo: "email", patron: /^(e mail|email|mail|correo|correo electronico|direccion de correo electronico)$/ },
  { campo: "telefono", patron: /^(telefono|tel|celular|nro movil|movil|n de telefono)$/ },
  { campo: "condicion", patron: /^(condicion|categoria|estado de la beca|estado)$/ },
  { campo: "departamento", patron: /^(departamento|dpto|depto)$/ },
  { campo: "area", patron: /^(area|area nombre|area designada|area de interes)$/ },
  { campo: "tutor", patron: /^(tutor|tutor a|tutor a a cargo|tutor a cargo|responsable)$/ },
  { campo: "modulos", patron: /^(modulo|modulos|cantidad de modulos)$/ },
];

export function mapeoVacio(): MapeoColumnas {
  return Object.fromEntries(CAMPOS_IMPORTABLES.map((c) => [c.campo, null])) as MapeoColumnas;
}

export function detectarColumnas(encabezados: Celda[]): MapeoColumnas {
  const mapeo = mapeoVacio();
  const usadas = new Set<number>();
  const normalizados = encabezados.map(normalizarEncabezado);
  for (const { campo, patron } of PATRONES) {
    const indice = normalizados.findIndex((h, i) => !usadas.has(i) && patron.test(h));
    if (indice >= 0) {
      mapeo[campo] = indice;
      usadas.add(indice);
    }
  }
  return mapeo;
}

// Índice (base 0) de la fila que parece ser la de encabezados: la primera,
// entre las primeras 30, que tiene una columna de DNI reconocible. Las
// planillas armadas a mano suelen tener un título arriba.
export function detectarFilaEncabezados(filas: Celda[][]): number {
  const limite = Math.min(filas.length, 30);
  for (let i = 0; i < limite; i++) {
    if (detectarColumnas(filas[i] ?? []).dni !== null) return i;
  }
  return 0;
}

// ── valores ──────────────────────────────────────────────────────────────────

// "Abregú Palma, Iván" se separa por la coma. Sin coma no hay forma segura
// de saber dónde termina el apellido ("Vasconi Suárez Anabella"), así que
// queda todo en apellido y el nombre vacío: mejor junto que mal cortado.
export function separarApellidoNombre(texto: string): { apellido: string; nombre: string } {
  const limpio = texto.replace(/\s+/g, " ").trim();
  const coma = limpio.indexOf(",");
  if (coma > 0) {
    return { apellido: limpio.slice(0, coma).trim(), nombre: limpio.slice(coma + 1).trim() };
  }
  return { apellido: limpio, nombre: "" };
}

// Los listados nacionales traen la condición y el rechazo en la misma
// columna ("RENOVANTE", "NUEVO POSTULANTE", "nuevos_inscriptos", "RECHAZADO").
export function interpretarCondicion(texto: string | null): {
  condicion: string | null;
  estado: EstadoAsignacion;
} {
  if (!texto) return { condicion: null, estado: "activa" };
  const t = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (t.includes("rechaz")) return { condicion: null, estado: "rechazada" };
  if (t.includes("baja")) return { condicion: null, estado: "baja" };
  if (t.includes("renov")) return { condicion: "Renovante", estado: "activa" };
  if (t.includes("nuev") || t.includes("ingresante")) return { condicion: "Nuevo", estado: "activa" };
  return { condicion: texto, estado: "activa" };
}

// ── armado ───────────────────────────────────────────────────────────────────

export type ResultadoLectura = {
  filas: FilaImportada[];
  // Filas con algún dato pero sin DNI válido (títulos, subtotales, vacías a medias).
  descartadas: number;
  // Filas cuyo DNI ya había aparecido antes en la misma planilla.
  repetidas: number;
};

export function armarFilas(
  hoja: Celda[][],
  filaEncabezados: number,
  mapeo: MapeoColumnas,
): ResultadoLectura {
  const filas: FilaImportada[] = [];
  const vistos = new Set<string>();
  let descartadas = 0;
  let repetidas = 0;

  const celda = (fila: Celda[], campo: CampoImportable): Celda => {
    const indice = mapeo[campo];
    return indice === null ? null : fila[indice];
  };

  for (let i = filaEncabezados + 1; i < hoja.length; i++) {
    const fila = hoja[i] ?? [];
    if (!fila.some((c) => textoCelda(c) !== null)) continue;

    const dni = normalizarDni(celda(fila, "dni"));
    let apellido = textoCelda(celda(fila, "apellido")) ?? "";
    let nombre = textoCelda(celda(fila, "nombre")) ?? "";
    if (!apellido) {
      const junto = textoCelda(celda(fila, "apellido_nombre"));
      if (junto) ({ apellido, nombre } = separarApellidoNombre(junto));
      else if (nombre) {
        // Solo vino la columna "Nombre" (con el nombre completo adentro).
        ({ apellido, nombre } = separarApellidoNombre(nombre));
      }
    }

    if (!dni || !apellido) {
      descartadas++;
      continue;
    }
    if (vistos.has(dni)) {
      repetidas++;
      continue;
    }
    vistos.add(dni);

    const { condicion, estado } = interpretarCondicion(textoCelda(celda(fila, "condicion")));
    filas.push({
      fila: i + 1,
      dni,
      apellido: apellido.slice(0, 120),
      nombre: nombre.slice(0, 120),
      legajo: textoCelda(celda(fila, "legajo"))?.slice(0, 20) ?? null,
      carrera: textoCelda(celda(fila, "carrera"))?.slice(0, 120) ?? null,
      email: textoCelda(celda(fila, "email"))?.toLowerCase().slice(0, 200) ?? null,
      telefono: textoCelda(celda(fila, "telefono"))?.slice(0, 40) ?? null,
      condicion: condicion?.slice(0, 60) ?? null,
      estado,
      area: textoCelda(celda(fila, "area"))?.slice(0, 300) ?? null,
      departamento: textoCelda(celda(fila, "departamento"))?.slice(0, 120) ?? null,
      tutor: textoCelda(celda(fila, "tutor"))?.slice(0, 200) ?? null,
      modulos: enteroCelda(celda(fila, "modulos")),
    });
  }

  return { filas, descartadas, repetidas };
}

// Revalidación del lado del servidor de lo que mandó el navegador: mismos
// límites que armarFilas, sin confiar en que el cliente los haya aplicado.
export function sanearFilas(entrada: unknown): FilaImportada[] {
  if (!Array.isArray(entrada)) return [];
  const filas: FilaImportada[] = [];
  const vistos = new Set<string>();
  const texto = (v: unknown, max: number): string | null => {
    if (typeof v !== "string") return null;
    const t = v.replace(/\s+/g, " ").trim().slice(0, max);
    return t === "" ? null : t;
  };
  for (const cruda of entrada.slice(0, MAX_FILAS_IMPORTACION)) {
    if (typeof cruda !== "object" || cruda === null) continue;
    const f = cruda as Record<string, unknown>;
    const dni = normalizarDni(typeof f.dni === "string" ? f.dni : null);
    const apellido = texto(f.apellido, 120);
    if (!dni || !apellido || vistos.has(dni)) continue;
    vistos.add(dni);
    const estado: EstadoAsignacion =
      f.estado === "rechazada" || f.estado === "baja" ? f.estado : "activa";
    const modulos =
      typeof f.modulos === "number" && Number.isInteger(f.modulos) && f.modulos >= 0 && f.modulos <= 99
        ? f.modulos
        : null;
    filas.push({
      fila: typeof f.fila === "number" && Number.isInteger(f.fila) ? f.fila : 0,
      dni,
      apellido,
      nombre: texto(f.nombre, 120) ?? "",
      legajo: texto(f.legajo, 20),
      carrera: texto(f.carrera, 120),
      email: texto(f.email, 200)?.toLowerCase() ?? null,
      telefono: texto(f.telefono, 40),
      condicion: texto(f.condicion, 60),
      estado,
      area: texto(f.area, 300),
      departamento: texto(f.departamento, 120),
      tutor: texto(f.tutor, 200),
      modulos,
    });
  }
  return filas;
}

// ── clasificación para la vista previa ───────────────────────────────────────

export type SituacionFila =
  | "nuevo" // estudiante que no estaba en el padrón
  | "existente" // ya estaba en el padrón, se le suma esta beca
  | "ya_tiene" // ya tenía esta beca este año (solo se completan datos que falten)
  | "conflicto"; // quedaría con una beca incompatible activa

export type FilaClasificada = {
  fila: number;
  dni: string;
  nombre: string;
  situacion: SituacionFila;
  // Programas incompatibles que ya tiene activos este año (solo en "conflicto").
  choca_con: string[];
};

export function clasificarFilas(
  filas: FilaImportada[],
  // DNIs que ya están en el padrón.
  enPadron: Set<string>,
  // DNIs que ya tienen ESTA beca este año.
  conEstaBeca: Set<string>,
  // Por DNI: nombres de programas incompatibles con el que se importa y que
  // el estudiante tiene activos este año.
  incompatiblesActivas: Map<string, string[]>,
): FilaClasificada[] {
  return filas.map((f) => {
    const nombre = f.nombre ? `${f.apellido}, ${f.nombre}` : f.apellido;
    const chocaCon = f.estado === "activa" ? (incompatiblesActivas.get(f.dni) ?? []) : [];
    let situacion: SituacionFila;
    if (chocaCon.length > 0) situacion = "conflicto";
    else if (conEstaBeca.has(f.dni)) situacion = "ya_tiene";
    else if (enPadron.has(f.dni)) situacion = "existente";
    else situacion = "nuevo";
    return { fila: f.fila, dni: f.dni, nombre, situacion, choca_con: chocaCon };
  });
}
