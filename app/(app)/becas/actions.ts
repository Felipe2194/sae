"use server";

import { revalidatePath } from "next/cache";
import { withUser } from "@/lib/db";
import { ErrorDeUsuario } from "@/lib/errores";
import { requireAdminEnSeccion, requireSeccion } from "@/lib/sesion";
import {
  clasificarFilas,
  normalizarDni,
  sanearFilas,
  type FilaClasificada,
} from "@/lib/becas/importacion";
import {
  INCOMPATIBILIDADES_SUGERIDAS,
  PROGRAMAS_SUGERIDOS,
  type ACargoEntrega,
  type EstadoAsignacion,
  type EstadoEntrega,
  type HistorialBeca,
  type OrigenPrograma,
} from "@/lib/becas/tipos";

// Las validaciones esperables (un DNI repetido, un campo vacío) vuelven como
// `{ error }` en vez de tirar: en producción Next oculta el mensaje de un
// throw. Los permisos sí tiran ErrorDeUsuario (lib/sesion.ts).
type Resultado<T = object> = ({ ok: true } & T) | { error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
const esAnio = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 2000 && v <= 2100;

function texto(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim().slice(0, max);
  return t === "" ? null : t;
}

function textoLargo(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t === "" ? null : t;
}

function enteroONull(v: unknown, max: number): number | null {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > max) return null;
  return v;
}

const codigoPg = (e: unknown) => (e as { code?: string } | null)?.code;

// ── Programas (administrador) ────────────────────────────────────────────────

export async function cargarProgramasSugeridos(): Promise<Resultado> {
  const session = await requireAdminEnSeccion("becas");
  await withUser(session.user.id, async (tx) => {
    for (const p of PROGRAMAS_SUGERIDOS) {
      await tx`
        insert into beca_programa (organizacion_id, nombre, origen, horas_por_modulo)
        values (mi_organizacion_id(), ${p.nombre}, ${p.origen}, ${p.horas_por_modulo})
        on conflict (organizacion_id, nombre) do nothing
      `;
    }
    for (const [a, b] of INCOMPATIBILIDADES_SUGERIDAS) {
      await tx`
        insert into beca_incompatibilidad (programa_a, programa_b)
        select least(pa.id, pb.id), greatest(pa.id, pb.id)
        from beca_programa pa, beca_programa pb
        where pa.organizacion_id = mi_organizacion_id() and pa.nombre = ${a}
          and pb.organizacion_id = mi_organizacion_id() and pb.nombre = ${b}
        on conflict do nothing
      `;
    }
  });
  revalidatePath("/becas");
  return { ok: true };
}

export type ProgramaInput = {
  nombre: string;
  origen: OrigenPrograma;
  horas_por_modulo: number | null;
  activo: boolean;
};

export async function guardarPrograma(id: string | null, data: ProgramaInput): Promise<Resultado> {
  const session = await requireAdminEnSeccion("becas");
  const nombre = texto(data.nombre, 80);
  if (!nombre) return { error: "El programa necesita un nombre." };
  const origen: OrigenPrograma =
    data.origen === "nacional" || data.origen === "externa" ? data.origen : "facultad";
  const horas = enteroONull(data.horas_por_modulo, 60);
  if (id !== null && !esUuid(id)) return { error: "El programa no existe." };
  try {
    await withUser(session.user.id, async (tx) => {
      if (id) {
        await tx`
          update beca_programa
          set nombre = ${nombre}, origen = ${origen}, horas_por_modulo = ${horas}, activo = ${!!data.activo}
          where id = ${id} and organizacion_id = mi_organizacion_id()
        `;
      } else {
        await tx`
          insert into beca_programa (organizacion_id, nombre, origen, horas_por_modulo, activo)
          values (mi_organizacion_id(), ${nombre}, ${origen}, ${horas}, ${!!data.activo})
        `;
      }
    });
  } catch (e) {
    if (codigoPg(e) === "23505") return { error: "Ya hay un programa con ese nombre." };
    throw e;
  }
  revalidatePath("/becas");
  return { ok: true };
}

export async function eliminarPrograma(id: string): Promise<Resultado> {
  const session = await requireAdminEnSeccion("becas");
  if (!esUuid(id)) return { error: "El programa no existe." };
  try {
    await withUser(session.user.id, async (tx) => {
      await tx`delete from beca_programa where id = ${id} and organizacion_id = mi_organizacion_id()`;
    });
  } catch (e) {
    if (codigoPg(e) === "23503") {
      return {
        error: "Ese programa tiene becas cargadas. Desactivalo en vez de borrarlo, así se conserva el historial.",
      };
    }
    throw e;
  }
  revalidatePath("/becas");
  return { ok: true };
}

export async function definirIncompatibilidad(
  programaA: string,
  programaB: string,
  incompatibles: boolean,
): Promise<Resultado> {
  const session = await requireAdminEnSeccion("becas");
  if (!esUuid(programaA) || !esUuid(programaB) || programaA === programaB) {
    return { error: "Elegí dos programas distintos." };
  }
  await withUser(session.user.id, async (tx) => {
    if (incompatibles) {
      // least/greatest: el par se guarda siempre ordenado (check del schema).
      // Los dos programas tienen que ser de esta organización: lo exige la
      // policy de insert, y acá se filtra para no depender solo de ella.
      await tx`
        insert into beca_incompatibilidad (programa_a, programa_b)
        select least(pa.id, pb.id), greatest(pa.id, pb.id)
        from beca_programa pa, beca_programa pb
        where pa.id = ${programaA} and pa.organizacion_id = mi_organizacion_id()
          and pb.id = ${programaB} and pb.organizacion_id = mi_organizacion_id()
        on conflict do nothing
      `;
    } else {
      await tx`
        delete from beca_incompatibilidad
        where programa_a = least(${programaA}::uuid, ${programaB}::uuid)
          and programa_b = greatest(${programaA}::uuid, ${programaB}::uuid)
      `;
    }
  });
  revalidatePath("/becas");
  return { ok: true };
}

// ── Entregas que pide cada programa (administrador) ──────────────────────────

export type EntregaInput = {
  programa_id: string;
  anio: number;
  nombre: string;
  vence_el: string | null;
  a_cargo: ACargoEntrega;
};

export async function guardarEntrega(id: string | null, data: EntregaInput): Promise<Resultado> {
  const session = await requireAdminEnSeccion("becas");
  const nombre = texto(data.nombre, 80);
  if (!nombre) return { error: "La entrega necesita un nombre." };
  if (!esUuid(data.programa_id) || !esAnio(data.anio)) return { error: "Elegí el programa y el año." };
  const vence =
    typeof data.vence_el === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.vence_el) ? data.vence_el : null;
  const aCargo: ACargoEntrega = data.a_cargo === "tutor" ? "tutor" : "becario";
  if (id !== null && !esUuid(id)) return { error: "La entrega no existe." };

  const resultado = await withUser(session.user.id, async (tx): Promise<Resultado> => {
    const [programa] = await tx`
      select 1 from beca_programa where id = ${data.programa_id} and organizacion_id = mi_organizacion_id()
    `;
    if (!programa) return { error: "El programa no existe." };
    if (id) {
      await tx`
        update beca_entrega set nombre = ${nombre}, vence_el = ${vence}, a_cargo = ${aCargo}
        where id = ${id} and organizacion_id = mi_organizacion_id()
      `;
    } else {
      await tx`
        insert into beca_entrega (organizacion_id, programa_id, anio, nombre, vence_el, a_cargo)
        values (mi_organizacion_id(), ${data.programa_id}, ${data.anio}, ${nombre}, ${vence}, ${aCargo})
      `;
    }
    return { ok: true };
  });
  revalidatePath("/becas");
  return resultado;
}

export async function eliminarEntrega(id: string): Promise<Resultado> {
  const session = await requireAdminEnSeccion("becas");
  if (!esUuid(id)) return { error: "La entrega no existe." };
  await withUser(session.user.id, async (tx) => {
    await tx`delete from beca_entrega where id = ${id} and organizacion_id = mi_organizacion_id()`;
  });
  revalidatePath("/becas");
  return { ok: true };
}

// ── Estudiantes ──────────────────────────────────────────────────────────────

export type EstudianteInput = {
  dni: string;
  apellido: string;
  nombre: string;
  legajo: string | null;
  carrera: string | null;
  email: string | null;
  telefono: string | null;
  notas: string | null;
};

export async function guardarEstudiante(
  id: string | null,
  data: EstudianteInput,
): Promise<Resultado<{ id: string }>> {
  const session = await requireSeccion("becas");
  const dni = normalizarDni(data.dni);
  if (!dni) return { error: "El DNI tiene que tener entre 7 y 9 números." };
  const apellido = texto(data.apellido, 120);
  if (!apellido) return { error: "Falta el apellido." };
  if (id !== null && !esUuid(id)) return { error: "El estudiante no existe." };
  const campos = {
    nombre: texto(data.nombre, 120) ?? "",
    legajo: texto(data.legajo, 20),
    carrera: texto(data.carrera, 120),
    email: texto(data.email, 200)?.toLowerCase() ?? null,
    telefono: texto(data.telefono, 40),
    notas: textoLargo(data.notas, 2000),
  };
  try {
    const guardadoId = await withUser(session.user.id, async (tx) => {
      if (id) {
        const filas = await tx<{ id: string }[]>`
          update estudiante set
            dni = ${dni}, apellido = ${apellido}, nombre = ${campos.nombre},
            legajo = ${campos.legajo}, carrera = ${campos.carrera}, email = ${campos.email},
            telefono = ${campos.telefono}, notas = ${campos.notas}
          where id = ${id} and organizacion_id = mi_organizacion_id()
          returning id
        `;
        return filas[0]?.id ?? null;
      }
      const [fila] = await tx<{ id: string }[]>`
        insert into estudiante (organizacion_id, dni, apellido, nombre, legajo, carrera, email, telefono, notas)
        values (
          mi_organizacion_id(), ${dni}, ${apellido}, ${campos.nombre}, ${campos.legajo},
          ${campos.carrera}, ${campos.email}, ${campos.telefono}, ${campos.notas}
        )
        returning id
      `;
      return fila.id;
    });
    if (!guardadoId) return { error: "El estudiante no existe." };
    revalidatePath("/becas");
    return { ok: true, id: guardadoId };
  } catch (e) {
    if (codigoPg(e) === "23505") return { error: "Ya hay un estudiante cargado con ese DNI." };
    throw e;
  }
}

// Borra al estudiante y, en cascada, todas sus becas y entregas marcadas.
export async function eliminarEstudiante(id: string): Promise<Resultado> {
  const session = await requireAdminEnSeccion("becas");
  if (!esUuid(id)) return { error: "El estudiante no existe." };
  await withUser(session.user.id, async (tx) => {
    await tx`delete from estudiante where id = ${id} and organizacion_id = mi_organizacion_id()`;
  });
  revalidatePath("/becas");
  return { ok: true };
}

export async function obtenerHistorial(estudianteId: string): Promise<HistorialBeca[]> {
  const session = await requireSeccion("becas");
  if (!esUuid(estudianteId)) throw new ErrorDeUsuario("El estudiante no existe.");
  return withUser(session.user.id, async (tx) => {
    const filas = await tx<HistorialBeca[]>`
      select
        a.id, a.anio, p.nombre as programa, a.condicion, a.estado,
        ar.nombre as area, ar.tutor_nombre as tutor, a.modulos, a.observaciones
      from beca_asignacion a
      join beca_programa p on p.id = a.programa_id
      left join beca_area ar on ar.id = a.area_id
      where a.estudiante_id = ${estudianteId} and a.organizacion_id = mi_organizacion_id()
      order by a.anio desc, p.nombre asc
    `;
    return [...filas];
  });
}

// ── Asignaciones (la beca de un estudiante en un año) ────────────────────────

export type AsignacionInput = {
  estudiante_id: string;
  programa_id: string;
  anio: number;
  condicion: string | null;
  estado: EstadoAsignacion;
  area_id: string | null;
  modulos: number | null;
  observaciones: string | null;
};

function estadoAsignacionValido(v: unknown): EstadoAsignacion {
  return v === "rechazada" || v === "baja" ? v : "activa";
}

export async function guardarAsignacion(id: string | null, data: AsignacionInput): Promise<Resultado> {
  const session = await requireSeccion("becas");
  if (!esUuid(data.estudiante_id) || !esUuid(data.programa_id) || !esAnio(data.anio)) {
    return { error: "Elegí el programa y el año de la beca." };
  }
  if (data.area_id !== null && !esUuid(data.area_id)) return { error: "El área no existe." };
  if (id !== null && !esUuid(id)) return { error: "La beca no existe." };
  const estado = estadoAsignacionValido(data.estado);
  const condicion = texto(data.condicion, 60);
  const modulos = enteroONull(data.modulos, 99);
  const observaciones = textoLargo(data.observaciones, 1000);

  try {
    const resultado = await withUser(session.user.id, async (tx): Promise<Resultado> => {
      // Las FK no pasan por RLS: sin estos chequeos se podría colgar una beca
      // de un estudiante, programa o área de otra organización.
      const [estudiante] = await tx`
        select 1 from estudiante where id = ${data.estudiante_id} and organizacion_id = mi_organizacion_id()
      `;
      if (!estudiante) return { error: "El estudiante no existe." };
      const [programa] = await tx`
        select 1 from beca_programa where id = ${data.programa_id} and organizacion_id = mi_organizacion_id()
      `;
      if (!programa) return { error: "El programa no existe." };
      if (data.area_id) {
        const [area] = await tx`
          select 1 from beca_area
          where id = ${data.area_id} and organizacion_id = mi_organizacion_id() and anio = ${data.anio}
        `;
        if (!area) return { error: "Esa área no es del año de la beca." };
      }
      if (id) {
        // Programa y año no se cambian al editar: sería otra beca.
        await tx`
          update beca_asignacion set
            condicion = ${condicion}, estado = ${estado}, area_id = ${data.area_id},
            modulos = ${modulos}, observaciones = ${observaciones}
          where id = ${id} and organizacion_id = mi_organizacion_id()
        `;
      } else {
        await tx`
          insert into beca_asignacion (
            organizacion_id, estudiante_id, programa_id, anio, condicion, estado,
            area_id, modulos, observaciones
          )
          values (
            mi_organizacion_id(), ${data.estudiante_id}, ${data.programa_id}, ${data.anio},
            ${condicion}, ${estado}, ${data.area_id}, ${modulos}, ${observaciones}
          )
        `;
      }
      return { ok: true };
    });
    revalidatePath("/becas");
    return resultado;
  } catch (e) {
    if (codigoPg(e) === "23505") return { error: "El estudiante ya tiene esa beca cargada en ese año." };
    throw e;
  }
}

export async function cambiarEstadoAsignacion(id: string, estado: EstadoAsignacion): Promise<Resultado> {
  const session = await requireSeccion("becas");
  if (!esUuid(id)) return { error: "La beca no existe." };
  const nuevo = estadoAsignacionValido(estado);
  await withUser(session.user.id, async (tx) => {
    await tx`
      update beca_asignacion set estado = ${nuevo}
      where id = ${id} and organizacion_id = mi_organizacion_id()
    `;
  });
  revalidatePath("/becas");
  return { ok: true };
}

export async function eliminarAsignacion(id: string): Promise<Resultado> {
  const session = await requireSeccion("becas");
  if (!esUuid(id)) return { error: "La beca no existe." };
  await withUser(session.user.id, async (tx) => {
    await tx`delete from beca_asignacion where id = ${id} and organizacion_id = mi_organizacion_id()`;
  });
  revalidatePath("/becas");
  return { ok: true };
}

// ── Áreas y tutores ──────────────────────────────────────────────────────────

export type AreaInput = {
  anio: number;
  departamento: string | null;
  nombre: string;
  tipo: string | null;
  tutor_nombre: string | null;
  tutor_email: string | null;
  tutor_telefono: string | null;
  modulos_cupo: number | null;
  perfil: string | null;
};

export async function guardarArea(id: string | null, data: AreaInput): Promise<Resultado> {
  const session = await requireSeccion("becas");
  const nombre = texto(data.nombre, 300);
  if (!nombre) return { error: "El área necesita un nombre." };
  if (!esAnio(data.anio)) return { error: "El año no es válido." };
  if (id !== null && !esUuid(id)) return { error: "El área no existe." };
  const campos = {
    departamento: texto(data.departamento, 120),
    tipo: texto(data.tipo, 60),
    tutor_nombre: texto(data.tutor_nombre, 200),
    tutor_email: texto(data.tutor_email, 200)?.toLowerCase() ?? null,
    tutor_telefono: texto(data.tutor_telefono, 40),
    modulos_cupo: enteroONull(data.modulos_cupo, 999),
    perfil: textoLargo(data.perfil, 1000),
  };
  await withUser(session.user.id, async (tx) => {
    if (id) {
      // El año no se cambia: las becas que apuntan a esta área son de ese año.
      await tx`
        update beca_area set
          departamento = ${campos.departamento}, nombre = ${nombre}, tipo = ${campos.tipo},
          tutor_nombre = ${campos.tutor_nombre}, tutor_email = ${campos.tutor_email},
          tutor_telefono = ${campos.tutor_telefono}, modulos_cupo = ${campos.modulos_cupo},
          perfil = ${campos.perfil}
        where id = ${id} and organizacion_id = mi_organizacion_id()
      `;
    } else {
      await tx`
        insert into beca_area (
          organizacion_id, anio, departamento, nombre, tipo, tutor_nombre, tutor_email,
          tutor_telefono, modulos_cupo, perfil
        )
        values (
          mi_organizacion_id(), ${data.anio}, ${campos.departamento}, ${nombre}, ${campos.tipo},
          ${campos.tutor_nombre}, ${campos.tutor_email}, ${campos.tutor_telefono},
          ${campos.modulos_cupo}, ${campos.perfil}
        )
      `;
    }
  });
  revalidatePath("/becas");
  return { ok: true };
}

// Las becas que estaban en esa área quedan sin área (on delete set null).
export async function eliminarArea(id: string): Promise<Resultado> {
  const session = await requireSeccion("becas");
  if (!esUuid(id)) return { error: "El área no existe." };
  await withUser(session.user.id, async (tx) => {
    await tx`delete from beca_area where id = ${id} and organizacion_id = mi_organizacion_id()`;
  });
  revalidatePath("/becas");
  return { ok: true };
}

// Trae al año `hasta` las áreas de `desde` que todavía no estén (mismo
// nombre y departamento), con su tutor y cupo, para ajustarlas después.
export async function copiarAreasDeAnio(desde: number, hasta: number): Promise<Resultado<{ copiadas: number }>> {
  const session = await requireSeccion("becas");
  if (!esAnio(desde) || !esAnio(hasta) || desde === hasta) return { error: "Elegí dos años distintos." };
  const copiadas = await withUser(session.user.id, async (tx) => {
    const filas = await tx`
      insert into beca_area (
        organizacion_id, anio, departamento, nombre, tipo, tutor_nombre, tutor_email,
        tutor_telefono, modulos_cupo, perfil
      )
      select
        o.organizacion_id, ${hasta}, o.departamento, o.nombre, o.tipo, o.tutor_nombre,
        o.tutor_email, o.tutor_telefono, o.modulos_cupo, o.perfil
      from beca_area o
      where o.organizacion_id = mi_organizacion_id() and o.anio = ${desde}
        and not exists (
          select 1 from beca_area d
          where d.organizacion_id = mi_organizacion_id() and d.anio = ${hasta}
            and lower(d.nombre) = lower(o.nombre)
            and coalesce(lower(d.departamento), '') = coalesce(lower(o.departamento), '')
        )
      returning id
    `;
    return filas.length;
  });
  revalidatePath("/becas");
  return { ok: true, copiadas };
}

// ── Entregas marcadas ────────────────────────────────────────────────────────

export async function marcarEntrega(
  asignacionId: string,
  entregaId: string,
  estado: EstadoEntrega,
  observacion: string | null,
): Promise<Resultado> {
  const session = await requireSeccion("becas");
  if (!esUuid(asignacionId) || !esUuid(entregaId)) return { error: "La entrega no existe." };
  const nota = textoLargo(observacion, 500);
  const resultado = await withUser(session.user.id, async (tx): Promise<Resultado> => {
    // La entrega tiene que ser del mismo programa y año que la beca.
    const [par] = await tx`
      select 1
      from beca_asignacion a
      join beca_entrega e on e.programa_id = a.programa_id and e.anio = a.anio
      where a.id = ${asignacionId} and e.id = ${entregaId}
        and a.organizacion_id = mi_organizacion_id()
        and e.organizacion_id = mi_organizacion_id()
    `;
    if (!par) return { error: "Esa entrega no corresponde a esa beca." };
    if (estado === "recibida" || estado === "observada") {
      await tx`
        insert into beca_entrega_estado (asignacion_id, entrega_id, estado, observacion, marcada_por)
        values (${asignacionId}, ${entregaId}, ${estado}, ${nota}, mi_usuario_id())
        on conflict (asignacion_id, entrega_id) do update set
          estado = excluded.estado, observacion = excluded.observacion,
          marcada_por = excluded.marcada_por, marcada_en = now()
      `;
    } else {
      await tx`
        delete from beca_entrega_estado
        where asignacion_id = ${asignacionId} and entrega_id = ${entregaId}
      `;
    }
    return { ok: true };
  });
  revalidatePath("/becas");
  return resultado;
}

// ── Importación desde Excel ──────────────────────────────────────────────────
// El .xlsx se lee en el navegador (importar-dialog.tsx); acá llegan las
// filas ya mapeadas, que se vuelven a validar con sanearFilas.

export type VistaPreviaImportacion = {
  filas: FilaClasificada[];
  // Áreas del archivo que todavía no existen en ese año (se crean al importar).
  areasNuevas: string[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- transacción de postgres.js
async function programaDeLaOrg(tx: any, programaId: string): Promise<boolean> {
  const [programa] = await tx`
    select 1 from beca_programa where id = ${programaId} and organizacion_id = mi_organizacion_id()
  `;
  return !!programa;
}

export async function previsualizarImportacion(
  programaId: string,
  anio: number,
  filasCrudas: unknown,
): Promise<Resultado<VistaPreviaImportacion>> {
  const session = await requireSeccion("becas");
  if (!esUuid(programaId) || !esAnio(anio)) return { error: "Elegí el programa y el año." };
  const filas = sanearFilas(filasCrudas);
  if (filas.length === 0) return { error: "No se encontró ninguna fila con DNI y apellido." };
  const dnis = filas.map((f) => f.dni);
  const areas = [...new Set(filas.map((f) => f.area).filter((a): a is string => !!a))];

  return withUser(session.user.id, async (tx): Promise<Resultado<VistaPreviaImportacion>> => {
    if (!(await programaDeLaOrg(tx, programaId))) return { error: "El programa no existe." };
    const [enPadron, conEstaBeca, incompatibles, areasExistentes] = await Promise.all([
      tx<{ dni: string }[]>`
        select dni from estudiante
        where organizacion_id = mi_organizacion_id() and dni = any(${dnis}::text[])
      `,
      tx<{ dni: string }[]>`
        select e.dni
        from beca_asignacion a
        join estudiante e on e.id = a.estudiante_id
        where a.organizacion_id = mi_organizacion_id()
          and a.programa_id = ${programaId} and a.anio = ${anio}
          and e.dni = any(${dnis}::text[])
      `,
      tx<{ dni: string; programa: string }[]>`
        select e.dni, p.nombre as programa
        from beca_asignacion a
        join estudiante e on e.id = a.estudiante_id
        join beca_programa p on p.id = a.programa_id
        where a.organizacion_id = mi_organizacion_id()
          and a.anio = ${anio} and a.estado = 'activa'
          and e.dni = any(${dnis}::text[])
          and exists (
            select 1 from beca_incompatibilidad i
            where (i.programa_a = a.programa_id and i.programa_b = ${programaId})
               or (i.programa_b = a.programa_id and i.programa_a = ${programaId})
          )
      `,
      tx<{ nombre: string }[]>`
        select lower(nombre) as nombre from beca_area
        where organizacion_id = mi_organizacion_id() and anio = ${anio}
      `,
    ]);

    const incompatiblesPorDni = new Map<string, string[]>();
    for (const fila of incompatibles) {
      const lista = incompatiblesPorDni.get(fila.dni);
      if (lista) lista.push(fila.programa);
      else incompatiblesPorDni.set(fila.dni, [fila.programa]);
    }
    const existentes = new Set(areasExistentes.map((a) => a.nombre));
    return {
      ok: true,
      filas: clasificarFilas(
        filas,
        new Set(enPadron.map((f) => f.dni)),
        new Set(conEstaBeca.map((f) => f.dni)),
        incompatiblesPorDni,
      ),
      areasNuevas: areas.filter((a) => !existentes.has(a.toLowerCase())),
    };
  });
}

export type ResumenImportacion = {
  estudiantesNuevos: number;
  becasNuevas: number;
  becasYaExistentes: number;
  areasCreadas: number;
};

export async function aplicarImportacion(
  programaId: string,
  anio: number,
  filasCrudas: unknown,
): Promise<Resultado<ResumenImportacion>> {
  const session = await requireSeccion("becas");
  if (!esUuid(programaId) || !esAnio(anio)) return { error: "Elegí el programa y el año." };
  const filas = sanearFilas(filasCrudas);
  if (filas.length === 0) return { error: "No se encontró ninguna fila con DNI y apellido." };

  const resultado = await withUser(session.user.id, async (tx): Promise<Resultado<ResumenImportacion>> => {
    if (!(await programaDeLaOrg(tx, programaId))) return { error: "El programa no existe." };
    // tx.json y no JSON.stringify(...)::jsonb: con el cast, postgres.js toma el
    // parámetro como jsonb y lo vuelve a serializar, y llega un string JSON
    // en vez de un arreglo ("cannot call jsonb_to_recordset on a non-array").
    const datos = tx.json(filas);

    // 1. Padrón: alta de los que no estaban. A los que ya estaban solo se les
    //    completan datos: lo que trae el listado pisa lo anterior únicamente
    //    si no viene vacío, y el nombre solo si antes no estaba separado.
    const estudiantes = await tx<{ nuevo: boolean }[]>`
      insert into estudiante (organizacion_id, dni, apellido, nombre, legajo, carrera, email, telefono)
      select mi_organizacion_id(), x.dni, x.apellido, coalesce(x.nombre, ''), x.legajo, x.carrera, x.email, x.telefono
      from jsonb_to_recordset(${datos})
        as x(dni text, apellido text, nombre text, legajo text, carrera text, email text, telefono text)
      on conflict (organizacion_id, dni) do update set
        apellido = case when estudiante.nombre = '' and excluded.nombre <> '' then excluded.apellido else estudiante.apellido end,
        nombre   = case when estudiante.nombre = '' and excluded.nombre <> '' then excluded.nombre else estudiante.nombre end,
        legajo   = coalesce(excluded.legajo, estudiante.legajo),
        carrera  = coalesce(excluded.carrera, estudiante.carrera),
        email    = coalesce(excluded.email, estudiante.email),
        telefono = coalesce(excluded.telefono, estudiante.telefono)
      returning (xmax = 0) as nuevo
    `;

    // 2. Áreas del archivo que no existan todavía en ese año (por nombre).
    const areas = await tx`
      insert into beca_area (organizacion_id, anio, nombre, departamento, tutor_nombre)
      select mi_organizacion_id(), ${anio}, d.area, d.departamento, d.tutor
      from (
        select distinct on (lower(x.area)) x.area, x.departamento, x.tutor
        from jsonb_to_recordset(${datos}) as x(area text, departamento text, tutor text)
        where x.area is not null
        order by lower(x.area)
      ) d
      where not exists (
        select 1 from beca_area a
        where a.organizacion_id = mi_organizacion_id() and a.anio = ${anio}
          and lower(a.nombre) = lower(d.area)
      )
      returning id
    `;

    // 3. Becas. Si el estudiante ya tenía esta beca este año no se pisa
    //    nada: solo se completan área, módulos y condición si faltaban.
    const becas = await tx<{ nueva: boolean }[]>`
      insert into beca_asignacion (
        organizacion_id, estudiante_id, programa_id, anio, condicion, estado, area_id, modulos
      )
      select mi_organizacion_id(), e.id, ${programaId}, ${anio}, x.condicion, x.estado, ar.id, x.modulos
      from jsonb_to_recordset(${datos})
        as x(dni text, condicion text, estado text, area text, modulos int)
      join estudiante e on e.organizacion_id = mi_organizacion_id() and e.dni = x.dni
      left join lateral (
        select a.id from beca_area a
        where a.organizacion_id = mi_organizacion_id() and a.anio = ${anio}
          and lower(a.nombre) = lower(x.area)
        order by a.creado_en, a.id
        limit 1
      ) ar on true
      on conflict (estudiante_id, programa_id, anio) do update set
        area_id   = coalesce(beca_asignacion.area_id, excluded.area_id),
        modulos   = coalesce(beca_asignacion.modulos, excluded.modulos),
        condicion = coalesce(beca_asignacion.condicion, excluded.condicion)
      returning (xmax = 0) as nueva
    `;

    const becasNuevas = becas.filter((b) => b.nueva).length;
    return {
      ok: true,
      estudiantesNuevos: estudiantes.filter((e) => e.nuevo).length,
      becasNuevas,
      becasYaExistentes: becas.length - becasNuevas,
      areasCreadas: areas.length,
    };
  });
  revalidatePath("/becas");
  return resultado;
}
