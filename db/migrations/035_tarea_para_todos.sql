-- Tareas "para todo el equipo": visibles en el /hoy de cualquier miembro
-- activo, no de una sola persona. A diferencia de "sin responsable todavía"
-- (backlog común, no debería inundar el /hoy de todo el mundo), este es un
-- campo explícito que se marca a propósito al crear/editar la tarea.
--
-- El constraint evita el estado ambiguo "es de Fulano y también de
-- cualquiera": una tarea para_todos siempre tiene que tener responsable_id
-- null (los colaboradores puntuales, si los hay, siguen viviendo en
-- tarea_asignado, sin relación con este campo).

alter table tarea add column para_todos boolean not null default false;

alter table tarea add constraint tarea_para_todos_sin_responsable
  check (not para_todos or responsable_id is null);
