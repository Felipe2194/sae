import { randomInt } from "node:crypto";

// Sin caracteres ambiguos (0/O, 1/l/I) para que sea fácil de dictar o transcribir.
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export function generarPasswordTemporal(longitud = 10): string {
  let out = "";
  for (let i = 0; i < longitud; i++) out += ALFABETO[randomInt(ALFABETO.length)];
  return out;
}
