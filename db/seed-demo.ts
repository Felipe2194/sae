// Datos de demo adicionales para el entorno de prueba (Vercel + Neon): colegios
// y su historial de visitas, viajes con inscriptos/costos/pagos, bitácoras
// diarias del equipo y tareas tipo evento/reunión para que el calendario y los
// informes no se vean vacíos. Requiere haber corrido `npm run db:seed` antes
// (reutiliza esa organización, usuarios y áreas).
// Uso: npm run db:seed-demo

import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";

const d = (n: number) => {
  const date = new Date();
  date.setDate(date.getDate() + n);
  return date.toISOString().split("T")[0];
};

async function seedDemo() {
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
      select id from colegio where organizacion_id = ${org.id} limit 1
    `;
    if (yaCargado) {
      console.log(
        "El seed de demo ya fue aplicado (ya hay colegios cargados). No se repite.",
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
    const miembro = uid("miembro@sae.test");
    const joaco = uid("joaco@sae.test");
    const cande = uid("cande@sae.test");
    const mili = uid("mili@sae.test");
    const vicky = uid("vicky@sae.test");
    const luchi = uid("luchi@sae.test");
    const felipe = uid("feli@sae.test");

    const areas = await sql`
      select id, nombre from area where organizacion_id = ${org.id}
    `;
    const aid = (nombre: string) => {
      const a = areas.find((a) => a.nombre === nombre);
      if (!a) throw new Error(`No se encontró el área ${nombre}`);
      return a.id as string;
    };
    const areaVisitas = aid("Visitas");
    const areaViajes = aid("Viajes");
    const areaBecas = aid("Becas");
    const areaCharlas = aid("Charlas y Capacitaciones");
    const areaSeminario = aid("Seminario de Ingreso");

    // ── Directorio de colegios ──────────────────────────────────────────────
    const colegiosDef = [
      ["IPEM 46 Justicia Social", "Villa María", "Centro", "Marta Gómez", "Directora", "marta.gomez@ipem46.edu.ar", "353-4551234", "activo"],
      ["Escuela Técnica Almafuerte", "Villa María", "Centro", "Roberto Díaz", "Regente", "rdiaz@etalmafuerte.edu.ar", "353-4552345", "activo"],
      ["Instituto San José", "Villa María", "Norte", "Silvina Torres", "Secretaria", "starres@sanjose.edu.ar", "353-4553456", "activo"],
      ["Escuela Normal Superior", "Villa María", "Centro", "Claudia Ferreyra", "Vicedirectora", "cferreyra@normalvm.edu.ar", "353-4554567", "nuevo"],
      ["IPET 291", "Villa Nueva", "Ribera", "Gustavo Paz", "Director", "gpaz@ipet291.edu.ar", "353-4555678", "activo"],
      ["Colegio San Antonio", "Villa María", "Sur", "Andrea Luna", "Directora", "aluna@sanantoniovm.edu.ar", "353-4556789", "activo"],
      ["Escuela Del Carmen", "Villa María", "Oeste", "Pablo Ríos", "Preceptor", "prios@delcarmen.edu.ar", "353-4557890", "inactivo"],
      ["Instituto Sagrado Corazón", "Villa Nueva", "Centro", "Lucía Molina", "Directora", "lmolina@sagradocorazonvn.edu.ar", "353-4558901", "activo"],
      ["IPEM 3 Manuel Belgrano", "Villa María", "Norte", "Fernando Acosta", "Regente", "facosta@ipem3.edu.ar", "353-4559012", "activo"],
      ["Escuela Técnica Nº 1", "Bell Ville", "Centro", "Mariana Suárez", "Directora", "msuarez@et1bv.edu.ar", "353-4610123", "nuevo"],
      ["Colegio Nuestra Señora", "Arroyo Cabral", "Centro", "Jorge Núñez", "Director", "jnunez@ns-ac.edu.ar", "353-4620234", "nuevo"],
      ["IPEM 87", "James Craik", "Centro", "Verónica Sosa", "Secretaria", "vsosa@ipem87.edu.ar", "353-4630345", "activo"],
    ] as const;

    const colegioIds: string[] = [];
    for (const [nombre, ciudad, zona, cn, cc, ce, ct, estado] of colegiosDef) {
      const [c] = await sql`
        insert into colegio
          (organizacion_id, nombre, ciudad, zona, contacto_nombre, contacto_cargo, contacto_email, contacto_telefono, estado_relacion)
        values
          (${org.id}, ${nombre}, ${ciudad}, ${zona}, ${cn}, ${cc}, ${ce}, ${ct}, ${estado})
        returning id
      `;
      colegioIds.push(c.id as string);
    }

    // ── Historial de visitas ────────────────────────────────────────────────
    // offsetDias, colegio, tipo, estado, cantAlumnos, integrantes[], observaciones
    type Visita = [number, number, string, string, number | null, string[], string];
    const visitas: Visita[] = [
      [-210, 0, "visita_colegio", "realizado", 85, [joaco, cande], "Charla sobre ingreso a la FRVM, buena recepción."],
      [-198, 1, "visita_colegio", "realizado", 60, [mili], "Presentación de carreras de ingeniería."],
      [-190, 4, "nos_visitan", "realizado", 40, [coord, admin], "Vinieron alumnos de 6to año a recorrer la facultad."],
      [-175, 2, "visita_colegio", "realizado", 55, [vicky, luchi], "Visita coordinada con el equipo de Becas."],
      [-160, 8, "feria_expo", "realizado", 200, [joaco, mili, cande], "Stand en la Expo Educativa de Villa María."],
      [-150, 5, "visita_colegio", "realizado", 45, [felipe], "Charla de orientación vocacional."],
      [-140, 6, "charla_taller", "cancelado", null, [], "Se suspendió por paro docente, no se reprogramó todavía."],
      [-133, 3, "nos_visitan", "realizado", 30, [coord], "Recorrida por laboratorios."],
      [-120, 9, "visita_colegio", "realizado", 50, [joaco, felipe], "Primera visita a esta escuela de Bell Ville."],
      [-110, 0, "charla_taller", "realizado", 70, [cande, mili], "Taller de armado de CV y perfil profesional."],
      [-95, 7, "visita_colegio", "realizado", 38, [vicky], "Visita de seguimiento, buena relación con la directora."],
      [-88, 1, "nos_visitan", "realizado", 25, [admin, coord], "Grupo reducido, consultas sobre becas."],
      [-70, 10, "visita_colegio", "reprogramado", null, [], "Se reprogramó por lluvia, pendiente nueva fecha."],
      [-60, 2, "feria_expo", "realizado", 150, [joaco, luchi, felipe], "Feria de carreras zona centro."],
      [-45, 11, "visita_colegio", "realizado", 42, [mili], "Primer contacto con IPEM 87 de James Craik."],
      [-30, 5, "nos_visitan", "realizado", 35, [coord], "Visitaron el Seminario de Ingreso en curso."],
      [-20, 4, "virtual", "realizado", 60, [cande], "Charla virtual por videollamada, buena convocatoria."],
      [-12, 8, "visita_colegio", "realizado", 48, [vicky, joaco], "Cierre de ciclo lectivo, entrega de folletería 2027."],
      [-5, 6, "charla_taller", "realizado", 55, [felipe, mili], "Taller de técnicas de estudio para ingresantes."],
      [3, 3, "visita_colegio", "confirmado", null, [luchi], "Visita coordinada para la semana que viene."],
      [7, 9, "nos_visitan", "confirmado", 30, [coord, admin], "Confirmado con el regente por mail."],
      [14, 0, "visita_colegio", "pendiente", null, [], "A confirmar horario con la escuela."],
      [21, 10, "feria_expo", "pendiente", null, [], "Feria educativa de la zona ribereña, esperando confirmación de stand."],
      [28, 7, "charla_taller", "confirmado", 40, [cande, felipe], "Taller sobre becas y ayudas económicas."],
    ];

    for (const [offset, colIdx, tipo, estado, cant, integrantes, obs] of visitas) {
      const [v] = await sql`
        insert into visita_colegio
          (organizacion_id, colegio_id, fecha, tipo, estado, cant_alumnos, observaciones, creada_por, asignado_por_id)
        values
          (${org.id}, ${colegioIds[colIdx]}, ${d(offset)}, ${tipo}, ${estado}, ${cant}, ${obs}, ${coord}, ${admin})
        returning id
      `;
      for (const usuarioId of integrantes) {
        await sql`
          insert into visita_integrante (visita_id, usuario_id)
          values (${v.id}, ${usuarioId})
        `;
      }
    }

    // ── Viajes ───────────────────────────────────────────────────────────────
    const [viajeRealizado] = await sql`
      insert into viaje
        (organizacion_id, nombre, destino, fecha_inicio, fecha_fin, cupo_maximo, precio, estado, codigo_publico, descripcion_publica, creada_por)
      values
        (${org.id}, 'Visita a Parque Tecnológico', 'Córdoba Capital', ${d(-45)}, ${d(-45)}, 40, 8500,
         'realizado', 'parque-tec-2026', 'Recorrida por el Parque Tecnológico y empresas de la zona.', ${coord})
      returning id
    `;
    await sql`
      insert into viaje_asignado (viaje_id, usuario_id)
      values (${viajeRealizado.id}, ${coord}), (${viajeRealizado.id}, ${joaco}), (${viajeRealizado.id}, ${mili})
    `;

    const inscriptosRealizado = [
      ["Nadia", "Fernández", "40111222", "S-1023", "Ingeniería en Sistemas", "3°", "confirmado"],
      ["Bruno", "Castro", "40222333", "S-1044", "Ingeniería Industrial", "2°", "confirmado"],
      ["Camila", "Vega", "40333444", "S-1067", "Ingeniería Civil", "4°", "confirmado"],
      ["Tomás", "Ibáñez", "40444555", "S-1089", "Ingeniería en Sistemas", "1°", "confirmado"],
      ["Rocío", "Aguirre", "40555666", "S-1101", "Ingeniería Química", "3°", "cancelado"],
      ["Franco", "Medina", "40666777", "S-1123", "Ingeniería Mecánica", "2°", "confirmado"],
    ] as const;
    for (const [nombre, apellido, dni, legajo, carrera, anio, estado] of inscriptosRealizado) {
      const [ins] = await sql`
        insert into viaje_integrante
          (viaje_id, nombre, apellido, dni, legajo, carrera, anio_cursada, estado, monto_a_pagar)
        values
          (${viajeRealizado.id}, ${nombre}, ${apellido}, ${dni}, ${legajo}, ${carrera}, ${anio}, ${estado}, 8500)
        returning id
      `;
      if (estado === "confirmado") {
        await sql`
          insert into viaje_pago (viaje_integrante_id, monto, medio_pago, fecha_pago, registrado_por)
          values (${ins.id}, 8500, 'Transferencia', ${d(-50)}, ${coord})
        `;
      }
    }
    await sql`
      insert into viaje_costo (viaje_id, concepto, monto, fijado_por)
      values
        (${viajeRealizado.id}, 'Transporte (micro)', 45000, ${coord}),
        (${viajeRealizado.id}, 'Seguro de viaje', 6000, ${coord})
    `;

    const [viajeAbierto] = await sql`
      insert into viaje
        (organizacion_id, nombre, destino, fecha_inicio, fecha_fin, cupo_maximo, precio, estado, codigo_publico, descripcion_publica, creada_por)
      values
        (${org.id}, 'Congreso Nacional de Estudiantes de Ingeniería', 'Rosario, Santa Fe', ${d(35)}, ${d(38)}, 50, 45000,
         'inscripciones_abiertas', 'conei-2027', 'Congreso nacional con charlas, talleres y networking.', ${admin})
      returning id
    `;
    await sql`
      insert into viaje_asignado (viaje_id, usuario_id)
      values (${viajeAbierto.id}, ${admin}), (${viajeAbierto.id}, ${vicky}), (${viajeAbierto.id}, ${luchi})
    `;
    const inscriptosAbierto = [
      ["Julieta", "Romero", "41111222", "S-1201", "Ingeniería en Sistemas", "4°", "confirmado"],
      ["Agustín", "Herrera", "41222333", "S-1223", "Ingeniería Industrial", "3°", "confirmado"],
      ["Milagros", "Ponce", "41333444", "S-1245", "Ingeniería Civil", "2°", "pendiente"],
      ["Ezequiel", "Bustos", "41444555", "S-1267", "Ingeniería en Sistemas", "5°", "lista_espera"],
    ] as const;
    for (const [nombre, apellido, dni, legajo, carrera, anio, estado] of inscriptosAbierto) {
      const [ins] = await sql`
        insert into viaje_integrante
          (viaje_id, nombre, apellido, dni, legajo, carrera, anio_cursada, estado, monto_a_pagar)
        values
          (${viajeAbierto.id}, ${nombre}, ${apellido}, ${dni}, ${legajo}, ${carrera}, ${anio}, ${estado}, 45000)
        returning id
      `;
      if (estado === "confirmado") {
        await sql`
          insert into viaje_pago (viaje_integrante_id, monto, medio_pago, fecha_pago, registrado_por)
          values (${ins.id}, 20000, 'Efectivo', ${d(-3)}, ${admin})
        `;
      }
    }

    // ── Tareas tipo evento/reunión (para el calendario) ─────────────────────
    await sql`
      insert into tarea
        (organizacion_id, area_id, titulo, tipo, responsable_id, estado, prioridad, fecha_vencimiento, hora_inicio, creada_por, orden, completada_en)
      values
        (${org.id}, ${areaBecas},     'Reunión de comisión directiva',            'reunion', ${admin},   'por_hacer',  'alta',  ${d(2)},  '18:00', ${admin}, 0, null),
        (${org.id}, ${areaVisitas},   'Reunión de equipo de Visitas',             'reunion', ${coord},   'por_hacer',  'media', ${d(4)},  '17:00', ${coord}, 0, null),
        (${org.id}, ${areaCharlas},   'Charla: Salidas laborales de Ingeniería',  'evento',  ${felipe},  'por_hacer',  'media', ${d(9)},  null,    ${coord}, 0, null),
        (${org.id}, ${areaSeminario}, 'Inicio del Seminario de Ingreso 2027',     'evento',  ${coord},   'por_hacer',  'alta',  ${d(15)}, null,    ${admin}, 0, null),
        (${org.id}, ${areaViajes},    'Reunión de cierre viaje Parque Tecnológico','reunion', ${coord},  'hecha',      'media', ${d(-40)},'16:00', ${coord}, 0, now() - interval '40 days'),
        (${org.id}, ${areaBecas},     'Entrega de resultados de becas 2026',      'entrega', ${admin},   'por_hacer',  'alta',  ${d(11)}, null,    ${admin}, 1, null),
        (${org.id}, ${areaVisitas},   'Reunión mensual con directores de colegio','reunion', ${admin},   'por_hacer',  'baja',  ${d(20)}, '10:00', ${admin}, 1, null)
    `;

    // ── Bitácora diaria (últimos días hábiles) ──────────────────────────────
    const registrosBitacora = [
      [joaco, "Armé el cronograma de turnos del mes.", "Falta confirmar reemplazo del jueves.", ""],
      [cande, "Respondí consultas de becas por mail.", "Revisar planillas de postulantes.", "Bastante volumen de consultas hoy."],
      [mili, "Coordiné la visita a IPEM 3.", "Confirmar transporte para la próxima semana.", ""],
      [vicky, "Actualicé el directorio de colegios.", "Cargar contactos nuevos de Villa Nueva.", ""],
      [luchi, "Seguimiento de inscriptos al congreso.", "Mandar recordatorio de pago a lista de espera.", ""],
      [felipe, "Preparé material para la charla de salidas laborales.", "Coordinar el aula con Seminario.", "Quedó pendiente confirmar proyector."],
    ] as const;

    const diasHabilesRecientes: number[] = [];
    for (let i = 0, offset = 0; diasHabilesRecientes.length < 8; i++) {
      offset = -i;
      const dow = new Date(Date.now() + offset * 86400000).getDay();
      if (dow !== 0 && dow !== 6) diasHabilesRecientes.push(offset);
    }

    for (const offset of diasHabilesRecientes) {
      for (const [usuarioId, hecho, pendiente, observaciones] of registrosBitacora) {
        await sql`
          insert into bitacora_diaria (organizacion_id, usuario_id, fecha, hecho, pendiente, observaciones)
          values (${org.id}, ${usuarioId}, ${d(offset)}, ${hecho}, ${pendiente}, ${observaciones || null})
          on conflict (usuario_id, fecha) do nothing
        `;
      }
    }

    // ── Cuenta para que directivos externos prueben el sistema ──────────────
    // 'administrador' (no 'miembro') porque /informes —donde está el reporte
    // anual que les interesa ver— es admin-only. Datos de esta base son todos
    // ficticios, así que no hay riesgo real en darles el rol completo acá.
    const bcrypt = (await import("bcryptjs")).default;
    const passwordDirectivos = "Directivos2026!";
    const [existeDirectivos] = await sql`
      select id from usuario where email = 'direccion@sae.test' limit 1
    `;
    if (!existeDirectivos) {
      await sql`
        insert into usuario (organizacion_id, nombre, email, password_hash, rol, estado)
        values (${org.id}, 'Dirección SAE (invitado)', 'direccion@sae.test', ${await bcrypt.hash(passwordDirectivos, 10)}, 'administrador', 'activo')
      `;
    }

    console.log("✓ Seed de demo completado.");
    console.log(`  colegios          : ${colegioIds.length}`);
    console.log(`  visitas           : ${visitas.length}`);
    console.log("  viajes            : 2 (1 realizado, 1 con inscripciones abiertas)");
    console.log(`  bitácoras         : hasta ${diasHabilesRecientes.length * registrosBitacora.length}`);
    console.log("  eventos/reuniones : 7 tareas nuevas (tipo evento/reunión/entrega)");
    console.log("  cuenta directivos : direccion@sae.test / Directivos2026! (rol miembro, solo lectura de hecho)");
  } finally {
    await sql.end();
  }
}

seedDemo().catch((err) => {
  console.error(err);
  process.exit(1);
});
