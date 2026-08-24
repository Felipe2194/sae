-- Índices compuestos para las queries más frecuentes de la app — hoy tarea
-- tiene índices individuales en organizacion_id, area_id y archivada, pero
-- /tablero, /areas/[areaId] y /coordinacion siempre filtran organizacion_id
-- (o area_id) JUNTO con archivada = false en cada carga de página. Con
-- índices separados Postgres arma un bitmap AND de los dos; con el
-- compuesto resuelve el filtro directo.
--
-- Los índices individuales que ya existían (tarea_organizacion_id_idx,
-- tarea_area_id_idx) se dejan: siguen haciendo falta para queries que NO
-- filtran por archivada (el historial por año de /areas/[areaId], por
-- ejemplo, mira todas las tareas del área sin importar si están archivadas).

create index tarea_organizacion_archivada_idx on tarea (organizacion_id, archivada);
create index tarea_area_archivada_idx on tarea (area_id, archivada);

-- archivada_en: usado por fetchTareasCierre() (app/(app)/areas/actions.ts)
-- para encontrar las tareas del último cierre de un área.
create index tarea_archivada_en_idx on tarea (archivada_en);
