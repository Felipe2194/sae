-- Columnas de tracking necesarias para los informes/analíticas del panel.
alter table usuario
  add column if not exists ultimo_login timestamptz;

alter table plantilla_area
  add column if not exists veces_aplicada integer not null default 0,
  add column if not exists ultima_aplicacion timestamptz;
