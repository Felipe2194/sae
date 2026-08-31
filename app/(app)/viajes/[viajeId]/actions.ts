"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import type { EstadoIntegranteViaje } from "@/types/database";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");
  return session;
}

// Mismo criterio que la policy viaje_update: creador, equipo asignado, o
// administrador — repetido acá en vez de importado desde ../actions.ts,
// mismo criterio que el resto del codebase (cada actions.ts repite sus
// propios helpers de autorización, ver requirePlanificador en proyectos).
async function requireOrganizadorViaje(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- transacción de postgres.js
  tx: any,
  viajeId: string,
  session: Awaited<ReturnType<typeof requireAuth>>,
) {
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

// ── Documentos del viaje ──────────────────────────────────────────────────────
// Reusa acceso_rapido, mismo patrón que crearAccesoArea/eliminarAccesoArea en
// app/(app)/proyectos/actions.ts.

export async function crearAccesoViaje(
  viajeId: string,
  etiqueta: string,
  url: string,
): Promise<{ id: string } | null> {
  const session = await requireAuth();
  const etiquetaLimpia = etiqueta.trim();
  const urlLimpia = url.trim();
  if (!etiquetaLimpia || !urlLimpia) return null;
  const { id } = await withUser(session.user.id, async (tx) => {
    await requireOrganizadorViaje(tx, viajeId, session);
    const [{ max_orden }] = await tx<[{ max_orden: number | null }]>`
      select max(orden) as max_orden from acceso_rapido where viaje_id = ${viajeId}
    `;
    const [{ id }] = await tx<[{ id: string }]>`
      insert into acceso_rapido (organizacion_id, viaje_id, etiqueta, url, orden)
      values (mi_organizacion_id(), ${viajeId}, ${etiquetaLimpia}, ${urlLimpia}, ${(max_orden ?? -1) + 1})
      returning id
    `;
    return { id };
  });
  revalidatePath(`/viajes/${viajeId}`);
  return { id };
}

export async function eliminarAccesoViaje(accesoId: string, viajeId: string) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await requireOrganizadorViaje(tx, viajeId, session);
    await tx`
      delete from acceso_rapido
      where id = ${accesoId}
        and viaje_id = ${viajeId}
        and organizacion_id = mi_organizacion_id()
    `;
  });
  revalidatePath(`/viajes/${viajeId}`);
}

// ── Costos del viaje ──────────────────────────────────────────────────────────
// Un costo (transporte, alojamiento, inscripción) arranca como una tarea
// normal del tablero vinculada al viaje (tarea.viaje_id) mientras se cotiza;
// al cerrarse, "fijarCosto" registra el monto final en viaje_costo, con
// trazabilidad a la tarea de origen. La tarea en sí no se toca (sigue
// existiendo en el tablero, archivarla queda a criterio de quien la gestiona).

export async function crearTareaCosteo(viajeId: string, titulo: string): Promise<{ id: string } | null> {
  const session = await requireAuth();
  const tituloLimpio = titulo.trim();
  if (!tituloLimpio) return null;
  const { id } = await withUser(session.user.id, async (tx) => {
    await requireOrganizadorViaje(tx, viajeId, session);
    // responsable_id = quien la carga (no queda "libre"): la policy
    // tarea_update (037_tarea_update_para_todos.sql) no tiene rama para
    // tarea_asignado/"libre" tras el rediseño de para_todos, así que sin
    // responsable_id un organizador que no sea el creador ni admin no podría
    // después tildarla hecha.
    const [{ id }] = await tx<[{ id: string }]>`
      insert into tarea (organizacion_id, area_id, viaje_id, titulo, responsable_id, creada_por, orden)
      values (mi_organizacion_id(), null, ${viajeId}, ${tituloLimpio}, mi_usuario_id(), mi_usuario_id(), 0)
      returning id
    `;
    return { id };
  });
  revalidatePath(`/viajes/${viajeId}`);
  revalidatePath("/tablero");
  return { id };
}

export async function fijarCosto(
  viajeId: string,
  data: { concepto: string; monto: number; tareaId: string | null },
): Promise<{ id: string } | null> {
  const session = await requireAuth();
  const conceptoLimpio = data.concepto.trim();
  if (!conceptoLimpio || !(data.monto > 0)) return null;
  const { id } = await withUser(session.user.id, async (tx) => {
    await requireOrganizadorViaje(tx, viajeId, session);
    const [{ id }] = await tx<[{ id: string }]>`
      insert into viaje_costo (viaje_id, concepto, monto, tarea_id, fijado_por)
      values (${viajeId}, ${conceptoLimpio}, ${data.monto}, ${data.tareaId}, mi_usuario_id())
      returning id
    `;
    return { id };
  });
  revalidatePath(`/viajes/${viajeId}`);
  revalidatePath("/informes");
  return { id };
}

export async function eliminarCosto(costoId: string, viajeId: string) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await requireOrganizadorViaje(tx, viajeId, session);
    await tx`delete from viaje_costo where id = ${costoId} and viaje_id = ${viajeId}`;
  });
  revalidatePath(`/viajes/${viajeId}`);
  revalidatePath("/informes");
}

// ── Inscriptos del viaje ──────────────────────────────────────────────────────

export async function cambiarEstadoIntegrante(
  integranteId: string,
  viajeId: string,
  estado: EstadoIntegranteViaje,
) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await requireOrganizadorViaje(tx, viajeId, session);
    const [antes] = await tx<[{ nombre: string; apellido: string; estado: string } | undefined]>`
      select nombre, apellido, estado::text from viaje_integrante
      where id = ${integranteId} and viaje_id = ${viajeId}
    `;
    if (!antes) return;
    await tx`
      update viaje_integrante set estado = ${estado}::estado_integrante_viaje
      where id = ${integranteId} and viaje_id = ${viajeId}
    `;
    if (antes.estado !== estado) {
      await tx`
        insert into auditoria (organizacion_id, usuario_id, entidad, entidad_id, entidad_nombre, campo, valor_antes, valor_despues)
        values (
          mi_organizacion_id(), mi_usuario_id(), 'viaje_integrante', ${integranteId},
          ${`${antes.nombre} ${antes.apellido}`}, 'estado', ${antes.estado}, ${estado}
        )
      `;
    }
  });
  revalidatePath(`/viajes/${viajeId}`);
  revalidatePath("/informes");
}

export async function actualizarIntegrante(
  integranteId: string,
  viajeId: string,
  data: { montoAPagar: number | null; notasInternas: string | null },
) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await requireOrganizadorViaje(tx, viajeId, session);
    await tx`
      update viaje_integrante set
        monto_a_pagar = ${data.montoAPagar},
        notas_internas = ${data.notasInternas}
      where id = ${integranteId} and viaje_id = ${viajeId}
    `;
  });
  revalidatePath(`/viajes/${viajeId}`);
}

export async function eliminarIntegrante(integranteId: string, viajeId: string) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await requireOrganizadorViaje(tx, viajeId, session);
    await tx`delete from viaje_integrante where id = ${integranteId} and viaje_id = ${viajeId}`;
  });
  revalidatePath(`/viajes/${viajeId}`);
  revalidatePath("/informes");
}

// ── Pagos ──────────────────────────────────────────────────────────────────────
// v1 sin comprobante adjunto (decisión explícita: se suma más adelante junto
// con el upload real vía Vercel Blob — ver plan). Por ahora solo monto/medio/
// fecha, igual de útil para saber el saldo pendiente por persona.

export async function registrarPago(
  viajeId: string,
  data: { viajeIntegranteId: string; monto: number; medioPago: string | null; fechaPago: string },
): Promise<{ id: string } | null> {
  const session = await requireAuth();
  if (!(data.monto > 0)) return null;
  const { id } = await withUser(session.user.id, async (tx) => {
    await requireOrganizadorViaje(tx, viajeId, session);
    const [{ id }] = await tx<[{ id: string }]>`
      insert into viaje_pago (viaje_integrante_id, monto, medio_pago, fecha_pago, registrado_por)
      values (${data.viajeIntegranteId}, ${data.monto}, ${data.medioPago}, ${data.fechaPago}, mi_usuario_id())
      returning id
    `;
    return { id };
  });
  revalidatePath(`/viajes/${viajeId}`);
  revalidatePath("/informes");
  return { id };
}

export async function eliminarPago(pagoId: string, viajeId: string) {
  const session = await requireAuth();
  await withUser(session.user.id, async (tx) => {
    await requireOrganizadorViaje(tx, viajeId, session);
    await tx`
      delete from viaje_pago
      where id = ${pagoId}
        and viaje_integrante_id in (select id from viaje_integrante where viaje_id = ${viajeId})
    `;
  });
  revalidatePath(`/viajes/${viajeId}`);
  revalidatePath("/informes");
}
