-- Amplía tarea_update para que una tarea "para todos" se pueda marcar hecha
-- por cualquier miembro. app/(app)/hoy/actions.ts (toggleTarea, el checkbox
-- de /hoy) hace el UPDATE directo sin chequeo propio en la aplicación
-- (a diferencia de tablero/actions.ts, que sí valida con puedeMoverEstado
-- antes de tocar la fila) — depende enteramente de esta policy. Sin esta
-- rama, una tarea para_todos (responsable_id null, sin tarea_asignado, y sin
-- relación con quien la mira) quedaba visible en el /hoy de todo el mundo
-- pero nadie salvo administrador podía tildarla, porque no calzaba en
-- ninguna de las ramas existentes (responsable/creador/admin/responsable de
-- área).
drop policy "tarea_update" on tarea;
create policy "tarea_update" on tarea for update
  using (
    organizacion_id = mi_organizacion_id()
    and (
      responsable_id = mi_usuario_id()
      or creada_por = mi_usuario_id()
      or mi_rol() in ('coordinador', 'administrador')
      or para_todos = true
      or exists (
        select 1 from area
        where area.id = tarea.area_id and area.responsable_id = mi_usuario_id()
      )
    )
  )
  with check (organizacion_id = mi_organizacion_id());
