-- Tareas planificadas: quedan cargadas (con subtareas, responsable, fecha)
-- pero fuera del Tablero y de toda métrica hasta que se activan.
alter table tarea add column activa boolean not null default true;
create index tarea_activa_idx on tarea (activa);

-- Fechas importantes de un proyecto que no dependen de ninguna tarea
-- (ej. "apertura de inscripciones", "cierre de pagos").
create table hito_area (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references area (id) on delete cascade,
  titulo text not null,
  fecha date not null,
  creado_por uuid not null references usuario (id),
  creado_en timestamptz not null default now()
);
create index hito_area_area_id_idx on hito_area (area_id);
grant select, insert, delete on hito_area to sae_app;
alter table hito_area enable row level security;

create policy "hito_area_select" on hito_area for select
  using (exists (select 1 from area where area.id = hito_area.area_id and area.organizacion_id = mi_organizacion_id()));
create policy "hito_area_insert" on hito_area for insert
  with check (exists (select 1 from area where area.id = area_id and area.organizacion_id = mi_organizacion_id()));
create policy "hito_area_delete" on hito_area for delete
  using (exists (select 1 from area where area.id = hito_area.area_id and area.organizacion_id = mi_organizacion_id()));

-- Amplía quién puede editar una tarea: hasta ahora, tarea_update solo dejaba
-- pasar a responsable/creador/administrador. Las acciones nuevas de
-- planificación (actualizarTareaPlanificada/activarTarea/archivarTareaPlanificada
-- en app/(app)/proyectos/actions.ts) ya chequean en la aplicación que quien
-- llama es administrador o el responsable del proyecto (area.responsable_id) —
-- pero si un administrador planificó la tarea (creada_por = admin) y después
-- el responsable del proyecto (no-admin) intenta editarla/activarla/descartarla,
-- RLS lo bloqueaba igual por no ser ni responsable_id ni creada_por de esa
-- tarea puntual. Se agrega esa rama para que el permiso de la aplicación y el
-- de la base coincidan.
drop policy "tarea_update" on tarea;
create policy "tarea_update" on tarea for update
  using (
    organizacion_id = mi_organizacion_id()
    and (
      responsable_id = mi_usuario_id()
      or creada_por = mi_usuario_id()
      or mi_rol() in ('coordinador', 'administrador')
      or exists (
        select 1 from area
        where area.id = tarea.area_id and area.responsable_id = mi_usuario_id()
      )
    )
  )
  with check (organizacion_id = mi_organizacion_id());
