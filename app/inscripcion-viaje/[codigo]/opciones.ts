// Opciones fijas del formulario de inscripción — compartidas entre el form
// (para poblar los <select>) y actions.ts (para validar del lado del
// servidor que lo que llegó es una de estas opciones y no texto libre
// inventado saltando el <select> del navegador).

export const CARRERAS_GRADO = [
  "Ingeniería Química",
  "Ingeniería Mecánica",
  "Ingeniería en Sistemas de Información",
  "Ingeniería Electrónica",
  "Ingeniería Civil",
  "Licenciatura en Administración Rural",
] as const;

export const CARRERAS_PREGRADO = [
  "Tecnicatura Universitaria en Programación",
  "Tecnicatura Universitaria en Logística",
  "Tecnicatura Universitaria en Mecatrónica",
  "Tecnicatura Universitaria en Negociación de Bienes",
] as const;

export const CARRERAS = [...CARRERAS_GRADO, ...CARRERAS_PREGRADO] as const;

export const ANIOS_CURSADA = ["1", "2", "3", "4", "5"] as const;

export const ANIOS_CURSADA_LABEL: Record<(typeof ANIOS_CURSADA)[number], string> = {
  "1": "1° año",
  "2": "2° año",
  "3": "3° año",
  "4": "4° año",
  "5": "5° año",
};
