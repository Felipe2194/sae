"use client";

import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { UserAvatar, UserAvatarStack, type UsuarioAvatar } from "./user-avatar";

type Props = {
  usuarios: UsuarioAvatar[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  placeholder?: string;
};

// Selector múltiple de personas (co-asignados a una tarea o un área). No hay
// Popover/Command en components/ui — se arma con DropdownMenu +
// DropdownMenuCheckboxItem, que ya vienen instalados. El menú se queda
// abierto al tildar (closeOnClick=false por default en CheckboxItem).
export function AsignadosPicker({
  usuarios,
  selectedIds,
  onChange,
  label = "Asignados",
  placeholder = "Sin asignar",
}: Props) {
  const seleccionados = usuarios.filter((u) => selectedIds.includes(u.id));

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id],
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="border-input hover:bg-accent flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-2.5 text-sm transition-colors">
        {seleccionados.length > 0 ? (
          <div className="flex min-w-0 items-center gap-1.5">
            <UserAvatarStack usuarios={seleccionados} size="sm" max={4} />
            <span className="text-muted-foreground truncate text-xs">
              {seleccionados.length} persona{seleccionados.length !== 1 ? "s" : ""}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <ChevronDown className="text-muted-foreground size-3.5 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <p className="text-muted-foreground px-1.5 py-1 text-xs font-medium">{label}</p>
        {usuarios.map((u) => (
          <DropdownMenuCheckboxItem
            key={u.id}
            checked={selectedIds.includes(u.id)}
            onCheckedChange={() => toggle(u.id)}
          >
            <span className="flex items-center gap-2">
              <UserAvatar nombre={u.nombre} avatarColor={u.avatar_color} size="sm" />
              {u.nombre}
            </span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
