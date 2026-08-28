-- Módulo "Visitas a colegios": portado desde el Google Sheet que usaba SAE
-- (macro de Apps Script) a una funcionalidad propia de la app. Alcance de
-- esta primera etapa: visitas + directorio de colegios/contactos + sync a
-- Google Calendar + presencia del equipo. Viajes y Eventos y el calendario
-- académico (feriados/exámenes) quedan para una etapa posterior.
--
-- No hay tabla de "histórico" como en el Sheet: el año se filtra con
-- extract(year from fecha) sobre visita_colegio directamente, así que no
-- hace falta mover filas a fin de año.

create type tipo_visita as enum (
  'visita_colegio',
  'nos_visitan',
  'feria_expo',
  'charla_taller',
  'virtual',
  'otro'
);

create type estado_visita as enum (
  'pendiente',
  'confirmado',
  'realizado',
  'cancelado',
  'reprogramado'
);

create type estado_relacion_colegio as enum ('nuevo', 'activo', 'inactivo');

-- === colegio ==================================================================
-- Directorio permanente de colegios/instituciones con las que el equipo tuvo
-- contacto. contacto_* son los datos "titulares" del colegio (se actualizan a
-- mano o copiando desde una visita puntual, ver guardarContactoColegio en
-- app/(app)/visitas/actions.ts) — no confundir con el contacto propio de cada
-- visita en visita_colegio, que puede ser otra persona.

create table colegio (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizacion (id),
  nombre text not null,
  ciudad text,
  zona text,
  contacto_nombre text,
  contacto_cargo text,
  contacto_email text,
  contacto_telefono text,
  estado_relacion estado_relacion_colegio not null default 'nuevo',
  creado_en timestamptz not null default now()
);

create index colegio_organizacion_id_idx on colegio (organizacion_id);

-- === visita_colegio ===========================================================

create table visita_colegio (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizacion (id),
  colegio_id uuid not null references colegio (id),
  fecha date not null,
  hora_inicio time,
  hora_fin time,
  tipo tipo_visita not null,
  estado estado_visita not null default 'pendiente',
  cant_alumnos integer,
  contacto_nombre text,
  contacto_cargo text,
  contacto_email text,
  contacto_telefono text,
  observaciones text,
  asignado_por_id uuid references usuario (id),
  google_event_id text,
  creada_por uuid not null references usuario (id),
  creada_en timestamptz not null default now()
);

create index visita_colegio_organizacion_id_idx on visita_colegio (organizacion_id);
create index visita_colegio_colegio_id_idx on visita_colegio (colegio_id);
create index visita_colegio_fecha_idx on visita_colegio (fecha);

-- === visita_integrante ========================================================
-- Quiénes del equipo participaron de la visita (multi-select). Mismo patrón
-- que tarea_asignado (migración 016).

create table visita_integrante (
  visita_id uuid not null references visita_colegio (id) on delete cascade,
  usuario_id uuid not null references usuario (id) on delete cascade,
  primary key (visita_id, usuario_id)
);

create index visita_integrante_usuario_id_idx on visita_integrante (usuario_id);

-- === RLS ======================================================================

alter table colegio enable row level security;
alter table visita_colegio enable row level security;
alter table visita_integrante enable row level security;

-- colegio: recurso compartido del equipo, cualquiera de la org lo puede crear
-- o editar (se auto-registra al cargar una visita con un colegio nuevo).
-- Borrar sí queda para administrador, por si hay que limpiar duplicados.

create policy "colegio_select"
  on colegio for select
  using (organizacion_id = mi_organizacion_id());

create policy "colegio_insert"
  on colegio for insert
  with check (organizacion_id = mi_organizacion_id());

create policy "colegio_update"
  on colegio for update
  using (organizacion_id = mi_organizacion_id())
  with check (organizacion_id = mi_organizacion_id());

create policy "colegio_delete"
  on colegio for delete
  using (organizacion_id = mi_organizacion_id() and mi_rol() = 'administrador');

-- visita_colegio: mismo criterio que tarea (select por org; insert propio;
-- update/delete por quien la creó, un integrante asignado o administrador).

create policy "visita_colegio_select"
  on visita_colegio for select
  using (organizacion_id = mi_organizacion_id());

create policy "visita_colegio_insert"
  on visita_colegio for insert
  with check (
    organizacion_id = mi_organizacion_id()
    and creada_por = mi_usuario_id()
  );

create policy "visita_colegio_update"
  on visita_colegio for update
  using (
    organizacion_id = mi_organizacion_id()
    and (
      creada_por = mi_usuario_id()
      or mi_rol() = 'administrador'
      or exists (
        select 1 from visita_integrante vi
        where vi.visita_id = visita_colegio.id and vi.usuario_id = mi_usuario_id()
      )
    )
  )
  with check (organizacion_id = mi_organizacion_id());

create policy "visita_colegio_delete"
  on visita_colegio for delete
  using (
    organizacion_id = mi_organizacion_id()
    and (creada_por = mi_usuario_id() or mi_rol() = 'administrador')
  );

-- visita_integrante: mismo criterio que tarea_asignado.

create policy "visita_integrante_select"
  on visita_integrante for select
  using (
    exists (
      select 1 from visita_colegio
      where visita_colegio.id = visita_integrante.visita_id
        and visita_colegio.organizacion_id = mi_organizacion_id()
    )
  );

create policy "visita_integrante_insert"
  on visita_integrante for insert
  with check (
    exists (
      select 1 from visita_colegio
      where visita_colegio.id = visita_integrante.visita_id
        and visita_colegio.organizacion_id = mi_organizacion_id()
        and (
          visita_colegio.creada_por = mi_usuario_id()
          or mi_rol() = 'administrador'
        )
    )
  );

create policy "visita_integrante_delete"
  on visita_integrante for delete
  using (
    exists (
      select 1 from visita_colegio
      where visita_colegio.id = visita_integrante.visita_id
        and visita_colegio.organizacion_id = mi_organizacion_id()
        and (
          visita_colegio.creada_por = mi_usuario_id()
          or mi_rol() = 'administrador'
        )
    )
  );

grant select, insert, update, delete on colegio to sae_app;
grant select, insert, update, delete on visita_colegio to sae_app;
grant select, insert, delete on visita_integrante to sae_app;
