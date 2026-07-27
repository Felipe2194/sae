-- M0.3: Seguridad multi-organización — rol de aplicación, GRANTs y políticas RLS.
--
-- Estrategia:
--   - El rol `sae_app` representa a la aplicación Next.js. No puede hacer login
--     directamente; el superuser conectado hace SET LOCAL ROLE sae_app en cada
--     transacción de usuario, lo que somete esa transacción a RLS.
--   - Cada transacción de usuario también hace set_config('app.user_id', uuid, true)
--     para que las funciones helper puedan identificar al usuario activo.
--   - El superuser (migrations, seed, acciones admin) accede sin SET ROLE y
--     esquiva RLS de forma natural (no es el propietario de las tablas desde la
--     perspectiva de RLS porque las tablas son propiedad de postgres, pero el
--     superuser las esquiva igual).

-- === Rol de aplicación =======================================================

do $$ begin
  create role sae_app nologin noinherit;
exception when duplicate_object then
  raise notice 'El rol sae_app ya existe';
end $$;

grant usage on schema public to sae_app;
grant select, insert, update, delete on all tables in schema public to sae_app;
grant usage, select on all sequences in schema public to sae_app;

-- === Funciones helper ========================================================
-- SECURITY DEFINER para que puedan consultar `usuario` sin recursión RLS.

create or replace function mi_usuario_id()
returns uuid
stable language sql as $$
  select nullif(current_setting('app.user_id', true), '')::uuid;
$$;

create or replace function mi_organizacion_id()
returns uuid
stable language sql security definer as $$
  select organizacion_id from usuario where id = mi_usuario_id();
$$;

create or replace function mi_rol()
returns rol_usuario
stable language sql security definer as $$
  select rol from usuario where id = mi_usuario_id();
$$;

-- === Activar RLS en las 9 tablas ============================================

alter table organizacion    enable row level security;
alter table usuario         enable row level security;
alter table area            enable row level security;
alter table tarea           enable row level security;
alter table comentario      enable row level security;
alter table adjunto         enable row level security;
alter table acceso_rapido   enable row level security;
alter table turno           enable row level security;
alter table bitacora_diaria enable row level security;

-- === Políticas: organizacion =================================================
-- Solo se ve la propia organización. La creación de orgs es tarea del superuser.

create policy "organizacion_select"
  on organizacion for select
  using (id = mi_organizacion_id());

-- === Políticas: usuario ======================================================
-- SELECT: todos los de la misma org (para asignar responsables, ver perfiles).
-- INSERT: solo superuser (registro pendiente → el Server Action lo hace sin SET ROLE).
-- UPDATE: uno mismo o un administrador de la org.
-- DELETE: solo administrador.

create policy "usuario_select"
  on usuario for select
  using (organizacion_id = mi_organizacion_id());

create policy "usuario_update_propio"
  on usuario for update
  using (
    id = mi_usuario_id()
    or (organizacion_id = mi_organizacion_id() and mi_rol() = 'administrador')
  )
  with check (
    id = mi_usuario_id()
    or (organizacion_id = mi_organizacion_id() and mi_rol() = 'administrador')
  );

create policy "usuario_delete"
  on usuario for delete
  using (organizacion_id = mi_organizacion_id() and mi_rol() = 'administrador');

-- === Políticas: area =========================================================

create policy "area_select"
  on area for select
  using (organizacion_id = mi_organizacion_id());

create policy "area_insert"
  on area for insert
  with check (
    organizacion_id = mi_organizacion_id()
    and mi_rol() in ('coordinador', 'administrador')
  );

create policy "area_update"
  on area for update
  using (
    organizacion_id = mi_organizacion_id()
    and mi_rol() in ('coordinador', 'administrador')
  )
  with check (
    organizacion_id = mi_organizacion_id()
    and mi_rol() in ('coordinador', 'administrador')
  );

create policy "area_delete"
  on area for delete
  using (organizacion_id = mi_organizacion_id() and mi_rol() = 'administrador');

-- === Políticas: tarea ========================================================

create policy "tarea_select"
  on tarea for select
  using (organizacion_id = mi_organizacion_id());

create policy "tarea_insert"
  on tarea for insert
  with check (
    organizacion_id = mi_organizacion_id()
    and creada_por = mi_usuario_id()
  );

create policy "tarea_update"
  on tarea for update
  using (
    organizacion_id = mi_organizacion_id()
    and (
      responsable_id = mi_usuario_id()
      or creada_por = mi_usuario_id()
      or mi_rol() in ('coordinador', 'administrador')
    )
  )
  with check (organizacion_id = mi_organizacion_id());

create policy "tarea_delete"
  on tarea for delete
  using (
    organizacion_id = mi_organizacion_id()
    and (
      creada_por = mi_usuario_id()
      or mi_rol() in ('coordinador', 'administrador')
    )
  );

-- === Políticas: comentario ===================================================
-- Sin organizacion_id propio: se verifica vía la tarea padre.

create policy "comentario_select"
  on comentario for select
  using (
    exists (
      select 1 from tarea
      where tarea.id = comentario.tarea_id
        and tarea.organizacion_id = mi_organizacion_id()
    )
  );

create policy "comentario_insert"
  on comentario for insert
  with check (
    autor_id = mi_usuario_id()
    and exists (
      select 1 from tarea
      where tarea.id = tarea_id
        and tarea.organizacion_id = mi_organizacion_id()
    )
  );

create policy "comentario_update"
  on comentario for update
  using (autor_id = mi_usuario_id())
  with check (autor_id = mi_usuario_id());

create policy "comentario_delete"
  on comentario for delete
  using (
    autor_id = mi_usuario_id()
    or mi_rol() in ('coordinador', 'administrador')
  );

-- === Políticas: adjunto ======================================================

create policy "adjunto_select"
  on adjunto for select
  using (
    exists (
      select 1 from tarea
      where tarea.id = adjunto.tarea_id
        and tarea.organizacion_id = mi_organizacion_id()
    )
  );

create policy "adjunto_insert"
  on adjunto for insert
  with check (
    subido_por = mi_usuario_id()
    and exists (
      select 1 from tarea
      where tarea.id = tarea_id
        and tarea.organizacion_id = mi_organizacion_id()
    )
  );

create policy "adjunto_update"
  on adjunto for update
  using (subido_por = mi_usuario_id())
  with check (subido_por = mi_usuario_id());

create policy "adjunto_delete"
  on adjunto for delete
  using (
    subido_por = mi_usuario_id()
    or mi_rol() in ('coordinador', 'administrador')
  );

-- === Políticas: acceso_rapido ================================================

create policy "acceso_rapido_select"
  on acceso_rapido for select
  using (organizacion_id = mi_organizacion_id());

create policy "acceso_rapido_insert"
  on acceso_rapido for insert
  with check (
    organizacion_id = mi_organizacion_id()
    and mi_rol() in ('coordinador', 'administrador')
  );

create policy "acceso_rapido_update"
  on acceso_rapido for update
  using (
    organizacion_id = mi_organizacion_id()
    and mi_rol() in ('coordinador', 'administrador')
  )
  with check (
    organizacion_id = mi_organizacion_id()
    and mi_rol() in ('coordinador', 'administrador')
  );

create policy "acceso_rapido_delete"
  on acceso_rapido for delete
  using (
    organizacion_id = mi_organizacion_id()
    and mi_rol() in ('coordinador', 'administrador')
  );

-- === Políticas: turno ========================================================

create policy "turno_select"
  on turno for select
  using (organizacion_id = mi_organizacion_id());

create policy "turno_insert"
  on turno for insert
  with check (
    organizacion_id = mi_organizacion_id()
    and mi_rol() in ('coordinador', 'administrador')
  );

create policy "turno_update"
  on turno for update
  using (
    organizacion_id = mi_organizacion_id()
    and mi_rol() in ('coordinador', 'administrador')
  )
  with check (
    organizacion_id = mi_organizacion_id()
    and mi_rol() in ('coordinador', 'administrador')
  );

create policy "turno_delete"
  on turno for delete
  using (
    organizacion_id = mi_organizacion_id()
    and mi_rol() in ('coordinador', 'administrador')
  );

-- === Políticas: bitacora_diaria ==============================================
-- Cada usuario ve su propia bitácora; coordinadores y admins ven toda la org.

create policy "bitacora_select"
  on bitacora_diaria for select
  using (
    organizacion_id = mi_organizacion_id()
    and (
      usuario_id = mi_usuario_id()
      or mi_rol() in ('coordinador', 'administrador')
    )
  );

create policy "bitacora_insert"
  on bitacora_diaria for insert
  with check (
    organizacion_id = mi_organizacion_id()
    and usuario_id = mi_usuario_id()
  );

create policy "bitacora_update"
  on bitacora_diaria for update
  using (
    organizacion_id = mi_organizacion_id()
    and usuario_id = mi_usuario_id()
  )
  with check (
    organizacion_id = mi_organizacion_id()
    and usuario_id = mi_usuario_id()
  );

create policy "bitacora_delete"
  on bitacora_diaria for delete
  using (
    organizacion_id = mi_organizacion_id()
    and (
      usuario_id = mi_usuario_id()
      or mi_rol() = 'administrador'
    )
  );
