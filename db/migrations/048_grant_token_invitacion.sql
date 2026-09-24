-- 043_invitaciones.sql agregó token_invitacion_hash/_expira pero no las sumó
-- al GRANT por columna de 041_columnas_update_usuario.sql, así que
-- generarInvitacion (configuracion/actions.ts, vía withUser() con el rol
-- sae_app) fallaba con "permission denied for table usuario". Completar la
-- invitación no se veía afectado: corre con `sql` directo (superuser).

grant update (token_invitacion_hash, token_invitacion_expira) on usuario to sae_app;
