"use client";

// Ejecuta `html` de forma síncrona durante el parseo del HTML (antes del
// primer paint), sin que React lo trate como script "vivo" a re-ejecutar acá
// dentro del bundle cliente. Ver:
// node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
//
// El truco del `type` requiere que este componente sea Client Component: si
// viviera en un Server Component (como app/layout.tsx), `typeof window` sería
// siempre "undefined" (ahí solo corre en el servidor) y el tag saldría
// siempre con type="text/javascript" también durante la hidratación en el
// navegador, lo que dispara el error de React "Encountered a script tag...".
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
