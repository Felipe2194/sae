// Enriquece los 13 proyectos (áreas) del seed base para que el módulo se vea
// en uso: equipo asignado, más tareas por hacer/en progreso/hechas (algunas
// con subtareas y co-asignados), notas y actividad del equipo, plantillas de
// tareas recurrentes, fechas importantes (hitos) y documentos compartidos.
// Requiere haber corrido antes npm run db:seed (usa esa organización,
// usuarios y áreas).
// Uso: npm run db:seed-proyectos-demo

import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";

const d = (n: number) => {
  const date = new Date();
  date.setDate(date.getDate() + n);
  return date.toISOString().split("T")[0];
};

async function seedProyectosDemo() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  try {
    const [org] = await sql`
      select id from organizacion where slug = 'sae-frvm' limit 1
    `;
    if (!org) {
      console.error("No existe la organización 'sae-frvm'. Corré primero: npm run db:seed");
      process.exit(1);
    }

    const [yaCargado] = await sql`
      select area_id from area_asignado
      where area_id in (select id from area where organizacion_id = ${org.id})
      limit 1
    `;
    if (yaCargado) {
      console.log(
        "El seed de proyectos ya fue aplicado (ya hay equipos asignados). No se repite.",
      );
      return;
    }

    const usuarios = await sql`
      select id, email from usuario where organizacion_id = ${org.id}
    `;
    const uid = (email: string) => {
      const u = usuarios.find((u) => u.email === email);
      if (!u) throw new Error(`No se encontró el usuario ${email}`);
      return u.id as string;
    };
    const admin = uid("admin@sae.test");
    const coord = uid("carlos@sae.test");
    const joaco = uid("joaco@sae.test");
    const cande = uid("cande@sae.test");
    const mili = uid("mili@sae.test");
    const vicky = uid("vicky@sae.test");
    const luchi = uid("luchi@sae.test");
    const felipe = uid("feli@sae.test");
    const leo = uid("leo@sae.test");
    const cami = uid("cami@sae.test");
    const julian = uid("julian@sae.test");
    const edu = uid("edu@sae.test");
    const agus = uid("agus@sae.test");

    const areas = await sql`
      select id, nombre from area where organizacion_id = ${org.id}
    `;
    const aid = (nombre: string) => {
      const a = areas.find((a) => a.nombre === nombre);
      if (!a) throw new Error(`No se encontró el área ${nombre}`);
      return a.id as string;
    };
    const areaBecas = aid("Becas");
    const areaDeportes = aid("Deportes");
    const areaVisitas = aid("Visitas");
    const areaSeminario = aid("Seminario de Ingreso");
    const areaSalud = aid("Salud");
    const areaCharlas = aid("Charlas y Capacitaciones");
    const areaResidencias = aid("Residencias");
    const areaViajes = aid("Viajes");
    const areaUtn = aid("UTN Corre");
    const areaTutorias = aid("Tutorías");
    const areaRRII = aid("Relaciones Internacionales");
    const areaGenero = aid("Género");
    const areaDiscapacidad = aid("Discapacidad");

    // ── Equipo asignado a cada proyecto ──────────────────────────────────────
    const equipos: [string, string[]][] = [
      [areaBecas, [coord, mili]],
      [areaDeportes, [joaco, cami, leo]],
      [areaVisitas, [vicky, luchi, joaco]],
      [areaSeminario, [coord, felipe, cande]],
      [areaSalud, [mili, agus]],
      [areaCharlas, [admin, felipe]],
      [areaResidencias, [julian, edu]],
      [areaViajes, [coord, vicky, luchi]],
      [areaUtn, [cami, joaco]],
      [areaTutorias, [coord, cande, mili]],
      [areaRRII, [admin, luchi]],
      [areaGenero, [cande, agus]],
      [areaDiscapacidad, [edu, julian]],
    ];
    for (const [areaId, miembros] of equipos) {
      for (const usuarioId of miembros) {
        await sql`
          insert into area_asignado (area_id, usuario_id)
          values (${areaId}, ${usuarioId})
        `;
      }
    }

    // ── Más tareas (por hacer / en progreso / hechas) ────────────────────────
    type TareaDef = {
      area: string;
      titulo: string;
      responsable: string | null;
      estado: string;
      prioridad: string;
      fecha: string | null;
      creador: string;
      subtareas?: string[];
      coasignados?: string[];
    };
    const tareas: TareaDef[] = [
      { area: areaResidencias, titulo: "Contactar propietarios de nuevas residencias", responsable: julian, estado: "por_hacer", prioridad: "media", fecha: d(12), creador: coord },
      { area: areaResidencias, titulo: "Armar folleto de residencias 2027", responsable: edu, estado: "en_progreso", prioridad: "baja", fecha: d(18), creador: coord },
      { area: areaGenero, titulo: "Organizar jornada de género y diversidad", responsable: cande, estado: "en_progreso", prioridad: "alta", fecha: d(25), creador: admin,
        subtareas: ["Confirmar disertantes", "Reservar auditorio", "Difundir por redes"] },
      { area: areaGenero, titulo: "Actualizar protocolo de género de la secretaría", responsable: agus, estado: "por_hacer", prioridad: "media", fecha: d(30), creador: admin },
      { area: areaDiscapacidad, titulo: "Relevar accesibilidad de las aulas", responsable: edu, estado: "en_progreso", prioridad: "alta", fecha: d(15), creador: coord,
        coasignados: [julian] },
      { area: areaDiscapacidad, titulo: "Contactar a fonoaudiología para intérprete de LSA", responsable: julian, estado: "por_hacer", prioridad: "media", fecha: d(20), creador: coord },
      { area: areaRRII, titulo: "Traducir folletería institucional al inglés", responsable: luchi, estado: "por_hacer", prioridad: "baja", fecha: d(22), creador: admin },
      { area: areaRRII, titulo: "Armar convocatoria de intercambio 2027", responsable: admin, estado: "en_progreso", prioridad: "alta", fecha: d(28), creador: admin,
        subtareas: ["Definir universidades destino", "Armar formulario de postulación", "Publicar bases y condiciones"] },
      { area: areaUtn, titulo: "Cerrar balance de UTN Corre 2026", responsable: cami, estado: "hecha", prioridad: "media", fecha: d(-8), creador: joaco },
      { area: areaUtn, titulo: "Definir fecha de UTN Corre 2027", responsable: joaco, estado: "por_hacer", prioridad: "baja", fecha: d(40), creador: joaco },
      { area: areaDeportes, titulo: "Conseguir árbitro para el torneo interno", responsable: leo, estado: "por_hacer", prioridad: "media", fecha: d(6), creador: joaco },
      { area: areaDeportes, titulo: "Comprar premios para el torneo", responsable: cami, estado: "por_hacer", prioridad: "baja", fecha: d(9), creador: joaco },
      { area: areaBecas, titulo: "Armar comisión evaluadora de becas", responsable: coord, estado: "en_progreso", prioridad: "alta", fecha: d(4), creador: admin,
        coasignados: [mili] },
      { area: areaSeminario, titulo: "Diseñar nueva folletería del seminario", responsable: felipe, estado: "por_hacer", prioridad: "baja", fecha: d(16), creador: coord },
      { area: areaCharlas, titulo: "Armar banco de disertantes 2027", responsable: admin, estado: "en_progreso", prioridad: "media", fecha: d(19), creador: admin },
      { area: areaSalud, titulo: "Renovar botiquín de la secretaría", responsable: agus, estado: "hecha", prioridad: "baja", fecha: d(-3), creador: mili },
      { area: areaViajes, titulo: "Difundir el viaje al Congreso CONEI", responsable: luchi, estado: "en_progreso", prioridad: "media", fecha: d(10), creador: coord },
      { area: areaTutorias, titulo: "Relevar satisfacción de tutorías del cuatrimestre", responsable: mili, estado: "por_hacer", prioridad: "baja", fecha: d(24), creador: coord },
    ];

    for (const t of tareas) {
      const [nueva] = await sql`
        insert into tarea
          (organizacion_id, area_id, titulo, responsable_id, estado, prioridad, fecha_vencimiento, creada_por, orden, completada_en)
        values
          (${org.id}, ${t.area}, ${t.titulo}, ${t.responsable}, ${t.estado}, ${t.prioridad}, ${t.fecha}, ${t.creador}, 0,
           ${t.estado === "hecha" ? sql`now()` : null})
        returning id
      `;
      if (t.subtareas) {
        for (let i = 0; i < t.subtareas.length; i++) {
          await sql`
            insert into subtarea (tarea_id, titulo, orden, hecha)
            values (${nueva.id}, ${t.subtareas[i]}, ${i}, false)
          `;
        }
      }
      if (t.coasignados) {
        for (const usuarioId of t.coasignados) {
          await sql`
            insert into tarea_asignado (tarea_id, usuario_id)
            values (${nueva.id}, ${usuarioId})
          `;
        }
      }
    }

    // ── Tareas planificadas (activa = false, fuera del tablero) ─────────────
    const planificadas: TareaDef[] = [
      { area: areaBecas, titulo: "Armar bases de la convocatoria de becas 2027", responsable: coord, estado: "por_hacer", prioridad: "media", fecha: d(60), creador: admin,
        subtareas: ["Revisar reglamento vigente", "Actualizar montos", "Circular a comisión directiva"] },
      { area: areaDeportes, titulo: "Planificar torneo de vóley del segundo cuatrimestre", responsable: leo, estado: "por_hacer", prioridad: "baja", fecha: d(75), creador: joaco,
        subtareas: ["Sondear interés por carrera", "Reservar gimnasio"] },
      { area: areaSeminario, titulo: "Rediseñar el cronograma del Seminario de Ingreso 2028", responsable: null, estado: "por_hacer", prioridad: "baja", fecha: d(150), creador: admin },
    ];
    for (const t of planificadas) {
      const [nueva] = await sql`
        insert into tarea
          (organizacion_id, area_id, titulo, responsable_id, estado, prioridad, fecha_vencimiento, creada_por, orden, activa)
        values
          (${org.id}, ${t.area}, ${t.titulo}, ${t.responsable}, ${t.estado}, ${t.prioridad}, ${t.fecha}, ${t.creador}, 0, false)
        returning id
      `;
      if (t.subtareas) {
        for (let i = 0; i < t.subtareas.length; i++) {
          await sql`
            insert into subtarea (tarea_id, titulo, orden, hecha)
            values (${nueva.id}, ${t.subtareas[i]}, ${i}, false)
          `;
        }
      }
    }

    // ── Notas y actividad del equipo (nota_area) ─────────────────────────────
    const notas: [string, string, string][] = [
      [areaBecas, "nota", "El formulario de postulación quedó armado, falta el link definitivo."],
      [areaBecas, "actividad", "Publicamos la convocatoria de becas 2026 en Instagram y el grupo de WhatsApp."],
      [areaBecas, "progreso", "Van 32 postulaciones recibidas sobre un cupo de 50."],
      [areaDeportes, "idea", "Podríamos sumar una categoría mixta al torneo de este año."],
      [areaDeportes, "actividad", "Se reservó la cancha municipal para el 18/9."],
      [areaVisitas, "nota", "El IPEM 46 pidió que la próxima charla sea después de las 10hs."],
      [areaVisitas, "progreso", "Ya visitamos 8 colegios este cuatrimestre, faltan 3 agendados."],
      [areaSeminario, "actividad", "Se armó la lista de aulas disponibles para el seminario."],
      [areaSeminario, "idea", "Grabar una de las charlas para subir después a YouTube."],
      [areaSalud, "nota", "Quedó pendiente renovar el botiquín antes de fin de mes."],
      [areaCharlas, "actividad", "Confirmado el disertante para la charla de salidas laborales."],
      [areaCharlas, "idea", "Invitar a egresados recientes para la próxima ronda de charlas."],
      [areaResidencias, "nota", "Dos residencias de la lista ya no están disponibles, hay que sacarlas."],
      [areaViajes, "progreso", "El viaje al Parque Tecnológico cerró con saldo positivo."],
      [areaViajes, "actividad", "Se abrieron las inscripciones al Congreso CONEI 2027."],
      [areaUtn, "progreso", "UTN Corre 2026 tuvo 140 inscriptos, récord de la carrera."],
      [areaTutorias, "nota", "Faltan tutores para primer año de Ingeniería Química."],
      [areaTutorias, "actividad", "Se asignaron tutores a los ingresantes de este cuatrimestre."],
      [areaRRII, "idea", "Sumar un convenio con una universidad de Brasil."],
      [areaRRII, "nota", "El folleto institucional en inglés quedó desactualizado."],
      [areaGenero, "actividad", "Se difundió el protocolo de género en la bienvenida a ingresantes."],
      [areaGenero, "idea", "Armar una charla en conjunto con Discapacidad."],
      [areaDiscapacidad, "progreso", "Relevamiento de accesibilidad al 60%, faltan 3 edificios."],
      [areaDiscapacidad, "nota", "Hay que pedir presupuesto para la rampa del edificio anexo."],
    ];
    for (const [areaId, tipo, contenido] of notas) {
      const autores = [admin, coord, joaco, cande, mili, vicky, luchi, felipe];
      const autor = autores[Math.floor(Math.random() * autores.length)];
      await sql`
        insert into nota_area (area_id, autor_id, contenido, tipo)
        values (${areaId}, ${autor}, ${contenido}, ${tipo}::tipo_nota_area)
      `;
    }

    // ── Plantillas de tareas recurrentes ─────────────────────────────────────
    const plantillas: [string, string, string, string[]][] = [
      [areaBecas, "Convocatoria de becas", coord, [
        "Publicar convocatoria",
        "Recibir postulaciones",
        "Evaluar postulaciones",
        "Notificar resultados",
      ]],
      [areaDeportes, "Organizar torneo interno", joaco, [
        "Reservar cancha",
        "Armar planilla de inscripciones",
        "Conseguir árbitro",
        "Comprar premios",
      ]],
      [areaVisitas, "Coordinar visita a colegio", coord, [
        "Contactar al colegio",
        "Confirmar fecha y horario",
        "Armar equipo que asiste",
        "Preparar material",
      ]],
      [areaCharlas, "Organizar charla", admin, [
        "Confirmar disertante",
        "Reservar aula",
        "Difundir por redes",
        "Armar planilla de asistencia",
      ]],
    ];
    for (const [areaId, nombre, creador, items] of plantillas) {
      const [plantilla] = await sql`
        insert into plantilla_area (organizacion_id, area_id, nombre, creada_por)
        values (${org.id}, ${areaId}, ${nombre}, ${creador})
        returning id
      `;
      for (let i = 0; i < items.length; i++) {
        await sql`
          insert into plantilla_item (plantilla_id, titulo, orden)
          values (${plantilla.id}, ${items[i]}, ${i})
        `;
      }
    }

    // ── Fechas importantes (hitos) ───────────────────────────────────────────
    const hitos: [string, string, number, string][] = [
      [areaBecas, "Apertura de inscripciones a becas 2027", 45, admin],
      [areaBecas, "Cierre de la convocatoria 2026", -30, admin],
      [areaDeportes, "Torneo interno de fútbol 5", 14, joaco],
      [areaVisitas, "Cierre de agenda de visitas del cuatrimestre", 35, coord],
      [areaSeminario, "Cierre de inscripción al Seminario de Ingreso", 12, coord],
      [areaSalud, "Jornada de Salud Estudiantil", 50, mili],
      [areaCharlas, "Ciclo de capacitaciones del segundo cuatrimestre", 40, admin],
      [areaResidencias, "Actualización del listado de residencias", -10, edu],
      [areaViajes, "Cierre de inscripción al Congreso CONEI", 30, admin],
      [areaUtn, "Carrera UTN Corre 2026", -25, joaco],
      [areaTutorias, "Inicio de tutorías de julio", -60, coord],
      [areaRRII, "Convocatoria de intercambio 2027", 55, admin],
      [areaGenero, "Jornada de género y diversidad", 25, cande],
      [areaDiscapacidad, "Relevamiento de accesibilidad edilicia", -15, edu],
    ];
    for (const [areaId, titulo, dias, creador] of hitos) {
      await sql`
        insert into hito_area (area_id, titulo, fecha, creado_por)
        values (${areaId}, ${titulo}, ${d(dias)}, ${creador})
      `;
    }

    // ── Documentos compartidos (acceso_rapido) ───────────────────────────────
    const documentos: [string, string, string][] = [
      [areaBecas, "Planilla de postulantes", "https://docs.google.com/spreadsheets/d/demo-becas-postulantes"],
      [areaBecas, "Formulario de inscripción", "https://forms.gle/demo-becas-2027"],
      [areaDeportes, "Reglamento del torneo", "https://docs.google.com/document/d/demo-reglamento-torneo"],
      [areaDeportes, "Planilla de inscriptos", "https://docs.google.com/spreadsheets/d/demo-deportes-inscriptos"],
      [areaVisitas, "Presentación institucional", "https://drive.google.com/drive/folders/demo-presentacion-sae"],
      [areaVisitas, "Directorio de colegios (respaldo)", "https://docs.google.com/spreadsheets/d/demo-directorio-colegios"],
      [areaViajes, "Cronograma del viaje a Rosario", "https://drive.google.com/drive/folders/demo-cronograma-conei"],
      [areaSeminario, "Material del Seminario de Ingreso", "https://drive.google.com/drive/folders/demo-material-seminario"],
      [areaCharlas, "Banco de disertantes", "https://docs.google.com/spreadsheets/d/demo-banco-disertantes"],
    ];
    const ordenPorArea: Record<string, number> = {};
    for (const [areaId, etiqueta, url] of documentos) {
      const orden = ordenPorArea[areaId] ?? 0;
      ordenPorArea[areaId] = orden + 1;
      await sql`
        insert into acceso_rapido (organizacion_id, area_id, etiqueta, url, orden)
        values (${org.id}, ${areaId}, ${etiqueta}, ${url}, ${orden})
      `;
    }

    console.log("✓ Seed de proyectos completado.");
    console.log(`  equipos asignados      : ${equipos.length} proyectos`);
    console.log(`  tareas nuevas          : ${tareas.length} (activas) + ${planificadas.length} (planificadas)`);
    console.log(`  notas / actividad      : ${notas.length}`);
    console.log(`  plantillas             : ${plantillas.length}`);
    console.log(`  hitos (fechas clave)   : ${hitos.length}`);
    console.log(`  documentos compartidos : ${documentos.length}`);
  } finally {
    await sql.end();
  }
}

seedProyectosDemo().catch((err) => {
  console.error(err);
  process.exit(1);
});
