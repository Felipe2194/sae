// Detección de becas incompatibles. Lógica pura (sin base ni React) para
// poder usarla igual en la pantalla, en la vista previa del importador y en
// los tests.

import type { Asignacion, Incompatibilidad } from "./tipos";

function clavePar(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function indiceIncompatibilidades(pares: Incompatibilidad[]): Set<string> {
  return new Set(pares.map((p) => clavePar(p.programa_a, p.programa_b)));
}

export function sonIncompatibles(indice: Set<string>, a: string, b: string): boolean {
  return a !== b && indice.has(clavePar(a, b));
}

export type Conflicto = {
  estudiante_id: string;
  anio: number;
  // Las dos becas que chocan, ordenadas por id de asignación para que el
  // mismo conflicto tenga siempre la misma forma.
  a: Asignacion;
  b: Asignacion;
};

// Un conflicto = dos becas ACTIVAS del mismo estudiante en el mismo año,
// de programas marcados como incompatibles. Las rechazadas y las bajas no
// cuentan: justamente, dar de baja una es la forma de resolverlo.
export function detectarConflictos(
  asignaciones: Asignacion[],
  pares: Incompatibilidad[],
): Conflicto[] {
  const indice = indiceIncompatibilidades(pares);
  if (indice.size === 0) return [];

  const porEstudianteAnio = new Map<string, Asignacion[]>();
  for (const a of asignaciones) {
    if (a.estado !== "activa") continue;
    const clave = `${a.estudiante_id}|${a.anio}`;
    const lista = porEstudianteAnio.get(clave);
    if (lista) lista.push(a);
    else porEstudianteAnio.set(clave, [a]);
  }

  const conflictos: Conflicto[] = [];
  for (const lista of porEstudianteAnio.values()) {
    if (lista.length < 2) continue;
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        if (!sonIncompatibles(indice, lista[i].programa_id, lista[j].programa_id)) continue;
        const [a, b] = lista[i].id < lista[j].id ? [lista[i], lista[j]] : [lista[j], lista[i]];
        conflictos.push({ estudiante_id: a.estudiante_id, anio: a.anio, a, b });
      }
    }
  }
  return conflictos;
}
