-- Módulo "Becas": padrón único de estudiantes becados, sus becas por año
-- (programa, área, tutor), control de incompatibilidades entre programas y
-- seguimiento de las entregas (informes) de las becas de la facultad.
-- Reemplaza el combo de ~38 planillas + Google Forms + mails copiados a mano
-- con el que se llevaron las becas 2025 (Manuel Belgrano, Investigación y
-- Servicio, BASE).
--
-- Decisiones de diseño (charladas con el usuario, no reabrir sin motivo):
-- - Manuel Belgrano es solo padrón: los becados certifican por su cuenta en
--   la página nacional, así que acá no se sigue la certificación mensual.
-- - Las entregas (informes de IyS/BASE) se tildan a mano: el archivo sigue
--   llegando al mail de becas, acá solo queda recibida/observada. No se
--   guardan archivos. Sin fila en beca_entrega_estado = pendiente.
-- - El estudiante se identifica por DNI (solo dígitos), único por
--   organización. Legajo y mail cambian entre listados; el DNI no.
-- - Las incompatibilidades NO se bloquean con un constraint: el listado
--   nacional llega como llega y hay que poder cargarlo igual. Se detectan
--   con una consulta y se muestran como conflictos a resolver.
-- - El tutor va como columnas del área (no tabla propia): en las planillas
--   siempre aparece pegado al área, y un tutor sin área no tiene uso.
-- - Los programas "externos" (Progresar) existen solo para marcar que el
--   estudiante la tiene y dispare la incompatibilidad; no tienen entregas.
-- - Cualquier miembro lee y edita estudiantes, áreas, asignaciones y
--   entregas (mismo criterio que Viajes). Programas, incompatibilidades,
--   definición de entregas y borrado de estudiantes: solo administrador.
-- - becas_habilitado arranca en false (a diferencia de las otras
--   secciones): son datos personales y la mayoría de las organizaciones no
--   gestiona becas. Cada una la activa desde Configuración.

-- === estudiante ===============================================================

create table estudiante (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizacion (id),
  dni text not null check (dni ~ '^[0-9]{6,9}$'),
  apellido text not null,
  nombre text not null default '',
  legajo text,
  carrera text,
  email text,
  telefono text,
  notas text,
  creado_en timestamptz not null default now(),
  unique (organizacion_id, dni)
);

-- === beca_programa ============================================================

create table beca_programa (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizacion (id),
  nombre text not null,
  origen text not null default 'facultad' check (origen in ('nacional', 'facultad', 'externa')),
  horas_por_modulo integer check (horas_por_modulo is null or horas_por_modulo >= 0),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  unique (organizacion_id, nombre)
);

-- Par no ordenado: se guarda siempre con programa_a < programa_b para que
-- "A incompatible con B" y "B incompatible con A" sean la misma fila.
create table beca_incompatibilidad (
  programa_a uuid not null references beca_programa (id) on delete cascade,
  programa_b uuid not null references beca_programa (id) on delete cascade,
  primary key (programa_a, programa_b),
  check (programa_a < programa_b)
);

create index beca_incompatibilidad_b_idx on beca_incompatibilidad (programa_b);

-- === beca_area ================================================================
-- Catálogo por año: las áreas y sus tutores cambian de un ciclo al otro (se
-- copian del año anterior desde la pantalla y se ajustan).

create table beca_area (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizacion (id),
  anio integer not null check (anio between 2000 and 2100),
  departamento text,
  nombre text not null,
  tipo text,
  tutor_nombre text,
  tutor_email text,
  tutor_telefono text,
  modulos_cupo integer check (modulos_cupo is null or modulos_cupo >= 0),
  perfil text,
  creado_en timestamptz not null default now()
);

create index beca_area_org_anio_idx on beca_area (organizacion_id, anio);

-- === beca_asignacion ==========================================================
-- Una beca de un estudiante en un año. unique(estudiante, programa, anio):
-- la misma beca no se carga dos veces aunque venga en dos listados.

create table beca_asignacion (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizacion (id),
  estudiante_id uuid not null references estudiante (id) on delete cascade,
  programa_id uuid not null references beca_programa (id),
  anio integer not null check (anio between 2000 and 2100),
  condicion text,
  estado text not null default 'activa' check (estado in ('activa', 'rechazada', 'baja')),
  area_id uuid references beca_area (id) on delete set null,
  modulos integer check (modulos is null or modulos >= 0),
  observaciones text,
  creado_en timestamptz not null default now(),
  unique (estudiante_id, programa_id, anio)
);

create index beca_asignacion_org_anio_idx on beca_asignacion (organizacion_id, anio);
create index beca_asignacion_programa_idx on beca_asignacion (programa_id);
create index beca_asignacion_area_idx on beca_asignacion (area_id);

-- === beca_entrega =============================================================
-- Qué hay que entregar en un programa y año ("Informe septiembre").

create table beca_entrega (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizacion (id),
  programa_id uuid not null references beca_programa (id) on delete cascade,
  anio integer not null check (anio between 2000 and 2100),
  nombre text not null,
  vence_el date,
  a_cargo text not null default 'becario' check (a_cargo in ('becario', 'tutor')),
  creado_en timestamptz not null default now()
);

create index beca_entrega_programa_anio_idx on beca_entrega (programa_id, anio);

create table beca_entrega_estado (
  asignacion_id uuid not null references beca_asignacion (id) on delete cascade,
  entrega_id uuid not null references beca_entrega (id) on delete cascade,
  estado text not null check (estado in ('recibida', 'observada')),
  observacion text,
  marcada_por uuid references usuario (id) on delete set null,
  marcada_en timestamptz not null default now(),
  primary key (asignacion_id, entrega_id)
);

create index beca_entrega_estado_entrega_idx on beca_entrega_estado (entrega_id);

alter table organizacion add column becas_habilitado boolean not null default false;

-- === RLS ======================================================================

alter table estudiante enable row level security;
alter table beca_programa enable row level security;
alter table beca_incompatibilidad enable row level security;
alter table beca_area enable row level security;
alter table beca_asignacion enable row level security;
alter table beca_entrega enable row level security;
alter table beca_entrega_estado enable row level security;

-- estudiante: toda la organización lee, crea y edita; borrar (se lleva sus
-- becas en cascada) queda para administrador.

create policy "estudiante_select" on estudiante for select
  using (organizacion_id = mi_organizacion_id());
create policy "estudiante_insert" on estudiante for insert
  with check (organizacion_id = mi_organizacion_id());
create policy "estudiante_update" on estudiante for update
  using (organizacion_id = mi_organizacion_id())
  with check (organizacion_id = mi_organizacion_id());
create policy "estudiante_delete" on estudiante for delete
  using (organizacion_id = mi_organizacion_id() and mi_rol() = 'administrador');

-- beca_programa: lectura para todos, cambios solo administrador.

create policy "beca_programa_select" on beca_programa for select
  using (organizacion_id = mi_organizacion_id());
create policy "beca_programa_insert" on beca_programa for insert
  with check (organizacion_id = mi_organizacion_id() and mi_rol() = 'administrador');
create policy "beca_programa_update" on beca_programa for update
  using (organizacion_id = mi_organizacion_id() and mi_rol() = 'administrador')
  with check (organizacion_id = mi_organizacion_id());
create policy "beca_programa_delete" on beca_programa for delete
  using (organizacion_id = mi_organizacion_id() and mi_rol() = 'administrador');

-- beca_incompatibilidad: sin organizacion_id propio, se resuelve por los dos
-- programas (los dos tienen que ser de la organización de quien escribe).

create policy "beca_incompatibilidad_select" on beca_incompatibilidad for select
  using (
    exists (
      select 1 from beca_programa p
      where p.id = beca_incompatibilidad.programa_a
        and p.organizacion_id = mi_organizacion_id()
    )
  );
create policy "beca_incompatibilidad_insert" on beca_incompatibilidad for insert
  with check (
    mi_rol() = 'administrador'
    and exists (
      select 1 from beca_programa p
      where p.id = beca_incompatibilidad.programa_a
        and p.organizacion_id = mi_organizacion_id()
    )
    and exists (
      select 1 from beca_programa p
      where p.id = beca_incompatibilidad.programa_b
        and p.organizacion_id = mi_organizacion_id()
    )
  );
create policy "beca_incompatibilidad_delete" on beca_incompatibilidad for delete
  using (
    mi_rol() = 'administrador'
    and exists (
      select 1 from beca_programa p
      where p.id = beca_incompatibilidad.programa_a
        and p.organizacion_id = mi_organizacion_id()
    )
  );

-- beca_area y beca_asignacion: toda la organización.

create policy "beca_area_select" on beca_area for select
  using (organizacion_id = mi_organizacion_id());
create policy "beca_area_insert" on beca_area for insert
  with check (organizacion_id = mi_organizacion_id());
create policy "beca_area_update" on beca_area for update
  using (organizacion_id = mi_organizacion_id())
  with check (organizacion_id = mi_organizacion_id());
create policy "beca_area_delete" on beca_area for delete
  using (organizacion_id = mi_organizacion_id());

create policy "beca_asignacion_select" on beca_asignacion for select
  using (organizacion_id = mi_organizacion_id());
create policy "beca_asignacion_insert" on beca_asignacion for insert
  with check (organizacion_id = mi_organizacion_id());
create policy "beca_asignacion_update" on beca_asignacion for update
  using (organizacion_id = mi_organizacion_id())
  with check (organizacion_id = mi_organizacion_id());
create policy "beca_asignacion_delete" on beca_asignacion for delete
  using (organizacion_id = mi_organizacion_id());

-- beca_entrega: qué se pide es configuración (administrador); todos leen.

create policy "beca_entrega_select" on beca_entrega for select
  using (organizacion_id = mi_organizacion_id());
create policy "beca_entrega_insert" on beca_entrega for insert
  with check (organizacion_id = mi_organizacion_id() and mi_rol() = 'administrador');
create policy "beca_entrega_update" on beca_entrega for update
  using (organizacion_id = mi_organizacion_id() and mi_rol() = 'administrador')
  with check (organizacion_id = mi_organizacion_id());
create policy "beca_entrega_delete" on beca_entrega for delete
  using (organizacion_id = mi_organizacion_id() and mi_rol() = 'administrador');

-- beca_entrega_estado: marcar recibida/observada es trabajo de todo el
-- equipo. Se verifica por la asignación (y, al escribir, que la entrega sea
-- de la misma organización).

create policy "beca_entrega_estado_select" on beca_entrega_estado for select
  using (
    exists (
      select 1 from beca_asignacion a
      where a.id = beca_entrega_estado.asignacion_id
        and a.organizacion_id = mi_organizacion_id()
    )
  );
create policy "beca_entrega_estado_insert" on beca_entrega_estado for insert
  with check (
    exists (
      select 1 from beca_asignacion a
      where a.id = beca_entrega_estado.asignacion_id
        and a.organizacion_id = mi_organizacion_id()
    )
    and exists (
      select 1 from beca_entrega e
      where e.id = beca_entrega_estado.entrega_id
        and e.organizacion_id = mi_organizacion_id()
    )
  );
create policy "beca_entrega_estado_update" on beca_entrega_estado for update
  using (
    exists (
      select 1 from beca_asignacion a
      where a.id = beca_entrega_estado.asignacion_id
        and a.organizacion_id = mi_organizacion_id()
    )
  )
  with check (
    exists (
      select 1 from beca_asignacion a
      where a.id = beca_entrega_estado.asignacion_id
        and a.organizacion_id = mi_organizacion_id()
    )
  );
create policy "beca_entrega_estado_delete" on beca_entrega_estado for delete
  using (
    exists (
      select 1 from beca_asignacion a
      where a.id = beca_entrega_estado.asignacion_id
        and a.organizacion_id = mi_organizacion_id()
    )
  );

grant select, insert, update, delete on estudiante to sae_app;
grant select, insert, update, delete on beca_programa to sae_app;
grant select, insert, delete on beca_incompatibilidad to sae_app;
grant select, insert, update, delete on beca_area to sae_app;
grant select, insert, update, delete on beca_asignacion to sae_app;
grant select, insert, update, delete on beca_entrega to sae_app;
grant select, insert, update, delete on beca_entrega_estado to sae_app;
