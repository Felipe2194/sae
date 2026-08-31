import { randomBytes } from "node:crypto";

// Código corto para el link público de inscripción (se comparte por
// WhatsApp/mail, tiene que ser cómodo de escribir/leer) — no se usa el uuid
// del viaje a propósito. Alfabeto sin caracteres ambiguos (0/O, 1/I/l).
const ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generarCodigoPublico(largo = 8): string {
  const bytes = randomBytes(largo);
  let codigo = "";
  for (let i = 0; i < largo; i++) {
    codigo += ALFABETO[bytes[i] % ALFABETO.length];
  }
  return codigo;
}
