-- plantilla_area nunca tuvo política de update — aplicarPlantilla necesita
-- poder incrementar veces_aplicada/ultima_aplicacion (nuevo tracking de uso).
create policy "plantilla_area_update" on plantilla_area for update
  using (organizacion_id = mi_organizacion_id())
  with check (organizacion_id = mi_organizacion_id());
