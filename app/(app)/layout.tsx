import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { withUser } from '@/lib/db';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { PanelNotificaciones } from "@/components/features/panel-notificaciones";
import { ThemeToggle } from "@/components/features/theme-toggle";
import { AppSidebar } from "@/components/features/app-sidebar";
import { MusicPlayer } from "@/components/features/music-player";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  // Se consulta acá (no vía el JWT de la sesión) para que un cambio de color
  // en /perfil o de branding en /admin se vea reflejado al toque, sin
  // esperar a un nuevo login.
  const { fila, playlists } = await withUser(session.user.id, async (tx) => {
    const [fila] = await tx<{ avatar_color: string | null; logo_url: string | null; color_principal: string | null }[]>`
      select u.avatar_color, o.logo_url, o.color_principal
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

  return (
    <SidebarProvider
      style={fila?.color_principal ? ({ "--primary": fila.color_principal } as React.CSSProperties) : undefined}
    >
      <AppSidebar
        user={{ name: session.user.name, email: session.user.email }}
        rol={(session.user as { rol: string }).rol}
        avatarColor={fila?.avatar_color ?? null}
        logoUrl={fila?.logo_url ?? null}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card/80 backdrop-blur-sm px-4">
          <SidebarTrigger className="size-9" />
          <span className="text-muted-foreground text-sm font-medium">SAE · UTN FRVM</span>
          <div className="ml-auto flex items-center gap-1">
            <PanelNotificaciones />
            <ThemeToggle />
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
