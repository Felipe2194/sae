import { auth } from "@/auth";
import { withUser } from "@/lib/db";
import { ErrorDeUsuario } from "@/lib/errores";
import type { SeccionOpcionalKey } from "@/lib/secciones";

// Guardas de sesión para las Server Actions. Antes cada actions.ts tenía su
// propia copia de estas dos funciones; un cambio en la regla (qué cuenta
// como sesión válida, qué rol administra) había que repetirlo en ocho
// archivos y era fácil dejar uno afuera.
//
// Tiran ErrorDeUsuario (lib/errores.ts): el mensaje llega a la persona tal
// cual, también en producción.

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new ErrorDeUsuario("La sesión venció. Volvé a ingresar.");
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();
  if (session.user.rol !== "administrador") {
    throw new ErrorDeUsuario("Solo un administrador puede hacer esto.");
  }
  return session;
}

// Para las acciones de una sección opcional (lib/secciones.ts). Las páginas
// ya redirigen si la sección está desactivada o es "solo administradores",
// pero una Server Action es un endpoint aparte: quien tuviera la pestaña
// abierta desde antes, o armara el pedido a mano, seguía pudiendo escribir.
// Usa la misma regla que las páginas (seccion_visible, migración 046).
//
// Las acciones de tareas (tablero/actions.ts) no la usan a propósito: las
// tareas son el núcleo y se tocan también desde Hoy, Proyectos y Viajes.
export async function requireSeccion(clave: SeccionOpcionalKey) {
  const session = await requireAuth();
  const visible = await withUser(session.user.id, async (tx) => {
    const [fila] = await tx<[Record<SeccionOpcionalKey, boolean>?]>`
      select
        seccion_visible(tablero_habilitado, secciones_solo_admin, 'tablero') as tablero,
        seccion_visible(calendario_habilitado, secciones_solo_admin, 'calendario') as calendario,
        seccion_visible(cronograma_habilitado, secciones_solo_admin, 'cronograma') as cronograma,
        seccion_visible(proyectos_habilitado, secciones_solo_admin, 'proyectos') as proyectos,
        seccion_visible(visitas_habilitado, secciones_solo_admin, 'visitas') as visitas,
        seccion_visible(viajes_habilitado, secciones_solo_admin, 'viajes') as viajes,
        seccion_visible(becas_habilitado, secciones_solo_admin, 'becas') as becas
      from organizacion
      where id = mi_organizacion_id()
    `;
    return fila?.[clave] ?? false;
  });
  if (!visible) {
    throw new ErrorDeUsuario("Esta sección no está disponible para tu cuenta.");
  }
  return session;
}

export async function requireAdminEnSeccion(clave: SeccionOpcionalKey) {
  const session = await requireSeccion(clave);
  if (session.user.rol !== "administrador") {
    throw new ErrorDeUsuario("Solo un administrador puede hacer esto.");
  }
  return session;
}

export type Sesion =Awaited<ReturnType<typeof requireAuth>>;
