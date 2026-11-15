'use server';

import { ErrorDeUsuario } from "@/lib/errores";
import { revalidatePath, refresh } from 'next/cache';
import { auth } from '@/auth';
import bcrypt from 'bcryptjs';
import { sql, withUser } from '@/lib/db';
import { registrarIntento, verificarLimiteIntentos } from '@/lib/rate-limit';
import { urlSegura } from '@/lib/utils';

export async function actualizarNombre(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new ErrorDeUsuario('No autenticado');

  const nombre = (formData.get('nombre') as string).trim();
  if (!nombre) return;

  const playlistRaw = ((formData.get('playlist_url') as string | null) ?? '').trim();
  let playlistUrl: string | null = null;
  if (playlistRaw) {
    // Solo http/https: `new URL(...)` sola acepta cualquier esquema,
    // incluido "javascript:" — ver lib/utils.ts.
    playlistUrl = urlSegura(playlistRaw);
    if (!playlistUrl) {
      throw new ErrorDeUsuario('El link de la playlist no es una URL válida');
    }
  }

  const avatarColorRaw = ((formData.get('avatar_color') as string | null) ?? '').trim();
  let avatarColor: string | null = null;
  if (avatarColorRaw) {
    if (!/^#[0-9a-fA-F]{6}$/.test(avatarColorRaw)) {
      throw new ErrorDeUsuario('Color de avatar inválido');
    }
    avatarColor = avatarColorRaw;
  }

  // Color del sistema (botones, acentos) — personal, opcional. Vacío =
  // "Restablecer": se sigue usando el color por defecto de la organización
  // (ver app/(app)/layout.tsx).
  const colorPrincipalRaw = ((formData.get('color_principal') as string | null) ?? '').trim();
  let colorPrincipal: string | null = null;
  if (colorPrincipalRaw) {
    if (!/^#[0-9a-fA-F]{6}$/.test(colorPrincipalRaw)) {
      throw new ErrorDeUsuario('Color del sistema inválido');
    }
    colorPrincipal = colorPrincipalRaw;
  }

  // Solo gradientes: el fondo con imagen propia se sacó (ver perfil-form.tsx).
  const fondoTipoRaw = (formData.get('fondo_tipo') as string | null) ?? '';
  let fondoTipo: 'gradiente' | null = fondoTipoRaw === 'gradiente' ? 'gradiente' : null;

  const fondoValorRaw = ((formData.get('fondo_valor') as string | null) ?? '').trim();
  let fondoValor: string | null = fondoValorRaw || null;
  // Sin tipo elegido, o sin valor cargado para ese tipo (ej. "Gradiente" sin
  // tocar ningún swatch todavía) -> sin fondo, no un tipo huérfano sin valor.
  if (!fondoTipo || !fondoValor) {
    fondoTipo = null;
    fondoValor = null;
  }

  const musicaMobileHabilitada = formData.get('musica_mobile_habilitada') === 'true';
  const musicaHabilitada = formData.get('musica_habilitada') === 'true';

  await withUser(session.user.id, async (tx) => {
    await tx`
      update usuario
      set nombre = ${nombre},
        playlist_url = ${playlistUrl},
        avatar_color = ${avatarColor},
        fondo_tipo = ${fondoTipo},
        fondo_valor = ${fondoValor},
        color_principal = ${colorPrincipal},
        musica_mobile_habilitada = ${musicaMobileHabilitada},
        musica_habilitada = ${musicaHabilitada}
      where id = mi_usuario_id()
    `;
  });

  revalidatePath('/perfil');
  revalidatePath('/hoy');
  revalidatePath('/', 'layout');
  // El color/fondo se aplican en app/(app)/layout.tsx, que envuelve toda la
  // sección — revalidatePath ya invalida esos datos, pero `refresh()` es lo
  // que efectivamente le pide al router del cliente que traiga el árbol
  // actualizado en la misma respuesta de esta Server Action, sin esperar a
  // una navegación futura ni depender de un F5 manual.
  refresh();
}

// Cambio de contraseña propio. Antes solo un administrador podía resetearla
// (y nunca la suya): nadie podía dejar de usar la contraseña temporal que le
// habían pasado por chat. Pide la actual — una sesión abierta en una
// computadora compartida, o un perfil al que se entró por cambio rápido sin
// contraseña, no alcanza para cambiarla.
export async function cambiarPassword(
  _prevState: { error: string | null; ok: boolean } | null,
  formData: FormData,
): Promise<{ error: string | null; ok: boolean }> {
  const session = await auth();
  if (!session?.user) return { error: 'La sesión venció. Volvé a ingresar.', ok: false };

  const actual = (formData.get('password_actual') as string | null) ?? '';
  const nueva = (formData.get('password_nueva') as string | null) ?? '';
  const confirmar = (formData.get('password_confirmar') as string | null) ?? '';

  if (!actual || !nueva) return { error: 'Completá todos los campos.', ok: false };
  if (nueva.length < 8) {
    return { error: 'La contraseña nueva debe tener al menos 8 caracteres.', ok: false };
  }
  // bcrypt ignora todo lo que pase de 72 — mismo tope que en /registro.
  if (nueva.length > 72) {
    return { error: 'La contraseña nueva no puede superar los 72 caracteres.', ok: false };
  }
  if (nueva !== confirmar) return { error: 'Las contraseñas nuevas no coinciden.', ok: false };
  if (nueva === actual) {
    return { error: 'La contraseña nueva tiene que ser distinta de la actual.', ok: false };
  }

  const clave = `password:usuario:${session.user.id}`;
  if (!(await verificarLimiteIntentos(clave, 6, 15 * 60 * 1000))) {
    return { error: 'Demasiados intentos. Esperá unos minutos y volvé a intentar.', ok: false };
  }

  // El hash se lee con la conexión directa, no con withUser(): es el mismo
  // criterio que el login (auth.ts) — la app nunca necesita leer hashes
  // dentro de una transacción de usuario.
  const [usuario] = await sql<{ password_hash: string; es_cuenta_generica: boolean }[]>`
    select password_hash, es_cuenta_generica from usuario where id = ${session.user.id}
  `;
  if (!usuario) return { error: 'La sesión venció. Volvé a ingresar.', ok: false };
  // La cuenta de oficina la usa todo el equipo: si cualquiera pudiera
  // cambiarle la clave desde acá, dejaría afuera al resto.
  if (usuario.es_cuenta_generica) {
    return {
      error: 'La contraseña de la cuenta de oficina la cambia quien administra la plataforma.',
      ok: false,
    };
  }

  if (!(await bcrypt.compare(actual, usuario.password_hash))) {
    await registrarIntento(clave);
    return { error: 'La contraseña actual no es correcta.', ok: false };
  }

  const passwordHash = await bcrypt.hash(nueva, 10);
  await withUser(session.user.id, async (tx) => {
    await tx`update usuario set password_hash = ${passwordHash} where id = mi_usuario_id()`;
    await tx`
      insert into auditoria (organizacion_id, usuario_id, entidad, entidad_id, entidad_nombre, campo)
      select organizacion_id, id, 'usuario', id, nombre, '(contraseña cambiada)'
      from usuario where id = mi_usuario_id()
    `;
  });

  return { error: null, ok: true };
}
