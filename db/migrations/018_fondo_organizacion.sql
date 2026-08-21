-- Fondo personalizado de organización (gradiente predefinido o imagen por
-- URL) para el efecto "glass" — tarjetas translúcidas sobre un fondo elegido
-- por el admin, en vez del fondo plano actual.
--
-- De paso: `organizacion` nunca tuvo policy de UPDATE (solo `organizacion_select`
-- desde 002_rls.sql), así que guardar nombre/logo/color/zona horaria desde
-- /admin no tocaba ninguna fila — RLS deniega por defecto sin policy que
-- matchee. Se agrega acá porque el fondo nuevo la necesita para persistir,
-- y de paso deja funcionando el resto del formulario.

alter table organizacion add column fondo_tipo  text check (fondo_tipo in ('gradiente', 'imagen'));
alter table organizacion add column fondo_valor text;

create policy "organizacion_update"
  on organizacion for update
  using (id = mi_organizacion_id() and mi_rol() = 'administrador')
  with check (id = mi_organizacion_id() and mi_rol() = 'administrador');
