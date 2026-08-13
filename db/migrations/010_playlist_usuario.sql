-- Cada persona puede guardar el link de una playlist propia en su perfil,
-- para que se pueda elegir y escuchar desde el widget de música de /hoy.
-- No hace falta política de RLS nueva: usuario_update_propio ya cubre
-- que cada quien edite su propia fila (o un admin, cualquiera).

alter table usuario add column playlist_url text;
