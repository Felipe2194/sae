import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { getToken } from 'next-auth/jwt';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { sql } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { RolUsuario } from '@/types/database';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const [usuario] = await sql<
          {
            id: string;
            nombre: string;
            email: string;
            password_hash: string;
            rol: 'miembro' | 'coordinador' | 'administrador';
            estado: string;
            organizacion_id: string;
            es_cuenta_generica: boolean;
          }[]
        >`
          select id, nombre, email, password_hash, rol, estado, organizacion_id, es_cuenta_generica
          from usuario
          where email = ${credentials.email as string}
          limit 1
        `;

        if (!usuario) return null;
        if (usuario.estado !== 'activo') return null;

        const valido = await bcrypt.compare(
          credentials.password as string,
          usuario.password_hash,
        );
        if (!valido) return null;

        await sql`update usuario set ultimo_login = now() where id = ${usuario.id}`;

        return {
          id: usuario.id,
          name: usuario.nombre,
          email: usuario.email,
          rol: usuario.rol,
          organizacion_id: usuario.organizacion_id,
          esCuentaGenerica: usuario.es_cuenta_generica,
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
      id: 'quick-switch',
      name: 'Cambiar de perfil',
      credentials: {
        usuarioId: { label: 'Usuario', type: 'text' },
      },
      async authorize(credentials, request) {
        const usuarioId = credentials?.usuarioId as string | undefined;
        if (!usuarioId) return null;

        const tokenActual = await getToken({ req: request, secret: process.env.AUTH_SECRET });
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

        const [destino] = await sql<
          { id: string; nombre: string; email: string; rol: RolUsuario; organizacion_id: string }[]
        >`
          select id, nombre, email, rol, organizacion_id
          from usuario
          where id = ${usuarioId}
            and organizacion_id = ${origen.organizacion_id}
            and estado = 'activo'
            and es_cuenta_generica = false
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
          origenGenericoId,
        };
      },
    }),
  ],

  session: { strategy: 'jwt' },

  callbacks: {
    // Login con Google: no hay adapter ni tabla de sesiones, así que la
    // vinculación con la fila `usuario` se resuelve acá a mano.
    // - Email nuevo → se da de alta en estado 'pendiente' (misma política que
    //   el registro por Credentials) y se manda a la pantalla de espera.
    // - Email existente pero no activo → también a la pantalla de espera.
    // - Email existente y activo → sigue el login normal.
    async signIn({ user, account }) {
      if (account?.provider !== 'google') return true;
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

        await sql`
          insert into usuario (organizacion_id, nombre, email, password_hash, rol, estado)
          values (${org.id}, ${user.name ?? user.email}, ${user.email}, ${passwordHash}, 'miembro', 'pendiente')
        `;
        logger.info('alta automática vía Google', { email: user.email });
        return '/pendiente-de-aprobacion';
      }

      if (usuario.estado !== 'activo') {
        logger.warn('login bloqueado: usuario no activo', {
          email: user.email,
          estado: usuario.estado,
        });
        return '/pendiente-de-aprobacion';
      }

      await sql`update usuario set ultimo_login = now() where id = ${usuario.id}`;

      return true;
    },
    async jwt({ token, user, account }) {
      if (user && account?.provider === 'credentials') {
        token.id = user.id as string;
        token.rol = user.rol;
        token.organizacion_id = user.organizacion_id;
        token.esCuentaGenerica = user.esCuentaGenerica ?? false;
        delete token.origenGenericoId;
      } else if (user && account?.provider === 'google' && user.email) {
        // Volver a buscar el usuario acá porque el `user` que entrega el
        // provider de Google no trae rol/organizacion_id (no son parte del
        // perfil de OAuth) — son propios de nuestra tabla `usuario`.
        const [usuario] = await sql<
          { id: string; rol: RolUsuario; organizacion_id: string; es_cuenta_generica: boolean }[]
        >`
          select id, rol, organizacion_id, es_cuenta_generica from usuario where email = ${user.email} limit 1
        `;
        if (usuario) {
          token.id = usuario.id;
          token.rol = usuario.rol;
          token.organizacion_id = usuario.organizacion_id;
          token.esCuentaGenerica = usuario.es_cuenta_generica;
          delete token.origenGenericoId;
        }
      } else if (user && account?.provider === 'quick-switch') {
        token.id = user.id as string;
        token.rol = user.rol;
        token.organizacion_id = user.organizacion_id;
        token.esCuentaGenerica = false;
        token.origenGenericoId = user.origenGenericoId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.rol = token.rol;
      session.user.organizacion_id = token.organizacion_id;
      session.user.esCuentaGenerica = Boolean(token.esCuentaGenerica);
      session.user.puedeCambiarPerfil = Boolean(
        token.esCuentaGenerica || token.origenGenericoId,
      );
      return session;
    },
  },

  pages: {
    signIn: '/login',
  },
});
