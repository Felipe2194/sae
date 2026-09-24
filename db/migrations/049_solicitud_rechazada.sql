-- Solicitudes de acceso rechazadas (alta automática vía Google o /registro).
-- Rechazar borra la fila de `usuario` (una cuenta pendiente no tiene datos
-- propios) y guarda el email acá: auth.ts y registro/actions.ts lo consultan
-- antes de crear una cuenta nueva, así la misma persona no vuelve a aparecer
-- como solicitud cada vez que intenta entrar. Un administrador puede
-- desbloquearlo desde Configuración → Usuarios.
--
-- email se guarda en minúsculas (lo normaliza la acción que inserta).

create table solicitud_rechazada (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizacion (id),
  email text not null,
  nombre text not null,
  rechazada_por uuid references usuario (id) on delete set null,
  rechazada_en timestamptz not null default now(),
  unique (organizacion_id, email)
);

alter table solicitud_rechazada enable row level security;

create policy "solicitud_rechazada_select"
  on solicitud_rechazada for select
  using (organizacion_id = mi_organizacion_id() and mi_rol() = 'administrador');

create policy "solicitud_rechazada_insert"
  on solicitud_rechazada for insert
  with check (organizacion_id = mi_organizacion_id() and mi_rol() = 'administrador');

create policy "solicitud_rechazada_delete"
  on solicitud_rechazada for delete
  using (organizacion_id = mi_organizacion_id() and mi_rol() = 'administrador');

grant select, insert, delete on solicitud_rechazada to sae_app;
