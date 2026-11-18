// Errores "para la persona" en Server Actions.
//
// En producción Next reemplaza el mensaje de cualquier error que tire una
// Server Action por uno genérico (para no filtrar detalles internos), así que
// un `throw new Error("Solo el responsable puede…")` llegaba al navegador
// como un texto en inglés sin sentido. Lo único que Next deja pasar intacto
// es `digest` cuando el error ya trae uno (es el mismo mecanismo que usan
// redirect() y notFound() — ver create-error-handler en next/dist/server).
// ErrorDeUsuario viaja ahí: el mensaje va en el digest con un prefijo, y
// mensajeDeError() lo recupera del lado del cliente.
//
// Usar SOLO para mensajes escritos a mano y pensados para mostrarse (una
// validación, un permiso). Nunca envolver un error de la base o de un
// servicio externo: eso sí tiene que quedar oculto.
//
// Si una versión futura de Next dejara de respetar el digest, el efecto es
// que la persona vuelve a ver el texto de respaldo de cada pantalla ("No se
// pudo guardar…") — se degrada, no se rompe.

const PREFIJO = "SAE_USUARIO:";

export class ErrorDeUsuario extends Error {
  digest: string;

  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorDeUsuario";
    this.digest = PREFIJO + mensaje;
  }
}

export function esErrorDeUsuario(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith(PREFIJO)
  );
}

// Para los catch de los componentes cliente: el mensaje escrito para la
// persona si el error es un ErrorDeUsuario, o `respaldo` para cualquier otro
// (un fallo inesperado no tiene un texto que valga la pena mostrar).
export function mensajeDeError(err: unknown, respaldo: string): string {
  if (esErrorDeUsuario(err)) {
    return (err as { digest: string }).digest.slice(PREFIJO.length);
  }
  return respaldo;
}
