// Helpers para crear notificaciones dentro de una transacción postgres.js existente.
//
// Devuelven el texto del mensaje de Telegram (o null si no corresponde
// mandar nada) en vez de enviarlo directamente: `enviarTelegram` hace un
// fetch HTTP externo, y hacerlo mientras la transacción sigue abierta
// retiene la conexión de Postgres (pool de solo 10, ver lib/db.ts) y
// cualquier lock de fila tomado hasta que Telegram responda. El caller debe
// llamar a `enviarTelegram(mensaje)` recién después de que `withUser`
// resuelva.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any;

// Notifica a una o varias personas que se les asignó una tarea (responsable
// y/o co-asignados — incluye el caso "Asignar a todos"). Un solo mensaje de
// Telegram por llamada, sin importar a cuántas personas: si se llamara una
// vez por persona, asignar una tarea urgente a todo el equipo mandaría una
// ráfaga de N mensajes casi idénticos al grupo compartido.
export async function notificarAsignacion(
  tx: Tx,
  usuarioIds: string | string[],
  tareaTitulo: string,
): Promise<string | null> {
  const ids = [...new Set(Array.isArray(usuarioIds) ? usuarioIds : [usuarioIds])];
  if (ids.length === 0) return null;

  for (const usuarioId of ids) {
    await tx`
      insert into notificacion (usuario_id, tipo, titulo, cuerpo, href)
      values (
        ${usuarioId},
        'tarea_asignada',
        'Te asignaron una tarea',
        ${tareaTitulo},
        '/tablero'
      )
    `;
  }

  if (ids.length === 1) {
    const [usuario] = await tx<{ nombre: string }[]>`
      select nombre from usuario where id = ${ids[0]}
    `;
    if (usuario) {
      return `📌 ${usuario.nombre} — nueva tarea asignada: "${tareaTitulo}"`;
    }
    return null;
  }
  return `📌 Tarea asignada a ${ids.length} personas: "${tareaTitulo}"`;
}

export async function notificarComentario(
  tx: Tx,
  responsableId: string,
  tareaTitulo: string,
  autorNombre: string,
): Promise<string | null> {
  const filas = await tx`
    insert into notificacion (usuario_id, tipo, titulo, cuerpo, href)
    select
      ${responsableId},
      'comentario',
      ${'Comentario en "' + tareaTitulo + '"'},
      ${autorNombre},
      '/tablero'
    where ${responsableId}::uuid != mi_usuario_id()
    returning id
  `;

  if (filas.length > 0) {
    return `💬 ${autorNombre} comentó en "${tareaTitulo}"`;
  }
  return null;
}
