import { sql } from '@/lib/db';

// Rate limiting basado en Postgres (no en memoria) para que funcione correctamente
// entre invocaciones serverless distintas. `clave` identifica el bucket a limitar
// (ej. "login:ip:1.2.3.4" o "registro:ip:1.2.3.4").
export async function verificarLimiteIntentos(
  clave: string,
  max: number,
  ventanaMs: number,
): Promise<boolean> {
  const desde = new Date(Date.now() - ventanaMs);
  const [fila] = await sql<{ count: string }[]>`
    select count(*)::text as count from intento_auth
    where clave = ${clave} and creado_en > ${desde}
  `;
  return Number(fila.count) < max;
}

export async function registrarIntento(clave: string): Promise<void> {
  await sql`insert into intento_auth (clave) values (${clave})`;
  // Housekeeping oportunista: no necesita ser exacto, solo evitar que la tabla crezca sin límite.
  await sql`delete from intento_auth where creado_en < now() - interval '1 day'`;
}

export function obtenerIp(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'sin-ip';
}
