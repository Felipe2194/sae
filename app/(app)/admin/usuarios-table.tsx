"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cambiarEstadoUsuario, cambiarRolUsuario } from "./actions";

export type UsuarioFila = {
  id: string;
  nombre: string;
  email: string;
  rol: "miembro" | "coordinador" | "administrador";
  estado: "pendiente" | "activo" | "inactivo";
  creada_en: string;
};

const ESTADO_BADGE: Record<
  UsuarioFila["estado"],
  { label: string; className: string }
> = {
  pendiente: {
    label: "Pendiente",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  activo: {
    label: "Activo",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  inactivo: {
    label: "Inactivo",
    className: "bg-muted text-muted-foreground",
  },
};

const ROL_LABEL: Record<UsuarioFila["rol"], string> = {
  miembro: "Miembro",
  coordinador: "Coordinador",
  administrador: "Administrador",
};

function UsuarioRow({
  usuario,
  esSelf,
}: {
  usuario: UsuarioFila;
  esSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const badge = ESTADO_BADGE[usuario.estado];

  function aprobar() {
    startTransition(() => cambiarEstadoUsuario(usuario.id, "activo"));
  }

  function desactivar() {
    startTransition(() => cambiarEstadoUsuario(usuario.id, "inactivo"));
  }

  function reactivar() {
    startTransition(() => cambiarEstadoUsuario(usuario.id, "activo"));
  }

  function onRolChange(rol: string) {
    startTransition(() => cambiarRolUsuario(usuario.id, rol));
  }

  return (
    <tr
      className={`border-b last:border-0 ${pending ? "opacity-50" : ""}`}
    >
      {/* Nombre + email */}
      <td className="px-4 py-3">
        <p className="font-medium text-sm leading-tight">
          {usuario.nombre}
          {esSelf && (
            <span className="ml-2 text-[10px] text-muted-foreground font-normal">
              (vos)
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">{usuario.email}</p>
      </td>

      {/* Estado */}
      <td className="px-3 py-3 whitespace-nowrap">
        <Badge className={badge.className}>{badge.label}</Badge>
      </td>

      {/* Rol */}
      <td className="px-3 py-3 whitespace-nowrap">
        {esSelf || usuario.estado !== "activo" ? (
          <span className="text-sm text-muted-foreground">
            {ROL_LABEL[usuario.rol]}
          </span>
        ) : (
          <Select
            value={usuario.rol}
            onValueChange={onRolChange}
            disabled={pending}
          >
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="miembro">Miembro</SelectItem>
              <SelectItem value="coordinador">Coordinador</SelectItem>
              <SelectItem value="administrador">Administrador</SelectItem>
            </SelectContent>
          </Select>
        )}
      </td>

      {/* Acciones */}
      <td className="px-3 py-3 whitespace-nowrap">
        {esSelf ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : usuario.estado === "pendiente" ? (
          <Button size="sm" onClick={aprobar} disabled={pending} className="h-8 text-xs">
            Aprobar
          </Button>
        ) : usuario.estado === "activo" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={desactivar}
            disabled={pending}
            className="h-8 text-xs text-destructive hover:text-destructive"
          >
            Desactivar
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={reactivar}
            disabled={pending}
            className="h-8 text-xs"
          >
            Reactivar
          </Button>
        )}
      </td>
    </tr>
  );
}

export function UsuariosTable({
  usuarios,
  selfId,
}: {
  usuarios: UsuarioFila[];
  selfId: string;
}) {
  const pendientes = usuarios.filter((u) => u.estado === "pendiente");
  const resto = usuarios.filter((u) => u.estado !== "pendiente");
  const ordenados = [...pendientes, ...resto];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium w-full">
              Usuario
            </th>
            <th className="text-muted-foreground px-3 py-3 text-left text-xs font-medium whitespace-nowrap">
              Estado
            </th>
            <th className="text-muted-foreground px-3 py-3 text-left text-xs font-medium whitespace-nowrap">
              Rol
            </th>
            <th className="text-muted-foreground px-3 py-3 text-left text-xs font-medium whitespace-nowrap">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {ordenados.map((u) => (
            <UsuarioRow key={u.id} usuario={u} esSelf={u.id === selfId} />
          ))}
          {ordenados.length === 0 && (
            <tr>
              <td
                colSpan={4}
                className="text-muted-foreground px-4 py-6 text-center text-sm"
              >
                No hay usuarios.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
