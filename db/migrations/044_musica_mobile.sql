-- El reproductor de música (botón flotante, ver components/features/music-player.tsx)
-- viene oculto por defecto en celular (pantallas angostas, ver
-- app/(app)/layout.tsx) — ocupa espacio de pantalla y no es el foco de un
-- uso desde el celular. Cada persona puede reactivarlo desde /perfil.

alter table usuario
  add column musica_mobile_habilitada boolean not null default false;

grant update (musica_mobile_habilitada) on usuario to sae_app;
