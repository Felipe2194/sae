import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { sql } from "@/lib/db";
import { hashToken } from "@/lib/invitaciones";
import { CompletarInvitacionForm } from "./completar-form";

// Sin caché estática: el token se valida contra la base en cada visita, no
// puede quedar pegado a una respuesta prerenderizada en el build.
export const dynamic = "force-dynamic";

export default async function InvitacionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Ruta pública, sin sesión: `sql` directo (superuser), igual criterio que
  // /registro y /inscripcion-viaje — no hay ningún usuario autenticado cuyo
  // id pasarle a withUser().
  const [usuario] = await sql<
    [{ id: string; nombre: string; token_invitacion_expira: string } | undefined]
  >`
    select id, nombre, token_invitacion_expira::text
    from usuario
    where token_invitacion_hash = ${hashToken(token)}
  `;
  const valido =
    usuario && new Date(usuario.token_invitacion_expira) > new Date();

  if (!valido) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Link no válido</CardTitle>
          <CardDescription>
            Este link de invitación ya no funciona — puede que haya vencido
            (dura 7 días) o que ya se haya usado. Pedile uno nuevo a un
            administrador.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return <CompletarInvitacionForm token={token} nombre={usuario.nombre} />;
}
