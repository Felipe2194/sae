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
import { login } from './actions';

export default function LoginPage() {
  const [state, action, isPending] = useActionState(login, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Iniciar sesión</CardTitle>
        <CardDescription>Entrá con tu cuenta de la secretaría.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="nombre@sae.test" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          {state?.error && (
            <p className="text-sm text-red-500">{state.error}</p>
          )}
          <Button type="submit" className="mt-2" disabled={isPending}>
            {isPending ? 'Ingresando…' : 'Iniciar sesión'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 text-sm">
        <Link href="#" className="text-muted-foreground hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>
        <span className="text-muted-foreground">
          ¿No tenés cuenta?{' '}
          <Link href="/registro" className="text-foreground underline">
            Registrate
          </Link>
        </span>
      </CardFooter>
    </Card>
  );
}
