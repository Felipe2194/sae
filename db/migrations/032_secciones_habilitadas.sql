-- Secciones opcionales del sidebar: un administrador nuevo elige en
-- Configuración cuáles usa su equipo (p. ej. una secretaría de proyectos de
-- software no hace visitas a colegios ni necesita cronograma de turnos).
-- Hoy y Tablero no se listan acá porque son el núcleo de la app y siempre
-- están disponibles.

alter table organizacion add column calendario_habilitado boolean not null default true;
alter table organizacion add column cronograma_habilitado boolean not null default true;
alter table organizacion add column proyectos_habilitado boolean not null default true;
alter table organizacion add column visitas_habilitado boolean not null default true;
