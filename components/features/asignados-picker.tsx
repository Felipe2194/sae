"use client";

import { ChevronDown, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { UserAvatar, UserAvatarStack, type UsuarioAvatar } from "./user-avatar";

type Props = {
  usuarios: UsuarioAvatar[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  placeholder?: string;
  // Muestra un "Asignar a todos" arriba de la lista — para tareas urgentes o
  // sin dueño claro, donde cualquiera que esté en la oficina la puede tomar.
  // No se ofrece en colaboradores de área: ahí "todos" no tiene el mismo
  // sentido (un área ya tiene su propio responsable + equipo estable).
  permitirTodos?: boolean;
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
  permitirTodos = false,
}: Props) {
  const seleccionados = usuarios.filter((u) => selectedIds.includes(u.id));
  const todosSeleccionados = usuarios.length > 0 && seleccionados.length === usuarios.length;

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id],
    );
  }

  function toggleTodos() {
    onChange(todosSeleccionados ? [] : usuarios.map((u) => u.id));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="border-input hover:bg-accent flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-2.5 text-sm transition-colors">
        {todosSeleccionados ? (
          <span className="flex items-center gap-1.5 text-xs">
            <Users className="size-3.5 text-muted-foreground" />
            Todos ({seleccionados.length})
          </span>
        ) : seleccionados.length > 0 ? (
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
        {permitirTodos && (
          <>
            <DropdownMenuCheckboxItem checked={todosSeleccionados} onCheckedChange={toggleTodos}>
              <span className="flex items-center gap-2">
                <Users className="size-3.5" />
                Todos — cualquiera en la oficina
              </span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
          </>
        )}
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
