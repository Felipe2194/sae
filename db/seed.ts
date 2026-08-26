// Inserta datos de prueba: una organización, 13 áreas, 3 usuarios de auth,
// 11 integrantes del equipo (8 con turnos reales en el cronograma + 3 que
// solo reciben tareas) y 15 tareas.
// Uso: npm run db:seed
// Requiere que las migraciones ya estén aplicadas (npm run db:migrate).

import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";
import bcrypt from "bcryptjs";

async function seed() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  try {
    const [existente] = await sql`
      select id from organizacion where slug = 'sae-frvm' limit 1
    `;
    if (existente) {
      console.log(
        "El seed ya fue aplicado. Para resetear: docker compose down -v && docker compose up -d && npm run db:migrate && npm run db:seed",
      );
      return;
    }

    const passwordHash = await bcrypt.hash("password123", 10);

    // ── Organización ─────────────────────────────────────────────────────────
    const [org] = await sql`
      insert into organizacion (nombre, slug)
      values ('SAE FRVM', 'sae-frvm')
      returning id
    `;

    // ── Usuarios de auth (test) ───────────────────────────────────────────────
    const [admin] = await sql`
      insert into usuario (organizacion_id, nombre, email, password_hash, rol, estado)
      values (${org.id}, 'Ana Administradora', 'admin@sae.test', ${passwordHash}, 'administrador', 'activo')
      returning id
    `;
    const [coord] = await sql`
      insert into usuario (organizacion_id, nombre, email, password_hash, rol, estado)
      values (${org.id}, 'Carlos Miembro', 'carlos@sae.test', ${passwordHash}, 'miembro', 'activo')
      returning id
    `;
    const [miembro] = await sql`
      insert into usuario (organizacion_id, nombre, email, password_hash, rol, estado)
      values (${org.id}, 'Mora Miembro', 'miembro@sae.test', ${passwordHash}, 'miembro', 'activo')
      returning id
    `;

    // ── Integrantes del equipo (para cronograma) ──────────────────────────────
    // Nicknames reales; emails placeholder hasta que se registren.
    const insertMiembro = async (nombre: string, email: string) => {
      const [r] = await sql`
        insert into usuario (organizacion_id, nombre, email, password_hash, rol, estado)
        values (${org.id}, ${nombre}, ${email}, ${passwordHash}, 'miembro', 'activo')
        returning id
      `;
      return r.id as string;
    };

    const joaId = await insertMiembro("Joaco", "joaco@sae.test");
    const canId = await insertMiembro("Cande", "cande@sae.test");
    const milId = await insertMiembro("Mili", "mili@sae.test");
    const vicId = await insertMiembro("Viki", "vicky@sae.test");
    const lucId = await insertMiembro("Luchi", "luchi@sae.test");
    const felId = await insertMiembro("Felipe", "feli@sae.test");
    const leoId = await insertMiembro("Leo", "leo@sae.test");
    const camId = await insertMiembro("Cami", "cami@sae.test");

    // Reciben tareas pero no tienen turno fijo en el cartel de oficina.
    await insertMiembro("Julian", "julian@sae.test");
    await insertMiembro("Edu", "edu@sae.test");
    await insertMiembro("Agus", "agus@sae.test");

    // ── Áreas ─────────────────────────────────────────────────────────────────
    const nombresAreas = [
      "Becas",
      "Deportes",
      "Visitas",
      "Seminario de Ingreso",
      "Salud",
      "Charlas y Capacitaciones",
      "Residencias",
      "Viajes",
      "UTN Corre",
      "Tutorías",
      "Relaciones Internacionales",
      "Género",
      "Discapacidad",
    ];
    const colores = [
      "#ef4444",
      "#f97316",
      "#f59e0b",
      "#eab308",
      "#84cc16",
      "#22c55e",
      "#10b981",
      "#14b8a6",
      "#06b6d4",
      "#3b82f6",
      "#6366f1",
      "#a855f7",
      "#ec4899",
    ];

    const areaIds: string[] = [];
    for (let i = 0; i < nombresAreas.length; i++) {
      const [area] = await sql`
        insert into area (organizacion_id, nombre, color, responsable_id, activa)
        values (${org.id}, ${nombresAreas[i]}, ${colores[i]}, ${coord.id}, true)
        returning id
      `;
      areaIds.push(area.id as string);
    }

    const [
      areaBecas,
      areaDeportes,
      areaVisitas,
      areaSeminario,
      areaSalud,
      areaCharlas,
      areaResidencias,
      areaViajes,
      areaUtn,
      areaTutorias,
    ] = areaIds;

    // Helper: fecha relativa desde hoy
    const d = (n: number) => {
      const date = new Date();
      date.setDate(date.getDate() + n);
      return date.toISOString().split("T")[0];
    };

    // ── Tareas ────────────────────────────────────────────────────────────────
    await sql`
      insert into tarea
        (organizacion_id, area_id, titulo, responsable_id, estado, prioridad, fecha_vencimiento, creada_por, orden, completada_en)
      values
        (${org.id}, ${areaBecas},       'Publicar convocatoria de becas 2026',          ${coord.id},   'por_hacer',  'alta',  ${d(3)},  ${coord.id},  0, null),
        (${org.id}, ${areaBecas},       'Revisar planillas de postulantes',              ${miembro.id}, 'en_progreso','media', ${d(5)},  ${coord.id},  0, null),
        (${org.id}, ${areaBecas},       'Enviar notificación de resultados',             null,          'por_hacer',  'media', ${d(10)}, ${coord.id},  1, null),
        (${org.id}, ${areaDeportes},    'Coordinar cancha para el torneo interno',       ${miembro.id}, 'por_hacer',  'baja',  ${d(7)},  ${coord.id},  0, null),
        (${org.id}, ${areaDeportes},    'Armar planilla de inscripciones',               ${miembro.id}, 'hecha',      'media', ${d(-2)}, ${coord.id},  0, now() - interval '1 day'),
        (${org.id}, ${areaVisitas},     'Agendar visita a escuela técnica',              ${coord.id},   'por_hacer',  'media', ${d(4)},  ${admin.id},  0, null),
        (${org.id}, ${areaSeminario},   'Reservar aula para seminario de ingreso',       ${coord.id},   'en_progreso','alta',  ${d(1)},  ${coord.id},  0, null),
        (${org.id}, ${areaSalud},       'Actualizar cartelera de salud estudiantil',     ${miembro.id}, 'por_hacer',  'baja',  null,     ${miembro.id},0, null),
        (${org.id}, ${areaSalud},       'Coordinar jornada de donación de sangre',       null,          'por_hacer',  'media', ${d(14)}, ${coord.id},  1, null),
        (${org.id}, ${areaCharlas},     'Confirmar disertante de la próxima charla',     ${admin.id},   'en_progreso','media', ${d(6)},  ${admin.id},  0, null),
        (${org.id}, ${areaResidencias}, 'Actualizar listado de residencias disponibles', ${coord.id},   'por_hacer',  'baja',  null,     ${coord.id},  0, null),
        (${org.id}, ${areaViajes},      'Cotizar transporte para viaje de estudio',      ${miembro.id}, 'por_hacer',  'media', ${d(8)},  ${coord.id},  0, null),
        (${org.id}, ${areaUtn},         'Difundir inscripción a UTN Corre',              ${miembro.id}, 'hecha',      'baja',  ${d(-5)}, ${miembro.id},0, now() - interval '3 days'),
        (${org.id}, ${areaTutorias},    'Asignar tutores a ingresantes',                 ${coord.id},   'en_progreso','alta',  ${d(2)},  ${coord.id},  0, null),
        (${org.id}, ${areaTutorias},    'Armar cronograma de tutorías de julio',         null,          'por_hacer',  'media', ${d(9)},  ${coord.id},  1, null)
    `;

    // ── Turnos reales de la oficina ───────────────────────────────────────────
    // dia_semana: 0=Lun, 1=Mar, 2=Mié, 3=Jue, 4=Vie
    //
    // Se almacenan bloques contiguos por persona+día.
    // La UI expande al momento de mostrar comparando overlap de rango.
    //
    // Fuente: cartel "Horario de Oficina" (turno mañana 08–12 + turno tarde,
    // actualizado 2026).

    type T = [string, number, string, string]; // [userId, dia, inicio, fin]
    const turnos: T[] = [
      // ── Lunes
      [joaId, 0, "08:00", "12:00"],
      [canId, 0, "08:00", "12:00"],
      [milId, 0, "14:00", "18:00"],
      [felId, 0, "16:00", "17:00"],
      [lucId, 0, "17:00", "21:00"],
      [camId, 0, "18:00", "21:00"],

      // ── Martes
      [joaId, 1, "08:00", "12:00"],
      [milId, 1, "08:00", "12:00"],
      [canId, 1, "14:00", "15:00"],
      [lucId, 1, "14:00", "18:00"],
      [felId, 1, "17:00", "20:00"],
      [leoId, 1, "18:00", "20:00"],
      [canId, 1, "18:00", "21:00"],

      // ── Miércoles
      [joaId, 2, "08:00", "12:00"],
      [vicId, 2, "08:00", "12:00"],
      [milId, 2, "14:00", "18:00"],
      [lucId, 2, "14:00", "18:00"],
      [felId, 2, "17:00", "20:00"],
      [canId, 2, "18:00", "21:00"],

      // ── Jueves
      [joaId, 3, "08:00", "12:00"],
      [milId, 3, "08:00", "12:00"],
      [vicId, 3, "14:00", "18:00"],
      [canId, 3, "14:00", "16:00"],
      [felId, 3, "14:00", "18:00"],
      [lucId, 3, "17:00", "21:00"],

      // ── Viernes
      [joaId, 4, "08:00", "12:00"],
      [milId, 4, "08:00", "12:00"],
      [lucId, 4, "14:00", "18:00"],
      [canId, 4, "18:00", "21:00"],
      [camId, 4, "18:00", "21:00"],
    ];

    for (const [userId, dia, inicio, fin] of turnos) {
      await sql`
        insert into turno (organizacion_id, usuario_id, dia_semana, hora_inicio, hora_fin)
        values (${org.id}, ${userId}, ${dia}, ${inicio}, ${fin})
      `;
    }

    console.log("✓ Seed completado.");
    console.log(`  org_id : ${org.id}`);
    console.log("  usuarios auth:");
    console.log(`    admin@sae.test       (administrador) id: ${admin.id}`);
    console.log(`    carlos@sae.test      (miembro)       id: ${coord.id}`);
    console.log(`    miembro@sae.test     (miembro)       id: ${miembro.id}`);
    console.log(
      "  integrantes con turno: Joaco, Cande, Mili, Viki, Luchi, Felipe, Leo, Cami",
    );
    console.log("  integrantes sin turno (reciben tareas): Julian, Edu, Agus");
    console.log(`  áreas   : ${nombresAreas.length}`);
    console.log("  tareas  : 15");
    console.log(`  turnos  : ${turnos.length}`);
    console.log("  password de todos: password123");
  } finally {
    await sql.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
