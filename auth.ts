import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { getToken } from "next-auth/jwt";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { logger } from "@/lib/logger";
import { obtenerIp, registrarIntento, verificarLimiteIntentos } from "@/lib/rate-limit";
import type { RolUsuario } from "@/types/database";

const VENTANA_RATE_LIMIT_LOGIN_MS = 15 * 60 * 1000;

// Hash bcrypt real (costo 10, igual que bcrypt.hash(password, 10) más abajo)
// pero de ninguna cuenta existente — se usa solo para que bcrypt.compare
// tarde lo mismo cuando el email no existe que cuando existe. Ver comentario
// en authorize().
const HASH_DUMMY_TIMING = "$2a$10$zo9FMeWrwXf0/UBAbTiUAeQsX6W.ztlhyyNxTQQJ6S8v5zfhGKTvC";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = (credentials.email as string).trim().toLowerCase();

        // El rate-limit de app/login/actions.ts es solo para la UI normal —
        // Auth.js expone /api/auth/callback/credentials como ruta propia
        // (ver app/api/auth/[...nextauth]/route.ts), excluida a propósito del
        // middleware (proxy.ts, necesita quedar pública para el login), así
        // que alguien puede pegarle directo a esa ruta salteando por completo
        // esa acción. El límite real tiene que vivir acá adentro, en el único
        // lugar por el que pasan ambos caminos.
        const ip = obtenerIp(request.headers);
        const claveIp = `login:ip:${ip}`;
        const claveEmail = `login:email:${email}`;
        const [okIp, okEmail] = await Promise.all([
          verificarLimiteIntentos(claveIp, 20, VENTANA_RATE_LIMIT_LOGIN_MS),
          verificarLimiteIntentos(claveEmail, 6, VENTANA_RATE_LIMIT_LOGIN_MS),
        ]);
        if (!okIp || !okEmail) return null;

        const [usuario] = await sql<
          {
            id: string;
            nombre: string;
            email: string;
            password_hash: string;
            rol: "miembro" | "administrador";
            estado: string;
            organizacion_id: string;
            es_cuenta_generica: boolean;
            es_superadmin: boolean;
          }[]
        >`
          select id, nombre, email, password_hash, rol, estado, organizacion_id, es_cuenta_generica, es_superadmin
          from usuario
          where email = ${email}
          limit 1
        `;

        // Mismo bcrypt.compare (contra un hash fijo, no uno real) tanto si el
        // usuario no existe como si existe pero está inactivo: sin esto, la
        // rama "no existe" responde de inmediato y la rama "existe" tarda lo
        // que tarda bcrypt, y ese delta de tiempo permite enumerar emails
        // válidos midiendo la respuesta aunque el mensaje de error sea igual.
        const hashParaComparar = usuario?.password_hash ?? HASH_DUMMY_TIMING;
        const valido = await bcrypt.compare(credentials.password as string, hashParaComparar);

        if (!usuario || usuario.estado !== "activo" || !valido) {
          await Promise.all([registrarIntento(claveIp), registrarIntento(claveEmail)]);
          return null;
        }

        await sql`update usuario set ultimo_login = now() where id = ${usuario.id}`;

        return {
          id: usuario.id,
          name: usuario.nombre,
          email: usuario.email,
          rol: usuario.rol,
          organizacion_id: usuario.organizacion_id,
          esCuentaGenerica: usuario.es_cuenta_generica,
          esSuperadmin: usuario.es_superadmin,
        };
      },
    }),

    // Cambio rápido de perfil en computadoras compartidas de oficina: no pide
    // contraseña, pero solo funciona si la sesión que hace el pedido ya viene
    // de una cuenta genérica (login normal con la cuenta compartida, o un
    // switch previo). authorize() lee la cookie de sesión actual con
    // getToken() porque acá no hay `auth()` de por medio — quien dispara esto
    // es el propio signIn('quick-switch', ...), no un usuario nuevo.
    Credentials({
      id: "quick-switch",
      name: "Cambiar de perfil",
      credentials: {
        usuarioId: { label: "Usuario", type: "text" },
      },
      async authorize(credentials, request) {
        const usuarioId = credentials?.usuarioId as string | undefined;
        if (!usuarioId) return null;

        const tokenActual = await getToken({
          req: request,
          secret: process.env.AUTH_SECRET,
        });
        if (!tokenActual) return null;

        const origenGenericoId = tokenActual.esCuentaGenerica
          ? (tokenActual.id as string)
          : (tokenActual.origenGenericoId as string | undefined);
        if (!origenGenericoId) return null;

        const [origen] = await sql<{ organizacion_id: string }[]>`
          select organizacion_id from usuario
          where id = ${origenGenericoId} and es_cuenta_generica = true and estado = 'activo'
          limit 1
        `;
        if (!origen) return null;

        // es_cuenta_generica = false, salvo que sea la propia cuenta
        // genérica de origen: "seguir como cuenta de oficina" en vez de
        // elegir un integrante (ver /cambiar-perfil) — sin esto, un
        // administrador que entra con esa cuenta y en algún momento cambia
        // de perfil no tenía forma de volver a actuar como ella (la única
        // cuenta con rol administrador de una organización nueva).
        const [destino] = await sql<
          {
            id: string;
            nombre: string;
            email: string;
            rol: RolUsuario;
            organizacion_id: string;
            es_superadmin: boolean;
          }[]
        >`
          select id, nombre, email, rol, organizacion_id, es_superadmin
          from usuario
          where id = ${usuarioId}
            and organizacion_id = ${origen.organizacion_id}
            and estado = 'activo'
            and (es_cuenta_generica = false or id = ${origenGenericoId})
          limit 1
        `;
        if (!destino) return null;

        await sql`update usuario set ultimo_login = now() where id = ${destino.id}`;

        return {
          id: destino.id,
          name: destino.nombre,
          email: destino.email,
          rol: destino.rol,
          organizacion_id: destino.organizacion_id,
          esSuperadmin: destino.es_superadmin,
          origenGenericoId,
        };
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    // Login con Google: no hay adapter ni tabla de sesiones, así que la
    // vinculación con la fila `usuario` se resuelve acá a mano.
    // - Email nuevo → se da de alta en estado 'pendiente' (misma política que
    //   el registro por Credentials) y se manda a la pantalla de espera.
    // - Email existente pero no activo → también a la pantalla de espera.
    // - Email existente y activo → sigue el login normal.
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;
      if (!user.email) return false;

      const [usuario] = await sql<{ id: string; estado: string }[]>`
        select id, estado from usuario where email = ${user.email} limit 1
      `;

      if (!usuario) {
        const [org] = await sql<{ id: string }[]>`
          select id from organizacion where slug = 'sae-frvm' limit 1
        `;
        if (!org) return false;

        // password_hash no se usa para cuentas de Google (no hay login por
        // Credentials con este email), pero la columna es NOT NULL: se guarda
        // un hash de un valor aleatorio, imposible de adivinar.
        const passwordHash = await bcrypt.hash(randomUUID(), 10);

        // El dueño de la plataforma (ver SUPERADMIN_EMAIL) entra ya activo
        // como administrador de SAE FRVM y con es_superadmin — no tiene
        // sentido que quede esperando que alguien lo apruebe si todavía no
        // hay ningún administrador que pueda hacerlo.
        const esSuperadmin =
          !!process.env.SUPERADMIN_EMAIL &&
          user.email.toLowerCase() ===
            process.env.SUPERADMIN_EMAIL.toLowerCase();

        await sql`
          insert into usuario (organizacion_id, nombre, email, password_hash, rol, estado, es_superadmin)
          values (
            ${org.id},
            ${user.name ?? user.email},
            ${user.email},
            ${passwordHash},
            ${esSuperadmin ? "administrador" : "miembro"},
            ${esSuperadmin ? "activo" : "pendiente"},
            ${esSuperadmin}
          )
        `;

        if (esSuperadmin) {
          logger.info("alta de superadmin de plataforma vía Google", {
            email: user.email,
          });
          return true;
        }
        logger.info("alta automática vía Google", { email: user.email });
        return "/pendiente-de-aprobacion";
      }

      if (usuario.estado !== "activo") {
        logger.warn("login bloqueado: usuario no activo", {
          email: user.email,
          estado: usuario.estado,
        });
        return "/pendiente-de-aprobacion";
      }

      await sql`update usuario set ultimo_login = now() where id = ${usuario.id}`;

      return true;
    },
    async jwt({ token, user, account }) {
      if (user && account?.provider === "credentials") {
        token.id = user.id as string;
        token.rol = user.rol;
        token.organizacion_id = user.organizacion_id;
        token.esCuentaGenerica = user.esCuentaGenerica ?? false;
        token.esSuperadmin = user.esSuperadmin ?? false;
        delete token.origenGenericoId;
      } else if (user && account?.provider === "google" && user.email) {
        // Volver a buscar el usuario acá porque el `user` que entrega el
        // provider de Google no trae rol/organizacion_id (no son parte del
        // perfil de OAuth) — son propios de nuestra tabla `usuario`.
        const [usuario] = await sql<
          {
            id: string;
            rol: RolUsuario;
            organizacion_id: string;
            es_cuenta_generica: boolean;
            es_superadmin: boolean;
          }[]
        >`
          select id, rol, organizacion_id, es_cuenta_generica, es_superadmin from usuario where email = ${user.email} limit 1
        `;
        if (usuario) {
          token.id = usuario.id;
          token.rol = usuario.rol;
          token.organizacion_id = usuario.organizacion_id;
          token.esCuentaGenerica = usuario.es_cuenta_generica;
          token.esSuperadmin = usuario.es_superadmin;
          delete token.origenGenericoId;
        }
      } else if (user && account?.provider === "quick-switch") {
        token.id = user.id as string;
        token.rol = user.rol;
        token.organizacion_id = user.organizacion_id;
        token.esCuentaGenerica = false;
        token.esSuperadmin = user.esSuperadmin ?? false;
        token.origenGenericoId = user.origenGenericoId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.rol = token.rol;
      session.user.organizacion_id = token.organizacion_id;
      session.user.esCuentaGenerica = Boolean(token.esCuentaGenerica);
      session.user.esSuperadmin = Boolean(token.esSuperadmin);
      session.user.puedeCambiarPerfil = Boolean(
        token.esCuentaGenerica || token.origenGenericoId,
      );
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
});
