import { logger } from "@/lib/logger";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Notificaciones fuera de la app, al grupo de Telegram del equipo — la
// especificación original lo dejaba como pregunta abierta frente a email,
// y Telegram es más inmediato para un equipo chico. Opcional: sin las env
// vars no hace nada. Nunca debe romper el flujo que la llama (asignar una
// tarea, comentar) si Telegram falla — por eso atrapa sus propios errores.
export async function enviarTelegram(mensaje: string): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) return;

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: mensaje,
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      logger.warn("telegram: el envío falló", {
        status: res.status,
        body: await res.text(),
      });
    }
  } catch (error) {
    logger.warn("telegram: error de red al enviar", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
