"use client";

import { useState, useTransition, useRef } from "react";
import { Lightbulb, TrendingUp, CheckSquare, StickyNote, Plus, Trash2, Loader2 } from "lucide-react";
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

type TipoNota = NotaRow["tipo"];

const TIPOS: { value: TipoNota; label: string; icon: React.ElementType; color: string; bg: string }[] = [
  { value: "nota",       label: "Nota",       icon: StickyNote,   color: "text-slate-500",  bg: "bg-slate-100 dark:bg-slate-800" },
  { value: "idea",       label: "Idea",       icon: Lightbulb,    color: "text-amber-500",  bg: "bg-amber-50 dark:bg-amber-950/40" },
  { value: "actividad",  label: "Actividad",  icon: CheckSquare,  color: "text-blue-500",   bg: "bg-blue-50 dark:bg-blue-950/40" },
  { value: "progreso",   label: "Progreso",   icon: TrendingUp,   color: "text-green-500",  bg: "bg-green-50 dark:bg-green-950/40" },
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

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  areaId: string;
  notasIniciales: NotaRow[];
  usuarioActualId: string;
  canDelete: boolean; // coord o admin puede borrar cualquier nota
};

// ── Componente ────────────────────────────────────────────────────────────────

export function AreaNotas({ areaId, notasIniciales, usuarioActualId, canDelete }: Props) {
  const [notas, setNotas] = useState<NotaRow[]>(notasIniciales);
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState<TipoNota>("nota");
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleAgregar() {
    const contenido = texto.trim();
    if (!contenido) return;

    // Optimistic: crear nota temporal
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
    startTransition(async () => {
      await eliminarNota(notaId, areaId);
      setDeletingId(null);
    });
  }

  return (
    <section className="flex flex-col gap-4">
      {/* ── Encabezado ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Bitácora del área</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Anotá actividades, ideas y avances del equipo
          </p>
        </div>
        <Button
          variant={abierto ? "secondary" : "outline"}
          size="sm"
          onClick={() => {
            setAbierto((v) => !v);
            if (!abierto) setTimeout(() => textareaRef.current?.focus(), 50);
          }}
        >
          <Plus className="size-4" />
          Nueva nota
        </Button>
      </div>

      {/* ── Formulario nuevo ─────────────────────────────────────────────── */}
      {abierto && (
        <div className="rounded-xl border bg-card p-4 flex flex-col gap-3 shadow-sm">
          {/* Selector de tipo */}
          <div className="flex gap-2 flex-wrap">
            {TIPOS.map((t) => {
              const Icon = t.icon;
              const activo = tipo === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setTipo(t.value)}
                  className={[
                    "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors",
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
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAgregar();
            }}
          />

          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              Ctrl+Enter para guardar
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setAbierto(false); setTexto(""); }}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleAgregar} disabled={!texto.trim() || pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : "Guardar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Feed de notas ────────────────────────────────────────────────── */}
      {notas.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center rounded-xl border border-dashed">
          <StickyNote className="size-7 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Todavía no hay notas en esta área.
          </p>
          <p className="text-xs text-muted-foreground/60">
            Anotá ideas, actividades o el progreso del equipo.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {notas.map((nota) => {
            const cfg = tipoConfig(nota.tipo);
            const Icon = cfg.icon;
            const esMia = nota.autor_id === usuarioActualId;
            const puedeEliminar = esMia || canDelete;

            return (
              <div
                key={nota.id}
                className="group relative rounded-xl border bg-card px-4 py-3 flex gap-3 hover:shadow-sm transition-shadow"
              >
                {/* Icono tipo */}
                <div className={`mt-0.5 shrink-0 size-7 rounded-full flex items-center justify-center ${cfg.bg}`}>
                  <Icon className={`size-3.5 ${cfg.color}`} />
                </div>

                {/* Contenido */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[11px] font-medium ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatFecha(nota.creada_en)}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {nota.contenido}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="inline-flex size-4 items-center justify-center rounded-full bg-muted text-[9px] font-semibold">
                      {iniciales(nota.autor_nombre)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {nota.autor_nombre}
                    </span>
                  </div>
                </div>

                {/* Borrar */}
                {puedeEliminar && (
                  <button
                    onClick={() => handleEliminar(nota.id)}
                    disabled={deletingId === nota.id}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
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
    </section>
  );
}
