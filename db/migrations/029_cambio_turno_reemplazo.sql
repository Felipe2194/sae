-- El tipo 'cambio' de excepcion_turno ya existía en el enum (migración 009)
-- pero sin ninguna columna para decir QUIÉN cubre el turno ese día —
-- quedaba como una ausencia con una nota de texto libre. Se agrega el
-- reemplazo real, para que "en la oficina ahora" (y el cronograma) puedan
-- mostrar a la persona que cubre en vez de a la que tenía el turno original,
-- sin tocar el cronograma fijo (turno): el cambio es puntual, solo para
-- fecha, y al día siguiente vuelve a regir el turno de siempre.
alter table excepcion_turno
  add column usuario_reemplazo_id uuid references usuario (id);
