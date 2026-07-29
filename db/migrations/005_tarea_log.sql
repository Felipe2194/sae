-- M1.1: Log de cambios por tarea — trazabilidad de quién cambió qué y cuándo.

create table tarea_log (
  id           uuid primary key default gen_random_uuid(),
  tarea_id     uuid not null references tarea (id) on delete cascade,
  usuario_id   uuid references usuario (id) on delete set null,
  campo        text not null,
  valor_antes  text,
  valor_despues text,
  creado_en    timestamptz not null default now()
);

create index tarea_log_tarea_id_idx on tarea_log (tarea_id);

-- RLS
alter table tarea_log enable row level security;

create policy "tarea_log_select"
  on tarea_log for select
  using (
    exists (
      select 1 from tarea t
      where t.id = tarea_log.tarea_id
        and t.organizacion_id = mi_organizacion_id()
    )
  );

create policy "tarea_log_insert"
  on tarea_log for insert
  with check (
    exists (
      select 1 from tarea t
      where t.id = tarea_id
        and t.organizacion_id = mi_organizacion_id()
    )
  );

grant select, insert on tarea_log to sae_app;
grant usage, select on all sequences in schema public to sae_app;
