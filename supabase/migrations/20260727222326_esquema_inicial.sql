-- Esquema inicial: organizaciones, usuarios, areas, tareas y tablas asociadas.
-- Ver docs/planes_extraidos/especificacion-sistema-gestion-secretarias.md sección 5.

create extension if not exists "pgcrypto";

-- === Tipos enumerados =======================================================

create type rol_usuario as enum ('miembro', 'coordinador', 'administrador');
create type estado_usuario as enum ('pendiente', 'activo', 'inactivo');
create type estado_tarea as enum ('por_hacer', 'en_progreso', 'hecha');
create type prioridad_tarea as enum ('baja', 'media', 'alta');
create type tipo_adjunto as enum ('archivo', 'enlace');

-- === organizacion ============================================================

create table organizacion (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  slug text not null unique,
  logo_url text,
  zona_horaria text not null default 'America/Argentina/Cordoba',
  creada_en timestamptz not null default now()
);

-- === usuario (extiende auth.users) ==========================================

create table usuario (
  id uuid primary key references auth.users (id) on delete cascade,
  organizacion_id uuid not null references organizacion (id),
  nombre text not null,
  email text not null,
  avatar_url text,
  rol rol_usuario not null default 'miembro',
  estado estado_usuario not null default 'pendiente',
  creada_en timestamptz not null default now()
);

create index usuario_organizacion_id_idx on usuario (organizacion_id);
create index usuario_estado_idx on usuario (estado);

-- === area ====================================================================

create table area (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizacion (id),
  nombre text not null,
  color text not null,
  descripcion text,
  responsable_id uuid references usuario (id),
  activa boolean not null default true,
  creada_en timestamptz not null default now()
);

create index area_organizacion_id_idx on area (organizacion_id);
create index area_responsable_id_idx on area (responsable_id);

-- === tarea ===================================================================

create table tarea (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizacion (id),
  area_id uuid not null references area (id),
  titulo text not null,
  descripcion text,
  responsable_id uuid references usuario (id),
  estado estado_tarea not null default 'por_hacer',
  prioridad prioridad_tarea not null default 'media',
  fecha_vencimiento date,
  recurrencia jsonb,
  google_event_id text,
  creada_por uuid not null references usuario (id),
  creada_en timestamptz not null default now(),
  completada_en timestamptz,
  orden integer not null default 0
);

create index tarea_organizacion_id_idx on tarea (organizacion_id);
create index tarea_responsable_id_idx on tarea (responsable_id);
create index tarea_estado_idx on tarea (estado);
create index tarea_fecha_vencimiento_idx on tarea (fecha_vencimiento);
create index tarea_area_id_idx on tarea (area_id);

-- === comentario ==============================================================

create table comentario (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid not null references tarea (id) on delete cascade,
  autor_id uuid not null references usuario (id),
  contenido text not null,
  creado_en timestamptz not null default now()
);

create index comentario_tarea_id_idx on comentario (tarea_id);

-- === adjunto =================================================================

create table adjunto (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid not null references tarea (id) on delete cascade,
  nombre text not null,
  tipo tipo_adjunto not null,
  url text not null,
  subido_por uuid not null references usuario (id),
  creado_en timestamptz not null default now()
);

create index adjunto_tarea_id_idx on adjunto (tarea_id);

-- === acceso_rapido ============================================================

create table acceso_rapido (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizacion (id),
  area_id uuid references area (id),
  etiqueta text not null,
  url text not null,
  icono text,
  orden integer not null default 0
);

create index acceso_rapido_organizacion_id_idx on acceso_rapido (organizacion_id);
create index acceso_rapido_area_id_idx on acceso_rapido (area_id);

-- === turno (cronograma semanal) =============================================

create table turno (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizacion (id),
  usuario_id uuid not null references usuario (id),
  dia_semana smallint not null check (dia_semana between 0 and 6),
  hora_inicio time not null,
  hora_fin time not null,
  vigente_desde date not null default current_date,
  vigente_hasta date,
  check (hora_fin > hora_inicio),
  check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);

create index turno_organizacion_id_idx on turno (organizacion_id);
create index turno_usuario_id_idx on turno (usuario_id);

-- === bitacora_diaria ==========================================================

create table bitacora_diaria (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizacion (id),
  usuario_id uuid not null references usuario (id),
  fecha date not null default current_date,
  hecho text,
  pendiente text,
  observaciones text,
  creada_en timestamptz not null default now(),
  unique (usuario_id, fecha)
);

create index bitacora_diaria_organizacion_id_idx on bitacora_diaria (organizacion_id);

-- === Trigger: alta de usuario ================================================
-- Al crearse un usuario en auth.users se crea su fila en `usuario` con estado
-- 'pendiente'. La organización se toma de raw_user_meta_data (seteado por la
-- app al registrarse, ej. vía un link de invitación con el slug de la
-- organización); el nombre, del metadata o del email como fallback.

create function public.manejar_usuario_nuevo()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.usuario (id, organizacion_id, nombre, email)
  values (
    new.id,
    (new.raw_user_meta_data ->> 'organizacion_id')::uuid,
    coalesce(new.raw_user_meta_data ->> 'nombre', new.email),
    new.email
  );
  return new;
end;
$$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.manejar_usuario_nuevo();
