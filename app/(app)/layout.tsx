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

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  // Se consulta acá (no vía el JWT de la sesión) para que un cambio de color
  // en /perfil o de branding en /admin se vea reflejado al toque, sin
  // esperar a un nuevo login.
  const [fila] = await withUser(session.user.id, (tx) =>
    tx<{ avatar_color: string | null; logo_url: string | null; color_principal: string | null }[]>`
      select u.avatar_color, o.logo_url, o.color_principal
      from usuario u
      join organizacion o on o.id = u.organizacion_id
      where u.id = mi_usuario_id()
    `,
  );

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
    </SidebarProvider>
  );
}
