import { sql } from "@/lib/db";
import { LandingScreen } from "./landing-screen";

// Sin sesión todavía — mismo query que app/login/page.tsx para reflejar el
// logo/color de la organización en la landing (coherencia visual con el
// login al que lleva). No se comparte una función porque son dos consultas
// casi idénticas en dos server components distintos — no vale la pena
// abstraer por dos usos.
export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const [org] = await sql<{ logo_url: string | null; color_principal: string | null }[]>`
    select logo_url, color_principal from organizacion where slug = 'sae-frvm' limit 1
  `;

  return (
    <LandingScreen
      logoUrl={org?.logo_url ?? null}
      brandColor={org?.color_principal || "#e05b22"}
    />
  );
}
