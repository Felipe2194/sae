"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cambiarPassword } from "./actions";

export function CambiarPasswordCard() {
  const [estado, accion, pendiente] = useActionState(cambiarPassword, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado?.ok) {
      formRef.current?.reset();
      toast.success("Contraseña actualizada.");
    }
  }, [estado]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Contraseña</CardTitle>
        <CardDescription>
          Si te pasaron una contraseña temporal, cambiala por una que solo vos conozcas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={accion} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password_actual">Contraseña actual</Label>
            <Input
              id="password_actual"
              name="password_actual"
              type="password"
              autoComplete="current-password"
              required
              maxLength={72}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password_nueva">Contraseña nueva</Label>
              <Input
                id="password_nueva"
                name="password_nueva"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password_confirmar">Repetir contraseña nueva</Label>
              <Input
                id="password_confirmar"
                name="password_confirmar"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
              />
            </div>
          </div>
          {estado?.error && (
            <p role="alert" className="text-destructive text-sm">
              {estado.error}
            </p>
          )}
          <div>
            <Button type="submit" disabled={pendiente}>
              {pendiente ? "Guardando…" : "Cambiar contraseña"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
