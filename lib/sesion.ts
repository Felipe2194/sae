import { auth } from "@/auth";
import { ErrorDeUsuario } from "@/lib/errores";

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

export type Sesion = Awaited<ReturnType<typeof requireAuth>>;
