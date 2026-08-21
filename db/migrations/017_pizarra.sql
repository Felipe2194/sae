-- Pizarra de ideas: corcho compartido donde cualquiera de la organización
-- pega notas de texto que se pueden mover libremente por un lienzo, visibles
-- para todo el equipo. Sin dibujo a mano alzada (confirmado con el usuario) —
-- solo notas de texto posicionadas libremente.

create table pizarra_nota (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizacion (id),
  autor_id        uuid not null references usuario (id),
  -- vacía al crear (se completa después con el picker de edición inline)
  contenido       text not null default '' check (char_length(contenido) <= 500),
  color           text not null default 'amarillo',
  pos_x           double precision not null default 0,
  pos_y           double precision not null default 0,
  z_index         integer not null default 0,
  creada_en       timestamptz not null default now(),
  actualizada_en  timestamptz not null default now()
);

create index pizarra_nota_organizacion_id_idx on pizarra_nota (organizacion_id);

alter table pizarra_nota enable row level security;

create policy "pizarra_nota_select"
  on pizarra_nota for select
  using (organizacion_id = mi_organizacion_id());

create policy "pizarra_nota_insert"
  on pizarra_nota for insert
  with check (organizacion_id = mi_organizacion_id() and autor_id = mi_usuario_id());

-- update/delete: el autor, o coordinador/administrador (mismo criterio que
-- borrar comentarios/adjuntos de tareas hoy).
create policy "pizarra_nota_update"
  on pizarra_nota for update
  using (
    organizacion_id = mi_organizacion_id()
    and (autor_id = mi_usuario_id() or mi_rol() in ('coordinador', 'administrador'))
  )
  with check (organizacion_id = mi_organizacion_id());

create policy "pizarra_nota_delete"
  on pizarra_nota for delete
  using (
    organizacion_id = mi_organizacion_id()
    and (autor_id = mi_usuario_id() or mi_rol() in ('coordinador', 'administrador'))
  );

grant select, insert, update, delete on pizarra_nota to sae_app;
