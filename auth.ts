import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
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
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.rol = (user as { rol: string }).rol;
        token.organizacion_id = (user as { organizacion_id: string }).organizacion_id;
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
