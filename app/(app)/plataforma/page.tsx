import { redirect } from "next/navigation";
import { Globe } from "lucide-react";
import { auth } from "@/auth";
import { sql } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { NuevaOrganizacionForm } from "./nueva-organizacion-form";

export type OrganizacionFila = {
  id: string;
  nombre: string;
  slug: string;
  zona_horaria: string;
  creada_en: string;
  usuarios_total: number;
  usuarios_activos: number;
};

export default async function PlataformaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.esSuperadmin) redirect("/hoy");

  const organizaciones = await sql<OrganizacionFila[]>`
    select
      o.id,
      o.nombre,
      o.slug,
      o.zona_horaria,
      o.creada_en::text as creada_en,
      count(u.id)::int as usuarios_total,
      count(u.id) filter (where u.estado = 'activo')::int as usuarios_activos
    from organizacion o
    left join usuario u on u.organizacion_id = o.id
    group by o.id
    order by o.creada_en asc
  `;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div>
        <div className="flex items-center gap-2">
          <Globe className="text-muted-foreground size-5" />
          <h1 className="text-2xl font-semibold tracking-tight">Plataforma</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          Organizaciones (secretarías) que usan el sistema. Cada una es un espacio
          separado: su propio equipo, su propio cronograma, su propia cuenta
          genérica de oficina.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Organizaciones existentes</h2>
        <Card>
          <CardContent className="p-0">
            {organizaciones.length === 0 ? (
              <p className="text-muted-foreground px-4 py-6 text-center text-sm">
                Todavía no hay ninguna.
              </p>
            ) : (
              <div className="divide-y">
                {organizaciones.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm leading-tight">{o.nombre}</p>
                      <p className="text-muted-foreground text-xs">/{o.slug}</p>
                    </div>
                    <p className="text-muted-foreground shrink-0 text-xs">
                      {o.usuarios_activos} activo{o.usuarios_activos === 1 ? "" : "s"}
                      {o.usuarios_total !== o.usuarios_activos && ` · ${o.usuarios_total} en total`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Crear organización nueva</h2>
        <p className="text-muted-foreground text-sm -mt-1">
          Se crea la organización y su cuenta genérica de oficina (administrador),
          con una contraseña temporal que se muestra una sola vez acá — compartila
          con esa secretaría por un canal seguro. Desde ahí entran y dan de alta
          al resto de su equipo en /admin.
        </p>
        <Card>
          <CardContent className="pt-4">
            <NuevaOrganizacionForm />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
