import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'Falta la variable de entorno DATABASE_URL. Copiá .env.example a .env.local y completá la cadena de conexión a Postgres.',
  );
}

// Un único pool de conexiones. Las conexiones van como superuser; las
// transacciones de usuario bajan al rol sae_app via SET LOCAL ROLE para
// que RLS se aplique correctamente.
const sql = postgres(process.env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export { sql };

// Ejecuta fn dentro de una transacción con el contexto del usuario dado.
// SET LOCAL ROLE sae_app  →  RLS se activa (sae_app no es superuser).
// set_config app.user_id  →  las políticas RLS pueden leer mi_usuario_id().
// Ambos son LOCAL: se revierten automáticamente al terminar la transacción.
export async function withUser<T>(
  userId: string,
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return sql.begin(async (tx): Promise<any> => {
    await tx`set local role sae_app`;
    await tx`select set_config('app.user_id', ${userId}, true)`;
    return fn(tx);
  }) as Promise<T>;
}
