"use client";

import { useState, useTransition } from "react";
import { Check, Camera } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { actualizarNombre } from "./actions";

const COLORES = [
  { hex: "#E05B22", label: "Naranja UTN" },
  { hex: "#3b82f6", label: "Azul" },
  { hex: "#22c55e", label: "Verde" },
  { hex: "#a855f7", label: "Violeta" },
  { hex: "#ec4899", label: "Rosa" },
  { hex: "#14b8a6", label: "Teal" },
  { hex: "#f59e0b", label: "Ámbar" },
  { hex: "#6366f1", label: "Índigo" },
  { hex: "#ef4444", label: "Rojo" },
  { hex: "#64748b", label: "Slate" },
];

const ROL_LABEL: Record<string, string> = {
  miembro: "Miembro",
  coordinador: "Coordinador/a",
  administrador: "Administrador/a",
};

type Props = {
  nombre: string;
  email: string;
  rol: string;
};

export function PerfilForm({ nombre: nombreInicial, email, rol }: Props) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [color, setColor] = useState(COLORES[0].hex);
  const [guardado, setGuardado] = useState(false);
  const [isPending, startTransition] = useTransition();

  const iniciales = nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  function handleGuardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await actualizarNombre(fd);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
    });
  }

  return (
    <div className="mx-auto max-w-2xl flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Personalizá tu cuenta y cómo te ven los demás en el sistema.
        </p>
      </div>

      {/* Avatar + color */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Avatar</CardTitle>
          <CardDescription>
            Elegí un color para tu avatar. La foto de perfil estará disponible próximamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar className="size-20" style={{ backgroundColor: color }}>
                <AvatarFallback
                  className="text-2xl font-bold text-white"
                  style={{ backgroundColor: color }}
                >
                  {iniciales}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                className="absolute -bottom-1 -right-1 size-7 rounded-full bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors"
                aria-label="Subir foto (próximamente)"
              >
                <Camera className="size-3.5 text-muted-foreground" />
              </button>
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="font-semibold text-base">{nombre.split(" ")[0]}</p>
              <p className="text-muted-foreground text-sm">{email}</p>
              <Badge variant="secondary" className="mt-1 w-fit text-xs">
                {ROL_LABEL[rol] ?? rol}
              </Badge>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-sm">Color del avatar</Label>
            <div className="flex flex-wrap gap-2.5">
              {COLORES.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  title={c.label}
                  className="size-8 rounded-full transition-all hover:scale-110 flex items-center justify-center"
                  style={{ backgroundColor: c.hex }}
                  aria-label={c.label}
                >
                  {color === c.hex && (
                    <Check className="size-4 text-white drop-shadow" strokeWidth={3} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Información personal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información personal</CardTitle>
          <CardDescription>
            El email y el rol solo puede modificarlos el administrador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGuardar} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="nombre">Nombre completo</Label>
                <Input
                  id="nombre"
                  name="nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre y apellido"
                  className="h-11"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Email</Label>
                <Input value={email} disabled className="h-11 opacity-60" />
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:w-1/2">
              <Label>Rol</Label>
              <Input
                value={ROL_LABEL[rol] ?? rol}
                disabled
                className="h-11 opacity-60"
              />
            </div>

            <div className="flex items-center gap-3 mt-2">
              <Button
                type="submit"
                className="h-11 text-base px-6"
                disabled={isPending}
              >
                {guardado ? (
                  <span className="flex items-center gap-2">
                    <Check className="size-4" />
                    Guardado
                  </span>
                ) : (
                  "Guardar cambios"
                )}
              </Button>
              {guardado && (
                <p className="text-muted-foreground text-sm">
                  Los cambios se aplicaron correctamente.
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
