-- Reuniones con hora de inicio, para poder sincronizar con Google Calendar
-- como evento con horario puntual (no de todo el día). Solo aplica cuando
-- tarea.tipo = 'reunion' — el resto de tareas sigue sin hora. La duración de
-- la reunión reusa duracion_estimada_hs (ya existe, en horas) en vez de sumar
-- una columna nueva para representar lo mismo.
alter table tarea add column hora_inicio time;
