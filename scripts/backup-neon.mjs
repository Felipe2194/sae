// Backup de la base de producción (Neon) a un archivo local.
//
//   npm run db:backup
//
// Neon guarda historial para restaurar a un punto en el tiempo, pero esa
// ventana depende del plan (en el gratuito son horas, no semanas) y vive en
// el mismo proveedor que la base. Este script deja además una copia completa
// afuera: un .sql.gz en ./backups/ (carpeta ignorada por git — tiene datos
// personales de estudiantes y colegios; no subirla a ningún lado público).
//
// Usa pg_dump desde la imagen oficial de Postgres vía Docker, así no hace
// falta tener el cliente instalado en Windows. Requiere Docker andando.
//
// Lee DATABASE_URL de .env.local salvo que ya esté definida en el entorno.
// Para restaurar en una base vacía:
//   gunzip -c backups/sae-AAAAMMDD-HHMMSS.sql.gz | psql "<cadena de conexión>"

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { config } from "dotenv";

config({ path: ".env.local" });

const RETENCION = Number(process.env.BACKUP_RETENCION ?? 30); // cuántos archivos conservar
const IMAGEN = process.env.BACKUP_IMAGEN_POSTGRES ?? "postgres:18-alpine";

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL (en .env.local o en el entorno).");
  process.exit(1);
}

const url = new URL(process.env.DATABASE_URL);
// pg_dump necesita una conexión directa: el pooler de Neon (PgBouncer en
// modo transacción) no soporta todo lo que usa. El host directo es el mismo
// sin el sufijo "-pooler".
url.hostname = url.hostname.replace("-pooler.", ".");
// Dentro del contenedor, "localhost" es el contenedor mismo.
if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
  url.hostname = "host.docker.internal";
}

const dir = path.join(process.cwd(), "backups");
fs.mkdirSync(dir, { recursive: true });

const ts = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
const destino = path.join(dir, `sae-${ts}.sql.gz`);

console.log(`Volcando ${url.hostname}${url.pathname} …`);

// La cadena de conexión va por variable de entorno, no como argumento: así
// no queda a la vista en la lista de procesos ni en el historial.
const r = spawnSync(
  "docker",
  [
    "run", "--rm", "-e", "PGURL", IMAGEN,
    "sh", "-c", 'pg_dump --no-owner --no-privileges "$PGURL"',
  ],
  {
    env: { ...process.env, PGURL: url.toString() },
    maxBuffer: 1024 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
  },
);

if (r.error || r.status !== 0) {
  console.error(
    r.error
      ? `No se pudo ejecutar Docker: ${r.error.message}`
      : `pg_dump falló (código ${r.status}). Si el error habla de versiones, el servidor es más nuevo que esta imagen: probá con BACKUP_IMAGEN_POSTGRES=postgres:<versión del servidor>-alpine.`,
  );
  process.exit(1);
}

// Un volcado sano siempre termina con este comentario: si falta, se cortó.
const sqlDump = r.stdout;
if (!sqlDump.toString("utf8", Math.max(0, sqlDump.length - 200)).includes("PostgreSQL database dump complete")) {
  console.error("El volcado quedó incompleto; no se guardó nada.");
  process.exit(1);
}

fs.writeFileSync(destino, zlib.gzipSync(sqlDump));
const kb = Math.round(fs.statSync(destino).size / 1024);
console.log(`Backup guardado: ${destino} (${kb} KB)`);

const viejos = fs
  .readdirSync(dir)
  .filter((f) => /^sae-\d{8}-\d{6}\.sql\.gz$/.test(f))
  .sort()
  .reverse()
  .slice(RETENCION);
for (const f of viejos) {
  fs.unlinkSync(path.join(dir, f));
  console.log(`Borrado backup viejo: ${f}`);
}
