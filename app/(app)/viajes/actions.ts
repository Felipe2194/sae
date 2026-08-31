"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import { generarCodigoPublico } from "@/lib/viajes/codigo";
import { CAMPOS_FORMULARIO_DEFAULT, type CamposFormularioViaje } from "@/lib/viajes/campos-formulario";
import type { EstadoViaje } from "@/types/database";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");
  return session;
}

// Quién puede editar/administrar un viaje puntual: quien lo creó, el equipo
// asignado, o administrador — mismo criterio que la policy viaje_update.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- transacción de postgres.js
async function requireOrganizador(tx: any, viajeId: string, session: Awaited<ReturnType<typeof requireAuth>>) {
  const rol = (session.user as { rol: string }).rol;
  if (rol === "administrador") return;
  const [viaje] = await tx<[{ creada_por: string } | undefined]>`
    select creada_por from viaje
    where id = ${viajeId} and organizacion_id = mi_organizacion_id()
  `;
  if (!viaje) throw new Error("El viaje no existe.");
  if (viaje.creada_por === session.user.id) return;
  const [asignado] = await tx<[{ usuario_id: string } | undefined]>`
    select usuario_id from viaje_asignado
    where viaje_id = ${viajeId} and usuario_id = ${session.user.id}
  `;
  if (!asignado) {
    throw new Error("Solo quien organiza este viaje (o administrador) puede hacer esto.");
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- transacción de postgres.js
async function sincronizarAsignadosViaje(tx: any, viajeId: string, usuarioIds: string[]) {
  await tx`delete from viaje_asignado where viaje_id = ${viajeId}`;
  for (const usuarioId of new Set(usuarioIds)) {
    await tx`
      insert into viaje_asignado (viaje_id, usuario_id)
      values (${viajeId}, ${usuarioId})
    `;
  }
}

export type ViajeInput = {
  nombre: string;
  destino: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  cupo_maximo: number | null;
  precio: number | null;
  estado: EstadoViaje;
  descripcion_publica: string | null;
  info_participantes: string | null;
  campos_formulario: CamposFormularioViaje;
  asignados_ids?: string[];
};

const MAX_INTENTOS_CODIGO = 5;

export async function crearViaje(data: ViajeInput): Promise<{ id: string }> {
  const session = await requireAuth();
  const { id } = await withUser(session.user.id, async (tx) => {
    for (let intento = 0; intento < MAX_INTENTOS_CODIGO; intento++) {
      const codigo = generarCodigoPublico();
      try {
        const [{ id }] = await tx<[{ id: string }]>`
          insert into viaje (
            organizacion_id, nombre, destino, fecha_inicio, fecha_fin,
            cupo_maximo, precio, estado, codigo_publico,
            descripcion_publica, info_participantes, campos_formulario, creada_por
          )
          values (
            mi_organizacion_id(), ${data.nombre}, ${data.destino}, ${data.fecha_inicio},
            ${data.fecha_fin}, ${data.cupo_maximo}, ${data.precio},
            ${data.estado}::estado_viaje, ${codigo},
            ${data.descripcion_publica}, ${data.info_participantes},
            ${JSON.stringify(data.campos_formulario ?? CAMPOS_FORMULARIO_DEFAULT)}::jsonb, mi_usuario_id()
          )
          returning id
        `;
        await sincronizarAsignadosViaje(tx, id, data.asignados_ids ?? []);
        return { id };
      } catch (e) {
        const codigoError = (e as { code?: string }).code;
        if (codigoError === "23505" && intento < MAX_INTENTOS_CODIGO - 1) continue;
        throw e;
      }
    }
    throw new Error("No se pudo generar un código único para el viaje.");
  });
  revalidatePath("/viajes");
  revalidatePath("/informes");
  return { id };
}

export async function actualizarViaje(viajeId: string, data: ViajeInput) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await requireOrganizador(tx, viajeId, session);
    const [antes] = await tx<[{ nombre: string; estado: string } | undefined]>`
      select nombre, estado::text from viaje
      where id = ${viajeId} and organizacion_id = mi_organizacion_id()
    `;
    await tx`
      update viaje set
        nombre               = ${data.nombre},
        destino              = ${data.destino},
        fecha_inicio         = ${data.fecha_inicio},
        fecha_fin            = ${data.fecha_fin},
        cupo_maximo          = ${data.cupo_maximo},
        precio               = ${data.precio},
        estado               = ${data.estado}::estado_viaje,
        descripcion_publica  = ${data.descripcion_publica},
        info_participantes   = ${data.info_participantes},
        campos_formulario    = ${JSON.stringify(data.campos_formulario ?? CAMPOS_FORMULARIO_DEFAULT)}::jsonb
      where id = ${viajeId} and organizacion_id = mi_organizacion_id()
    `;
    if (data.asignados_ids !== undefined) {
      await sincronizarAsignadosViaje(tx, viajeId, data.asignados_ids);
    }
    if (antes && antes.estado !== data.estado) {
      await tx`
        insert into auditoria (organizacion_id, usuario_id, entidad, entidad_id, entidad_nombre, campo, valor_antes, valor_despues)
        values (mi_organizacion_id(), mi_usuario_id(), 'viaje', ${viajeId}, ${data.nombre}, 'estado', ${antes.estado}, ${data.estado})
      `;
    }
  });
  revalidatePath("/viajes");
  revalidatePath(`/viajes/${viajeId}`);
  revalidatePath("/informes");
}

export async function eliminarViaje(viajeId: string) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    const rol = (session.user as { rol: string }).rol;
    const [viaje] = await tx<[{ creada_por: string } | undefined]>`
      select creada_por from viaje where id = ${viajeId} and organizacion_id = mi_organizacion_id()
    `;
    if (!viaje) return;
    if (rol !== "administrador" && viaje.creada_por !== session.user.id) {
      throw new Error("Solo quien creó el viaje (o administrador) puede eliminarlo.");
    }
    await tx`delete from viaje where id = ${viajeId} and organizacion_id = mi_organizacion_id()`;
  });
  revalidatePath("/viajes");
  revalidatePath("/informes");
}

// Código a mano (ej. "congreso2026") en vez del generado al azar — más fácil
// de recordar/escribir a mano si alguien lo transcribe desde un cartel o un
// mensaje de voz. Mismo alfabeto amplio que generarCodigoPublico más guion
// bajo: sin espacios ni "/" (rompería la URL) ni caracteres que se confundan
// al dictarlos.
const CODIGO_VALIDO = /^[A-Za-z0-9_-]{3,40}$/;

export async function actualizarCodigoPublico(
  viajeId: string,
  nuevoCodigo: string,
): Promise<{ codigo: string } | { error: string }> {
  const session = await requireAuth();
  const codigo = nuevoCodigo.trim();
  if (!CODIGO_VALIDO.test(codigo)) {
    return {
      error: "El código debe tener entre 3 y 40 caracteres: letras, números, guiones o guion bajo, sin espacios.",
    };
  }
  try {
    await withUser(session.user.id, async (tx) => {
      await requireOrganizador(tx, viajeId, session);
      const actualizadas = await tx`
        update viaje set codigo_publico = ${codigo}
        where id = ${viajeId} and organizacion_id = mi_organizacion_id()
      `;
      if (actualizadas.count === 0) throw new Error("El viaje no existe.");
    });
  } catch (e) {
    const codigoError = (e as { code?: string }).code;
    if (codigoError === "23505") {
      return { error: "Ese código ya lo está usando otro viaje. Probá con otro." };
    }
    throw e;
  }
  revalidatePath(`/viajes/${viajeId}`);
  return { codigo };
}

// Escape hatch para revocar un link que se filtró o se compartió por error.
export async function regenerarCodigoPublico(viajeId: string): Promise<{ codigo: string }> {
  const session = await requireAuth();
  const codigo = await withUser(session.user.id, async (tx) => {
    await requireOrganizador(tx, viajeId, session);
    for (let intento = 0; intento < MAX_INTENTOS_CODIGO; intento++) {
      const codigo = generarCodigoPublico();
      try {
        await tx`
          update viaje set codigo_publico = ${codigo}
          where id = ${viajeId} and organizacion_id = mi_organizacion_id()
        `;
        return codigo;
      } catch (e) {
        const codigoError = (e as { code?: string }).code;
        if (codigoError === "23505" && intento < MAX_INTENTOS_CODIGO - 1) continue;
        throw e;
      }
    }
    throw new Error("No se pudo generar un código único para el viaje.");
  });
  revalidatePath(`/viajes/${viajeId}`);
  return { codigo };
}
