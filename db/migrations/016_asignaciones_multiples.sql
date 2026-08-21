-- Asignación múltiple: hasta ahora tarea.responsable_id y area.responsable_id
-- solo admiten una persona. Se agregan tablas puente para co-asignados
-- adicionales, sin tocar el significado de responsable_id (sigue siendo el
-- "principal" — de él dependen /hoy, informes y coordinación tal cual están
-- hoy). La UI une responsable + co-asignados en un solo stack de avatares.

create table tarea_asignado (
  tarea_id    uuid not null references tarea (id) on delete cascade,
  usuario_id  uuid not null references usuario (id) on delete cascade,
  asignado_en timestamptz not null default now(),
  primary key (tarea_id, usuario_id)
);
create index tarea_asignado_usuario_id_idx on tarea_asignado (usuario_id);

create table area_asignado (
  area_id     uuid not null references area (id) on delete cascade,
  usuario_id  uuid not null references usuario (id) on delete cascade,
  asignado_en timestamptz not null default now(),
  primary key (area_id, usuario_id)
);
create index area_asignado_usuario_id_idx on area_asignado (usuario_id);

alter table tarea_asignado enable row level security;
alter table area_asignado enable row level security;

-- tarea_asignado: mismo criterio que quien puede editar la tarea hoy.
create policy "tarea_asignado_select"
  on tarea_asignado for select
  using (
    exists (
      select 1 from tarea
      where tarea.id = tarea_asignado.tarea_id
        and tarea.organizacion_id = mi_organizacion_id()
    )
  );

create policy "tarea_asignado_insert"
  on tarea_asignado for insert
  with check (
    exists (
      select 1 from tarea
      where tarea.id = tarea_asignado.tarea_id
        and tarea.organizacion_id = mi_organizacion_id()
        and (
          tarea.responsable_id = mi_usuario_id()
          or tarea.creada_por = mi_usuario_id()
          or mi_rol() in ('coordinador', 'administrador')
        )
    )
  );

create policy "tarea_asignado_delete"
  on tarea_asignado for delete
  using (
    exists (
      select 1 from tarea
      where tarea.id = tarea_asignado.tarea_id
        and tarea.organizacion_id = mi_organizacion_id()
        and (
          tarea.responsable_id = mi_usuario_id()
          or tarea.creada_por = mi_usuario_id()
          or mi_rol() in ('coordinador', 'administrador')
        )
    )
  );

grant select, insert, delete on tarea_asignado to sae_app;

-- area_asignado: solo coordinador/administrador, igual que area.responsable_id.
create policy "area_asignado_select"
  on area_asignado for select
  using (
    exists (
      select 1 from area
      where area.id = area_asignado.area_id
        and area.organizacion_id = mi_organizacion_id()
    )
  );

create policy "area_asignado_insert"
  on area_asignado for insert
  with check (
    exists (
      select 1 from area
      where area.id = area_asignado.area_id
        and area.organizacion_id = mi_organizacion_id()
    )
    and mi_rol() in ('coordinador', 'administrador')
  );

create policy "area_asignado_delete"
  on area_asignado for delete
  using (
    exists (
      select 1 from area
      where area.id = area_asignado.area_id
        and area.organizacion_id = mi_organizacion_id()
    )
    and mi_rol() in ('coordinador', 'administrador')
  );

grant select, insert, delete on area_asignado to sae_app;

-- Ampliar tarea_update: un co-asignado también tiene que poder mover/editar
-- la tarea (si no, queda decorativo y el drag falla en silencio por RLS).
-- Mismo patrón de redefinir una policy existente que 013_plantilla_area_update_policy.sql.
drop policy "tarea_update" on tarea;
create policy "tarea_update"
  on tarea for update
  using (
    organizacion_id = mi_organizacion_id()
    and (
      responsable_id = mi_usuario_id()
      or creada_por = mi_usuario_id()
      or mi_rol() in ('coordinador', 'administrador')
      or exists (
        select 1 from tarea_asignado ta
        where ta.tarea_id = tarea.id and ta.usuario_id = mi_usuario_id()
      )
    )
  )
  with check (organizacion_id = mi_organizacion_id());
