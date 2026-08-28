-- Tablero pasa a ser una sección opcional más (ver 032_secciones_habilitadas):
-- hay equipos que solo agendan visitas/reuniones y no usan el kanban de
-- tareas. Hoy sigue siendo la única sección que no se puede apagar.

alter table organizacion add column tablero_habilitado boolean not null default true;
