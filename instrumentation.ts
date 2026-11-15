import type { Instrumentation } from "next";
import { esErrorDeUsuario } from "@/lib/errores";

// Aviso de errores de servidor sin depender de un servicio externo: cada
// error inesperado (un 500 en una página, una Server Action o una ruta) queda
// como una línea JSON en los logs y, si está configurado
// TELEGRAM_ALERTAS_CHAT_ID, llega también como mensaje de Telegram — para
// enterarse antes de que alguien del equipo avise que "no anda".
//
// Usa un chat aparte del grupo del equipo (TELEGRAM_CHAT_ID) a propósito: un
// stack trace no le sirve a nadie más que a quien mantiene el sistema.
//
// Los ErrorDeUsuario (lib/errores.ts) no se reportan: son validaciones y
// permisos, el camino esperado, no una falla.

// Mismo error repetido (una página rota que todos recargan): un aviso cada
// 10 minutos por instancia, no uno por request.
const VENTANA_REPETIDOS_MS = 10 * 60 * 1000;
const avisados = new Map<string, number>();

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  if (esErrorDeUsuario(err)) return;

  const mensaje = err instanceof Error ? err.message : String(err);
  const digest =
    typeof err === "object" && err !== null && "digest" in err
      ? String((err as { digest: unknown }).digest)
      : undefined;

  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      nivel: "error",
      mensaje: "error de servidor no controlado",
      error: mensaje,
      digest,
      stack: err instanceof Error ? err.stack : undefined,
      ruta: request.path,
      metodo: request.method,
      tipo: context.routeType,
      archivo: context.routePath,
    }),
  );

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_ALERTAS_CHAT_ID;
  if (!token || !chat) return;

  const clave = `${context.routePath}|${mensaje}`;
  const ahora = Date.now();
  const ultimo = avisados.get(clave);
  if (ultimo && ahora - ultimo < VENTANA_REPETIDOS_MS) return;
  avisados.set(clave, ahora);
  if (avisados.size > 200) avisados.clear();

  // Solo el path, sin query string: puede traer datos de quien navega.
  const ruta = request.path.split("?")[0];
  const texto = [
    "⚠️ SAE — error de servidor",
    `${request.method} ${ruta} (${context.routeType})`,
    mensaje.slice(0, 500),
    digest ? `digest: ${digest}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: texto, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // El aviso es best-effort: el error original ya quedó en los logs.
  }
};
