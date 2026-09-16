import { redirect } from "next/navigation";

// Los redirect("/hoy") y redirect("/login") por falta de permiso o sesión
// vencida quedaban mudos: la persona aterrizaba en otra pantalla sin que
// nadie le explicara por qué. Estos helpers agregan un `motivo` a la URL de
// destino; <AvisoMotivo> (components/features/aviso-motivo.tsx), montado en
// /hoy y /login, lo lee y dispara el toast correspondiente. Mantener los
// valores de motivo sincronizados con los que reconoce ese componente.

export function redirectSinPermiso(): never {
  redirect("/hoy?motivo=sin-permiso");
}

export function redirectSeccionDeshabilitada(): never {
  redirect("/hoy?motivo=seccion-deshabilitada");
}

export function redirectSesionInvalida(): never {
  redirect("/login?motivo=sesion-invalida");
}
