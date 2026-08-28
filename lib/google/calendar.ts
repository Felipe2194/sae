// Escritura en Google Calendar vía cuenta de servicio (JWT Bearer Grant, RFC
// 7523) — se implementa a mano con fetch + crypto en vez de instalar el
// paquete googleapis completo, mismo criterio que ya usa
// app/api/calendar/events/route.ts para lectura (fetch directo a la API REST).

import { createSign } from "node:crypto";

const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

// "Integrar calendario" en Google Calendar muestra el ID de calendario junto
// a una URL de embebido HTML con pinta parecida (?src=...&ctz=...) — es fácil
// copiar esa URL entera en vez del ID solo. Si detecta una URL con `src`, la
// desarma y se queda con eso; si no, usa el valor tal cual (ya era un ID).
export function extraerCalendarId(valor: string): string {
  const v = valor.trim();
  if (!v) return v;
  try {
    const url = new URL(v);
    const src = url.searchParams.get("src");
    if (src) return src;
  } catch {
    // no es una URL — se asume que ya es el ID
  }
  return v;
}

function base64url(input: string | Buffer): string {
  return (typeof input === "string" ? Buffer.from(input) : input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function obtenerAccessToken(
  clientEmail: string,
  privateKey: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: clientEmail,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signInput = `${header}.${claims}`;
  const signature = base64url(
    createSign("RSA-SHA256").update(signInput).sign(privateKey),
  );

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${signInput}.${signature}`,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `No se pudo autenticar la cuenta de servicio de Calendar (${res.status}).`,
    );
  }
  const data = await res.json();
  return data.access_token as string;
}

export type NuevoEventoCalendar = {
  titulo: string;
  descripcion: string | null;
  fecha: string; // YYYY-MM-DD
  // Sin horaInicio: evento de todo el día (ej. visita a colegio sin horario
  // puntual cargado). Con horaInicio y sin horaFin: se asume 1 hora de
  // duración.
  horaInicio?: string; // HH:MM
  horaFin?: string; // HH:MM
  timeZone: string; // IANA, ej. America/Argentina/Cordoba
};

function sumarUnaHora(hora: string): string {
  const [h, m] = hora.split(":").map(Number);
  const total = (h * 60 + m + 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function diaSiguiente(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// La cuenta de servicio es de la plataforma (una sola, vía env vars) — lo
// que varía por organización es el `calendarId` (ver 034_google_calendar_
// organizacion.sql), que cada admin pega en Configuración después de
// compartir su propio calendario con este mail. Antes de esa migración
// había un único GOOGLE_CALENDAR_ID global; se mantiene como fallback en
// obtenerCalendarId() de cada caller para no romper la organización que ya
// dependía de esa variable.
function credencialesServicio(): {
  clientEmail: string;
  privateKey: string;
} | null {
  const clientEmail = process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY;
  if (!clientEmail || !privateKeyRaw) return null;
  return {
    clientEmail,
    privateKey: privateKeyRaw.replace(/\\n/g, "\n"),
  };
}

function cuerpoEvento(evento: NuevoEventoCalendar) {
  if (!evento.horaInicio) {
    return {
      summary: evento.titulo,
      description: evento.descripcion ?? undefined,
      start: { date: evento.fecha },
      end: { date: diaSiguiente(evento.fecha) },
    };
  }
  const horaFin = evento.horaFin ?? sumarUnaHora(evento.horaInicio);
  return {
    summary: evento.titulo,
    description: evento.descripcion ?? undefined,
    start: {
      dateTime: `${evento.fecha}T${evento.horaInicio}:00`,
      timeZone: evento.timeZone,
    },
    end: {
      dateTime: `${evento.fecha}T${horaFin}:00`,
      timeZone: evento.timeZone,
    },
  };
}

// Crea el evento en el calendario propio de la organización (`calendarId` —
// ver 034_google_calendar_organizacion.sql, cada admin vincula el suyo desde
// Configuración). Devuelve el id del evento creado, o `null` si falta el
// calendarId o no hay credenciales de escritura configuradas
// (GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL/_KEY) — en ese caso la reunión se
// crea igual como tarea normal, solo que sin sync a Calendar. Si las
// credenciales están puestas pero el pedido falla (permiso, calendario no
// compartido con la cuenta de servicio, etc.) tira un error en vez de fallar
// en silencio, para que el administrador se entere de que hay que revisar la
// configuración.
export async function crearEventoCalendar(
  calendarId: string | null,
  evento: NuevoEventoCalendar,
): Promise<string | null> {
  if (!calendarId) return null;
  const creds = credencialesServicio();
  if (!creds) return null;
  const accessToken = await obtenerAccessToken(
    creds.clientEmail,
    creds.privateKey,
  );

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(cuerpoEvento(evento)),
    },
  );

  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(
      `Google Calendar rechazó el evento (${res.status}): ${detalle.slice(0, 200)}`,
    );
  }

  const data = await res.json();
  return data.id as string;
}

// Actualiza un evento ya creado (por ejemplo, al editar una visita que ya
// estaba sincronizada). Igual que crearEventoCalendar, devuelve `null` sin
// calendarId o credenciales configuradas en vez de fallar.
export async function actualizarEventoCalendar(
  calendarId: string | null,
  eventId: string,
  evento: NuevoEventoCalendar,
): Promise<string | null> {
  if (!calendarId) return null;
  const creds = credencialesServicio();
  if (!creds) return null;
  const accessToken = await obtenerAccessToken(
    creds.clientEmail,
    creds.privateKey,
  );

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(cuerpoEvento(evento)),
    },
  );

  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(
      `Google Calendar rechazó la actualización (${res.status}): ${detalle.slice(0, 200)}`,
    );
  }

  const data = await res.json();
  return data.id as string;
}

// Borra un evento (por ejemplo, al cancelar/reprogramar una visita ya
// sincronizada). Silencioso si falta el calendarId, las credenciales, o si
// el evento ya no existe (404 — pudo haberse borrado a mano desde Calendar).
export async function eliminarEventoCalendar(
  calendarId: string | null,
  eventId: string,
): Promise<void> {
  if (!calendarId) return;
  const creds = credencialesServicio();
  if (!creds) return;
  const accessToken = await obtenerAccessToken(
    creds.clientEmail,
    creds.privateKey,
  );

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { authorization: `Bearer ${accessToken}` },
    },
  );

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const detalle = await res.text().catch(() => "");
    throw new Error(
      `Google Calendar rechazó el borrado (${res.status}): ${detalle.slice(0, 200)}`,
    );
  }
}

export type EventoLeido = {
  id: string;
  titulo: string;
  inicio: string;
  fin: string;
  allDay: boolean;
  colorId?: string;
};

// Lectura vía cuenta de servicio — no exige que el calendario sea público
// (a diferencia del modo con GOOGLE_CALENDAR_API_KEY que usa
// app/api/calendar/events/route.ts como fallback): alcanza con compartirlo
// con el mail de la cuenta de servicio, mismo paso que ya hace falta para
// que las reuniones/visitas se sincronicen. `null` si falta el calendarId o
// las credenciales — el caller decide el fallback (API key o mock).
export async function listarEventosCalendar(
  calendarId: string | null,
  timeMin: string,
  timeMax: string,
): Promise<EventoLeido[] | null> {
  if (!calendarId) return null;
  const creds = credencialesServicio();
  if (!creds) return null;
  const accessToken = await obtenerAccessToken(
    creds.clientEmail,
    creds.privateKey,
  );

  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
  );
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "100");

  const res = await fetch(url.toString(), {
    headers: { authorization: `Bearer ${accessToken}` },
    next: { revalidate: 300, tags: ["calendar-events"] },
  });

  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(
      `Google Calendar rechazó la consulta (${res.status}): ${detalle.slice(0, 200)}`,
    );
  }

  const data = await res.json();
  return (data.items ?? []).map(
    (item: {
      id: string;
      summary?: string;
      start?: { date?: string; dateTime?: string };
      end?: { date?: string; dateTime?: string };
      colorId?: string;
    }) => ({
      id: item.id,
      titulo: item.summary ?? "(Sin título)",
      inicio: item.start?.date ?? item.start?.dateTime ?? "",
      fin: item.end?.date ?? item.end?.dateTime ?? "",
      allDay: Boolean(item.start?.date),
      colorId: item.colorId,
    }),
  );
}

export function tieneServicioCalendar(): boolean {
  return credencialesServicio() !== null;
}
