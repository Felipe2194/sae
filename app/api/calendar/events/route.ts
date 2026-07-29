import { NextRequest, NextResponse } from "next/server";

export type CalendarEvent = {
  id: string;
  titulo: string;
  inicio: string; // ISO date o datetime
  fin: string;
  color?: string;
  allDay: boolean;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));

  const apiKey = process.env.GOOGLE_CALENDAR_API_KEY;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  if (!apiKey || !calendarId) {
    // Sin credenciales: devolver eventos de ejemplo
    return NextResponse.json(mockEvents(year, month));
  }

  // Rango: primer día del mes → primer día del mes siguiente
  const timeMin = new Date(year, month - 1, 1).toISOString();
  const timeMax = new Date(year, month, 1).toISOString();

  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
  );
  url.searchParams.set("key", apiKey);
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "100");

  const res = await fetch(url.toString(), { next: { revalidate: 300 } });

  if (!res.ok) {
    return NextResponse.json(
      { error: "Error al consultar Google Calendar" },
      { status: res.status },
    );
  }

  const data = await res.json();

  const events: CalendarEvent[] = (data.items ?? []).map(
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
      color: colorIdToHex(item.colorId),
    }),
  );

  return NextResponse.json(events);
}

// Paleta de Google Calendar
function colorIdToHex(id?: string): string | undefined {
  const map: Record<string, string> = {
    "1": "#a4bdfc", // Lavanda
    "2": "#7ae7bf", // Salvia
    "3": "#dbadff", // Uva
    "4": "#ff887c", // Flamingo
    "5": "#fbd75b", // Banana
    "6": "#ffb878", // Mandarina
    "7": "#46d6db", // Pavo real
    "8": "#e1e1e1", // Grafito
    "9": "#5484ed", // Arándano
    "10": "#51b749", // Albahaca
    "11": "#dc2127", // Tomate
  };
  return id ? map[id] : undefined;
}

// Eventos de ejemplo cuando no hay credenciales
function mockEvents(year: number, month: number): CalendarEvent[] {
  const pad = (n: number) => String(n).padStart(2, "0");
  const d = (day: number) => `${year}-${pad(month)}-${pad(day)}`;
  return [
    {
      id: "mock-1",
      titulo: "Reunión de coordinación",
      inicio: d(2),
      fin: d(2),
      allDay: true,
      color: "#5484ed",
    },
    {
      id: "mock-2",
      titulo: "Entrega de becas",
      inicio: d(8),
      fin: d(8),
      allDay: true,
      color: "#dc2127",
    },
    {
      id: "mock-3",
      titulo: "Charla informativa ingresantes",
      inicio: d(10),
      fin: d(10),
      allDay: true,
      color: "#51b749",
    },
    {
      id: "mock-4",
      titulo: "Torneo deportivo interno",
      inicio: d(15),
      fin: d(17),
      allDay: true,
      color: "#ffb878",
    },
    {
      id: "mock-5",
      titulo: "Taller tutorías",
      inicio: d(22),
      fin: d(22),
      allDay: true,
      color: "#7ae7bf",
    },
    {
      id: "mock-6",
      titulo: "Visita escuela técnica",
      inicio: d(25),
      fin: d(25),
      allDay: true,
      color: "#fbd75b",
    },
  ];
}
