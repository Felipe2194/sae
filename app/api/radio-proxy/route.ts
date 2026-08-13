import { NextRequest } from "next/server";
import { logger } from "@/lib/logger";

const STREAM_URL =
  process.env.NEXT_PUBLIC_RADIO_STREAM_URL || "https://ice1.somafm.com/groovesalad-128-mp3";

// Reenvía el stream de radio desde el servidor en vez de que el <audio> del
// cliente apunte directo al proveedor externo. Algunos servidores de
// streaming (SomaFM incluido) devuelven 403 a pedidos que vienen del
// navegador — rechazan el Origin/Referer que mandan, aunque anuncien CORS
// abierto — pero aceptan sin problema el mismo pedido hecho servidor a
// servidor (así probamos con curl). El navegador termina hablando solo con
// nuestro propio origen.
export async function GET(req: NextRequest) {
  const range = req.headers.get("range");

  let upstream: Response;
  try {
    upstream = await fetch(STREAM_URL, {
      headers: range ? { Range: range } : undefined,
    });
  } catch (error) {
    logger.warn("radio-proxy: no se pudo conectar al stream", {
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response("No se pudo conectar a la radio", { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 206) {
    logger.warn("radio-proxy: el proveedor respondió con error", {
      status: upstream.status,
    });
    return new Response("No se pudo conectar a la radio", { status: 502 });
  }

  const headers = new Headers();
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("Cache-Control", "no-store");

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
