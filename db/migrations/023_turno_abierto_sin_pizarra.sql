-- Cronograma abierto a todos: cada usuario puede cargar/editar/borrar sus
-- propios turnos (antes era exclusivo de coordinador/administrador, que
-- seguían siendo cuello de botella para cambios de horario). Coordinador y
-- administrador conservan la gestión sobre los turnos de cualquiera, mismo
-- criterio que ya usa excepcion_turno (ausencias).

drop policy "turno_insert" on turno;
drop policy "turno_update" on turno;
drop policy "turno_delete" on turno;

create policy "turno_insert"
  on turno for insert
  with check (
    organizacion_id = mi_organizacion_id()
    and (usuario_id = mi_usuario_id() or mi_rol() in ('coordinador', 'administrador'))
  );

create policy "turno_update"
  on turno for update
  using (
    organizacion_id = mi_organizacion_id()
    and (usuario_id = mi_usuario_id() or mi_rol() in ('coordinador', 'administrador'))
  )
  with check (
    organizacion_id = mi_organizacion_id()
    and (usuario_id = mi_usuario_id() or mi_rol() in ('coordinador', 'administrador'))
  );

create policy "turno_delete"
  on turno for delete
  using (
    organizacion_id = mi_organizacion_id()
    and (usuario_id = mi_usuario_id() or mi_rol() in ('coordinador', 'administrador'))
  );

-- Pizarra: se saca del producto, no aportaba uso real.
drop table pizarra_nota;
