-- Quién completó cada tarea/subtarea. La bitácora automática de /hoy
-- ("Qué hice") buscaba las tareas completadas hoy por responsable o
-- asignado — una tarea "para todos" (responsable null, ver para_todos) o
-- una sin dueño no le aparecía a nadie aunque alguien la hubiera hecho.
--
-- Lo completa un trigger (no cada server action): hay varios caminos que
-- marcan una tarea como hecha (toggle en /hoy, mover en el tablero, editar
-- en el modal, plantillas) y así quedan todos cubiertos. mi_usuario_id()
-- sale del withUser(); desde un script con `sql` directo queda null.

alter table tarea
  add column completada_por uuid references usuario(id) on delete set null;
alter table subtarea
  add column completada_por uuid references usuario(id) on delete set null;

create or replace function registrar_completada_por_tarea()
returns trigger
language plpgsql
as $$
begin
  if new.estado = 'hecha' then
    if tg_op = 'INSERT' or old.estado is distinct from 'hecha' then
      new.completada_por := mi_usuario_id();
    end if;
  else
    new.completada_por := null;
  end if;
  return new;
end;
$$;

create trigger tarea_completada_por
  before insert or update of estado on tarea
  for each row execute function registrar_completada_por_tarea();

create or replace function registrar_completada_por_subtarea()
returns trigger
language plpgsql
as $$
begin
  if new.hecha then
    if tg_op = 'INSERT' or not old.hecha then
      new.completada_por := mi_usuario_id();
    end if;
  else
    new.completada_por := null;
  end if;
  return new;
end;
$$;

create trigger subtarea_completada_por
  before insert or update of hecha on subtarea
  for each row execute function registrar_completada_por_subtarea();

-- Lo ya completado: mejor aproximación disponible (el responsable, o quien
-- la creó si no tenía).
update tarea set completada_por = coalesce(responsable_id, creada_por)
where estado = 'hecha' and completada_por is null;

update subtarea s set completada_por = coalesce(t.responsable_id, t.creada_por)
from tarea t
where t.id = s.tarea_id and s.hecha and s.completada_por is null;
