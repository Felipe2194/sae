import 'next-auth';
import type { RolUsuario } from './database';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      rol: RolUsuario;
      organizacion_id: string;
      // Sesión de la cuenta genérica de oficina y sesiones nacidas de un
      // cambio de perfil (provider "quick-switch") — ver auth.ts.
      esCuentaGenerica: boolean;
      puedeCambiarPerfil: boolean;
      // Dueño de la plataforma: puede crear organizaciones (secretarías)
      // nuevas en /plataforma. No tiene relación con rol_usuario (que es
      // siempre relativo a una organización) — ver db/migrations/024.
      esSuperadmin: boolean;
    };
  }

  interface User {
    rol: RolUsuario;
    organizacion_id: string;
    esCuentaGenerica?: boolean;
    origenGenericoId?: string;
    esSuperadmin?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    rol: RolUsuario;
    organizacion_id: string;
    esCuentaGenerica?: boolean;
    origenGenericoId?: string;
    esSuperadmin?: boolean;
  }
}
