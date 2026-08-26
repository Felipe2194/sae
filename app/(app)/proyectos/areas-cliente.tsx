"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, User, AlertTriangle, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AreaDialog,
  CATEGORIA_AREA_OPTS,
  type UsuarioOption,
} from "./area-dialog";
import { ReactivarAreaBoton } from "./reactivar-area-boton";
import { fetchAreasArchivadas, type AreaArchivadaRow } from "./actions";

type Area = {
  id: string;
  nombre: string;
  color: string;
  descripcion: string | null;
  tipo: "continua" | "evento";
  categoria: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  responsable_nombre: string | null;
  tareas_total: number;
  tareas_hechas: number;
  tareas_abiertas: number;
  vencidas_0_7: number;
  vencidas_8_14: number;
  vencidas_15_30: number;
  vencidas_30_mas: number;
  proximos: { id: string; titulo: string; fecha_vencimiento: string }[];
};

const CATEGORIA_LABEL = Object.fromEntries(
  CATEGORIA_AREA_OPTS.map((c) => [c.value, c.label]),
);

/** Rótulo de la antigüedad más vieja entre las tareas vencidas del área. */
function peorAntiguedad(area: Area): string | null {
  if (area.vencidas_30_mas > 0) return "hace más de 30 días";
  if (area.vencidas_15_30 > 0) return "hace 15 a 30 días";
  if (area.vencidas_8_14 > 0) return "hace 8 a 14 días";
  if (area.vencidas_0_7 > 0) return "hace menos de una semana";
  return null;
}

function relDay(fechaISO: string, hoyISO: string): string {
  const diff = Math.round(
    (new Date(fechaISO + "T00:00:00").getTime() -
      new Date(hoyISO + "T00:00:00").getTime()) /
      86_400_000,
  );
  if (diff <= 0) return "Hoy";
  if (diff === 1) return "Mañana";
  return `en ${diff} días`;
}

/** "Faltan N días" / "Finaliza hoy" / "Finalizado hace N días". */
function cuentaRegresiva(fechaFin: string, hoyISO: string): string {
  const dias = Math.round(
    (new Date(fechaFin + "T00:00:00").getTime() -
      new Date(hoyISO + "T00:00:00").getTime()) /
      86_400_000,
  );
  if (dias > 0) return `Faltan ${dias} día${dias === 1 ? "" : "s"}`;
  if (dias === 0) return "Finaliza hoy";
  return `Finalizado hace ${-dias} día${-dias === 1 ? "" : "s"}`;
}

function ProyectoCard({ area, hoyISO }: { area: Area; hoyISO: string }) {
  const pct =
    area.tareas_total > 0
      ? Math.round((area.tareas_hechas / area.tareas_total) * 100)
      : 0;
  const vencidasTotal =
    area.vencidas_0_7 +
    area.vencidas_8_14 +
    area.vencidas_15_30 +
    area.vencidas_30_mas;
  const peorLabel = peorAntiguedad(area);

  return (
    <Link key={area.id} href={`/proyectos/${area.id}`} className="group">
      <div className="bg-card flex h-full flex-col overflow-hidden rounded-xl border transition-shadow hover:shadow-md">
        {/* Barra de color superior */}
        <div className="h-1.5 w-full" style={{ backgroundColor: area.color }} />

        <div className="flex flex-1 flex-col gap-3 p-4">
          {/* Nombre + categoría */}
          <div className="flex items-start gap-2">
            <span
              className="mt-1 size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: area.color }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="group-hover:text-foreground text-sm leading-tight font-semibold">
                  {area.nombre}
                </p>
                <Badge
                  variant="outline"
                  className="px-1.5 py-0 text-[10px] font-normal"
                >
                  {CATEGORIA_LABEL[area.categoria] ?? area.categoria}
                </Badge>
              </div>
              {area.descripcion && (
                <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                  {area.descripcion}
                </p>
              )}
            </div>
          </div>

          {/* Cuenta regresiva (solo eventos) */}
          {area.tipo === "evento" && area.fecha_fin && (
            <div className="flex items-center gap-1.5 text-xs">
              <CalendarClock className="text-muted-foreground size-3.5 shrink-0" />
              <span className="font-medium">
                {cuentaRegresiva(area.fecha_fin, hoyISO)}
              </span>
            </div>
          )}

          <div className="flex-1" />

          {/* Barra de progreso */}
          {area.tareas_total > 0 ? (
            <div className="flex flex-col gap-1.5">
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span>{area.tareas_abiertas} abiertas</span>
                <span className="tabular-nums">{pct}%</span>
              </div>
              <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: area.color,
                    opacity: 0.8,
                  }}
                />
              </div>
              <p className="text-muted-foreground text-[12px]">
                {area.tareas_hechas} de {area.tareas_total} completadas
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">Sin tareas aún</p>
          )}

          {/* Vencidas, por antigüedad */}
          {vencidasTotal > 0 && (
            <div className="flex items-start gap-1.5 text-xs">
              <AlertTriangle className="text-destructive mt-0.5 size-3.5 shrink-0" />
              <p className="min-w-0">
                <span className="text-destructive font-medium">
                  {vencidasTotal} {vencidasTotal === 1 ? "vencida" : "vencidas"}
                </span>
                {peorLabel && (
                  <span className="text-muted-foreground">
                    {" "}
                    · la más vieja {peorLabel}
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Próximos 7 días */}
          {area.proximos.length > 0 && (
            <div className="flex flex-col gap-1 border-t pt-2.5">
              <p className="text-muted-foreground text-[11px] font-medium">
                Próximos 7 días
              </p>
              {area.proximos.map((t) => (
                <div key={t.id} className="flex items-center gap-1.5 text-xs">
                  <span className="min-w-0 flex-1 truncate">{t.titulo}</span>
                  <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                    {relDay(t.fecha_vencimiento, hoyISO)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Responsable */}
          {area.responsable_nombre && (
            <div className="text-muted-foreground flex items-center gap-1.5 border-t pt-3 text-xs">
              <User className="size-3 shrink-0" />
              <span className="truncate">{area.responsable_nombre}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

type Props = {
  areas: Area[];
  usuarios: UsuarioOption[];
  canManage: boolean;
};

const TABS = [
  { value: "continua", label: "Líneas y Áreas" },
  { value: "evento", label: "Eventos e Iniciativas" },
  { value: "archivadas", label: "Archivados" },
] as const;

type Tab = (typeof TABS)[number]["value"];

export function AreasCliente({ areas, usuarios, canManage }: Props) {
  const hoyISO = new Date().toISOString().slice(0, 10);
  const [tab, setTab] = useState<Tab>("continua");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [archivadas, setArchivadas] = useState<AreaArchivadaRow[] | null>(null);
  const [, startTransition] = useTransition();

  const continuas = areas.filter((a) => a.tipo === "continua");
  const eventos = areas.filter((a) => a.tipo === "evento");

  useEffect(() => {
    if (tab === "archivadas" && archivadas === null) {
      startTransition(async () => {
        const rows = await fetchAreasArchivadas();
        setArchivadas(rows);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe correr al entrar a la pestaña
  }, [tab]);

  function handleReactivada(areaId: string) {
    setArchivadas((prev) => prev?.filter((a) => a.id !== areaId) ?? prev);
  }

  const listaActual =
    tab === "continua" ? continuas : tab === "evento" ? eventos : null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proyectos</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {areas.length}{" "}
            {areas.length === 1 ? "proyecto activo" : "proyectos activos"}
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            Nuevo proyecto
          </Button>
        )}
      </div>

      {/* ── Pestañas ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.value
                ? "border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent"
            }`}
          >
            {t.label}
            {t.value === "continua" && ` (${continuas.length})`}
            {t.value === "evento" && ` (${eventos.length})`}
          </button>
        ))}
      </div>

      {listaActual !== null ? (
        listaActual.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-muted-foreground text-sm">
              {tab === "continua"
                ? "No hay áreas continuas creadas todavía."
                : "No hay eventos o iniciativas creados todavía."}
            </p>
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="size-4" />
                Crear proyecto
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listaActual.map((area) => (
              <ProyectoCard key={area.id} area={area} hoyISO={hoyISO} />
            ))}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-1.5">
          {archivadas === null ? (
            <p className="text-muted-foreground text-xs">Cargando...</p>
          ) : archivadas.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No hay proyectos archivados.
            </p>
          ) : (
            archivadas.map((a) => (
              <div
                key={a.id}
                className="bg-muted/30 flex items-center gap-2 rounded-lg border px-3 py-2"
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: a.color }}
                />
                <Link
                  href={`/proyectos/${a.id}`}
                  className="min-w-0 flex-1 truncate text-sm hover:underline"
                >
                  {a.nombre}
                </Link>
                <ReactivarAreaBoton
                  areaId={a.id}
                  label="Reactivar"
                  labelPendiente="Reactivar"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 text-xs"
                  onReactivada={() => handleReactivada(a.id)}
                />
              </div>
            ))
          )}
        </div>
      )}

      {canManage && (
        <AreaDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          usuarios={usuarios}
        />
      )}
    </div>
  );
}
