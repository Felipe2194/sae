-- Módulo "Viajes": organización de viajes a empresas/congresos (inscripción
-- pública, equipo organizador, costos, pagos con comprobante). Reemplaza el
-- combo actual de Google Form + Excel de inscriptos + Excel de pagos +
-- carpeta de comprobantes + nota a mano a cooperadora. Ya estaba anotado
-- como pendiente en el comentario de 030_visitas_colegios.sql.
--
-- Decisiones de diseño (charladas con el usuario, no reabrir sin motivo):
-- - Cualquier miembro puede crear/editar un viaje (mismo criterio que
--   visita_colegio, no como area que es admin-only).
-- - Los datos de inscriptos (DNI, contacto) son visibles para toda la
--   organización, no solo para quien organiza ese viaje puntual (mismo
--   criterio que visita_colegio/colegio).
-- - La inscripción pública (sin sesión) NUNCA pasa por RLS: se resuelve con
--   el cliente `sql` (superuser) desde la server action, igual que el
--   registro de usuarios en app/(auth)/registro/actions.ts. Por eso
--   viaje_integrante no tiene una policy de INSERT "abierta" — la ruta
--   pública bypassea RLS estructuralmente, igual que usuario.
-- - Los costos (transporte, alojamiento, etc.) arrancan como tareas del
--   tablero (tarea.viaje_id) y se "fijan" como viaje_costo al cerrarse —
--   viaje_costo.tarea_id queda como trazabilidad, no como obligación (se
--   puede cargar un costo sin que haya existido como tarea).
-- - viaje.precio es el precio único del viaje; viaje_integrante.monto_a_pagar
--   es un snapshot al momento de inscribirse (copiado en la action, no con
--   un default de SQL) para no correr montos ya confirmados si el precio del
--   viaje cambia después, y queda editable por persona (becas/descuentos).

create type estado_viaje as enum (
  'borrador',
  'inscripciones_abiertas',
  'inscripciones_cerradas',
  'realizado',
  'cancelado'
);

create type estado_integrante_viaje as enum (
  'pendiente',
  'confirmado',
  'lista_espera',
  'rechazado',
  'cancelado'
);

-- === viaje ====================================================================

create table viaje (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizacion (id),
  nombre text not null,
  destino text not null,
  fecha_inicio date not null,
  fecha_fin date,
  cupo_maximo integer,
  precio numeric,
  estado estado_viaje not null default 'borrador',
  codigo_publico text not null unique,
  descripcion_publica text,
  info_participantes text,
  creada_por uuid not null references usuario (id),
  creada_en timestamptz not null default now()
);

create index viaje_organizacion_id_idx on viaje (organizacion_id);

-- === viaje_integrante =========================================================
-- Inscriptos externos (estudiantes), no son usuarios del sistema — no hay FK
-- a usuario. unique(viaje_id, dni) evita doble inscripción con el mismo DNI
-- (la action atrapa el error 23505 y devuelve un mensaje amigable).

create table viaje_integrante (
  id uuid primary key default gen_random_uuid(),
  viaje_id uuid not null references viaje (id) on delete cascade,
  nombre text not null,
  apellido text not null,
  dni text not null,
  legajo text,
  carrera text,
  anio_cursada text,
  email text,
  telefono text,
  estado estado_integrante_viaje not null default 'pendiente',
  monto_a_pagar numeric,
  notas_internas text,
  creado_en timestamptz not null default now(),
  unique (viaje_id, dni)
);

create index viaje_integrante_viaje_id_idx on viaje_integrante (viaje_id);

-- === viaje_asignado ============================================================
-- Equipo organizador interno. Mismo patrón que area_asignado/visita_integrante
-- (016/030): delete-all + reinsert-all desde la action, sin diffing.

create table viaje_asignado (
  viaje_id uuid not null references viaje (id) on delete cascade,
  usuario_id uuid not null references usuario (id) on delete cascade,
  asignado_en timestamptz not null default now(),
  primary key (viaje_id, usuario_id)
);

create index viaje_asignado_usuario_id_idx on viaje_asignado (usuario_id);

-- === viaje_costo ===============================================================
-- Costo fijado (transporte, alojamiento, inscripción). tarea_id es nullable:
-- normalmente viene de "fijar" una tarea de costeo, pero se puede cargar un
-- costo directo sin haber pasado por el tablero.

create table viaje_costo (
  id uuid primary key default gen_random_uuid(),
  viaje_id uuid not null references viaje (id) on delete cascade,
  concepto text not null,
  monto numeric not null,
  tarea_id uuid references tarea (id),
  fijado_por uuid not null references usuario (id),
  fijado_en timestamptz not null default now()
);

create index viaje_costo_viaje_id_idx on viaje_costo (viaje_id);

-- === viaje_pago ================================================================
-- Un pago de un inscripto, con comprobante (upload real vía Vercel Blob,
-- no un link pegado a mano). Sin organizacion_id propio: se verifica vía
-- join a viaje_integrante -> viaje, mismo criterio que comentario/adjunto.

create table viaje_pago (
  id uuid primary key default gen_random_uuid(),
  viaje_integrante_id uuid not null references viaje_integrante (id) on delete cascade,
  monto numeric not null,
  medio_pago text,
  fecha_pago date not null default current_date,
  comprobante_url text,
  registrado_por uuid not null references usuario (id),
  creado_en timestamptz not null default now()
);

create index viaje_pago_viaje_integrante_id_idx on viaje_pago (viaje_integrante_id);

-- === columnas nuevas en tablas existentes ====================================

-- Costos-como-tareas: paralelo a tarea.area_id, nullable, sin efecto en RLS
-- de tarea (que nunca usó area_id para autorización, ver 026_proyectos.sql).
alter table tarea add column viaje_id uuid references viaje (id);
create index tarea_viaje_id_idx on tarea (viaje_id);

-- Documentos del viaje (cronograma PDF, notas): se reusa acceso_rapido en vez
-- de crear viaje_documento, mismo criterio que proyectos con area_id.
alter table acceso_rapido add column viaje_id uuid references viaje (id);
create index acceso_rapido_viaje_id_idx on acceso_rapido (viaje_id);

alter table organizacion add column viajes_habilitado boolean not null default true;

-- === RLS ======================================================================

alter table viaje enable row level security;
alter table viaje_integrante enable row level security;
alter table viaje_asignado enable row level security;
alter table viaje_costo enable row level security;
alter table viaje_pago enable row level security;

-- viaje: cualquiera de la org lo ve y lo crea; editar/borrar queda para quien
-- lo creó, el equipo asignado, o administrador. Mismo criterio que
-- visita_colegio, no como area (que es admin-only).

create policy "viaje_select"
  on viaje for select
  using (organizacion_id = mi_organizacion_id());

create policy "viaje_insert"
  on viaje for insert
  with check (
    organizacion_id = mi_organizacion_id()
    and creada_por = mi_usuario_id()
  );

create policy "viaje_update"
  on viaje for update
  using (
    organizacion_id = mi_organizacion_id()
    and (
      creada_por = mi_usuario_id()
      or mi_rol() = 'administrador'
      or exists (
        select 1 from viaje_asignado va
        where va.viaje_id = viaje.id and va.usuario_id = mi_usuario_id()
      )
    )
  )
  with check (organizacion_id = mi_organizacion_id());

create policy "viaje_delete"
  on viaje for delete
  using (
    organizacion_id = mi_organizacion_id()
    and (creada_por = mi_usuario_id() or mi_rol() = 'administrador')
  );

-- viaje_asignado: select org-wide vía join; insert/delete solo quien creó el
-- viaje o administrador (arma el equipo desde el diálogo de edición).

create policy "viaje_asignado_select"
  on viaje_asignado for select
  using (
    exists (
      select 1 from viaje
      where viaje.id = viaje_asignado.viaje_id
        and viaje.organizacion_id = mi_organizacion_id()
    )
  );

create policy "viaje_asignado_insert"
  on viaje_asignado for insert
  with check (
    exists (
      select 1 from viaje
      where viaje.id = viaje_asignado.viaje_id
        and viaje.organizacion_id = mi_organizacion_id()
        and (viaje.creada_por = mi_usuario_id() or mi_rol() = 'administrador')
    )
  );

create policy "viaje_asignado_delete"
  on viaje_asignado for delete
  using (
    exists (
      select 1 from viaje
      where viaje.id = viaje_asignado.viaje_id
        and viaje.organizacion_id = mi_organizacion_id()
        and (viaje.creada_por = mi_usuario_id() or mi_rol() = 'administrador')
    )
  );

-- viaje_integrante: select org-wide (decisión explícita: los datos de
-- inscriptos no quedan acotados a quien organiza ese viaje puntual).
-- insert/update/delete autenticados quedan para creador/asignado/admin —
-- la inscripción pública no usa esta policy, inserta con `sql` directo
-- (superuser), sin pasar por sae_app.

create policy "viaje_integrante_select"
  on viaje_integrante for select
  using (
    exists (
      select 1 from viaje
      where viaje.id = viaje_integrante.viaje_id
        and viaje.organizacion_id = mi_organizacion_id()
    )
  );

create policy "viaje_integrante_insert"
  on viaje_integrante for insert
  with check (
    exists (
      select 1 from viaje
      where viaje.id = viaje_integrante.viaje_id
        and viaje.organizacion_id = mi_organizacion_id()
        and (
          viaje.creada_por = mi_usuario_id()
          or mi_rol() = 'administrador'
          or exists (
            select 1 from viaje_asignado va
            where va.viaje_id = viaje.id and va.usuario_id = mi_usuario_id()
          )
        )
    )
  );

create policy "viaje_integrante_update"
  on viaje_integrante for update
  using (
    exists (
      select 1 from viaje
      where viaje.id = viaje_integrante.viaje_id
        and viaje.organizacion_id = mi_organizacion_id()
        and (
          viaje.creada_por = mi_usuario_id()
          or mi_rol() = 'administrador'
          or exists (
            select 1 from viaje_asignado va
            where va.viaje_id = viaje.id and va.usuario_id = mi_usuario_id()
          )
        )
    )
  )
  with check (
    exists (
      select 1 from viaje
      where viaje.id = viaje_integrante.viaje_id
        and viaje.organizacion_id = mi_organizacion_id()
    )
  );

create policy "viaje_integrante_delete"
  on viaje_integrante for delete
  using (
    exists (
      select 1 from viaje
      where viaje.id = viaje_integrante.viaje_id
        and viaje.organizacion_id = mi_organizacion_id()
        and (
          viaje.creada_por = mi_usuario_id()
          or mi_rol() = 'administrador'
          or exists (
            select 1 from viaje_asignado va
            where va.viaje_id = viaje.id and va.usuario_id = mi_usuario_id()
          )
        )
    )
  );

-- viaje_costo: select org-wide (menos sensible que datos de inscriptos,
-- mismo nivel que tarea); mutación acotada a creador/asignado/admin.

create policy "viaje_costo_select"
  on viaje_costo for select
  using (
    exists (
      select 1 from viaje
      where viaje.id = viaje_costo.viaje_id
        and viaje.organizacion_id = mi_organizacion_id()
    )
  );

create policy "viaje_costo_insert"
  on viaje_costo for insert
  with check (
    exists (
      select 1 from viaje
      where viaje.id = viaje_costo.viaje_id
        and viaje.organizacion_id = mi_organizacion_id()
        and (
          viaje.creada_por = mi_usuario_id()
          or mi_rol() = 'administrador'
          or exists (
            select 1 from viaje_asignado va
            where va.viaje_id = viaje.id and va.usuario_id = mi_usuario_id()
          )
        )
    )
  );

create policy "viaje_costo_delete"
  on viaje_costo for delete
  using (
    exists (
      select 1 from viaje
      where viaje.id = viaje_costo.viaje_id
        and viaje.organizacion_id = mi_organizacion_id()
        and (
          viaje.creada_por = mi_usuario_id()
          or mi_rol() = 'administrador'
          or exists (
            select 1 from viaje_asignado va
            where va.viaje_id = viaje.id and va.usuario_id = mi_usuario_id()
          )
        )
    )
  );

-- viaje_pago: select org-wide vía join (consistente con viaje_costo);
-- mutación acotada a creador/asignado/admin del viaje.

create policy "viaje_pago_select"
  on viaje_pago for select
  using (
    exists (
      select 1 from viaje_integrante vi
      join viaje on viaje.id = vi.viaje_id
      where vi.id = viaje_pago.viaje_integrante_id
        and viaje.organizacion_id = mi_organizacion_id()
    )
  );

create policy "viaje_pago_insert"
  on viaje_pago for insert
  with check (
    exists (
      select 1 from viaje_integrante vi
      join viaje on viaje.id = vi.viaje_id
      where vi.id = viaje_pago.viaje_integrante_id
        and viaje.organizacion_id = mi_organizacion_id()
        and (
          viaje.creada_por = mi_usuario_id()
          or mi_rol() = 'administrador'
          or exists (
            select 1 from viaje_asignado va
            where va.viaje_id = viaje.id and va.usuario_id = mi_usuario_id()
          )
        )
    )
  );

create policy "viaje_pago_delete"
  on viaje_pago for delete
  using (
    exists (
      select 1 from viaje_integrante vi
      join viaje on viaje.id = vi.viaje_id
      where vi.id = viaje_pago.viaje_integrante_id
        and viaje.organizacion_id = mi_organizacion_id()
        and (
          viaje.creada_por = mi_usuario_id()
          or mi_rol() = 'administrador'
          or exists (
            select 1 from viaje_asignado va
            where va.viaje_id = viaje.id and va.usuario_id = mi_usuario_id()
          )
        )
    )
  );

grant select, insert, update, delete on viaje to sae_app;
grant select, insert, update, delete on viaje_integrante to sae_app;
grant select, insert, delete on viaje_asignado to sae_app;
grant select, insert, delete on viaje_costo to sae_app;
grant select, insert, delete on viaje_pago to sae_app;
