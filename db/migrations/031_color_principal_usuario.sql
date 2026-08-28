-- El "Color principal" de organizacion (color_principal, migración 014) era
-- la única forma de personalizar el color de acento de los botones — a
-- pedido, ahora cada usuario puede elegir el suyo propio en /perfil, igual
-- que ya elige su fondo (usuario.fondo_tipo/fondo_valor). null = sin
-- override, se sigue usando el color de la organización como default del
-- sistema (ver app/(app)/layout.tsx, que resuelve
-- usuario.color_principal ?? organizacion.color_principal).
alter table usuario
  add column color_principal text;
