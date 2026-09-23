// Carga el directorio de colegios y las visitas 2026 reales desde el Excel
// del equipo ("SAE_UTN_Sistema_v5-2026.xlsx"), reemplazando la data de demo
// que quedó en producción (db/seed-demo.ts y db/seed-proyectos-demo.ts).
//
// El Excel se convierte antes a JSON (una entrada por hoja, filas como
// { r, c: [celdas] }) — ver el conversor usado el 2026-09-23. Los datos
// reales (contactos de colegios) no se commitean: se pasan por ruta.
//
// Uso:
//   npx tsx db/cargar-sae-2026.ts --datos=<ruta.json>           (simula, no escribe)
//   npx tsx db/cargar-sae-2026.ts --datos=<ruta.json> --apply   (escribe, en una transacción)

import { config } from "dotenv";
config({ path: ".env.local" });

import fs from "node:fs";
import postgres from "postgres";

type Fila = { r: number; c: (string | null)[] };
type Hojas = Record<string, Fila[]>;

const HOJA_VISITAS = "📍 Visitas Colegios";
const HOJA_COLEGIOS = "🏫 Colegios - Contactos";

// Apodos del Excel → email del usuario en el sistema.
const APODO_A_EMAIL: Record<string, string> = {
  cande: "cande@sae.test",
  edu: "edu@sae.test",
  juli: "julian@sae.test",
  agus: "agus@sae.test",
  feli: "felipegiovanardi19@gmail.com",
  joaco: "joaco@sae.test",
  mili: "mili@sae.test",
  leo: "leo@sae.test",
  viky: "vicky@sae.test",
  luchi: "luchi@sae.test",
  cami: "cami@sae.test",
};

const TIPO: Record<string, string> = {
  "visita a colegio": "visita_colegio",
  "nos visitan": "nos_visitan",
  "feria/expo": "feria_expo",
  "charla/taller": "charla_taller",
  virtual: "virtual",
};

const PROVINCIA: Record<string, string> = {
  cordoba: "Córdoba",
  "santa fe": "Santa Fe",
  "buenos aires": "Buenos Aires",
};

// Mismo colegio escrito distinto en las dos hojas (confirmado por ciudad y
// teléfono iguales). Clave normalizada → nombre con el que queda.
const MISMO_COLEGIO: Record<string, string> = {
  "instituto astrada": "Instituto Andrada Secundario",
  "instituto andrada secundario": "Instituto Andrada Secundario",
};

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const limpiar = (v: string | null | undefined) => {
  const s = (v ?? "").replace(/\s+/g, " ").trim();
  return s || null;
};
const clave = (nombre: string) => sinAcentos(limpiar(nombre)!.toLowerCase());

// Excel guardó los teléfonos como número: vienen en notación científica.
function telefono(v: string | null): string | null {
  const s = limpiar(v);
  if (!s) return null;
  if (/^[\d.]+e\+?\d+$/i.test(s)) return String(Math.round(Number(s)));
  return s;
}

// Fecha serial de Excel (días desde 1899-12-30) → YYYY-MM-DD.
function fecha(v: string | null): string | null {
  const n = Number(v);
  if (!v || !Number.isFinite(n)) return null;
  return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000).toISOString().slice(0, 10);
}

// Fracción de día de Excel → HH:MM.
function hora(v: string | null): string | null {
  const n = Number(v);
  if (!v || !Number.isFinite(n)) return null;
  const min = Math.round(n * 24 * 60);
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function provincia(v: string | null): string | null {
  const s = limpiar(v);
  return s ? (PROVINCIA[sinAcentos(s.toLowerCase())] ?? null) : null;
}

type Colegio = {
  nombre: string;
  ciudad: string | null;
  provincia: string | null;
  contacto_nombre: string | null;
  contacto_cargo: string | null;
  contacto_email: string | null;
  contacto_telefono: string | null;
  estado_relacion: "nuevo" | "activo";
};

type Visita = {
  fila: number;
  colegio: string;
  fecha: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  tipo: string;
  estado: string;
  cant_alumnos: number | null;
  contacto_nombre: string | null;
  contacto_cargo: string | null;
  contacto_email: string | null;
  contacto_telefono: string | null;
  observaciones: string | null;
  google_event_id: string | null;
  apodos: string[];
};

function leerExcel(hojas: Hojas) {
  const avisos: string[] = [];
  const colegios = new Map<string, Colegio>();
  const nombreCanonico = (nombre: string) => {
    const k = clave(nombre);
    return MISMO_COLEGIO[k] ?? limpiar(nombre)!;
  };

  for (const { r, c } of hojas[HOJA_COLEGIOS].filter((f) => f.r > 3)) {
    if (!limpiar(c[0])) continue;
    const nombre = nombreCanonico(c[0]!);
    const k = clave(nombre);
    const nuevo: Colegio = {
      nombre,
      ciudad: limpiar(c[1]),
      provincia: provincia(c[2]),
      contacto_nombre: limpiar(c[3]),
      contacto_cargo: limpiar(c[4]),
      contacto_email: limpiar(c[5]),
      contacto_telefono: telefono(c[6]),
      estado_relacion: "nuevo",
    };
    const previo = colegios.get(k);
    if (previo) {
      avisos.push(`Colegio repetido en la hoja de contactos (fila ${r}): "${nombre}" — se unifica.`);
      for (const campo of Object.keys(nuevo) as (keyof Colegio)[]) {
        if (previo[campo] == null && nuevo[campo] != null) Object.assign(previo, { [campo]: nuevo[campo] });
      }
    } else {
      colegios.set(k, nuevo);
    }
  }

  const visitas: Visita[] = [];
  for (const { r, c } of hojas[HOJA_VISITAS].filter((f) => f.r > 3)) {
    if (!limpiar(c[5]) || !fecha(c[1])) continue;
    const nombre = nombreCanonico(c[5]!);
    const k = clave(nombre);
    const v: Visita = {
      fila: r,
      colegio: nombre,
      fecha: fecha(c[1])!,
      hora_inicio: hora(c[2]),
      hora_fin: hora(c[3]),
      tipo: TIPO[(limpiar(c[8]) ?? "").toLowerCase()] ?? "otro",
      estado: (limpiar(c[9]) ?? "pendiente").toLowerCase(),
      cant_alumnos: c[11] ? Math.round(Number(c[11])) : null,
      contacto_nombre: limpiar(c[12]),
      contacto_cargo: limpiar(c[13]),
      contacto_email: limpiar(c[14]),
      contacto_telefono: telefono(c[15]),
      observaciones: limpiar(c[16]),
      google_event_id: limpiar(c[18]),
      apodos: (c[10] ?? "").split(",").map((a) => a.trim().toLowerCase()).filter(Boolean),
    };
    visitas.push(v);

    // El colegio toma de la visita lo que le falte; si la provincia no
    // coincide, manda la de la visita (la hoja de contactos se autocompletaba
    // con "Cordoba" por defecto — ej. Las Rosas es de Santa Fe).
    const ciudad = limpiar(c[6]);
    const prov = provincia(c[7]);
    let col = colegios.get(k);
    if (!col) {
      col = {
        nombre, ciudad, provincia: prov,
        contacto_nombre: v.contacto_nombre, contacto_cargo: v.contacto_cargo,
        contacto_email: v.contacto_email, contacto_telefono: v.contacto_telefono,
        estado_relacion: "nuevo",
      };
      colegios.set(k, col);
      avisos.push(`"${nombre}" solo figura en Visitas (fila ${r}) — se crea en el directorio.`);
    } else {
      if (prov && col.provincia && prov !== col.provincia) {
        avisos.push(`Provincia distinta para "${nombre}": contactos dice ${col.provincia}, la visita ${prov} — queda ${prov}.`);
        col.provincia = prov;
      }
      col.ciudad ??= ciudad;
      col.provincia ??= prov;
      col.contacto_nombre ??= v.contacto_nombre;
      col.contacto_cargo ??= v.contacto_cargo;
      col.contacto_email ??= v.contacto_email;
      col.contacto_telefono ??= v.contacto_telefono;
    }
    if (v.estado === "realizado") col.estado_relacion = "activo";
    if (v.hora_inicio && v.hora_fin && v.hora_fin <= v.hora_inicio) {
      avisos.push(`Fila ${r}: hora fin ${v.hora_fin} no es posterior a ${v.hora_inicio} — se descarta la hora fin.`);
      v.hora_fin = null;
    }
  }

  for (const col of colegios.values()) {
    if (col.contacto_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(col.contacto_email)) {
      avisos.push(`Email incompleto en "${col.nombre}": ${col.contacto_email} (se carga igual, corregir a mano).`);
    }
  }
  return { colegios: [...colegios.values()], visitas, avisos };
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const ruta = args.find((a) => a.startsWith("--datos="))?.slice("--datos=".length);
  if (!ruta) throw new Error("Falta --datos=<ruta.json>");
  const { colegios, visitas, avisos } = leerExcel(JSON.parse(fs.readFileSync(ruta, "utf8")));

  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    const [org] = await sql<{ id: string; nombre: string }[]>`select id, nombre from organizacion where slug = 'sae-frvm'`;
    if (!org) throw new Error("No existe la organización sae-frvm");
    const usuarios = await sql<{ id: string; email: string; nombre: string }[]>`
      select id, email, nombre from usuario where organizacion_id = ${org.id}
    `;
    const porEmail = new Map(usuarios.map((u) => [u.email, u]));
    const creador = porEmail.get("felipegiovanardi19@gmail.com");
    if (!creador) throw new Error("No está el usuario de Felipe Giovanardi para creada_por");

    const sinMatch = new Set<string>();
    for (const v of visitas) for (const a of v.apodos) if (!porEmail.get(APODO_A_EMAIL[a] ?? "")) sinMatch.add(a);

    console.log(`Organización: ${org.nombre}  ·  base: ${new URL(process.env.DATABASE_URL!).host}\n`);
    console.log(`Colegios a cargar: ${colegios.length}`);
    for (const c of colegios) {
      console.log(`  ${c.estado_relacion === "activo" ? "●" : "○"} ${c.nombre} — ${c.ciudad ?? "¿ciudad?"}, ${c.provincia ?? "¿provincia?"}${c.contacto_nombre ? ` · ${c.contacto_nombre}` : ""}`);
    }
    const porEstado = visitas.reduce<Record<string, number>>((acc, v) => ((acc[v.estado] = (acc[v.estado] ?? 0) + 1), acc), {});
    console.log(`\nVisitas a cargar: ${visitas.length} (${Object.entries(porEstado).map(([k, n]) => `${n} ${k}`).join(", ")})`);
    console.log(`  desde ${visitas[0]?.fecha} hasta ${visitas.at(-1)?.fecha}`);
    console.log(`  integrantes sin usuario: ${sinMatch.size ? [...sinMatch].join(", ") : "ninguno"}`);
    console.log(`\nAvisos (${avisos.length}):`);
    for (const a of avisos) console.log(`  - ${a}`);

    if (!apply) {
      console.log("\nSimulación: no se escribió nada. Con --apply se reemplaza la demo por esto.");
      return;
    }

    await sql.begin(async (tx) => {
      // 1) Data de demo (seed-demo / seed-proyectos-demo).
      await tx`delete from visita_colegio where organizacion_id = ${org.id}`;
      await tx`delete from colegio where organizacion_id = ${org.id}`;
      await tx`delete from viaje where organizacion_id = ${org.id}`;
      await tx`delete from hito_area where area_id in (select id from area where organizacion_id = ${org.id})`;
      await tx`delete from plantilla_area where organizacion_id = ${org.id}`;
      await tx`delete from area_asignado where area_id in (select id from area where organizacion_id = ${org.id})`;
      await tx`delete from acceso_rapido where organizacion_id = ${org.id} and url like '%demo-%'`;

      // 2) Cuentas (decidido con Felipe el 2026-09-23): feli@sae.test era un
      //    duplicado de su cuenta real — sus turnos pasan a esa cuenta. La
      //    cuenta "invitado" de directivos era de la demo. Mili deja el
      //    equipo pero queda inactiva para conservar su historial de visitas.
      const feli = porEmail.get("feli@sae.test");
      if (feli) {
        await tx`update turno set usuario_id = ${creador.id} where usuario_id = ${feli.id}`;
        await tx`delete from excepcion_turno where usuario_id = ${feli.id} or usuario_reemplazo_id = ${feli.id}`;
      }
      await tx`
        delete from usuario
        where organizacion_id = ${org.id} and email in ('feli@sae.test', 'direccion@sae.test')
      `;
      const mili = porEmail.get("mili@sae.test");
      if (mili) {
        await tx`update usuario set estado = 'inactivo' where id = ${mili.id}`;
        await tx`
          update turno set vigente_hasta = current_date - 1
          where usuario_id = ${mili.id} and vigente_desde < current_date
            and (vigente_hasta is null or vigente_hasta >= current_date)
        `;
        await tx`delete from turno where usuario_id = ${mili.id} and vigente_desde >= current_date`;
      }

      // 3) Colegios y visitas reales.
      const idColegio = new Map<string, string>();
      for (const c of colegios) {
        const [{ id }] = await tx<{ id: string }[]>`
          insert into colegio (organizacion_id, nombre, ciudad, provincia, contacto_nombre,
            contacto_cargo, contacto_email, contacto_telefono, estado_relacion)
          values (${org.id}, ${c.nombre}, ${c.ciudad}, ${c.provincia}, ${c.contacto_nombre},
            ${c.contacto_cargo}, ${c.contacto_email}, ${c.contacto_telefono},
            ${c.estado_relacion}::estado_relacion_colegio)
          returning id
        `;
        idColegio.set(clave(c.nombre), id);
      }
      for (const v of visitas) {
        const [{ id }] = await tx<{ id: string }[]>`
          insert into visita_colegio (organizacion_id, colegio_id, fecha, hora_inicio, hora_fin,
            tipo, estado, cant_alumnos, contacto_nombre, contacto_cargo, contacto_email,
            contacto_telefono, observaciones, google_event_id, creada_por)
          values (${org.id}, ${idColegio.get(clave(v.colegio))!}, ${v.fecha}, ${v.hora_inicio},
            ${v.hora_fin}, ${v.tipo}::tipo_visita, ${v.estado}::estado_visita, ${v.cant_alumnos},
            ${v.contacto_nombre}, ${v.contacto_cargo}, ${v.contacto_email}, ${v.contacto_telefono},
            ${v.observaciones}, ${v.google_event_id}, ${creador.id})
          returning id
        `;
        for (const a of new Set(v.apodos)) {
          const u = porEmail.get(APODO_A_EMAIL[a] ?? "");
          if (u) await tx`insert into visita_integrante (visita_id, usuario_id) values (${id}, ${u.id})`;
        }
      }
    });
    console.log("\n✅ Cargado.");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
