'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { registrar } from './actions';

export default function RegistroPage() {
  const [state, action, isPending] = useActionState(registrar, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crear cuenta</CardTitle>
        <CardDescription>
          Tu cuenta queda pendiente hasta que un coordinador la apruebe.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              name="nombre"
              placeholder="Nombre y apellido"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="nombre@frvm.utn.edu.ar"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={8}
              required
            />
          </div>
          {state?.error && (
            <p className="text-sm text-red-500">{state.error}</p>
          )}
          <Button type="submit" className="mt-2" disabled={isPending}>
            {isPending ? 'Creando cuenta…' : 'Crear cuenta'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="text-sm">
        <span className="text-muted-foreground">
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" className="text-foreground underline">
            Iniciá sesión
          </Link>
        </span>
      </CardFooter>
    </Card>
  );
}
