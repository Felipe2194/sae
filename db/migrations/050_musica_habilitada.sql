-- Quitar el reproductor de música por completo (components/features/
-- music-player.tsx), en computadora y en celular. Activado por defecto:
-- cada persona lo apaga desde /perfil si no lo usa. Con esto en false,
-- musica_mobile_habilitada (044) deja de tener efecto.

alter table usuario
  add column musica_habilitada boolean not null default true;

grant update (musica_habilitada) on usuario to sae_app;
