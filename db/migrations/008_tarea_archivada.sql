-- Archivar tareas en vez de eliminarlas (preserva historial y métricas de coordinación)

alter table tarea add column archivada boolean not null default false;

create index tarea_archivada_idx on tarea (archivada);
