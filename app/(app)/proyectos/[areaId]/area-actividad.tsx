"use client";

import { useMemo, useState, useTransition, useRef } from "react";
import {
  Lightbulb,
  TrendingUp,
  CheckSquare,
  StickyNote,
  Plus,
  Trash2,
  Loader2,
  History,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { crearNota, eliminarNota } from "../actions";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type NotaRow = {
  id: string;
  contenido: string;
  tipo: "nota" | "idea" | "actividad" | "progreso";
  creada_en: string;
  autor_id: string;
  autor_nombre: string;
};

export type LogEntryRow = {
  id: string;
  campo: string;
  valor_antes: string | null;
  valor_despues: string | null;
  autor_nombre: string | null;
  tarea_titulo: string;
  creada_en: string;
};

type TipoNota = NotaRow["tipo"];

type FeedItem =
  | { origen: "nota"; creada_en: string; nota: NotaRow }
  | { origen: "log"; creada_en: string; log: LogEntryRow };

const TIPOS: {
  value: TipoNota;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}[] = [
  {
    value: "nota",
    label: "Nota",
    icon: StickyNote,
    color: "text-slate-500",
    bg: "bg-slate-100 dark:bg-slate-800",
  },
  {
    value: "idea",
    label: "Idea",
    icon: Lightbulb,
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950/40",
  },
  {
    value: "actividad",
    label: "Actividad",
    icon: CheckSquare,
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/40",
  },
  {
    value: "progreso",
    label: "Progreso",
    icon: TrendingUp,
    color: "text-green-500",
    bg: "bg-green-50 dark:bg-green-950/40",
  },
];

function tipoConfig(tipo: TipoNota) {
  return TIPOS.find((t) => t.value === tipo) ?? TIPOS[0];
}

function formatFecha(iso: string): string {
  const d = new Date(iso);
  const hoy = new Date();
  const diff = hoy.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hs = Math.floor(mins / 60);
  if (hs < 24) return `hace ${hs} h`;
  const dias = Math.floor(hs / 24);
  if (dias < 7) return `hace ${dias} d`;
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/);
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

// ── Fila de log automático (cambios de tarea) ───────────────────────────────

function LogFila({ log }: { log: LogEntryRow }) {
  return (
    <div className="flex gap-3 px-4 py-2.5">
      <div className="bg-muted mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
        <History className="text-muted-foreground size-3.5" />
      </div>
      <div className="flex min-w-0 flex-1 items-center">
        <p className="text-muted-foreground text-xs leading-relaxed">
          <span className="text-foreground/80 font-medium">
            {log.autor_nombre ?? "Sistema"}
          </span>{" "}
          cambió <span className="font-medium">{log.campo}</span>
          {log.valor_antes ? (
            <>
              {" de "}
              <span className="line-through opacity-60">{log.valor_antes}</span>
              {" a "}
              <span className="text-foreground/80 font-medium">
                {log.valor_despues}
              </span>
            </>
          ) : (
            log.valor_despues && (
              <>
                {" "}
                →{" "}
                <span className="text-foreground/80 font-medium">
                  {log.valor_despues}
                </span>
              </>
            )
          )}
          {" en "}
          <span className="italic">«{log.tarea_titulo}»</span>
          {" · "}
          {formatFecha(log.creada_en)}
        </p>
      </div>
    </div>
  );
}

// ── Componente ────────────────────────────────────────────────────────────────

type Props = {
  areaId: string;
  notasIniciales: NotaRow[];
  logRows: LogEntryRow[];
  usuarioActualId: string;
  canDelete: boolean; // coord o admin puede borrar cualquier nota
};

export function AreaActividad({
  areaId,
  notasIniciales,
  logRows,
  usuarioActualId,
  canDelete,
}: Props) {
  const [notas, setNotas] = useState<NotaRow[]>(notasIniciales);
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState<TipoNota>("nota");
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [
      ...notas.map((n): FeedItem => ({
        origen: "nota",
        creada_en: n.creada_en,
        nota: n,
      })),
      ...logRows.map((l): FeedItem => ({
        origen: "log",
        creada_en: l.creada_en,
        log: l,
      })),
    ];
    return items.sort((a, b) => (a.creada_en < b.creada_en ? 1 : -1));
  }, [notas, logRows]);

  function handleAgregar() {
    const contenido = texto.trim();
    if (!contenido) return;

    const temp: NotaRow = {
      id: `temp-${Date.now()}`,
      contenido,
      tipo,
      creada_en: new Date().toISOString(),
      autor_id: usuarioActualId,
      autor_nombre: "Tú",
    };
    setNotas((prev) => [temp, ...prev]);
    setTexto("");
    setAbierto(false);

    startTransition(async () => {
      await crearNota(areaId, contenido, tipo);
    });
  }

  function handleEliminar(notaId: string) {
    setDeletingId(notaId);
    setNotas((prev) => prev.filter((n) => n.id !== notaId));
    if (notaId.startsWith("temp-")) {
      setDeletingId(null);
      return;
    }
    startTransition(async () => {
      await eliminarNota(notaId, areaId);
      setDeletingId(null);
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Activity className="text-muted-foreground size-4" />
          Actividad del equipo
        </CardTitle>
        <Button
          variant={abierto ? "secondary" : "outline"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            setAbierto((v) => !v);
            if (!abierto) setTimeout(() => textareaRef.current?.focus(), 50);
          }}
        >
          <Plus className="size-3.5" />
          Nueva nota
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {abierto && (
          <div className="bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {TIPOS.map((t) => {
                const Icon = t.icon;
                const activo = tipo === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => setTipo(t.value)}
                    className={[
                      "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      activo
                        ? `${t.bg} ${t.color} border-current`
                        : "border-border text-muted-foreground hover:bg-muted",
                    ].join(" ")}
                  >
                    <Icon className="size-3" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            <Textarea
              ref={textareaRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escribí tu nota aquí..."
              rows={3}
              className="resize-none text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                  handleAgregar();
              }}
            />

            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-[12px]">
                Ctrl+Enter para guardar
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAbierto(false);
                    setTexto("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleAgregar}
                  disabled={!texto.trim() || pending}
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Guardar"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {feed.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center">
            <StickyNote className="text-muted-foreground/30 size-7" />
            <p className="text-muted-foreground text-sm">
              Todavía no hay actividad en esta área.
            </p>
            <p className="text-muted-foreground/60 text-xs">
              Acá van a aparecer las notas del equipo y los cambios en las
              tareas.
            </p>
          </div>
        ) : (
          <div className="flex flex-col divide-y overflow-hidden rounded-xl border">
            {feed.map((item) => {
              if (item.origen === "log") {
                return <LogFila key={`log-${item.log.id}`} log={item.log} />;
              }

              const nota = item.nota;
              const cfg = tipoConfig(nota.tipo);
              const Icon = cfg.icon;
              const esMia = nota.autor_id === usuarioActualId;
              const puedeEliminar = esMia || canDelete;

              return (
                <div
                  key={`nota-${nota.id}`}
                  className="group bg-card hover:bg-muted/40 relative flex gap-3 px-4 py-3 transition-colors"
                >
                  <div
                    className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${cfg.bg}`}
                  >
                    <Icon className={`size-3.5 ${cfg.color}`} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className={`text-[12px] font-medium ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        ·
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        {formatFecha(nota.creada_en)}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {nota.contenido}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="bg-muted inline-flex size-4 items-center justify-center rounded-full text-[10px] font-semibold">
                        {iniciales(nota.autor_nombre)}
                      </span>
                      <span className="text-muted-foreground text-[12px]">
                        {nota.autor_nombre}
                      </span>
                    </div>
                  </div>

                  {puedeEliminar && (
                    <button
                      onClick={() => handleEliminar(nota.id)}
                      disabled={deletingId === nota.id}
                      className="hover:bg-destructive/10 text-muted-foreground hover:text-destructive absolute top-3 right-3 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100"
                      title="Eliminar nota"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
