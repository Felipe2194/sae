-- Ningún monto de dinero del módulo de viajes tenía un CHECK que impidiera
-- cargar un valor negativo por error de tipeo (038_viajes.sql los dejó como
-- `numeric` a secas). No cambia la precisión/escala de la columna (eso sí
-- tocaría datos existentes si algún día se ajusta) — solo agrega el piso en
-- cero, que es válido para cualquier valor ya cargado hoy.

alter table viaje_integrante
  add constraint viaje_integrante_monto_a_pagar_no_negativo
  check (monto_a_pagar is null or monto_a_pagar >= 0);

alter table viaje_costo
  add constraint viaje_costo_monto_no_negativo
  check (monto >= 0);

alter table viaje_pago
  add constraint viaje_pago_monto_no_negativo
  check (monto >= 0);
