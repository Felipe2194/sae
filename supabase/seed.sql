-- Datos de prueba locales: una organización, las 13 áreas de SAE FRVM,
-- tres usuarios ficticios (admin/coordinador/miembro, password "password123")
-- y quince tareas de ejemplo. Solo para desarrollo local.

do $$
declare
  v_org_id uuid;
  v_admin_id uuid := gen_random_uuid();
  v_coord_id uuid := gen_random_uuid();
  v_miembro_id uuid := gen_random_uuid();
  v_areas uuid[] := '{}';
  v_area_id uuid;
  v_area_becas uuid;
  v_area_deportes uuid;
  v_area_salud uuid;
  v_area_tutorias uuid;
  v_nombres_areas text[] := array[
    'Becas', 'Deportes', 'Visitas', 'Seminario de Ingreso', 'Salud',
    'Charlas y Capacitaciones', 'Residencias', 'Viajes', 'UTN Corre',
    'Tutorías', 'Relaciones Internacionales', 'Género', 'Discapacidad'
  ];
  v_colores text[] := array[
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6',
    '#6366f1', '#a855f7', '#ec4899'
  ];
  i int;
begin
  -- organización
  insert into organizacion (nombre, slug)
  values ('SAE FRVM', 'sae-frvm')
  returning id into v_org_id;

  -- usuarios ficticios (auth.users mínimo; el trigger al_crear_usuario crea
  -- la fila correspondiente en `usuario` a partir de raw_user_meta_data)
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values
    ('00000000-0000-0000-0000-000000000000', v_admin_id, 'authenticated', 'authenticated',
     'admin@sae.test', crypt('password123', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}',
     jsonb_build_object('organizacion_id', v_org_id, 'nombre', 'Ana Administradora'),
     now(), now()),
    ('00000000-0000-0000-0000-000000000000', v_coord_id, 'authenticated', 'authenticated',
     'coordinador@sae.test', crypt('password123', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}',
     jsonb_build_object('organizacion_id', v_org_id, 'nombre', 'Carlos Coordinador'),
     now(), now()),
    ('00000000-0000-0000-0000-000000000000', v_miembro_id, 'authenticated', 'authenticated',
     'miembro@sae.test', crypt('password123', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}',
     jsonb_build_object('organizacion_id', v_org_id, 'nombre', 'Mora Miembro'),
     now(), now());

  insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values
    (v_admin_id, v_admin_id::text, jsonb_build_object('sub', v_admin_id::text, 'email', 'admin@sae.test'), 'email', now(), now(), now()),
    (v_coord_id, v_coord_id::text, jsonb_build_object('sub', v_coord_id::text, 'email', 'coordinador@sae.test'), 'email', now(), now(), now()),
    (v_miembro_id, v_miembro_id::text, jsonb_build_object('sub', v_miembro_id::text, 'email', 'miembro@sae.test'), 'email', now(), now(), now());

  -- el trigger ya creó las filas en `usuario` con estado 'pendiente' y rol 'miembro';
  -- las activamos y les asignamos el rol que les corresponde
  update usuario set estado = 'activo', rol = 'administrador' where id = v_admin_id;
  update usuario set estado = 'activo', rol = 'coordinador' where id = v_coord_id;
  update usuario set estado = 'activo', rol = 'miembro' where id = v_miembro_id;

  -- las 13 áreas de SAE
  for i in 1 .. array_length(v_nombres_areas, 1) loop
    insert into area (organizacion_id, nombre, color, responsable_id, activa)
    values (v_org_id, v_nombres_areas[i], v_colores[i], v_coord_id, true)
    returning id into v_area_id;
    v_areas := array_append(v_areas, v_area_id);
  end loop;

  v_area_becas := v_areas[1];
  v_area_deportes := v_areas[2];
  v_area_salud := v_areas[5];
  v_area_tutorias := v_areas[10];

  -- quince tareas de ejemplo
  insert into tarea (organizacion_id, area_id, titulo, descripcion, responsable_id, estado, prioridad, fecha_vencimiento, creada_por, orden, completada_en)
  values
    (v_org_id, v_area_becas, 'Publicar convocatoria de becas 2026', null, v_coord_id, 'por_hacer', 'alta', current_date + 3, v_coord_id, 0, null),
    (v_org_id, v_area_becas, 'Revisar planillas de postulantes', null, v_miembro_id, 'en_progreso', 'media', current_date + 5, v_coord_id, 0, null),
    (v_org_id, v_area_becas, 'Enviar notificación de resultados', null, null, 'por_hacer', 'media', current_date + 10, v_coord_id, 1, null),
    (v_org_id, v_area_deportes, 'Coordinar cancha para el torneo interno', null, v_miembro_id, 'por_hacer', 'baja', current_date + 7, v_coord_id, 0, null),
    (v_org_id, v_area_deportes, 'Armar planilla de inscripciones', null, v_miembro_id, 'hecha', 'media', current_date - 2, v_coord_id, 0, now() - interval '1 day'),
    (v_org_id, v_areas[3], 'Agendar visita a escuela técnica', null, v_admin_id, 'por_hacer', 'media', current_date + 4, v_admin_id, 0, null),
    (v_org_id, v_areas[4], 'Reservar aula para seminario de ingreso', null, v_coord_id, 'en_progreso', 'alta', current_date + 1, v_coord_id, 0, null),
    (v_org_id, v_area_salud, 'Actualizar cartelera de salud estudiantil', null, v_miembro_id, 'por_hacer', 'baja', null, v_miembro_id, 0, null),
    (v_org_id, v_area_salud, 'Coordinar jornada de donación de sangre', null, null, 'por_hacer', 'media', current_date + 14, v_coord_id, 1, null),
    (v_org_id, v_areas[6], 'Confirmar disertante de la próxima charla', null, v_admin_id, 'en_progreso', 'media', current_date + 6, v_admin_id, 0, null),
    (v_org_id, v_areas[7], 'Actualizar listado de residencias disponibles', null, v_coord_id, 'por_hacer', 'baja', null, v_coord_id, 0, null),
    (v_org_id, v_areas[8], 'Cotizar transporte para viaje de estudio', null, v_miembro_id, 'por_hacer', 'media', current_date + 8, v_coord_id, 0, null),
    (v_org_id, v_areas[9], 'Difundir inscripción a UTN Corre', null, v_miembro_id, 'hecha', 'baja', current_date - 5, v_miembro_id, 0, now() - interval '3 day'),
    (v_org_id, v_area_tutorias, 'Asignar tutores a ingresantes', null, v_coord_id, 'en_progreso', 'alta', current_date + 2, v_coord_id, 0, null),
    (v_org_id, v_area_tutorias, 'Armar cronograma de tutorías de julio', null, null, 'por_hacer', 'media', current_date + 9, v_coord_id, 1, null);
end $$;
