import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function RegistroPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Crear cuenta</CardTitle>
        <CardDescription>
          Tu cuenta queda pendiente hasta que un coordinador la apruebe.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" placeholder="Nombre y apellido" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="nombre@sae.test" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" />
          </div>
          <Button type="submit" className="mt-2">
            Crear cuenta
          </Button>
        </form>
      </CardContent>
      <CardFooter className="text-sm">
        <span className="text-muted-foreground">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="text-foreground underline">
            Iniciá sesión
          </Link>
        </span>
      </CardFooter>
    </Card>
  );
}
