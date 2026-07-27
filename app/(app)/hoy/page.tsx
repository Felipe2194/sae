"use client";

import { useMemo, useState } from "react";
import { Link2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  usuarioActual,
  tareas as tareasIniciales,
  accesosRapidos,
  areaPorId,
  type Tarea,
} from "@/lib/mock-data";

const hoyISO = new Date().toISOString().slice(0, 10);

function saludo(): string {
  const hora = new Date().getHours();
  if (hora < 12) return "Buenos días";
  if (hora < 20) return "Buenas tardes";
  return "Buenas noches";
}

function fechaLarga(): string {
  const texto = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function TareaFila({
  tarea,
  onToggle,
}: {
  tarea: Tarea;
  onToggle: (id: string) => void;
}) {
  const area = areaPorId(tarea.areaId);
  const vencida =
    tarea.fechaVencimiento !== null &&
    tarea.fechaVencimiento < hoyISO &&
    tarea.estado !== "hecha";

  return (
    <div className="flex items-center gap-3 py-2">
      <Checkbox
        checked={tarea.estado === "hecha"}
        onCheckedChange={() => onToggle(tarea.id)}
      />
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: area?.color }}
      />
      <span
        className={`flex-1 text-sm ${tarea.estado === "hecha" ? "text-muted-foreground line-through" : ""}`}
      >
        {tarea.titulo}
      </span>
      {vencida && (
        <Badge variant="destructive" className="shrink-0">
          Vencida
        </Badge>
      )}
      {tarea.estado === "en_progreso" && (
        <Badge variant="secondary" className="shrink-0">
          En progreso
        </Badge>
      )}
    </div>
  );
}

export default function HoyPage() {
  const [tareas, setTareas] = useState(tareasIniciales);

  function toggleTarea(id: string) {
    setTareas((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, estado: t.estado === "hecha" ? "por_hacer" : "hecha" }
          : t,
      ),
    );
  }

  const misTareasHoy = useMemo(
    () =>
      tareas.filter(
        (t) =>
          t.responsableId === usuarioActual.id &&
          (t.estado === "en_progreso" ||
            (t.fechaVencimiento !== null && t.fechaVencimiento <= hoyISO)),
      ),
    [tareas],
  );

  const estaSemana = useMemo(
    () =>
      tareas.filter(
        (t) =>
          t.responsableId === usuarioActual.id &&
          t.estado !== "hecha" &&
          t.fechaVencimiento !== null &&
          t.fechaVencimiento > hoyISO,
      ),
    [tareas],
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <p className="text-muted-foreground text-sm">{fechaLarga()}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {saludo()}, {usuarioActual.nombre.split(" ")[0]}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mis tareas de hoy</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {misTareasHoy.length === 0 ? (
            <p className="text-muted-foreground py-4 text-sm">
              No tenés nada pendiente para hoy.
            </p>
          ) : (
            misTareasHoy.map((t) => (
              <TareaFila key={t.id} tarea={t} onToggle={toggleTarea} />
            ))
          )}
        </CardContent>
      </Card>

      <Collapsible defaultOpen={false}>
        <Card>
          <CollapsibleTrigger
            nativeButton={false}
            render={<CardHeader className="cursor-pointer select-none" />}
          >
            <CardTitle className="flex items-center justify-between text-base">
              Esta semana
              <Badge variant="outline">{estaSemana.length}</Badge>
            </CardTitle>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="divide-y">
              {estaSemana.length === 0 ? (
                <p className="text-muted-foreground py-4 text-sm">
                  No hay nada próximo a vencer.
                </p>
              ) : (
                estaSemana.map((t) => (
                  <TareaFila key={t.id} tarea={t} onToggle={toggleTarea} />
                ))
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Accesos rápidos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {accesosRapidos.map((ar) => (
            <Button
              key={ar.id}
              variant="outline"
              size="sm"
              nativeButton={false}
              render={
                <a href={ar.url} target="_blank" rel="noopener noreferrer" />
              }
            >
              <Link2 />
              {ar.etiqueta}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
