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
  // x-vercel-forwarded-for lo pone la plataforma con la IP real de quien
  // conecta — a diferencia de x-forwarded-for, que Vercel no reescribe: un
  // cliente puede mandar el suyo propio con cualquier valor por delante, y
  // como más abajo se toma el primero de la lista, alcanza con eso para
  // evadir el límite por IP mandando un header distinto en cada intento.
  const ipVercel = headers.get('x-vercel-forwarded-for');
  if (ipVercel) return ipVercel.split(',')[0]?.trim() ?? 'sin-ip';

  // Self-hosted (ver docs/migracion-servidores-propios.md): acá depende de
  // que el reverse proxy de enfrente REESCRIBA X-Forwarded-For con la IP
  // real en vez de solo agregarle un valor al que ya venía del cliente — en
  // nginx, `proxy_set_header X-Forwarded-For $remote_addr;`, no
  // `$proxy_add_x_forwarded_for`. Sin eso, este fallback queda tan
  // evadible como estaba antes.
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'sin-ip';
}
