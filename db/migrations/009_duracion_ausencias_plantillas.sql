-- M2: duración estimada/real de tareas, excepciones de turno (ausencias) y
-- plantillas de tareas por área.

-- === Duración de tareas ======================================================

alter table tarea add column duracion_estimada_hs numeric(6, 2);
alter table tarea add column duracion_real_hs numeric(6, 2);

-- === Subtareas: cuándo se completó ==========================================
-- Necesario para poder alimentar la bitácora diaria con subtareas resueltas hoy.

alter table subtarea add column completada_en timestamptz;

-- === Excepciones de turno (ausencias / cambios) ==============================
-- El cronograma fijo no contempla que alguien falte a su turno habitual
-- (parciales, licencias, feriados). Esto es lo que evita que "En la oficina
-- ahora" reporte falsos positivos.

create type tipo_excepcion_turno as enum ('ausencia', 'cambio');

create table excepcion_turno (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizacion (id),
  usuario_id      uuid not null references usuario (id),
  fecha           date not null,
  tipo            tipo_excepcion_turno not null default 'ausencia',
  nota            text,
  creada_por      uuid not null references usuario (id),
  creada_en       timestamptz not null default now()
);

create index excepcion_turno_organizacion_id_idx on excepcion_turno (organizacion_id);
create index excepcion_turno_usuario_fecha_idx on excepcion_turno (usuario_id, fecha);

grant select, insert, update, delete on excepcion_turno to sae_app;

alter table excepcion_turno enable row level security;

create policy "excepcion_turno_select" on excepcion_turno for select
  using (organizacion_id = mi_organizacion_id());

create policy "excepcion_turno_insert" on excepcion_turno for insert
  with check (
    organizacion_id = mi_organizacion_id()
    and (usuario_id = mi_usuario_id() or mi_rol() in ('coordinador', 'administrador'))
  );

create policy "excepcion_turno_delete" on excepcion_turno for delete
  using (
    organizacion_id = mi_organizacion_id()
    and (usuario_id = mi_usuario_id() or mi_rol() in ('coordinador', 'administrador'))
  );

-- === Plantillas de tareas por área ===========================================
-- Procesos que se repiten (inscripción a becas, torneos, campañas de salud):
-- una plantilla es un nombre + una lista de títulos de tarea. "Aplicar" clona
-- esos títulos como tareas reales de la organización, en estado 'por_hacer'.

create table plantilla_area (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizacion (id),
  area_id         uuid not null references area (id) on delete cascade,
  nombre          text not null,
  creada_por      uuid not null references usuario (id),
  creada_en       timestamptz not null default now()
);

create index plantilla_area_area_id_idx on plantilla_area (area_id);

create table plantilla_item (
  id           uuid primary key default gen_random_uuid(),
  plantilla_id uuid not null references plantilla_area (id) on delete cascade,
  titulo       text not null,
  orden        integer not null default 0
);

create index plantilla_item_plantilla_id_idx on plantilla_item (plantilla_id);

grant select, insert, update, delete on plantilla_area to sae_app;
grant select, insert, update, delete on plantilla_item to sae_app;
grant usage, select on all sequences in schema public to sae_app;

alter table plantilla_area enable row level security;
alter table plantilla_item enable row level security;

create policy "plantilla_area_select" on plantilla_area for select
  using (organizacion_id = mi_organizacion_id());

create policy "plantilla_area_insert" on plantilla_area for insert
  with check (
    organizacion_id = mi_organizacion_id()
    and mi_rol() in ('coordinador', 'administrador')
  );

create policy "plantilla_area_delete" on plantilla_area for delete
  using (
    organizacion_id = mi_organizacion_id()
    and mi_rol() in ('coordinador', 'administrador')
  );

create policy "plantilla_item_select" on plantilla_item for select
  using (
    exists (
      select 1 from plantilla_area p
      where p.id = plantilla_item.plantilla_id
        and p.organizacion_id = mi_organizacion_id()
    )
  );

create policy "plantilla_item_insert" on plantilla_item for insert
  with check (
    exists (
      select 1 from plantilla_area p
      where p.id = plantilla_id
        and p.organizacion_id = mi_organizacion_id()
        and mi_rol() in ('coordinador', 'administrador')
    )
  );

create policy "plantilla_item_delete" on plantilla_item for delete
  using (
    exists (
      select 1 from plantilla_area p
      where p.id = plantilla_item.plantilla_id
        and p.organizacion_id = mi_organizacion_id()
        and mi_rol() in ('coordinador', 'administrador')
    )
  );
