import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { BuscadorGlobal } from "@/components/features/buscador-global";
import { PanelNotificaciones } from "@/components/features/panel-notificaciones";
import { ThemeToggle } from "@/components/features/theme-toggle";
import { AppSidebar } from "@/components/features/app-sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <SidebarProvider>
      <AppSidebar
        user={{ name: session.user.name, email: session.user.email }}
        rol={(session.user as { rol: string }).rol}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card/80 backdrop-blur-sm px-4">
          <SidebarTrigger className="size-9" />
          <span className="text-muted-foreground text-sm font-medium">SAE · UTN FRVM</span>
          <div className="ml-auto flex items-center gap-1">
            <BuscadorGlobal rol={(session.user as { rol: string }).rol} />
            <PanelNotificaciones />
            <ThemeToggle />
          </div>
        </header>
        <div className="flex-1 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
