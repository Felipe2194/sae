'use server';

import { signOut as authSignOut } from '@/auth';
import { auth } from '@/auth';
import { withUser } from '@/lib/db';

export async function signOut() {
  await authSignOut({ redirectTo: '/login' });
}

export type ResultadoBusqueda = {
  tipo: 'tarea' | 'area';
  id: string;
  titulo: string;
  subtitulo: string | null;
  color: string | null;
  href: string;
};

export async function buscar(query: string): Promise<ResultadoBusqueda[]> {
  const session = await auth();
  if (!session?.user || !query.trim()) return [];

  const q = `%${query.trim().toLowerCase()}%`;

  return withUser(session.user.id, async (tx) => {
    const tareas = await tx<ResultadoBusqueda[]>`
      select
        'tarea'::text     as tipo,
        t.id,
        t.titulo,
        a.nombre          as subtitulo,
        a.color,
        '/tablero'::text  as href
      from tarea t
      left join area a on a.id = t.area_id
      where t.organizacion_id = mi_organizacion_id()
        and lower(t.titulo) like ${q}
        and t.estado != 'hecha'
      order by t.creada_en desc
      limit 6
    `;

    const areas = await tx<ResultadoBusqueda[]>`
      select
        'area'::text             as tipo,
        a.id,
        a.nombre                 as titulo,
        null::text               as subtitulo,
        a.color,
        ('/areas/' || a.id)      as href
      from area a
      where a.organizacion_id = mi_organizacion_id()
        and lower(a.nombre) like ${q}
        and a.activa = true
      order by a.nombre asc
      limit 4
    `;

    return [...tareas, ...areas];
  });
}
