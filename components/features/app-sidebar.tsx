"use client";

import type React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sparkles,
  LayoutDashboard,
  Calendar,
  CalendarRange,
  Layers3,
  CircleUser,
  LogOut,
  BarChart3,
  UserRoundCog,
  Globe,
  School,
} from "lucide-react";
import type { SeccionesHabilitadas } from "@/lib/secciones";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { signOut } from "@/app/(app)/actions";

const ITEMS_BASE: {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: string[] | null;
  seccion: keyof SeccionesHabilitadas | null;
}[] = [
  { href: "/hoy", label: "Hoy", icon: Sparkles, roles: null, seccion: null },
  {
    href: "/tablero",
    label: "Tablero",
    icon: LayoutDashboard,
    roles: null,
    seccion: "tablero",
  },
  {
    href: "/calendario",
    label: "Calendario",
    icon: Calendar,
    roles: null,
    seccion: "calendario",
  },
  {
    href: "/cronograma",
    label: "Cronograma",
    icon: CalendarRange,
    roles: null,
    seccion: "cronograma",
  },
  {
    href: "/proyectos",
    label: "Proyectos",
    icon: Layers3,
    roles: null,
    seccion: "proyectos",
  },
  {
    href: "/visitas",
    label: "Visitas",
    icon: School,
    roles: null,
    seccion: "visitas",
  },
  {
    href: "/informes",
    label: "Informes",
    icon: BarChart3,
    roles: ["administrador"],
    seccion: null,
  },
];

// Aparte de ITEMS_BASE: no es un rol de rol_usuario (que es siempre relativo
// a una organización), sino el dueño de la plataforma — ver auth.ts.
const ITEM_PLATAFORMA = {
  href: "/plataforma",
  label: "Plataforma",
  icon: Globe,
  roles: null,
  seccion: null,
};

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

type SidebarUser = {
  name: string;
  email: string;
};

const AVATAR_COLOR_DEFAULT = "oklch(0.62 0.19 42)";

export function AppSidebar({
  user,
  rol,
  avatarColor,
  logoUrl,
  puedeCambiarPerfil,
  esSuperadmin,
  secciones,
}: {
  user: SidebarUser;
  rol: string;
  avatarColor: string | null;
  logoUrl?: string | null;
  puedeCambiarPerfil?: boolean;
  esSuperadmin?: boolean;
  secciones: SeccionesHabilitadas;
}) {
  const pathname = usePathname();
  // En mobile la sidebar es un Sheet (cajón) que se abre encima de la
  // página — al navegar a otra sección se quedaba abierto tapando el
  // contenido hasta tocar afuera para cerrarlo a mano.
  const { isMobile, setOpenMobile } = useSidebar();
  const cerrarSiMobile = () => {
    if (isMobile) setOpenMobile(false);
  };
  const inits = iniciales(user.name);
  const items = ITEMS_BASE.filter(
    (item) =>
      (item.roles === null || item.roles.includes(rol)) &&
      (item.seccion === null || secciones[item.seccion]),
  );
  if (esSuperadmin) items.push(ITEM_PLATAFORMA);
  const colorFondo = avatarColor ?? AVATAR_COLOR_DEFAULT;
  const logo = logoUrl || "/LogoUTN.png";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {/* Sidebar expandido: logo completo */}
        <div className="flex flex-col gap-1 px-3 py-3 group-data-[collapsible=icon]:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo}
            alt="UTN Villa María"
            width={170}
            className={logoUrl ? "block" : "block dark:hidden"}
            style={{
              objectFit: "contain",
              objectPosition: "left",
            }}
          />
          {/* Organización sin logo propio: el texto del logo por defecto es
              negro y desaparece sobre el sidebar oscuro — variante con el
              texto en blanco (public/LogoUTN-dark.png) solo para ese caso;
              un logo subido por la organización se muestra tal cual siempre.
              El display no puede ir en `style` (inline) porque le gana en
              especificidad a las clases dark:hidden/dark:block de Tailwind y
              las dos imágenes quedaban visibles a la vez sin importar el
              tema. */}
          {!logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/LogoUTN-dark.png"
              alt="UTN Villa María"
              width={170}
              className="hidden dark:block"
              style={{
                objectFit: "contain",
                objectPosition: "left",
              }}
            />
          )}
          <span className="text-muted-foreground text-[12px] font-medium tracking-wide">
            Sistema de Actividades Estudiantiles
          </span>
        </div>
        {/* Sidebar colapsado: símbolo UTN */}
        <div className="hidden items-center justify-center py-3 group-data-[collapsible=icon]:flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon.jpg"
            alt="UTN"
            width={32}
            height={32}
            className="rounded-lg"
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={pathname.startsWith(item.href)}
                    tooltip={item.label}
                    size="lg"
                    className="gap-3 px-3 text-base"
                    onClick={cerrarSiMobile}
                  >
                    <item.icon className="size-5 shrink-0" />
                    <span className="group-data-[collapsible=icon]:hidden">
                      {item.label}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton size="lg" className="h-auto py-2" />}
          >
            {/* Expandido: logo + nombre */}
            <div className="flex w-full flex-col gap-1.5 group-data-[collapsible=icon]:hidden">
              <div className="flex items-center gap-1.5 opacity-60">
                <span className="text-[11px] font-medium tracking-wide uppercase">
                  UTN FRVM
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Avatar className="size-7">
                  <AvatarFallback
                    className="text-xs font-semibold text-white"
                    style={{ backgroundColor: colorFondo }}
                  >
                    {inits}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {user.name.split(" ")[0]}
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    {user.email}
                  </span>
                </div>
              </div>
            </div>
            {/* Colapsado: solo avatar */}
            <Avatar className="hidden size-6 group-data-[collapsible=icon]:flex">
              <AvatarFallback
                className="text-[11px] font-semibold text-white"
                style={{ backgroundColor: colorFondo }}
              >
                {inits}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuItem
              nativeButton={false}
              render={<Link href="/perfil" />}
              onClick={cerrarSiMobile}
            >
              <CircleUser className="size-4" />
              Mi perfil
            </DropdownMenuItem>
            {puedeCambiarPerfil && (
              <DropdownMenuItem
                nativeButton={false}
                render={<Link href="/cambiar-perfil" />}
                onClick={cerrarSiMobile}
              >
                <UserRoundCog className="size-4" />
                Cambiar de perfil
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                (
                  document.getElementById("signout-form") as HTMLFormElement
                )?.requestSubmit()
              }
            >
              <LogOut className="size-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <form id="signout-form" action={signOut} className="hidden" />
      </SidebarFooter>
    </Sidebar>
  );
}
