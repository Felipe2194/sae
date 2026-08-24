-- El fondo "glass" (018_fondo_organizacion.sql) era configurable solo por el
-- admin y valía para toda la organización — se pasa a preferencia personal
-- en /perfil, cada quien elige el suyo. No hace falta política de RLS
-- nueva: usuario_update_propio (002_rls.sql) ya cubre que cada quien edite
-- su propia fila.
--
-- No hay una migración de datos con sentido de organizacion.fondo_* hacia
-- usuario.fondo_*: no existe un "dueño" natural del valor que tenía la
-- organización, así que se pierde el fondo compartido que hubiera elegido
-- el admin (cada persona vuelve a elegir el suyo desde cero).

alter table usuario add column fondo_tipo  text check (fondo_tipo in ('gradiente', 'imagen'));
alter table usuario add column fondo_valor text;

alter table organizacion drop column fondo_tipo;
alter table organizacion drop column fondo_valor;
