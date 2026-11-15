"use client";

import { useActionState, useState } from "react";
import { Lock } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cambiarPerfilProtegido } from "./actions";

// Perfil administrador: en vez de entrar de un toque, pide la contraseña de
// esa persona (ver authorize() de quick-switch en auth.ts).
export function PerfilProtegido({
  usuarioId,
  nombre,
  iniciales,
  color,
}: {
  usuarioId: string;
  nombre: string;
  iniciales: string;
  color: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState(
    cambiarPerfilProtegido.bind(null, usuarioId),
    null,
  );

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="bg-card hover:border-primary hover:bg-accent focus-visible:ring-ring relative flex w-full flex-col items-center gap-3 rounded-xl border p-5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <Lock
          className="text-muted-foreground absolute top-2 right-2 size-3.5"
          aria-label="Pide contraseña"
        />
        <Avatar size="lg" className="size-16">
          <AvatarFallback
            className="text-lg font-semibold text-white"
            style={{ backgroundColor: color }}
          >
            {iniciales}
          </AvatarFallback>
        </Avatar>
        <span className="text-center text-sm leading-tight font-medium">{nombre}</span>
      </button>
    );
  }

  return (
    <form
      action={accion}
      className="bg-card border-primary flex w-full flex-col gap-2 rounded-xl border p-3"
    >
      <span className="text-center text-sm leading-tight font-medium">{nombre}</span>
      <Input
        name="password"
        type="password"
        autoFocus
        autoComplete="current-password"
        placeholder="Contraseña"
        aria-label={`Contraseña de ${nombre}`}
        maxLength={72}
      />
      {estado?.error && (
        <p role="alert" className="text-destructive text-xs">
          {estado.error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="flex-1"
          onClick={() => setAbierto(false)}
        >
          Cancelar
        </Button>
        <Button type="submit" size="sm" className="flex-1" disabled={pendiente}>
          Entrar
        </Button>
      </div>
    </form>
  );
}
