-- M1.2: tipo de tarea + subtareas

create type tipo_tarea as enum ('tarea', 'evento', 'entrega', 'reunion');

alter table tarea add column tipo tipo_tarea not null default 'tarea';

-- === subtarea ================================================================

create table subtarea (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid not null references tarea (id) on delete cascade,
  titulo text not null,
  hecha boolean not null default false,
  orden integer not null default 0,
  creada_en timestamptz not null default now()
);

create index subtarea_tarea_id_idx on subtarea (tarea_id);

grant select, insert, update, delete on subtarea to sae_app;

alter table subtarea enable row level security;

create policy "subtarea_select" on subtarea for select
  using (
    exists (
      select 1 from tarea
      where tarea.id = subtarea.tarea_id
        and tarea.organizacion_id = mi_organizacion_id()
    )
  );

create policy "subtarea_insert" on subtarea for insert
  with check (
    exists (
      select 1 from tarea t
      where t.id = tarea_id
        and t.organizacion_id = mi_organizacion_id()
    )
  );

create policy "subtarea_update" on subtarea for update
  using (
    exists (
      select 1 from tarea
      where tarea.id = subtarea.tarea_id
        and tarea.organizacion_id = mi_organizacion_id()
    )
  )
  with check (
    exists (
      select 1 from tarea
      where tarea.id = subtarea.tarea_id
        and tarea.organizacion_id = mi_organizacion_id()
    )
  );

create policy "subtarea_delete" on subtarea for delete
  using (
    exists (
      select 1 from tarea
      where tarea.id = subtarea.tarea_id
        and tarea.organizacion_id = mi_organizacion_id()
    )
  );
