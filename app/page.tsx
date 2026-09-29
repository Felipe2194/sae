import { redirect } from "next/navigation";

// Sistema de uso interno: no hay landing pública. proxy.ts ya manda '/' a
// /hoy o /login según haya sesión; esto queda solo por si el proxy no corre.
export default function RaizPage() {
  redirect("/login");
}
