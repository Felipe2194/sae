import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MascotaTigre } from "@/components/features/mascota-tigre";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="bg-primary/10 flex size-14 items-center justify-center rounded-full">
        <MascotaTigre className="text-primary size-7" />
      </div>
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="text-xl font-semibold">Página no encontrada</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        La página que buscás no existe o fue movida.
      </p>
      <Button nativeButton={false} render={<Link href="/hoy" />}>
        Volver al inicio
      </Button>
    </div>
  );
}
