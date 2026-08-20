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
  UsersRound,
  ShieldCheck,
  CircleUser,
  LogOut,
  BarChart3,
  UserRoundCog,
} from "lucide-react";
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

const ITEMS_BASE: { href: string; label: string; icon: React.ElementType; roles: string[] | null }[] = [
  { href: "/hoy", label: "Hoy", icon: Sparkles, roles: null },
  { href: "/tablero", label: "Tablero", icon: LayoutDashboard, roles: null },
  { href: "/calendario", label: "Calendario", icon: Calendar, roles: null },
  { href: "/cronograma", label: "Cronograma", icon: CalendarRange, roles: null },
  { href: "/areas", label: "Áreas", icon: Layers3, roles: null },
  { href: "/coordinacion", label: "Coordinación", icon: UsersRound, roles: ["coordinador", "administrador"] },
  { href: "/informes", label: "Informes", icon: BarChart3, roles: ["coordinador", "administrador"] },
  { href: "/admin", label: "Admin", icon: ShieldCheck, roles: ["administrador"] },
];

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
}: {
  user: SidebarUser;
  rol: string;
  avatarColor: string | null;
  logoUrl?: string | null;
  puedeCambiarPerfil?: boolean;
}) {
  const pathname = usePathname();
  const inits = iniciales(user.name);
  const items = ITEMS_BASE.filter((item) => item.roles === null || item.roles.includes(rol));
  const colorFondo = avatarColor ?? AVATAR_COLOR_DEFAULT;
  const logo = logoUrl || "/LogoUTN.png";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {/* Sidebar expandido: logo completo */}
        <div className="group-data-[collapsible=icon]:hidden px-3 py-3 flex flex-col gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo}
            alt="UTN Villa María"
            width={170}
            style={{ objectFit: "contain", objectPosition: "left", display: "block" }}
          />
          <span className="text-muted-foreground text-[12px] font-medium tracking-wide">
            Sistema de Actividades Estudiantiles
          </span>
        </div>
        {/* Sidebar colapsado: símbolo UTN */}
        <div className="hidden group-data-[collapsible=icon]:flex items-center justify-center py-3">
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
                    className="text-base gap-3 px-3"
                  >
                    <item.icon className="size-5 shrink-0" />
                    <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton size="lg" className="h-auto py-2" />}>
            {/* Expandido: logo + nombre */}
            <div className="flex flex-col gap-1.5 group-data-[collapsible=icon]:hidden w-full">
              <div className="flex items-center gap-1.5 opacity-60">
                <span className="text-[11px] font-medium tracking-wide uppercase">UTN FRVM</span>
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
                  <span className="truncate font-medium">{user.name.split(" ")[0]}</span>
                  <span className="text-muted-foreground truncate text-xs">{user.email}</span>
                </div>
              </div>
            </div>
            {/* Colapsado: solo avatar */}
            <Avatar className="size-6 group-data-[collapsible=icon]:flex hidden">
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
            >
              <CircleUser className="size-4" />
              Mi perfil
            </DropdownMenuItem>
            {puedeCambiarPerfil && (
              <DropdownMenuItem
                nativeButton={false}
                render={<Link href="/cambiar-perfil" />}
              >
                <UserRoundCog className="size-4" />
                Cambiar de perfil
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => (document.getElementById("signout-form") as HTMLFormElement)?.requestSubmit()}>
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
