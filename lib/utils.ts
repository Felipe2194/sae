import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Sanea una URL cargada por un usuario antes de guardarla (accesos rápidos,
// adjuntos, playlist, fondo de perfil). `new URL(...)` sola no alcanza como
// validación: acepta cualquier esquema, incluido "javascript:" — guardado
// como link de un "documento" y clickeado después desde <a href>, corre con
// la sesión de quien lo clickee. Devuelve la URL normalizada (u.href) o
// null si no es http/https o no es una URL válida.
export function urlSegura(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}
