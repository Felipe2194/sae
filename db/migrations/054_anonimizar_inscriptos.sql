-- Retención de datos personales de inscriptos a viajes. Una vez pasado el
-- viaje, nombre, DNI, legajo, mail y teléfono de cada estudiante ya no hacen
-- falta para nada, pero quedaban guardados para siempre. Un administrador
-- puede ahora borrarlos desde la pestaña Inscriptos de un viaje realizado o
-- cancelado (botón manual, con confirmación: nada se borra solo).
--
-- No se eliminan las filas: se anonimizan. Así Informes y Costos siguen
-- contando cuánta gente viajó, de qué carrera y cuánto pagó, sin saber quién.
--   nombre/apellido -> "Inscripto N"      dni -> "borrado-N"
--   legajo, email, telefono, notas_internas -> null
--   viaje_pago.comprobante_url -> null
--   auditoria: el nombre que quedó registrado en cambios de estado -> "Inscripto N"
-- carrera, anio_cursada, estado, monto_a_pagar y los pagos se conservan.
--
-- Es irreversible (salvo restaurando un backup): conviene sacar antes el
-- reporte para la cooperadora, que es lo único que usa DNI y legajo.
--
-- security definer porque toca auditoria (sin policy de UPDATE para sae_app)
-- y tiene que valer para cualquier viaje de la organización; los permisos se
-- chequean adentro, con las mismas funciones que usan las policies.

alter table viaje_integrante add column anonimizado_en timestamptz;

create or replace function anonimizar_inscriptos_viaje(p_viaje_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viaje viaje%rowtype;
  cantidad integer;
begin
  select * into v_viaje
  from viaje
  where id = p_viaje_id and organizacion_id = mi_organizacion_id()
  for update;

  if not found then
    raise exception 'viaje inexistente o de otra organización';
  end if;
  if coalesce(mi_rol()::text, '') <> 'administrador' then
    raise exception 'solo un administrador puede borrar datos personales';
  end if;
  if v_viaje.estado not in ('realizado', 'cancelado') then
    raise exception 'el viaje tiene que estar realizado o cancelado';
  end if;

  -- El número sale del orden de inscripción sobre TODAS las filas del viaje
  -- (no solo las pendientes), para que sea estable si se corre dos veces.
  with numerados as (
    select id, row_number() over (order by creado_en, id) as n, anonimizado_en
    from viaje_integrante
    where viaje_id = p_viaje_id
  ),
  anonimizados as (
    update viaje_integrante vi
    set nombre = 'Inscripto',
        apellido = numerados.n::text,
        dni = 'borrado-' || numerados.n,
        legajo = null,
        email = null,
        telefono = null,
        notas_internas = null,
        anonimizado_en = now()
    from numerados
    where vi.id = numerados.id and numerados.anonimizado_en is null
    returning vi.id, numerados.n
  ),
  pagos as (
    update viaje_pago vp
    set comprobante_url = null
    from anonimizados a
    where vp.viaje_integrante_id = a.id and vp.comprobante_url is not null
    returning 1
  ),
  rastros as (
    update auditoria au
    set entidad_nombre = 'Inscripto ' || a.n
    from anonimizados a
    where au.entidad = 'viaje_integrante' and au.entidad_id = a.id
    returning 1
  )
  select count(*) into cantidad from anonimizados;

  if cantidad > 0 then
    insert into auditoria (
      organizacion_id, usuario_id, entidad, entidad_id, entidad_nombre,
      campo, valor_antes, valor_despues
    )
    values (
      v_viaje.organizacion_id, mi_usuario_id(), 'viaje', v_viaje.id, v_viaje.nombre,
      '(datos personales de inscriptos borrados)', null, cantidad::text
    );
  end if;

  return cantidad;
end;
$$;

revoke all on function anonimizar_inscriptos_viaje(uuid) from public;
grant execute on function anonimizar_inscriptos_viaje(uuid) to sae_app;
