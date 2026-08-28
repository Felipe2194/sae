// Gradientes predefinidos para el fondo "glass" de la app — cada persona
// elige el suyo en /perfil. Compartido entre el picker (perfil-form), el
// layout que pinta el fondo real, y los blobs decorativos de error.tsx.
//
// Cada uno es un "mesh glow": una base sólida casi plana + uno o dos
// radial-gradient de color superpuestos, en vez del linear-gradient plano
// de antes. Cada tema trae una variante `light` y una `dark` — la base
// pasa de casi-negra (glow saturado encima) a casi-blanca (glow pastel
// encima) para que se vea bien prendido en los dos temas, no solo en uno.
// El switch entre variantes lo hace CSS puro (ver clase `.fondo-mesh` y
// `[data-slot="sidebar-wrapper"]` en globals.css), no JS — así no hay
// flash al hidratar ni que ir a buscar el tema resuelto en cada consumidor.
// 2026-08-27: gradientes recargados con más color — "Lavanda" era el único
// que se veía bien en modo oscuro porque su segunda capa era mucho más
// grande (85% de radio, corte al 75%) y más opaca (0.5) que el resto, así
// que el color cubría buena parte de la pantalla en vez de quedar como un
// glow chico en una esquina. El resto usaba capas más chicas y opacidades
// bajas (0.3–0.4), y "Medianoche" además tenía colores muy desaturados
// (azules grisáceos) que ni con más opacidad se iban a notar. Acá se lleva
// a todos los gradientes al mismo criterio que Lavanda: capas grandes
// (65–90% de radio) con corte generoso (60–70%) y opacidades más altas
// (0.4–0.6 en claro, 0.4–0.65 en oscuro), y se reemplazan los colores
// apagados (el navy de Medianoche, el crema casi blanco de Durazno) por
// tonos más vivos dentro de la misma paleta.
export const GRADIENTES_FONDO = {
  aurora: {
    label: 'Aurora',
    light:
      'radial-gradient(80% 70% at 25% 100%, rgba(120,224,216,0.6) 0%, transparent 68%), radial-gradient(65% 58% at 88% 0%, rgba(200,160,240,0.5) 0%, transparent 62%), #f2fbf9',
    dark:
      'radial-gradient(85% 75% at 25% -10%, rgba(100,225,210,0.6) 0%, transparent 65%), radial-gradient(80% 68% at 92% 35%, rgba(190,130,240,0.45) 0%, transparent 65%), #060a0c',
  },
  atardecer: {
    label: 'Atardecer',
    light:
      'radial-gradient(80% 68% at 50% 100%, rgba(255,138,64,0.6) 0%, transparent 66%), radial-gradient(62% 55% at 85% 0%, rgba(255,120,155,0.45) 0%, transparent 60%), #fff6f0',
    dark:
      'radial-gradient(90% 78% at 50% -15%, rgba(255,120,90,0.65) 0%, transparent 62%), radial-gradient(85% 72% at 65% 35%, rgba(180,70,210,0.5) 0%, transparent 68%), #0a0710',
  },
  oceano: {
    label: 'Océano',
    light:
      'radial-gradient(75% 65% at 20% 100%, rgba(60,150,255,0.55) 0%, transparent 65%), radial-gradient(62% 55% at 90% 0%, rgba(0,220,240,0.45) 0%, transparent 60%), #eef7ff',
    dark:
      'radial-gradient(80% 70% at 15% 15%, rgba(70,160,255,0.6) 0%, transparent 62%), radial-gradient(85% 75% at 100% 100%, rgba(0,225,240,0.4) 0%, transparent 65%), #040a11',
  },
  bosque: {
    label: 'Bosque',
    light:
      'radial-gradient(75% 65% at 22% 100%, rgba(56,150,64,0.5) 0%, transparent 65%), radial-gradient(62% 55% at 85% 0%, rgba(150,215,80,0.45) 0%, transparent 60%), #f0faea',
    dark:
      'radial-gradient(80% 70% at 18% 100%, rgba(60,155,70,0.6) 0%, transparent 62%), radial-gradient(75% 65% at 90% 0%, rgba(150,215,80,0.4) 0%, transparent 65%), #050a06',
  },
  lavanda: {
    label: 'Lavanda',
    light:
      'radial-gradient(72% 62% at 50% 100%, rgba(190,100,245,0.5) 0%, transparent 62%), radial-gradient(62% 55% at 85% 0%, rgba(250,105,200,0.45) 0%, transparent 58%), #f8f0ff',
    dark:
      'radial-gradient(68% 62% at 15% 55%, rgba(250,175,150,0.5) 0%, transparent 55%), radial-gradient(88% 78% at 60% 30%, rgba(160,80,220,0.55) 0%, transparent 68%), #0c0712',
  },
  medianoche: {
    label: 'Medianoche',
    light:
      'radial-gradient(75% 65% at 50% 100%, rgba(50,95,220,0.42) 0%, transparent 62%), radial-gradient(60% 55% at 90% 0%, rgba(70,50,160,0.35) 0%, transparent 58%), #eef1f8',
    dark:
      'radial-gradient(85% 75% at 50% -5%, rgba(60,110,230,0.6) 0%, transparent 62%), radial-gradient(80% 68% at 100% 100%, rgba(80,55,190,0.5) 0%, transparent 65%), #05070d',
  },
  durazno: {
    label: 'Durazno',
    light:
      'radial-gradient(75% 65% at 28% 100%, rgba(250,165,130,0.55) 0%, transparent 64%), radial-gradient(60% 55% at 88% 0%, rgba(255,190,90,0.45) 0%, transparent 58%), #fff8ef',
    dark:
      'radial-gradient(80% 70% at 28% 100%, rgba(250,165,130,0.6) 0%, transparent 62%), radial-gradient(65% 58% at 90% 0%, rgba(255,190,90,0.4) 0%, transparent 60%), #0e0805',
  },
  menta: {
    label: 'Menta',
    light:
      'radial-gradient(75% 65% at 25% 100%, rgba(50,220,120,0.45) 0%, transparent 65%), radial-gradient(62% 55% at 85% 0%, rgba(45,235,205,0.45) 0%, transparent 60%), #eefdf6',
    dark:
      'radial-gradient(78% 68% at 20% 0%, rgba(45,235,205,0.5) 0%, transparent 62%), radial-gradient(82% 72% at 90% 100%, rgba(55,220,120,0.45) 0%, transparent 65%), #03130b',
  },
} as const;

export type GradienteFondoKey = keyof typeof GRADIENTES_FONDO;

/**
 * `--fondo-light` / `--fondo-dark` a partir de lo guardado en `usuario` —
 * null si no hay fondo custom. Se aplican como custom properties (no como
 * `background` directo) para que la clase `.fondo-mesh` / la regla de
 * `[data-slot="sidebar-wrapper"]` en globals.css elija la variante correcta
 * según el tema activo, sin JS.
 */
export function fondoVars(
  fondoTipo: 'gradiente' | 'imagen' | null,
  fondoValor: string | null,
): { light: string; dark: string } | null {
  if (!fondoTipo || !fondoValor) return null;
  if (fondoTipo === 'gradiente') {
    const g = GRADIENTES_FONDO[fondoValor as GradienteFondoKey];
    return g ? { light: g.light, dark: g.dark } : null;
  }
  const url = `url("${fondoValor}") center / cover no-repeat fixed`;
  return { light: url, dark: url };
}
