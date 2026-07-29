-- M1.2: Notificaciones in-app.
-- Generadas al asignar una tarea, comentar en una tarea asignada al usuario, etc.

create table notificacion (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references usuario (id) on delete cascade,
  tipo         text not null,          -- 'tarea_asignada' | 'comentario' | 'mencion'
  titulo       text not null,
  cuerpo       text,
  href         text,                   -- link de navegación
  leida        boolean not null default false,
  creada_en    timestamptz not null default now()
);

create index notificacion_usuario_id_idx on notificacion (usuario_id, leida, creada_en desc);

-- RLS: cada usuario solo ve las suyas
alter table notificacion enable row level security;

create policy "notificacion_select"
  on notificacion for select
  using (usuario_id = mi_usuario_id());

create policy "notificacion_update"
  on notificacion for update
  using (usuario_id = mi_usuario_id())
  with check (usuario_id = mi_usuario_id());

create policy "notificacion_insert"
  on notificacion for insert
  with check (
    exists (
      select 1 from usuario u
      where u.id = usuario_id
        and u.organizacion_id = mi_organizacion_id()
    )
  );

grant select, insert, update on notificacion to sae_app;
grant usage, select on all sequences in schema public to sae_app;
