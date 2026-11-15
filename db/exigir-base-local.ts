// Freno para los scripts que cargan datos de demostración.
//
// .env.local puede apuntar a la base de producción (queda así después de un
// `vercel env pull`), y desde el 2026-09-23 esa base tiene datos reales: un
// `npm run db:seed-demo` distraído los mezclaría con colegios, visitas y
// usuarios inventados. Estos scripts solo corren contra una base local o de
// CI, salvo que se pida explícitamente lo contrario.
//
// Para correrlo igual contra una base remota (por ejemplo, una rama de Neon
// de pruebas): PERMITIR_BASE_REMOTA=1 npm run db:seed

const HOSTS_LOCALES = new Set(["localhost", "127.0.0.1", "::1", "db", "postgres", "host.docker.internal"]);

export function exigirBaseLocal(nombreScript: string): void {
  const cadena = process.env.DATABASE_URL;
  if (!cadena) {
    console.error("Falta DATABASE_URL.");
    process.exit(1);
  }
  let host: string;
  try {
    host = new URL(cadena).hostname;
  } catch {
    console.error("DATABASE_URL no es una cadena de conexión válida.");
    process.exit(1);
  }
  if (HOSTS_LOCALES.has(host) || process.env.PERMITIR_BASE_REMOTA === "1") return;

  console.error(
    [
      "",
      `✋ ${nombreScript} no corre contra una base remota (${host}).`,
      "   Carga datos de demostración y esa base puede ser la de producción.",
      "   Para usar la base local de Docker:",
      "     DATABASE_URL=postgresql://postgres:postgres@localhost:5433/sae npm run …",
      "   Si de verdad es una base de pruebas remota: PERMITIR_BASE_REMOTA=1",
      "",
    ].join("\n"),
  );
  process.exit(1);
}
