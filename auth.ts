import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { sql } from '@/lib/db';

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
          }[]
        >`
          select id, nombre, email, password_hash, rol, estado, organizacion_id
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

        return {
          id: usuario.id,
          name: usuario.nombre,
          email: usuario.email,
          rol: usuario.rol,
          organizacion_id: usuario.organizacion_id,
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
        return '/pendiente-de-aprobacion';
      }

      if (usuario.estado !== 'activo') return '/pendiente-de-aprobacion';

      return true;
    },
    async jwt({ token, user, account }) {
      if (user && account?.provider === 'credentials') {
        token.id = user.id;
        token.rol = (user as { rol: string }).rol;
        token.organizacion_id = (user as { organizacion_id: string }).organizacion_id;
      } else if (user && account?.provider === 'google' && user.email) {
        // Volver a buscar el usuario acá porque el `user` que entrega el
        // provider de Google no trae rol/organizacion_id (no son parte del
        // perfil de OAuth) — son propios de nuestra tabla `usuario`.
        const [usuario] = await sql<
          { id: string; rol: string; organizacion_id: string }[]
        >`
          select id, rol, organizacion_id from usuario where email = ${user.email} limit 1
        `;
        if (usuario) {
          token.id = usuario.id;
          token.rol = usuario.rol;
          token.organizacion_id = usuario.organizacion_id;
        }
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      (session.user as { rol: string }).rol = token.rol as string;
      (session.user as { organizacion_id: string }).organizacion_id =
        token.organizacion_id as string;
      return session;
    },
  },

  pages: {
    signIn: '/login',
  },
});
