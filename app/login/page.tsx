import { sql } from "@/lib/db";
import { LoginScreen } from "./login-screen";

// Sin sesión todavía — se consulta la única organización del sistema
// directamente para reflejar su logo/color, igual que hacía (auth)/layout.tsx.
// Next no detecta la query como razón para renderizar dinámico (no es fetch
// ni usa cookies()/headers()), así que se fuerza para no dejar el logo/color
// pegados al valor que tenía la organización al momento del build.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const [org] = await sql<{ logo_url: string | null; color_principal: string | null }[]>`
    select logo_url, color_principal from organizacion where slug = 'sae-frvm' limit 1
  `;

  return (
    <LoginScreen
      logo={org?.logo_url || "/LogoUTN.png"}
      brandColor={org?.color_principal || "#e05b22"}
    />
  );
}
