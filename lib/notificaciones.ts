// Helpers para crear notificaciones dentro de una transacción postgres.js existente.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any;

export async function notificarAsignacion(
  tx: Tx,
  usuarioId: string,
  tareaTitulo: string,
) {
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

export async function notificarComentario(
  tx: Tx,
  responsableId: string,
  tareaTitulo: string,
  autorNombre: string,
) {
  await tx`
    insert into notificacion (usuario_id, tipo, titulo, cuerpo, href)
    select
      ${responsableId},
      'comentario',
      ${'Comentario en "' + tareaTitulo + '"'},
      ${autorNombre},
      '/tablero'
    where ${responsableId}::uuid != mi_usuario_id()
  `;
}
