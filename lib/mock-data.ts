// Datos de ejemplo para maquetar el front antes de conectar Supabase (M0.3).
// Misma forma que el modelo de datos real (ver docs/), con ids simples.

export type RolUsuario = "miembro" | "coordinador" | "administrador";
export type EstadoTarea = "por_hacer" | "en_progreso" | "hecha";
export type PrioridadTarea = "baja" | "media" | "alta";

export type Usuario = {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  iniciales: string;
  apodo?: string;
  color?: string;
};

export type Area = {
  id: string;
  nombre: string;
  color: string;
  responsableId: string | null;
};

export type Tarea = {
  id: string;
  titulo: string;
  areaId: string;
  responsableId: string | null;
  estado: EstadoTarea;
  prioridad: PrioridadTarea;
  fechaVencimiento: string | null; // ISO date
};

export type AccesoRapido = {
  id: string;
  etiqueta: string;
  url: string;
};

export const usuarioActual: Usuario = {
  id: "u-coord",
  nombre: "Carlos Coordinador",
  email: "coordinador@sae.test",
  rol: "coordinador",
  iniciales: "CC",
  apodo: "Carlos",
  color: "#E05B22",
};

export const usuarios: Usuario[] = [
  usuarioActual,
  {
    id: "u-admin",
    nombre: "Ana Administradora",
    email: "admin@sae.test",
    rol: "administrador",
    iniciales: "AA",
  },
  {
    id: "u-miembro",
    nombre: "Mora Miembro",
    email: "miembro@sae.test",
    rol: "miembro",
    iniciales: "MM",
  },
];

export const areas: Area[] = [
  {
    id: "a-becas",
    nombre: "Becas",
    color: "#ef4444",
    responsableId: "u-coord",
  },
  {
    id: "a-deportes",
    nombre: "Deportes",
    color: "#f97316",
    responsableId: "u-coord",
  },
  {
    id: "a-visitas",
    nombre: "Visitas",
    color: "#f59e0b",
    responsableId: "u-admin",
  },
  {
    id: "a-seminario",
    nombre: "Seminario de Ingreso",
    color: "#eab308",
    responsableId: "u-coord",
  },
  {
    id: "a-salud",
    nombre: "Salud",
    color: "#84cc16",
    responsableId: "u-miembro",
  },
  {
    id: "a-charlas",
    nombre: "Charlas y Capacitaciones",
    color: "#22c55e",
    responsableId: "u-admin",
  },
  {
    id: "a-residencias",
    nombre: "Residencias",
    color: "#10b981",
    responsableId: "u-coord",
  },
  {
    id: "a-viajes",
    nombre: "Viajes",
    color: "#14b8a6",
    responsableId: "u-coord",
  },
  {
    id: "a-utncorre",
    nombre: "UTN Corre",
    color: "#06b6d4",
    responsableId: "u-miembro",
  },
  {
    id: "a-tutorias",
    nombre: "Tutorías",
    color: "#3b82f6",
    responsableId: "u-coord",
  },
  {
    id: "a-relaciones",
    nombre: "Relaciones Internacionales",
    color: "#6366f1",
    responsableId: null,
  },
  { id: "a-genero", nombre: "Género", color: "#a855f7", responsableId: null },
  {
    id: "a-discapacidad",
    nombre: "Discapacidad",
    color: "#ec4899",
    responsableId: null,
  },
];

function hoyMas(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export const tareas: Tarea[] = [
  {
    id: "t1",
    titulo: "Publicar convocatoria de becas 2026",
    areaId: "a-becas",
    responsableId: "u-coord",
    estado: "por_hacer",
    prioridad: "alta",
    fechaVencimiento: hoyMas(0),
  },
  {
    id: "t2",
    titulo: "Revisar planillas de postulantes",
    areaId: "a-becas",
    responsableId: "u-miembro",
    estado: "en_progreso",
    prioridad: "media",
    fechaVencimiento: hoyMas(2),
  },
  {
    id: "t3",
    titulo: "Enviar notificación de resultados",
    areaId: "a-becas",
    responsableId: null,
    estado: "por_hacer",
    prioridad: "media",
    fechaVencimiento: hoyMas(10),
  },
  {
    id: "t4",
    titulo: "Coordinar cancha para el torneo interno",
    areaId: "a-deportes",
    responsableId: "u-miembro",
    estado: "por_hacer",
    prioridad: "baja",
    fechaVencimiento: hoyMas(7),
  },
  {
    id: "t5",
    titulo: "Armar planilla de inscripciones",
    areaId: "a-deportes",
    responsableId: "u-miembro",
    estado: "hecha",
    prioridad: "media",
    fechaVencimiento: hoyMas(-2),
  },
  {
    id: "t6",
    titulo: "Agendar visita a escuela técnica",
    areaId: "a-visitas",
    responsableId: "u-admin",
    estado: "por_hacer",
    prioridad: "media",
    fechaVencimiento: hoyMas(4),
  },
  {
    id: "t7",
    titulo: "Reservar aula para seminario de ingreso",
    areaId: "a-seminario",
    responsableId: "u-coord",
    estado: "en_progreso",
    prioridad: "alta",
    fechaVencimiento: hoyMas(0),
  },
  {
    id: "t8",
    titulo: "Actualizar cartelera de salud estudiantil",
    areaId: "a-salud",
    responsableId: "u-miembro",
    estado: "por_hacer",
    prioridad: "baja",
    fechaVencimiento: null,
  },
  {
    id: "t9",
    titulo: "Coordinar jornada de donación de sangre",
    areaId: "a-salud",
    responsableId: null,
    estado: "por_hacer",
    prioridad: "media",
    fechaVencimiento: hoyMas(14),
  },
  {
    id: "t10",
    titulo: "Confirmar disertante de la próxima charla",
    areaId: "a-charlas",
    responsableId: "u-admin",
    estado: "en_progreso",
    prioridad: "media",
    fechaVencimiento: hoyMas(6),
  },
  {
    id: "t11",
    titulo: "Actualizar listado de residencias disponibles",
    areaId: "a-residencias",
    responsableId: "u-coord",
    estado: "por_hacer",
    prioridad: "baja",
    fechaVencimiento: null,
  },
  {
    id: "t12",
    titulo: "Cotizar transporte para viaje de estudio",
    areaId: "a-viajes",
    responsableId: "u-miembro",
    estado: "por_hacer",
    prioridad: "media",
    fechaVencimiento: hoyMas(8),
  },
  {
    id: "t13",
    titulo: "Difundir inscripción a UTN Corre",
    areaId: "a-utncorre",
    responsableId: "u-miembro",
    estado: "hecha",
    prioridad: "baja",
    fechaVencimiento: hoyMas(-5),
  },
  {
    id: "t14",
    titulo: "Asignar tutores a ingresantes",
    areaId: "a-tutorias",
    responsableId: "u-coord",
    estado: "en_progreso",
    prioridad: "alta",
    fechaVencimiento: hoyMas(1),
  },
  {
    id: "t15",
    titulo: "Armar cronograma de tutorías de julio",
    areaId: "a-tutorias",
    responsableId: null,
    estado: "por_hacer",
    prioridad: "media",
    fechaVencimiento: hoyMas(9),
  },
];

export const accesosRapidos: AccesoRapido[] = [
  {
    id: "ar1",
    etiqueta: "Drive de la secretaría",
    url: "https://drive.google.com",
  },
  {
    id: "ar2",
    etiqueta: "Calendario compartido",
    url: "https://calendar.google.com",
  },
  {
    id: "ar3",
    etiqueta: "Planilla de becas",
    url: "https://sheets.google.com",
  },
];

export const personaDeTurno = usuarios[2]; // Mora Miembro, para el panel del día

export function areaPorId(id: string): Area | undefined {
  return areas.find((a) => a.id === id);
}

export function usuarioPorId(id: string | null): Usuario | undefined {
  if (!id) return undefined;
  return usuarios.find((u) => u.id === id);
}
