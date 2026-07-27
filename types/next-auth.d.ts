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
    };
  }

  interface User {
    rol: RolUsuario;
    organizacion_id: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    rol: RolUsuario;
    organizacion_id: string;
  }
}
