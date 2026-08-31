-- acceso_rapido_insert/update/delete (002_rls.sql) exigían
-- mi_rol() in ('coordinador', 'administrador') — la rama 'coordinador' quedó
-- muerta desde 025_sin_coordinador.sql, así que en la práctica es admin-only.
-- Eso funciona para los accesos de /configuracion y de Proyectos (donde
-- "administrador arma la lista" es el criterio elegido), pero rompe Viajes:
-- ahí cualquier miembro puede crear un viaje y gestionarlo (ver 038_viajes.sql),
-- así que también tiene que poder cargar sus documentos sin ser admin.
--
-- Se redefinen las tres policies sumando una rama para filas con viaje_id: el
-- creador o un asignado de ESE viaje puede gestionarlas, sin tocar el
-- criterio admin-only existente para el resto de los accesos rápidos
-- (área/organización, viaje_id null).

drop policy "acceso_rapido_insert" on acceso_rapido;
create policy "acceso_rapido_insert"
  on acceso_rapido for insert
  with check (
    organizacion_id = mi_organizacion_id()
    and (
      mi_rol() in ('coordinador', 'administrador')
      or (
        viaje_id is not null
        and exists (
          select 1 from viaje v
          where v.id = acceso_rapido.viaje_id
            and (
              v.creada_por = mi_usuario_id()
              or exists (
                select 1 from viaje_asignado va
                where va.viaje_id = v.id and va.usuario_id = mi_usuario_id()
              )
            )
        )
      )
    )
  );

drop policy "acceso_rapido_update" on acceso_rapido;
create policy "acceso_rapido_update"
  on acceso_rapido for update
  using (
    organizacion_id = mi_organizacion_id()
    and (
      mi_rol() in ('coordinador', 'administrador')
      or (
        viaje_id is not null
        and exists (
          select 1 from viaje v
          where v.id = acceso_rapido.viaje_id
            and (
              v.creada_por = mi_usuario_id()
              or exists (
                select 1 from viaje_asignado va
                where va.viaje_id = v.id and va.usuario_id = mi_usuario_id()
              )
            )
        )
      )
    )
  )
  with check (organizacion_id = mi_organizacion_id());

drop policy "acceso_rapido_delete" on acceso_rapido;
create policy "acceso_rapido_delete"
  on acceso_rapido for delete
  using (
    organizacion_id = mi_organizacion_id()
    and (
      mi_rol() in ('coordinador', 'administrador')
      or (
        viaje_id is not null
        and exists (
          select 1 from viaje v
          where v.id = acceso_rapido.viaje_id
            and (
              v.creada_por = mi_usuario_id()
              or exists (
                select 1 from viaje_asignado va
                where va.viaje_id = v.id and va.usuario_id = mi_usuario_id()
              )
            )
        )
      )
    )
  );
