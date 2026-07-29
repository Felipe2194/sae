"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DIAS_SEMANA,
  franjas,
  turnoPorDiaYFranja,
  usuarioPorId,
  type DiaSemana,
} from "@/lib/mock-data";

/** Devuelve el lunes de la semana que contiene `fecha`. */
function lunesDe(fecha: Date): Date {
  const d = new Date(fecha);
  const dow = d.getDay(); // 0=dom
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatSemana(lunes: Date): string {
  const viernes = new Date(lunes);
  viernes.setDate(lunes.getDate() + 4);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
  return `${lunes.toLocaleDateString("es-AR", opts)} – ${viernes.toLocaleDateString("es-AR", { ...opts, year: "numeric" })}`;
}

const COLORES_USUARIO: Record<string, string> = {
  "u-coord": "bg-orange-100 text-orange-800 border-orange-200",
  "u-admin": "bg-blue-100 text-blue-800 border-blue-200",
  "u-miembro": "bg-green-100 text-green-800 border-green-200",
};

export default function CronogramaPage() {
  const [lunes, setLunes] = useState<Date>(() => lunesDe(new Date()));

  const semanaAnterior = () => {
    const d = new Date(lunes);
    d.setDate(d.getDate() - 7);
    setLunes(d);
  };
  const semanaSiguiente = () => {
    const d = new Date(lunes);
    d.setDate(d.getDate() + 7);
    setLunes(d);
  };
  const irAHoy = () => setLunes(lunesDe(new Date()));

  const hoyISO = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Cronograma semanal
          </h1>
          <p className="text-muted-foreground text-sm">
            {formatSemana(lunes)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={semanaAnterior}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={irAHoy}>
            Hoy
          </Button>
          <Button variant="outline" size="sm" onClick={semanaSiguiente}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-2">
        {["u-coord", "u-admin", "u-miembro"].map((uid) => {
          const u = usuarioPorId(uid);
          if (!u) return null;
          return (
            <div key={uid} className="flex items-center gap-1.5">
              <Avatar className="size-5">
                <AvatarFallback
                  className="text-[9px]"
                  style={{ backgroundColor: u.color ?? "#94a3b8", color: "#fff" }}
                >
                  {u.iniciales}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{u.nombre.split(" ")[0]}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-1.5">
          <span className="bg-muted text-muted-foreground rounded px-2 py-0.5 text-xs">
            —
          </span>
          <span className="text-sm">Libre</span>
        </div>
      </div>

      {/* Grilla */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="text-muted-foreground w-28 border-b px-4 py-3 text-left font-medium">
                    Horario
                  </th>
                  {DIAS_SEMANA.map(({ dia, label, abrev }) => {
                    const fecha = new Date(lunes);
                    fecha.setDate(lunes.getDate() + dia);
                    const fechaISO = fecha.toISOString().slice(0, 10);
                    const esHoy = fechaISO === hoyISO;
                    return (
                      <th
                        key={dia}
                        className={`border-b px-3 py-3 text-center font-medium ${esHoy ? "text-primary" : "text-muted-foreground"}`}
                      >
                        <span className="hidden sm:block">{label}</span>
                        <span className="sm:hidden">{abrev}</span>
                        <div
                          className={`mx-auto mt-0.5 h-1 w-6 rounded-full ${esHoy ? "bg-primary" : "bg-transparent"}`}
                        />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {franjas.map((franja, fi) => (
                  <tr key={franja.id} className={fi % 2 === 0 ? "bg-muted/30" : ""}>
                    <td className="text-muted-foreground border-b px-4 py-3 text-xs font-medium whitespace-nowrap">
                      {franja.inicio} – {franja.fin}
                    </td>
                    {DIAS_SEMANA.map(({ dia }) => {
                      const turno = turnoPorDiaYFranja(
                        dia as DiaSemana,
                        franja.id,
                      );
                      const usuario = turno
                        ? usuarioPorId(turno.usuarioId)
                        : undefined;
                      return (
                        <td
                          key={dia}
                          className="border-b px-2 py-2 text-center"
                        >
                          {usuario ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${COLORES_USUARIO[turno!.usuarioId!] ?? "bg-secondary text-secondary-foreground border-border"}`}
                            >
                              <Avatar className="size-4">
                                <AvatarFallback
                                  className="text-[8px]"
                                  style={{
                                    backgroundColor:
                                      usuario.color ?? "#94a3b8",
                                    color: "#fff",
                                  }}
                                >
                                  {usuario.iniciales}
                                </AvatarFallback>
                              </Avatar>
                              <span className="hidden sm:inline">
                                {usuario.nombre.split(" ")[0]}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              —
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Resumen semanal */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {["u-coord", "u-admin", "u-miembro"].map((uid) => {
          const u = usuarioPorId(uid);
          if (!u) return null;
          const cantTurnos = franjas.reduce((acc, f) => {
            const t = turnoPorDiaYFranja;
            const count = DIAS_SEMANA.filter(
              ({ dia }) => turnoPorDiaYFranja(dia as DiaSemana, f.id)?.usuarioId === uid,
            ).length;
            return acc + count;
          }, 0);
          const horas = cantTurnos * 2;
          return (
            <Card key={uid} className="py-3">
              <CardHeader className="px-4 pb-1">
                <CardTitle className="text-sm font-medium">
                  {u.nombre}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">{horas}</span>
                  <span className="text-muted-foreground text-sm">hs / semana</span>
                </div>
                <Badge
                  variant="outline"
                  className={`mt-1 ${COLORES_USUARIO[uid] ?? ""}`}
                >
                  {cantTurnos} turnos
                </Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
