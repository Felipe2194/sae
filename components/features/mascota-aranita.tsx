type Props = { className?: string };

// Mascota de la landing pública (/) — "Arañito", inspirado en la arañita del
// logo de la UTN. Imagen fija en public/mascota-aranita.png (recortada y con
// el fondo quitado de una lámina de referencia con varias propuestas de
// personaje), mismo criterio que components/features/mascota-tigre.tsx.
export function MascotaAranita({ className }: Props) {
  // eslint-disable-next-line @next/next/no-img-element -- imagen local fija, sin necesidad de la optimización de next/image
  return <img src="/mascota-aranita.png" alt="" className={className} />;
}
