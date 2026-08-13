import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { logger } from "@/lib/logger";

// Endpoint de salud sin autenticación, para monitoreo externo (uptime
// checks, balanceadores de carga). No expone nada sensible: solo confirma
// que el proceso responde y que la base es alcanzable.
export async function GET() {
  try {
    await sql`select 1`;
    return NextResponse.json({ status: "ok", db: "ok" });
  } catch (error) {
    logger.error("health-check: base de datos inalcanzable", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ status: "error", db: "unreachable" }, { status: 503 });
  }
}
