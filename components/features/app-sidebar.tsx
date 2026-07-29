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

export function AppSidebar({ user, rol }: { user: SidebarUser; rol: string }) {
  const pathname = usePathname();
  const inits = iniciales(user.name);
  const items = ITEMS_BASE.filter((item) => item.roles === null || item.roles.includes(rol));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {/* Sidebar expandido: logo completo */}
        <div className="group-data-[collapsible=icon]:hidden px-3 py-3 flex flex-col gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/LogoUTN.png"
            alt="UTN Villa María"
            width={170}
            style={{ objectFit: "contain", objectPosition: "left", display: "block" }}
          />
          <span className="text-muted-foreground text-[11px] font-medium tracking-wide">
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
                    className="text-base"
                  >
                    <item.icon className="size-5" />
                    <span>{item.label}</span>
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/LogoUTN.png"
                  alt="UTN"
                  width={14}
                  height={14}
                  style={{ objectFit: "contain" }}
                />
                <span className="text-[10px] font-medium tracking-wide uppercase">UTN FRVM</span>
              </div>
              <div className="flex items-center gap-2">
                <Avatar className="size-7">
                  <AvatarFallback className="text-xs font-semibold bg-[oklch(0.62_0.19_42)] text-white">
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
              <AvatarFallback className="text-[10px] font-semibold bg-[oklch(0.62_0.19_42)] text-white">
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
