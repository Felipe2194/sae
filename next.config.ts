import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Sin nonces (ver docs/credenciales-pendientes.md si se quiere endurecer más
// adelante): 'unsafe-inline' es necesario porque Next.js inyecta el payload
// de RSC como <script> inline y esta app usa estilos inline dinámicos
// (colores de área/usuario calculados en runtime). Igual bloquea la carga de
// scripts/objetos/frames de terceros, que es el riesgo real para una app
// interna sin CDN de anuncios ni contenido de usuarios no confiable.
// frame-src abre youtube-nocookie.com puntualmente para el embed de música
// (components/features/music-player.tsx), y drive/docs.google.com para el
// selector y la vista previa de Drive (app/(app)/tablero/drive-picker-button.tsx,
// tarea-sheet.tsx) — frame-ancestors sigue en 'none' porque eso controla lo
// contrario (quién puede embeber ESTA app). script-src/connect-src suman los
// hosts de Google Identity Services y la Picker API, que se cargan como
// <script> dinámico (no npm) y hacen sus propios fetch a googleapis.com.
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  font-src 'self';
  frame-src https://www.youtube-nocookie.com https://drive.google.com https://docs.google.com;
  connect-src 'self' https://www.googleapis.com https://content.googleapis.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';${isDev ? "" : "\n  upgrade-insecure-requests;"}
`
  .replace(/\s{2,}/g, " ")
  .trim();

const nextConfig: NextConfig = {
  // "standalone" arma un bundle self-contained en .next/standalone — lo usa
  // el Dockerfile para self-hosting (ver docs/migracion-servidores-propios.md).
  // No afecta el deploy en Vercel, que ignora esta opción.
  output: "standalone",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          ...(isDev
            ? []
            : [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]),
        ],
      },
    ];
  },
};

export default nextConfig;
