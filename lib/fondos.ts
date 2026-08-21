// Gradientes predefinidos para el fondo "glass" de la app — elegidos por el
// admin en /admin → Organización. Compartido entre el picker (organizacion-form)
// y el layout que pinta el fondo real, para que ambos usen el mismo CSS.

export const GRADIENTES_FONDO = {
  aurora: { label: 'Aurora', css: 'linear-gradient(135deg, #a8edea 0%, #d5b8f0 50%, #fed6e3 100%)' },
  atardecer: { label: 'Atardecer', css: 'linear-gradient(135deg, #ff9a56 0%, #ff6a88 50%, #ff99ac 100%)' },
  oceano: { label: 'Océano', css: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  bosque: { label: 'Bosque', css: 'linear-gradient(135deg, #43a047 0%, #a8e063 100%)' },
  lavanda: { label: 'Lavanda', css: 'linear-gradient(135deg, #c471f5 0%, #fa71cd 100%)' },
  medianoche: { label: 'Medianoche', css: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)' },
  durazno: { label: 'Durazno', css: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' },
  menta: { label: 'Menta', css: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
} as const;

export type GradienteFondoKey = keyof typeof GRADIENTES_FONDO;

/** CSS `background` a partir de lo guardado en `organizacion` — null = sin fondo custom. */
export function cssFondoOrganizacion(
  fondoTipo: 'gradiente' | 'imagen' | null,
  fondoValor: string | null,
): string | null {
  if (!fondoTipo || !fondoValor) return null;
  if (fondoTipo === 'gradiente') {
    return GRADIENTES_FONDO[fondoValor as GradienteFondoKey]?.css ?? null;
  }
  return `url("${fondoValor}") center / cover no-repeat fixed`;
}
