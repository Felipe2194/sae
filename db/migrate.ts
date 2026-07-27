// Aplica todas las migraciones pendientes en db/migrations/ en orden.
// Uso: npm run db:migrate

import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';
import fs from 'node:fs';
import path from 'node:path';

async function migrate() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  try {
    await sql`
      create table if not exists _migraciones (
        id serial primary key,
        nombre text unique not null,
        aplicada_en timestamptz not null default now()
      )
    `;

    const dir = path.join(process.cwd(), 'db/migrations');
    const archivos = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const archivo of archivos) {
      const [existente] = await sql`
        select id from _migraciones where nombre = ${archivo}
      `;
      if (existente) {
        console.log(`  skip  ${archivo}`);
        continue;
      }

      const contenido = fs.readFileSync(path.join(dir, archivo), 'utf-8');
      console.log(`  run   ${archivo}`);
      await sql.unsafe(contenido);
      await sql`insert into _migraciones (nombre) values (${archivo})`;
      console.log(`  ✓     ${archivo}`);
    }

    console.log('\nMigraciones aplicadas.');
  } finally {
    await sql.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
