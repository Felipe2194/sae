-- Secciones "solo administradores": además de activar/desactivar una sección
-- para toda la organización (032), el administrador puede dejarla oculta para
-- el equipo pero seguir viéndola él, para ir armándola antes de mostrarla —
-- mismo criterio que ya tiene Informes, que es admin-only de por sí.
--
-- Se guarda como lista de claves (las de lib/secciones.ts) en vez de sumar
-- una columna booleana más por sección: son estados de una misma elección
-- (todo el equipo / solo admins / desactivada) y así no se multiplican las
-- columnas cada vez que aparece una sección nueva.

alter table organizacion
  add column secciones_solo_admin text[] not null default '{}';

-- Regla única de visibilidad, para que cada página la aplique en su propia
-- consulta sin repetir la lógica: la sección tiene que estar activada y, si
-- es solo para administradores, quien consulta tiene que serlo.
create or replace function seccion_visible(habilitado boolean, solo_admin text[], clave text)
returns boolean
stable language sql as $$
  select habilitado and (
    clave <> all(solo_admin) or coalesce(mi_rol() = 'administrador', false)
  );
$$;
