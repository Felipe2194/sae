// Importa las 32 visitas y 33 colegios cargados en el Google Sheet
// "SAE_UTN_Sistema_v5.xlsx" (equipo SAE UTN Villa María) a las tablas
// colegio / visita_colegio / visita_integrante nuevas — ver
// db/migrations/030_visitas_colegios.sql. Datos crudos extraídos del xlsx en
// db/datos-importacion-sae.json.
//
// Uso:
//   npx tsx db/importar-visitas-sae.ts                       (dry-run, no escribe nada)
//   npx tsx db/importar-visitas-sae.ts --apply                (escribe)
//   npx tsx db/importar-visitas-sae.ts --apply --slug=sae-frvm (organización específica)
//
// Sin --slug: si hay una sola organización en la base, se usa esa. Si hay
// más de una, hay que indicar --slug=<slug>.
//
// No sincroniza con Google Calendar (evita crear 32 eventos de golpe) — se
// puede sincronizar visita por visita desde la UI después de importar.

import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";
import datos from "./datos-importacion-sae.json";

type VisitaCruda = {
  id: string;
  fecha: string | null;
  horaInicio: string | null;
  horaFin: string | null;
  colegio: string | null;
  ciudad: string | null;
  zona: string | null;
  tipo: string | null;
  estado: string | null;
  integrantes: string | null;
  alumnos: string | null;
  contactoNombre: string | null;
  contactoCargo: string | null;
  contactoEmail: string | null;
  contactoTelefono: string | null;
  observaciones: string | null;
  asignadoPor: string | null;
};

type ColegioCrudo = {
  nombre: string;
  ciudad: string | null;
  zona: string | null;
  contactoNombre: string | null;
  contactoCargo: string | null;
  contactoEmail: string | null;
  contactoTelefono: string | null;
};

const TIPO_MAP: Record<string, string> = {
  "visita a colegio": "visita_colegio",
  "nos visitan": "nos_visitan",
  "feria/expo": "feria_expo",
  "charla/taller": "charla_taller",
  virtual: "virtual",
};

const ESTADO_MAP: Record<string, string> = {
  pendiente: "pendiente",
  confirmado: "confirmado",
  realizado: "realizado",
  cancelado: "cancelado",
  reprogramado: "reprogramado",
};

function mapTipo(label: string | null): string {
  return TIPO_MAP[(label ?? "").trim().toLowerCase()] ?? "otro";
}

function mapEstado(label: string | null): string {
  return ESTADO_MAP[(label ?? "").trim().toLowerCase()] ?? "pendiente";
}

// Excel guardó varios teléfonos como número, así que Sheets los volcó en
// notación científica al exportar (ej: "3.471678341E9" en vez de
// "3471678341"). Son enteros de hasta 12 cifras, muy por debajo de
// Number.MAX_SAFE_INTEGER: la conversión no pierde precisión, solo deshace
// el formato roto.
function normalizarTelefono(valor: string | null): string | null {
  if (!valor) return null;
  const v = valor.trim();
  if (!v) return null;
  if (/^[\d.]+e\+?\d+$/i.test(v)) {
    const n = Number(v);
    if (Number.isFinite(n)) return String(Math.round(n));
  }
  return v;
}

function limpiar(valor: string | null | undefined): string | null {
  const v = (valor ?? "").trim();
  return v || null;
}

function parseAlumnos(valor: string | null): number | null {
  if (!valor) return null;
  const n = parseFloat(valor);
  return Number.isFinite(n) ? Math.round(n) : null;
}

// Primer token del nombre completo del usuario (ej: "Eduardo Gómez" → "eduardo"),
// para matchear contra los apodos de una sola palabra del Sheet ("Edu").
function primerNombre(nombreCompleto: string): string {
  return nombreCompleto.trim().split(/\s+/)[0].toLowerCase();
}

// Apodos del Sheet que no matchean por primerNombre() — resueltos a mano
// contra el equipo real (decisión tomada con Felipe el 2026-08-27):
//   - "feli" → Felipe Giovanardi (felipegiovanardi19@gmail.com), no la
//     cuenta admin@sae.test ni la inactiva feli@sae.test.
//   - "juli" → Julian (mismo usuario, apodo distinto).
//   - "viky" → Viki (diferencia de tipeo, misma persona).
// Clave: email del usuario destino (único, a diferencia del nombre "Felipe"
// que está duplicado). Se resuelve después de cargar `usuarios`.
const ALIAS_APODO_A_EMAIL: Record<string, string> = {
  feli: "felipegiovanardi19@gmail.com",
  juli: "julian@sae.test",
  viky: "vicky@sae.test",
};

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const slugArg = args.find((a) => a.startsWith("--slug="))?.split("=")[1];

  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  try {
    const orgs = slugArg
      ? await sql`select id, nombre, slug from organizacion where slug = ${slugArg}`
      : await sql`select id, nombre, slug from organizacion`;

    if (orgs.length === 0) {
      console.error(
        slugArg
          ? `No se encontró ninguna organización con slug "${slugArg}".`
          : "No hay organizaciones en la base.",
      );
      process.exit(1);
    }
    if (orgs.length > 1) {
      console.error(
        "Hay más de una organización en la base. Indicá cuál con --slug=<slug>:\n" +
          orgs.map((o) => `  - ${o.nombre} (${o.slug})`).join("\n"),
      );
      process.exit(1);
    }
    const org = orgs[0];
    console.log(`Organización destino: ${org.nombre} (${org.slug})\n`);

    const usuarios = await sql<{ id: string; nombre: string; email: string }[]>`
      select id, nombre, email from usuario where organizacion_id = ${org.id}
    `;
    const usuarioPorNombre = new Map(
      usuarios.map((u) => [primerNombre(u.nombre), u]),
    );
    const usuarioPorEmail = new Map(usuarios.map((u) => [u.email, u]));
    for (const [apodo, email] of Object.entries(ALIAS_APODO_A_EMAIL)) {
      const usuario = usuarioPorEmail.get(email);
      if (usuario) usuarioPorNombre.set(apodo, usuario);
    }

    const visitas = datos.visitas as VisitaCruda[];
    const colegiosCrudos = datos.colegios as ColegioCrudo[];

    // ── Reporte de matcheo de integrantes ─────────────────────────────────────
    const apodos = new Set<string>();
    for (const v of visitas) {
      if (!v.integrantes) continue;
      for (const nombre of v.integrantes.split(",")) {
        apodos.add(nombre.trim().toLowerCase());
      }
    }
    const matcheados: string[] = [];
    const sinMatch: string[] = [];
    for (const apodo of apodos) {
      if (usuarioPorNombre.has(apodo)) matcheados.push(apodo);
      else sinMatch.push(apodo);
    }

    console.log(`Colegios en el archivo: ${colegiosCrudos.length}`);
    console.log(`Visitas en el archivo: ${visitas.length}`);
    console.log(`\nIntegrantes matcheados contra usuario.nombre (${matcheados.length}):`);
    for (const a of matcheados) {
      console.log(`  ✓ "${a}" → ${usuarioPorNombre.get(a)!.nombre}`);
    }
    if (sinMatch.length > 0) {
      console.log(`\nIntegrantes SIN match (${sinMatch.length}) — no se les asignará la visita:`);
      for (const a of sinMatch) console.log(`  ✗ "${a}"`);
    }

    if (!apply) {
      console.log(
        "\nDry-run: no se escribió nada. Corré con --apply para importar de verdad" +
          (sinMatch.length > 0
            ? " (revisá primero los nombres sin match arriba)."
            : "."),
      );
      return;
    }

    const [admin] = await sql<{ id: string }[]>`
      select id from usuario
      where organizacion_id = ${org.id} and rol = 'administrador'
      order by creada_en asc
      limit 1
    `;
    if (!admin) {
      console.error(
        "No hay ningún usuario administrador en esta organización — se necesita uno para creada_por.",
      );
      process.exit(1);
    }

    let colegiosCreados = 0;
    let colegiosExistentes = 0;
    const colegioIdPorNombre = new Map<string, string>();

    for (const c of colegiosCrudos) {
      const nombre = c.nombre.trim();
      const [existente] = await sql<{ id: string }[]>`
        select id from colegio
        where organizacion_id = ${org.id} and lower(nombre) = lower(${nombre})
      `;
      if (existente) {
        colegioIdPorNombre.set(nombre.toLowerCase(), existente.id);
        colegiosExistentes++;
        continue;
      }
      const [{ id }] = await sql<{ id: string }[]>`
        insert into colegio (
          organizacion_id, nombre, ciudad, zona,
          contacto_nombre, contacto_cargo, contacto_email, contacto_telefono
        )
        values (
          ${org.id}, ${nombre}, ${limpiar(c.ciudad)}, ${limpiar(c.zona)},
          ${limpiar(c.contactoNombre)}, ${limpiar(c.contactoCargo)},
          ${limpiar(c.contactoEmail)}, ${normalizarTelefono(c.contactoTelefono)}
        )
        returning id
      `;
      colegioIdPorNombre.set(nombre.toLowerCase(), id);
      colegiosCreados++;
    }

    let visitasCreadas = 0;
    let integrantesAsignados = 0;

    for (const v of visitas) {
      if (!v.colegio || !v.fecha) continue;
      const nombreColegio = v.colegio.trim();
      let colegioId = colegioIdPorNombre.get(nombreColegio.toLowerCase());
      if (!colegioId) {
        // No estaba en la hoja de Contactos (pasa con algunas ferias/expos
        // cargadas solo en Visitas) — se crea igual con lo que haya.
        const [{ id }] = await sql<{ id: string }[]>`
          insert into colegio (organizacion_id, nombre, ciudad, zona)
          values (${org.id}, ${nombreColegio}, ${limpiar(v.ciudad)}, ${limpiar(v.zona)})
          returning id
        `;
        colegioIdPorNombre.set(nombreColegio.toLowerCase(), id);
        colegioId = id;
        colegiosCreados++;
      }

      const [{ id: visitaId }] = await sql<{ id: string }[]>`
        insert into visita_colegio (
          organizacion_id, colegio_id, fecha, hora_inicio, hora_fin, tipo,
          estado, cant_alumnos, contacto_nombre, contacto_cargo,
          contacto_email, contacto_telefono, observaciones, creada_por
        )
        values (
          ${org.id}, ${colegioId}, ${v.fecha}, ${v.horaInicio}, ${v.horaFin},
          ${mapTipo(v.tipo)}::tipo_visita, ${mapEstado(v.estado)}::estado_visita,
          ${parseAlumnos(v.alumnos)}, ${limpiar(v.contactoNombre)},
          ${limpiar(v.contactoCargo)}, ${limpiar(v.contactoEmail)},
          ${normalizarTelefono(v.contactoTelefono)}, ${limpiar(v.observaciones)},
          ${admin.id}
        )
        returning id
      `;
      visitasCreadas++;

      if (v.integrantes) {
        for (const nombre of v.integrantes.split(",")) {
          const usuario = usuarioPorNombre.get(nombre.trim().toLowerCase());
          if (!usuario) continue;
          await sql`
            insert into visita_integrante (visita_id, usuario_id)
            values (${visitaId}, ${usuario.id})
            on conflict do nothing
          `;
          integrantesAsignados++;
        }
      }
    }

    console.log(
      `\n✅ Importado: ${colegiosCreados} colegios nuevos (${colegiosExistentes} ya existían), ` +
        `${visitasCreadas} visitas, ${integrantesAsignados} asignaciones de integrante.`,
    );
  } finally {
    await sql.end();
  }
}

main();
