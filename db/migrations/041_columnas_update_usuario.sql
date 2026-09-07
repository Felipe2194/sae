-- GRANT de UPDATE por columna en `usuario` para sae_app, en vez de la tabla
-- entera (migración 002_rls.sql daba `grant ... update ... on all tables`
-- sin distinguir columnas). RLS (usuario_update_propio) ya restringe QUÉ FILA
-- se puede tocar (uno mismo, o un administrador de la misma organización),
-- pero no restringe QUÉ COLUMNA de esa fila — hoy ninguna acción hace mass-
-- assignment sobre `usuario`, así que no es explotable en la práctica, pero
-- tampoco hay nada que lo impida si una acción futura lo hiciera por error.
--
-- La lista de abajo es exactamente el conjunto de columnas que algún server
-- action ya actualiza hoy vía withUser() (rol sae_app):
--   - nombre, playlist_url, avatar_color, fondo_tipo, fondo_valor,
--     color_principal            → perfil/actions.ts (uno mismo)
--   - estado, rol, es_cuenta_generica, password_hash
--                                 → configuracion/actions.ts (un administrador
--                                    sobre otro usuario de su organización)
--   - ultimo_login                → no se usa hoy vía sae_app (va por `sql`
--                                    directo en auth.ts), se deja habilitada
--                                    por si alguna vez se mueve a withUser().
--
-- Deliberadamente AFUERA (solo el superuser puede tocarlas, como ya pasa hoy
-- con el alta de usuarios): id, organizacion_id, email, avatar_url (columna
-- sin uso), creada_en, es_superadmin. Ninguna acción vía withUser() necesita
-- escribirlas — organizacion_id y es_superadmin en particular son las que
-- importa que ningún bug futuro pueda tocar desde el rol de aplicación.

revoke update on usuario from sae_app;

grant update (
  nombre,
  password_hash,
  rol,
  estado,
  playlist_url,
  avatar_color,
  es_cuenta_generica,
  fondo_tipo,
  fondo_valor,
  ultimo_login,
  color_principal
) on usuario to sae_app;
