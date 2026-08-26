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
export const GRADIENTES_FONDO = {
  aurora: {
    label: 'Aurora',
    light:
      'radial-gradient(70% 60% at 30% 100%, rgba(168,237,234,0.55) 0%, transparent 65%), radial-gradient(60% 55% at 85% 0%, rgba(213,184,240,0.4) 0%, transparent 65%), #f6fbfa',
    dark:
      'radial-gradient(75% 65% at 30% -10%, rgba(120,232,220,0.5) 0%, transparent 60%), radial-gradient(70% 60% at 90% 30%, rgba(199,150,240,0.35) 0%, transparent 65%), #070b0d',
  },
  atardecer: {
    label: 'Atardecer',
    light:
      'radial-gradient(70% 60% at 50% 100%, rgba(255,154,86,0.5) 0%, transparent 65%), radial-gradient(55% 50% at 85% 0%, rgba(255,153,172,0.35) 0%, transparent 65%), #fff8f4',
    dark:
      'radial-gradient(90% 75% at 50% -20%, rgba(255,141,120,0.65) 0%, rgba(168,88,199,0.4) 40%, transparent 70%), #0b0710',
  },
  oceano: {
    label: 'Océano',
    light:
      'radial-gradient(65% 55% at 20% 100%, rgba(79,172,254,0.4) 0%, transparent 65%), radial-gradient(55% 50% at 90% 0%, rgba(0,242,254,0.3) 0%, transparent 65%), #f1f9ff',
    dark:
      'radial-gradient(70% 60% at 15% 20%, rgba(79,172,254,0.55) 0%, transparent 60%), radial-gradient(75% 65% at 100% 100%, rgba(0,242,254,0.3) 0%, transparent 65%), #050b12',
  },
  bosque: {
    label: 'Bosque',
    light:
      'radial-gradient(65% 55% at 25% 100%, rgba(67,160,71,0.35) 0%, transparent 65%), radial-gradient(55% 50% at 85% 0%, rgba(168,224,99,0.35) 0%, transparent 65%), #f4fbef',
    dark:
      'radial-gradient(70% 60% at 20% 100%, rgba(67,160,71,0.55) 0%, transparent 60%), radial-gradient(65% 55% at 90% 0%, rgba(168,224,99,0.3) 0%, transparent 65%), #060b07',
  },
  lavanda: {
    label: 'Lavanda',
    light:
      'radial-gradient(65% 55% at 50% 100%, rgba(196,113,245,0.4) 0%, transparent 65%), radial-gradient(55% 50% at 85% 0%, rgba(250,113,205,0.35) 0%, transparent 65%), #faf3ff',
    dark:
      'radial-gradient(65% 60% at 15% 55%, rgba(250,181,158,0.45) 0%, transparent 55%), radial-gradient(85% 75% at 60% 30%, rgba(160,80,220,0.5) 0%, transparent 65%), #0d0713',
  },
  medianoche: {
    label: 'Medianoche',
    light:
      'radial-gradient(65% 55% at 50% 100%, rgba(44,83,100,0.22) 0%, transparent 65%), radial-gradient(55% 50% at 90% 0%, rgba(32,58,67,0.18) 0%, transparent 65%), #eff3f5',
    dark:
      'radial-gradient(75% 65% at 50% 0%, rgba(44,83,100,0.55) 0%, transparent 60%), radial-gradient(70% 60% at 100% 100%, rgba(32,58,67,0.4) 0%, transparent 65%), #05080a',
  },
  durazno: {
    label: 'Durazno',
    light:
      'radial-gradient(65% 55% at 30% 100%, rgba(252,182,159,0.45) 0%, transparent 65%), radial-gradient(55% 50% at 85% 0%, rgba(255,236,210,0.4) 0%, transparent 65%), #fffaf3',
    dark:
      'radial-gradient(70% 60% at 30% 100%, rgba(252,182,159,0.5) 0%, transparent 60%), radial-gradient(60% 55% at 90% 0%, rgba(255,236,210,0.3) 0%, transparent 65%), #0f0906',
  },
  menta: {
    label: 'Menta',
    light:
      'radial-gradient(65% 55% at 25% 100%, rgba(67,233,123,0.35) 0%, transparent 65%), radial-gradient(55% 50% at 85% 0%, rgba(56,249,215,0.35) 0%, transparent 65%), #f0fdf8',
    dark:
      'radial-gradient(70% 60% at 20% 0%, rgba(56,249,215,0.45) 0%, transparent 60%), radial-gradient(75% 65% at 90% 100%, rgba(67,233,123,0.4) 0%, transparent 65%), #04100a',
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
