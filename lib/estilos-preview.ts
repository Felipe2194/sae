// Estilos visuales alternativos para comparar en los deploys de preview
// (rama preview-estilos). No es una feature de producción: el selector solo
// se monta con VERCEL_ENV=preview o en `next dev` (ver app/layout.tsx), y
// todo el CSS de app/estilos-preview.css cuelga de html[data-estilo], que
// nadie fija fuera del selector.

export type Esquema = "light" | "dark";

export type EstiloPreview = {
  id: string;
  nombre: string;
  // Cada estilo fuerza su esquema (claro/oscuro): varios solo tienen sentido
  // en uno. null = respeta el tema elegido por la persona.
  esquema: Esquema | null;
};

export const ESTILOS_PREVIEW: EstiloPreview[] = [
  { id: "actual", nombre: "Actual (sin cambios)", esquema: null },
  { id: "neo-brutalismo", nombre: "Neo brutalismo", esquema: "light" },
  { id: "brutalismo", nombre: "Brutalismo puro", esquema: "light" },
  { id: "memphis", nombre: "Memphis", esquema: "light" },
  { id: "y2k", nombre: "Y2K", esquema: "light" },
  { id: "retro70", nombre: "Retro 70s", esquema: "light" },
  { id: "pixel", nombre: "Pixel art / retro gaming", esquema: "dark" },
  { id: "glass", nombre: "Glassmorphism", esquema: "dark" },
  { id: "neumorphism", nombre: "Neumorphism", esquema: "light" },
  { id: "clay", nombre: "Claymorphism", esquema: "light" },
  { id: "bento", nombre: "Bento grid", esquema: "light" },
  { id: "suizo", nombre: "Minimalismo suizo", esquema: "light" },
  { id: "cyberpunk", nombre: "Cyberpunk / Neón", esquema: "dark" },
  { id: "dark-premium", nombre: "Dark premium (Linear / Vercel)", esquema: "dark" },
  { id: "aurora", nombre: "Aurora / Mesh gradients", esquema: "dark" },
  { id: "cuaderno", nombre: "Skeuomorfismo (cuaderno)", esquema: "light" },
  { id: "editorial", nombre: "Editorial / Revista", esquema: "light" },
  { id: "doodle", nombre: "Hand-drawn / Doodle", esquema: "light" },
  { id: "gamificado", nombre: "Gamificado (estilo Duolingo)", esquema: "light" },
];

export const CLAVE_ESTILO = "sae:estilo-preview";

// Corre en <head> después del script de tema, antes del primer paint: fija
// data-estilo y el esquema forzado para que no haya flash. Acepta
// ?estilo=<id> en la URL (queda guardado) para compartir un estilo puntual.
export function scriptEstiloPreview(): string {
  const esquemas: Record<string, Esquema | null> = {};
  for (const e of ESTILOS_PREVIEW) esquemas[e.id] = e.esquema;
  return `(function(){try{var E=${JSON.stringify(esquemas)};var K=${JSON.stringify(CLAVE_ESTILO)};var p=new URLSearchParams(location.search).get("estilo");if(p&&p in E)localStorage.setItem(K,p);var e=localStorage.getItem(K);if(!e||!(e in E))return;var d=document.documentElement;d.setAttribute("data-estilo",e);var s=E[e];if(s){d.setAttribute("data-esquema",s);d.classList.toggle("dark",s==="dark");d.style.colorScheme=s;}}catch(x){}})()`;
}
