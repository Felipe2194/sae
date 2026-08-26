"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");
  return session;
}

// Cualquiera puede cargar/editar/borrar su propio turno; administrador
// puede hacerlo por cualquiera (mismo criterio que las excepciones de turno
// más abajo). RLS (turno_insert/update/delete) refuerza esto mismo del lado
// de la base.
function requierePropioOManage(
  session: Awaited<ReturnType<typeof requireAuth>>,
  usuarioId: string,
) {
  const rol = (session.user as { rol: string }).rol;
  if (usuarioId !== session.user.id && rol !== "administrador") {
    throw new Error("Solo podés gestionar tu propio turno");
  }
}

export async function crearTurno(data: {
  usuario_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  vigente_desde: string;
  vigente_hasta: string | null;
}) {
  const session = await requireAuth();
  requierePropioOManage(session, data.usuario_id);
  await withUser(session.user.id, async (tx) => {
    await tx`
      insert into turno (organizacion_id, usuario_id, dia_semana, hora_inicio, hora_fin, vigente_desde, vigente_hasta)
      values (
        mi_organizacion_id(),
        ${data.usuario_id},
        ${data.dia_semana},
        ${data.hora_inicio},
        ${data.hora_fin},
        ${data.vigente_desde},
        ${data.vigente_hasta}
      )
    `;
  });
  revalidatePath("/cronograma");
  revalidatePath("/hoy");
}

export async function actualizarTurno(
  turnoId: string,
  data: {
    usuario_id: string;
    dia_semana: number;
    hora_inicio: string;
    hora_fin: string;
    vigente_desde: string;
    vigente_hasta: string | null;
  },
) {
  const session = await requireAuth();
  requierePropioOManage(session, data.usuario_id);
  await withUser(session.user.id, async (tx) => {
    await tx`
      update turno set
        usuario_id    = ${data.usuario_id},
        dia_semana    = ${data.dia_semana},
        hora_inicio   = ${data.hora_inicio},
        hora_fin      = ${data.hora_fin},
        vigente_desde = ${data.vigente_desde},
        vigente_hasta = ${data.vigente_hasta}
      where id = ${turnoId}
        and organizacion_id = mi_organizacion_id()
    `;
  });
  revalidatePath("/cronograma");
  revalidatePath("/hoy");
}

export async function eliminarTurno(turnoId: string) {
  // Sin chequeo explícito de dueño acá: RLS (turno_delete) es quien decide
  // si esta fila se puede borrar (propio turno, o administrador).
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await tx`
      delete from turno
      where id = ${turnoId}
        and organizacion_id = mi_organizacion_id()
    `;
  });
  revalidatePath("/cronograma");
  revalidatePath("/hoy");
}

// ── Excepciones de turno (ausencias / cambios) ──────────────────────────────
// Cualquiera puede marcar su propia ausencia; administrador puede marcar la
// de cualquiera. RLS (excepcion_turno_insert/delete) refuerza esto mismo del
// lado de la base.

export async function crearExcepcion(data: {
  usuario_id: string;
  fecha: string;
  tipo: "ausencia" | "cambio";
  nota: string | null;
  usuario_reemplazo_id: string | null;
}) {
  const session = await requireAuth();
  const rol = (session.user as { rol: string }).rol;
  if (data.usuario_id !== session.user.id && rol !== "administrador") {
    throw new Error("Solo podés marcar tu propia ausencia");
  }
  if (data.tipo === "cambio") {
    if (!data.usuario_reemplazo_id) {
      throw new Error("Elegí quién cubre el turno ese día.");
    }
    if (data.usuario_reemplazo_id === data.usuario_id) {
      throw new Error("El reemplazo tiene que ser otra persona.");
    }
  }
  await withUser(session.user.id, async (tx) => {
    await tx`
      insert into excepcion_turno (
        organizacion_id, usuario_id, fecha, tipo, nota, usuario_reemplazo_id, creada_por
      )
      values (
        mi_organizacion_id(),
        ${data.usuario_id},
        ${data.fecha},
        ${data.tipo}::tipo_excepcion_turno,
        ${data.nota || null},
        ${data.tipo === "cambio" ? data.usuario_reemplazo_id : null},
        mi_usuario_id()
      )
    `;
  });
  revalidatePath("/cronograma");
  revalidatePath("/hoy");
}

export async function eliminarExcepcion(excepcionId: string) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await tx`delete from excepcion_turno where id = ${excepcionId}`;
  });
  revalidatePath("/cronograma");
  revalidatePath("/hoy");
}
