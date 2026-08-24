-- Cierre de área a fin de temporada: al archivar un área ahora se archivan
-- junto con ella sus tareas abiertas (no las 'hecha', esas ya están resueltas
-- y no hace falta tocarlas). Para poder ofrecer esas tareas como sugerencia
-- al reactivar el área la temporada siguiente ("¿repetimos estas tareas o
-- arrancamos en blanco?"), hace falta saber CUÁNDO se archivó cada una —
-- así se puede filtrar por "lo que se cerró junto con el área la última vez"
-- en vez de mezclar con tareas archivadas individualmente en otro momento.
--
-- area.archivada_en y las tarea.archivada_en del cierre se escriben con el
-- mismo now() dentro de la misma transacción (ver archivarArea() en
-- app/(app)/areas/actions.ts) — Postgres devuelve el mismo valor de now()
-- para todas las llamadas de una transacción, así que quedan perfectamente
-- correlacionadas sin necesitar una tabla de "lotes de cierre" aparte.

alter table area  add column archivada_en timestamptz;
alter table tarea add column archivada_en timestamptz;
