import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Settings } from 'lucide-react';
import { auth } from '@/auth';
import { withUser } from '@/lib/db';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { PanelNotificaciones } from "@/components/features/panel-notificaciones";
import { ThemeToggle } from "@/components/features/theme-toggle";
import { AppSidebar } from "@/components/features/app-sidebar";
import { MusicPlayer } from "@/components/features/music-player";
import { fondoVars } from "@/lib/fondos";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  // Login con la cuenta genérica de oficina: todavía no se eligió con qué
  // integrante se está trabajando, así que no hay tareas/música propias que
  // mostrar acá — se manda directo al selector de perfil. Pero solo si hay
  // alguien a quien elegir: una organización recién creada desde /plataforma
  // no tiene todavía ningún otro integrante, y /cambiar-perfil no ofrece
  // ninguna salida en ese caso (no tiene header ni sidebar) — quedaba
  // trabada ahí sin poder llegar nunca a /configuracion a dar de alta al
  // equipo. Si no hay nadie más, se deja pasar directo: la cuenta genérica
  // sigue como administradora hasta que se cree el primer integrante real.
  if (session.user.esCuentaGenerica) {
    const hayOtrosPerfiles = await withUser(session.user.id, async (tx) => {
      const [fila] = await tx<[{ existe: boolean }]>`
        select exists(
          select 1 from usuario
          where organizacion_id = mi_organizacion_id()
            and estado = 'activo'
            and es_cuenta_generica = false
            and id != mi_usuario_id()
        ) as existe
      `;
      return fila.existe;
    });
    if (hayOtrosPerfiles) redirect('/cambiar-perfil');
  }

  // Se consulta acá (no vía el JWT de la sesión) para que un cambio de color
  // en /perfil o de branding en /configuracion se vea reflejado al toque, sin
  // esperar a un nuevo login. El fondo es preferencia personal (usuario.*),
  // no de la organización — cada quien elige el suyo en /perfil.
  const { fila, playlists } = await withUser(session.user.id, async (tx) => {
    const [fila] = await tx<{
      avatar_color: string | null;
      logo_url: string | null;
      color_principal_usuario: string | null;
      color_principal_org: string | null;
      fondo_tipo: 'gradiente' | 'imagen' | null;
      fondo_valor: string | null;
      calendario_habilitado: boolean;
      cronograma_habilitado: boolean;
      proyectos_habilitado: boolean;
      visitas_habilitado: boolean;
      tablero_habilitado: boolean;
      viajes_habilitado: boolean;
    }[]>`
      select
        u.avatar_color, o.logo_url,
        u.color_principal as color_principal_usuario,
        o.color_principal as color_principal_org,
        u.fondo_tipo, u.fondo_valor,
        o.calendario_habilitado, o.cronograma_habilitado,
        o.proyectos_habilitado, o.visitas_habilitado, o.tablero_habilitado,
        o.viajes_habilitado
      from usuario u
      join organizacion o on o.id = u.organizacion_id
      where u.id = mi_usuario_id()
    `;

    // Playlists que la gente cargó en su perfil, para elegir en el
    // reproductor de música. Se consulta acá (y no en /hoy) porque el
    // reproductor ahora vive en el layout — así el audio sigue sonando al
    // navegar entre secciones en vez de cortarse y tener que volver a
    // darle play.
    const playlists = await tx<{ usuario_id: string; nombre: string; url: string }[]>`
      select id as usuario_id, nombre, playlist_url as url
      from usuario
      where organizacion_id = mi_organizacion_id()
        and estado = 'activo'
        and playlist_url is not null
      order by nombre asc
    `;

    return { fila, playlists: [...playlists] };
  });

  const fondo = fondoVars(fila?.fondo_tipo ?? null, fila?.fondo_valor ?? null);
  // Color del sistema: el de la persona (elegido en /perfil) manda si lo
  // hay, si no se usa el default de la organización (/configuracion) — así
  // el sistema tiene un color por defecto pero cada quien puede usar el suyo.
  const colorPrincipal = fila?.color_principal_usuario ?? fila?.color_principal_org ?? null;
  const rol = (session.user as { rol: string }).rol;

  return (
    <SidebarProvider
      style={{
        ...(colorPrincipal ? { "--primary": colorPrincipal } : {}),
        ...(fondo ? { "--fondo-light": fondo.light, "--fondo-dark": fondo.dark } : {}),
      } as React.CSSProperties}
    >
      <AppSidebar
        user={{ name: session.user.name, email: session.user.email }}
        rol={rol}
        avatarColor={fila?.avatar_color ?? null}
        logoUrl={fila?.logo_url ?? null}
        puedeCambiarPerfil={session.user.puedeCambiarPerfil}
        esSuperadmin={session.user.esSuperadmin}
        secciones={{
          tablero: fila?.tablero_habilitado ?? true,
          calendario: fila?.calendario_habilitado ?? true,
          cronograma: fila?.cronograma_habilitado ?? true,
          proyectos: fila?.proyectos_habilitado ?? true,
          visitas: fila?.visitas_habilitado ?? true,
          viajes: fila?.viajes_habilitado ?? true,
        }}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card/80 backdrop-blur-sm px-4">
          <SidebarTrigger className="size-9" />
          <span className="text-muted-foreground text-sm font-medium">SAE · UTN FRVM</span>
          <div className="ml-auto flex items-center gap-1">
            <PanelNotificaciones />
            <ThemeToggle />
            {rol === "administrador" && (
              <Button
                variant="ghost"
                size="icon-sm"
                nativeButton={false}
                render={<Link href="/configuracion" />}
                aria-label="Configuración"
                title="Configuración"
              >
                <Settings className="size-4" />
              </Button>
            )}
          </div>
        </header>
        <div className="flex-1 p-4 md:p-6">{children}</div>
      </SidebarInset>
      <MusicPlayer
        playlists={playlists.map((p) => ({ usuarioId: p.usuario_id, nombre: p.nombre, url: p.url }))}
        usuarioActualId={session.user.id}
      />
    </SidebarProvider>
  );
}
