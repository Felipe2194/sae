import { randomBytes, createHash } from "node:crypto";

// 7 días: suficiente para que el admin lo comparta y la persona lo abra sin
// apuro, pero acotado — un link viejo dando vueltas en un chat no debería
// quedar utilizable para siempre.
export const DURACION_INVITACION_MS = 7 * 24 * 60 * 60 * 1000;

export function generarTokenInvitacion(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
