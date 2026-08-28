-- El Google Calendar ya no es un único calendario global fijado por env var
-- (GOOGLE_CALENDAR_ID) — cada organización vincula el suyo propio desde
-- Configuración, compartiéndolo con la cuenta de servicio de la plataforma
-- (GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL, que sigue siendo de la plataforma,
-- no de cada organización). Nullable: sin configurar, /calendario muestra
-- eventos de ejemplo y las reuniones/visitas no sincronizan, igual que hoy.
-- lib/google/calendar.ts cae a GOOGLE_CALENDAR_ID como default legacy si esta
-- columna está vacía, para no romper la organización ya configurada por env.

alter table organizacion add column google_calendar_id text;
