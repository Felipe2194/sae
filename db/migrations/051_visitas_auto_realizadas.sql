-- Visitas que quedaron como Pendiente/Confirmado después de las 21:00 de su
-- día (fin de la franja de trabajo, ver FRANJAS_HORARIAS_TRABAJO en
-- app/(app)/visitas/tipos.ts) pasan solas a Realizado — para no olvidarse
-- nunca de confirmar que se fue. Si en realidad no se hizo, el equipo la
-- edita después y la pasa a Cancelada o Reprogramada. Una vez pasada a
-- Realizado no se vuelve a tocar, así que corregirla a mano es definitivo.
--
-- No hay cron: se llama al cargar /hoy, /visitas e /informes (lo que sea que
-- se abra primero), dentro de withUser — current_date/localtime salen en la
-- zona horaria de la organización. security definer porque la policy de
-- update de visita_colegio solo deja editar a quien la creó/participó o a un
-- admin, y esto tiene que valer para cualquier visita de la organización.
-- Queda en auditoría sin usuario (lo hizo el sistema, no una persona).

create or replace function marcar_visitas_realizadas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  cantidad integer;
begin
  with actualizadas as (
    update visita_colegio v
    set estado = 'realizado'
    from (
      select id, estado::text as estado_antes
      from visita_colegio
      where organizacion_id = mi_organizacion_id()
        and estado in ('pendiente', 'confirmado')
        -- Solo de acá en adelante: las visitas viejas importadas del Excel
        -- que quedaron Pendiente no se tocan (no se sabe si se hicieron, y
        -- pasarlas todas a Realizado inflaría Informes de golpe).
        and fecha >= date '2026-09-28'
        and (
          fecha < current_date
          or (fecha = current_date and localtime >= time '21:00')
        )
      for update
    ) previa
    where v.id = previa.id
    returning v.id, v.organizacion_id, v.colegio_id, previa.estado_antes
  ),
  auditadas as (
    insert into auditoria (
      organizacion_id, usuario_id, entidad, entidad_id, entidad_nombre,
      campo, valor_antes, valor_despues
    )
    select a.organizacion_id, null, 'visita', a.id, c.nombre,
      'estado', a.estado_antes, 'realizado'
    from actualizadas a
    join colegio c on c.id = a.colegio_id
    returning 1
  )
  select count(*) into cantidad from auditadas;
  return cantidad;
end;
$$;

grant execute on function marcar_visitas_realizadas() to sae_app;
