-- Cuentas ocultas: un administrador que revisa el sistema (soporte, pruebas)
-- sin figurar para el equipo — no aparece en selectores de personas,
-- Presencia, Informes, Cambiar perfil ni playlists. Sí aparece en
-- Configuración → Usuarios, marcada, para poder administrarla.
--
-- No hace falta tocar grants: 041_columnas_update_usuario.sql limita qué
-- columnas de usuario puede actualizar sae_app, y esta no está en la lista,
-- así que nadie puede ocultarse (ni mostrarse) a sí mismo desde la app.

alter table usuario add column oculto boolean not null default false;
