-- M1.3: Bitácora por área — notas tipificadas del equipo

create type tipo_nota_area as enum ('nota', 'idea', 'actividad', 'progreso');

create table nota_area (
  id         uuid             primary key default gen_random_uuid(),
  area_id    uuid             not null references area(id) on delete cascade,
  autor_id   uuid             not null references usuario(id) on delete cascade,
  contenido  text             not null check (char_length(contenido) > 0),
  tipo       tipo_nota_area   not null default 'nota',
  creada_en  timestamptz      not null default now()
);

create index nota_area_area_fecha_idx on nota_area (area_id, creada_en desc);

-- RLS ──────────────────────────────────────────────────────────────────────────

alter table nota_area enable row level security;

-- Leer: cualquier miembro de la organización ve las notas de sus áreas
create policy "nota_area_select" on nota_area
  for select using (
    area_id in (
      select id from area where organizacion_id = mi_organizacion_id()
    )
  );

-- Insertar: el autor debe ser el usuario activo y el área de su org
create policy "nota_area_insert" on nota_area
  for insert with check (
    autor_id = mi_usuario_id()
    and area_id in (
      select id from area where organizacion_id = mi_organizacion_id()
    )
  );

-- Borrar: el propio autor o un coord/admin puede eliminar
create policy "nota_area_delete" on nota_area
  for delete using (
    autor_id = mi_usuario_id()
    or mi_rol() in ('coordinador', 'administrador')
  );

-- Permisos al rol de aplicación
grant select, insert, delete on nota_area to sae_app;
