import Link from "next/link";
import { Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PendienteDeAprobacionPage() {
  return (
    <Card>
      <CardHeader className="items-center text-center">
        <Clock className="text-muted-foreground mb-2 size-8" />
        <CardTitle>Cuenta pendiente de aprobación</CardTitle>
        <CardDescription>
          Un coordinador todavía no aprobó tu registro. Te vamos a avisar por
          email en cuanto puedas entrar.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/login" />}
        >
          Volver al login
        </Button>
      </CardContent>
    </Card>
  );
}
