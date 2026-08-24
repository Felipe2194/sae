type Props = { className?: string };

// Mascota de las pantallas de error/estado vacío (404, error, global-error) —
// representa al desarrollador detrás de la página. Trazo estilo lucide
// (stroke currentColor, viewBox 24x24) para que combine con el resto de los
// íconos de la app sin traer una librería de ilustración aparte.
export function MascotaTigre({ className }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="13" r="6.5" />
      <path d="M6.5 8 5 3.5 9 7" />
      <path d="M17.5 8 19 3.5 15 7" />
      <path d="M9.5 12.5h.01" />
      <path d="M14.5 12.5h.01" />
      <path d="M9 8.5l1 1.5" />
      <path d="M15 8.5l-1 1.5" />
      <path d="M10.4 15.3c.7.8 2.2.8 3.2 0" />
    </svg>
  );
}
