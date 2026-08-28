import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

// Proxy al servicio de favicons de Google — la CSP de la app solo permite
// imágenes 'self' (ver next.config.ts), así que un <img src="https://google.com/...">
// directo queda bloqueado en el browser. Sirviéndolo desde nuestro propio
// origen evita tener que abrir img-src a terceros solo por esto.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse(null, { status: 401 });
  }

  const dominio = new URL(req.url).searchParams.get("dominio");
  // Un hostname simple, no una URL completa ni nada más raro — este endpoint
  // solo reenvía a Google Favicons, no sirve como proxy de imágenes genérico.
  if (!dominio || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(dominio)) {
    return new NextResponse(null, { status: 400 });
  }

  const res = await fetch(
    `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(dominio)}`,
  );
  if (!res.ok) {
    return new NextResponse(null, { status: 502 });
  }

  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      "content-type": res.headers.get("content-type") ?? "image/png",
      "cache-control": "public, max-age=86400",
    },
  });
}
