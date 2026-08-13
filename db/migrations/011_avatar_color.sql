-- Color de avatar elegible desde /perfil (antes existía en el formulario
-- pero no se guardaba en ningún lado). Sin política de RLS nueva:
-- usuario_update_propio ya cubre que cada quien edite su propia fila.

alter table usuario add column avatar_color text;
