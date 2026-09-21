"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { completarInvitacion } from "./actions";

export function CompletarInvitacionForm({
  token,
  nombre,
}: {
  token: string;
  nombre: string;
}) {
  const router = useRouter();
  const completarConToken = completarInvitacion.bind(null, token);
  const [state, action, isPending] = useActionState(completarConToken, null);
  const [verPassword, setVerPassword] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hola, {nombre}</CardTitle>
        <CardDescription>
          Completá tu cuenta con tu email real y elegí tu contraseña. A partir
          de ahora entrás con estos datos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="nombre@frvm.utn.edu.ar"
              required
              maxLength={254}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={verPassword ? "text" : "password"}
                minLength={8}
                maxLength={72}
                required
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setVerPassword((v) => !v)}
                className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-9 items-center justify-center"
                aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                tabIndex={-1}
              >
                {verPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password_confirmar">Repetí la contraseña</Label>
            <Input
              id="password_confirmar"
              name="password_confirmar"
              type={verPassword ? "text" : "password"}
              minLength={8}
              maxLength={72}
              required
            />
          </div>
          {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
          <Button type="submit" className="mt-2" disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar y entrar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
