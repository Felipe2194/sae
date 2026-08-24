-- La bitácora diaria nació pensada como registro personal, así que su
-- policy de SELECT solo dejaba ver la propia salvo que fueras coordinador o
-- administrador. Pero el uso real del equipo es justo lo contrario: el
-- turno de la mañana carga qué hizo y qué quedó pendiente para que el
-- turno de la tarde lo lea acá en vez de por WhatsApp — para eso cualquier
-- miembro necesita poder leer la bitácora de sus compañeros, no solo la
-- propia. Insert/update/delete no cambian: cada quien sigue editando solo
-- la suya.

drop policy "bitacora_select" on bitacora_diaria;

create policy "bitacora_select"
  on bitacora_diaria for select
  using (organizacion_id = mi_organizacion_id());
