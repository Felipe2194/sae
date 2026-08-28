-- Auditoría multi-entidad: quién cambió qué, para que administración pueda
-- supervisar un equipo rotativo (quién reasignó una tarea, cambió el rol o
-- estado de alguien, canceló una visita). Mismo espíritu que tarea_log
-- (005_tarea_log.sql) pero genérico entre entidades y con organizacion_id
-- propio en vez de depender de un join — varias de las acciones auditadas
-- (eliminar usuario, eliminar visita) borran la fila original, así que
-- entidad_nombre guarda una foto legible del nombre al momento del cambio,
-- no se puede recalcular después con un join.

create table auditoria (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizacion (id),
  usuario_id      uuid references usuario (id) on delete set null,
  entidad         text not null,
  entidad_id      uuid,
  entidad_nombre  text,
  campo           text not null,
  valor_antes     text,
  valor_despues   text,
  creado_en       timestamptz not null default now()
);

create index auditoria_org_creado_idx on auditoria (organizacion_id, creado_en desc);

alter table auditoria enable row level security;

-- Solo administrador supervisa — es la herramienta de rendición de cuentas,
-- no un historial de uso general para cualquier miembro.
create policy "auditoria_select"
  on auditoria for select
  using (organizacion_id = mi_organizacion_id() and mi_rol() = 'administrador');

-- Cualquier usuario autenticado inserta su propia auditoría: cada acción se
-- audita dentro de su propia transacción (withUser), no hay un rol especial
-- "auditor" que la escriba por otro.
create policy "auditoria_insert"
  on auditoria for insert
  with check (organizacion_id = mi_organizacion_id());

grant select, insert on auditoria to sae_app;
