-- Revisión pre-producción: índices faltantes y endurecimiento de RLS.
-- Todo es idempotente (if not exists / create or replace) y no toca datos.

-- === 1. Índices para claves foráneas que no tenían ninguno ===================
-- Postgres indexa solo el lado referenciado (la PK), no la columna que
-- referencia. Sin índice en esa columna, borrar o reasignar un usuario
-- (Configuración → "Quitar del equipo") recorre cada tabla entera para
-- verificar la FK, y los filtros por autor/creador hacen lo mismo.

-- Usadas además por consultas de todos los días:
--   tarea.completada_por / comentario.autor_id → bitácora de /hoy
--   tarea.creada_por, tarea_log.usuario_id     → Informes (actividad por integrante)
create index if not exists tarea_creada_por_idx        on tarea (creada_por);
create index if not exists tarea_completada_por_idx    on tarea (completada_por) where completada_por is not null;
create index if not exists comentario_autor_creado_idx on comentario (autor_id, creado_en desc);
create index if not exists tarea_log_usuario_id_idx    on tarea_log (usuario_id);
create index if not exists subtarea_completada_por_idx on subtarea (completada_por) where completada_por is not null;

-- Solo para la verificación de FK al borrar/reasignar:
create index if not exists adjunto_subido_por_idx            on adjunto (subido_por);
create index if not exists auditoria_usuario_id_idx          on auditoria (usuario_id);
create index if not exists excepcion_turno_creada_por_idx    on excepcion_turno (creada_por);
create index if not exists excepcion_turno_reemplazo_idx     on excepcion_turno (usuario_reemplazo_id) where usuario_reemplazo_id is not null;
create index if not exists hito_area_creado_por_idx          on hito_area (creado_por);
create index if not exists nota_area_autor_id_idx            on nota_area (autor_id);
create index if not exists plantilla_area_organizacion_idx   on plantilla_area (organizacion_id);
create index if not exists plantilla_area_creada_por_idx     on plantilla_area (creada_por);
create index if not exists solicitud_rechazada_por_idx       on solicitud_rechazada (rechazada_por) where rechazada_por is not null;
create index if not exists viaje_creada_por_idx              on viaje (creada_por);
create index if not exists viaje_costo_tarea_id_idx          on viaje_costo (tarea_id);
create index if not exists viaje_costo_fijado_por_idx        on viaje_costo (fijado_por);
create index if not exists viaje_pago_registrado_por_idx     on viaje_pago (registrado_por);
create index if not exists visita_colegio_asignado_por_idx   on visita_colegio (asignado_por_id) where asignado_por_id is not null;
create index if not exists visita_colegio_creada_por_idx     on visita_colegio (creada_por);

-- === 2. Índices compuestos para las consultas que más se repiten ============

-- /visitas, /hoy e /informes filtran siempre por organización + fecha (el
-- año elegido, o "hoy"). Los índices sueltos de organizacion_id y de fecha
-- obligaban a elegir uno y filtrar el resto.
create index if not exists visita_colegio_org_fecha_idx on visita_colegio (organizacion_id, fecha);

-- Bitácora del equipo en /hoy: organización + día.
create index if not exists bitacora_diaria_org_fecha_idx on bitacora_diaria (organizacion_id, fecha);

-- Tareas archivadas del tablero, ahora paginadas de la más reciente a la
-- más vieja: el índice parcial ya viene en ese orden.
create index if not exists tarea_archivadas_recientes_idx
  on tarea (organizacion_id, archivada_en desc nulls last)
  where archivada;

-- Historial de una tarea, siempre "de esta tarea, lo último primero".
create index if not exists tarea_log_tarea_creado_idx on tarea_log (tarea_id, creado_en desc);

-- === 3. Endurecimiento ========================================================

-- Las funciones helper son SECURITY DEFINER (corren con los permisos de su
-- dueño). Sin search_path fijo, quien pudiera crear objetos en un schema que
-- esté antes en el search_path podría hacer que resuelvan `usuario` a otra
-- tabla. Hoy sae_app no puede crear nada, pero fijarlo es la práctica
-- recomendada y no cuesta nada.
alter function mi_organizacion_id() set search_path = public;
alter function mi_rol() set search_path = public;

-- La policy de alta de auditoría solo exigía la organización: cualquier
-- sesión podía registrar un cambio a nombre de otra persona. La auditoría es
-- la herramienta de rendición de cuentas — el autor tiene que ser quien está
-- logueado. (marcar_visitas_realizadas() inserta con usuario_id null y es
-- SECURITY DEFINER, así que no pasa por esta policy.)
drop policy if exists "auditoria_insert" on auditoria;
create policy "auditoria_insert"
  on auditoria for insert
  with check (
    organizacion_id = mi_organizacion_id()
    and usuario_id = mi_usuario_id()
  );

-- Un integrante puede editar su propia fila de `usuario` (nombre, colores,
-- contraseña) y el permiso de UPDATE por columna incluye rol/estado/
-- es_cuenta_generica porque los administradores los cambian vía withUser().
-- La combinación dejaba una puerta abierta a nivel base: nada impedía que
-- alguien se cambiara SU PROPIO rol a administrador. Ninguna acción de la
-- app lo hace, pero la base no debería depender de eso. RLS no puede
-- comparar el valor viejo con el nuevo, así que va en un trigger: esas tres
-- columnas solo las cambia un administrador (o la conexión directa, que no
-- corre como sae_app).
create or replace function usuario_proteger_privilegios()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user = 'sae_app'
    and (
      new.rol is distinct from old.rol
      or new.estado is distinct from old.estado
      or new.es_cuenta_generica is distinct from old.es_cuenta_generica
    )
    and mi_rol() is distinct from 'administrador'
  then
    raise exception 'Solo un administrador puede cambiar rol, estado o tipo de cuenta'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists usuario_proteger_privilegios on usuario;
create trigger usuario_proteger_privilegios
  before update on usuario
  for each row execute function usuario_proteger_privilegios();
