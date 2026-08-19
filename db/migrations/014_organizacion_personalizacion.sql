-- M4.2: personalización de organización — color de marca. `logo_url` y
-- `zona_horaria` ya existían en el schema desde 001 pero nunca se leían ni
-- escribían desde la app; esta migración solo agrega lo que faltaba.

alter table organizacion add column color_principal text;
