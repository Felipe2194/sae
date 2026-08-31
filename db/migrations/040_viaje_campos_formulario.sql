-- Campos configurables del formulario público de inscripción a un viaje —
-- ver comentario en lib/viajes/campos-formulario.ts. Guardado como jsonb en
-- vez de columnas booleanas por campo: son 5 campos con 3 estados cada uno
-- (requerido/opcional/oculto) y la lista puede crecer, así se evita seguir
-- agregando columnas a viaje cada vez.
alter table viaje add column campos_formulario jsonb not null default
  '{"legajo":"requerido","carrera":"requerido","anio_cursada":"requerido","email":"requerido","telefono":"requerido"}'::jsonb;
