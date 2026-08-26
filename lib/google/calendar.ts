// Escritura en Google Calendar vía cuenta de servicio (JWT Bearer Grant, RFC
// 7523) — se implementa a mano con fetch + crypto en vez de instalar el
// paquete googleapis completo, mismo criterio que ya usa
// app/api/calendar/events/route.ts para lectura (fetch directo a la API REST).

import { createSign } from "node:crypto";

const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

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
  horaInicio: string; // HH:MM
  horaFin: string; // HH:MM
  timeZone: string; // IANA, ej. America/Argentina/Cordoba
};

// Crea el evento en el calendario compartido de la organización (mismo
// GOOGLE_CALENDAR_ID que ya se usa para leerlo en /calendario, ver
// app/api/calendar/events/route.ts). Devuelve el id del evento creado, o
// `null` si no hay credenciales de escritura configuradas
// (GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL/_KEY) — en ese caso la reunión se
// crea igual como tarea normal, solo que sin sync a Calendar. Si las
// credenciales están puestas pero el pedido falla (permiso, calendario no
// compartido con la cuenta de servicio, etc.) tira un error en vez de fallar
// en silencio, para que el administrador se entere de que hay que revisar la
// configuración.
export async function crearEventoCalendar(
  evento: NuevoEventoCalendar,
): Promise<string | null> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const clientEmail = process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY;
  if (!calendarId || !clientEmail || !privateKeyRaw) return null;

  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
  const accessToken = await obtenerAccessToken(clientEmail, privateKey);

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        summary: evento.titulo,
        description: evento.descripcion ?? undefined,
        start: {
          dateTime: `${evento.fecha}T${evento.horaInicio}:00`,
          timeZone: evento.timeZone,
        },
        end: {
          dateTime: `${evento.fecha}T${evento.horaFin}:00`,
          timeZone: evento.timeZone,
        },
      }),
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
