// Logging estructurado mínimo — sin dependencias. Una línea JSON por evento,
// para que cualquier agregador de logs (Vercel, Docker, etc.) la pueda
// parsear sin configuración adicional. No reemplaza a Sentry para excepciones
// con stack trace/alertas, pero cubre "qué pasó y cuándo" sin agregar una
// dependencia ni requerir credenciales de un servicio externo.

type Nivel = "info" | "warn" | "error";
type Contexto = Record<string, unknown>;

function escribir(nivel: Nivel, mensaje: string, contexto?: Contexto) {
  const linea = {
    timestamp: new Date().toISOString(),
    nivel,
    mensaje,
    ...contexto,
  };
  const salida = nivel === "error" ? console.error : nivel === "warn" ? console.warn : console.log;
  salida(JSON.stringify(linea));
}

export const logger = {
  info: (mensaje: string, contexto?: Contexto) => escribir("info", mensaje, contexto),
  warn: (mensaje: string, contexto?: Contexto) => escribir("warn", mensaje, contexto),
  error: (mensaje: string, contexto?: Contexto) => escribir("error", mensaje, contexto),
};
