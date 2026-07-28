"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Sun,
  Kanban,
  CalendarDays,
  Clock,
  Layers,
  Users,
  Settings,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { usuarioActual } from "@/lib/mock-data";

const items = [
  { href: "/hoy", label: "Hoy", icon: Sun },
  { href: "/tablero", label: "Tablero", icon: Kanban },
  { href: "/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/cronograma", label: "Cronograma", icon: Clock },
  { href: "/areas", label: "Áreas", icon: Layers },
  { href: "/coordinacion", label: "Coordinación", icon: Users },
  { href: "/admin", label: "Admin", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="size-8 shrink-0 rounded-lg bg-[oklch(0.62_0.19_42)] flex items-center justify-center overflow-hidden">
            <Image
              src="/LogoUTN.png"
              alt="UTN"
              width={28}
              height={28}
              className="object-contain brightness-0 invert"
            />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-semibold text-sm">SAE · FRVM</span>
            <span className="text-muted-foreground text-xs">UTN Villa María</span>
          </div>
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
          <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
            <Avatar className="size-6">
              <AvatarFallback>{usuarioActual.iniciales}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-medium">
                {usuarioActual.nombre}
              </span>
              <span className="text-muted-foreground truncate text-xs">
                {usuarioActual.email}
              </span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuItem
              nativeButton={false}
              render={<Link href="/perfil" />}
            >
              Mi perfil
            </DropdownMenuItem>
            <DropdownMenuItem
              nativeButton={false}
              render={<Link href="/login" />}
            >
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
