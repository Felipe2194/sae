// Secciones opcionales del sidebar — cada organización elige en
// /configuracion cuáles usa su equipo (ver migración 032). Compartido entre
// el sidebar (qué se muestra) y el formulario de Configuración (qué se
// puede tildar), para no tener las cuatro claves definidas en dos lugares
// que se puedan desincronizar.
//
// Hoy y Tablero no están acá: son el núcleo de la app y siempre están
// disponibles, sin importar qué elija cada organización.

export type SeccionOpcionalKey =
  | "tablero"
  | "calendario"
  | "cronograma"
  | "proyectos"
  | "visitas"
  | "viajes";

export type SeccionesHabilitadas = Record<SeccionOpcionalKey, boolean>;

export const SECCIONES_OPCIONALES: {
  key: SeccionOpcionalKey;
  href: string;
  label: string;
  descripcion: string;
}[] = [
  {
    key: "tablero",
    href: "/tablero",
    label: "Tablero",
    descripcion: "Vista kanban de todas las tareas, con sus columnas por estado.",
  },
  {
    key: "proyectos",
    href: "/proyectos",
    label: "Proyectos",
    descripcion: "Áreas y proyectos de software, con sus propias tareas.",
  },
  {
    key: "calendario",
    href: "/calendario",
    label: "Calendario",
    descripcion: "Vencimientos de tareas y eventos de Google Calendar.",
  },
  {
    key: "cronograma",
    href: "/cronograma",
    label: "Cronograma",
    descripcion: "Turnos de guardia y ausencias del equipo.",
  },
  {
    key: "visitas",
    href: "/visitas",
    label: "Visitas",
    descripcion: "Visitas a colegios, ferias y charlas.",
  },
  {
    key: "viajes",
    href: "/viajes",
    label: "Viajes",
    descripcion: "Viajes a empresas y congresos, con inscripción, pagos y equipo organizador.",
  },
];
