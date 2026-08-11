-- Rate limiting simple para /login y /registro (protección básica contra fuerza bruta).
-- Se accede siempre con la conexión superuser (antes de tener un usuario autenticado),
-- igual que la consulta de `usuario` en auth.ts — no necesita RLS.

create table intento_auth (
  id         bigserial primary key,
  clave      text not null,
  creado_en  timestamptz not null default now()
);

create index intento_auth_clave_idx on intento_auth (clave, creado_en);
