// Build de Vercel (package.json → "vercel-build"; Vercel lo usa en lugar de
// "build" cuando existe).
//
// En producción aplica primero las migraciones pendientes y recién después
// compila. Antes se corrían a mano contra la base, y olvidarse una dejaba el
// código nuevo hablándole a un schema viejo (pasó con la 048 y la 051: 500
// en /hoy hasta que alguien se dio cuenta). Si una migración falla, el build
// falla y el deploy no sale: producción sigue en la versión anterior, que es
// la que coincide con el schema que quedó.
//
// Solo con VERCEL_ENV=production: los deploys de preview (ramas, PRs)
// comparten o pueden compartir la base y no deben tocarle el schema.
//
// Las migraciones tienen que ser compatibles con la versión que ya está
// corriendo (agregar columnas/índices, no renombrar ni borrar algo en uso):
// entre que se aplican y que el deploy nuevo queda activo pasan unos minutos
// en los que el código viejo sigue atendiendo.

import { spawnSync } from "node:child_process";

function correr(comando, args) {
  console.log(`\n> ${comando} ${args.join(" ")}`);
  const r = spawnSync(comando, args, { stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (process.env.VERCEL_ENV === "production") {
  correr("npx", ["tsx", "db/migrate.ts"]);
} else {
  console.log(
    `Migraciones salteadas (VERCEL_ENV=${process.env.VERCEL_ENV ?? "sin definir"}): solo se aplican en producción.`,
  );
}

correr("npx", ["next", "build"]);
