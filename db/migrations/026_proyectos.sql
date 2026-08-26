-- "Áreas" pasa a ser el concepto de producto "Proyectos": unifica el trabajo
-- continuo de las secretarías (áreas de siempre) con eventos puntuales con
-- fecha de inicio/cierre. La tabla/columna se queda llamada `area`/`area_id`
-- a propósito (mismo criterio que con "coordinador" en la migración 025):
-- renombrarla arrastraría cada política RLS y FK que la usa en toda la app
-- (turno, tablero, admin, informes, plataforma). El nombre público cambia
-- en la UI (/areas → /proyectos), no en el schema.

create type tipo_area as enum ('continua', 'evento');
create type categoria_area as enum ('deportes', 'becas', 'institucional', 'cultura', 'academico', 'general');

alter table area add column tipo tipo_area not null default 'continua';
alter table area add column categoria categoria_area not null default 'general';
alter table area add column fecha_inicio date;
alter table area add column fecha_fin date;

-- Tareas cotidianas sin proyecto ("Sin Proyecto" en el filtro del tablero).
-- RLS de tarea no usa area_id para autorización (se basa en
-- responsable_id/creada_por/asignados/rol), así que esto no rompe ninguna
-- policy.
alter table tarea alter column area_id drop not null;
