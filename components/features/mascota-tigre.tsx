type Props = { className?: string };

// Mascota de las pantallas de error/estado vacío (404, error, global-error) —
// representa al desarrollador detrás de la página. Imagen fija en
// public/mascota-tigre.png (recortada de la ilustración original: se le
// sacó el fondo y los carteles de texto, queda solo el tigre + laptop) en
// vez de un ícono vectorial — a diferencia del resto de los íconos de la
// app (lucide, monocromo), esta tiene su propia paleta a color fija.
export function MascotaTigre({ className }: Props) {
  // eslint-disable-next-line @next/next/no-img-element -- imagen local fija, sin necesidad de la optimización de next/image
  return <img src="/mascota-tigre.png" alt="" className={className} />;
}
