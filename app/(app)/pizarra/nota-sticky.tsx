"use client";

import { useEffect, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Trash2 } from "lucide-react";
import { UserAvatar } from "@/components/features/user-avatar";
import type { NotaRow } from "./actions";

export const COLOR_BG: Record<string, string> = {
  amarillo: "#FEF3C7",
  rosa: "#FCE7F3",
  celeste: "#DBEAFE",
  verde: "#D1FAE5",
  violeta: "#EDE9FE",
  naranja: "#FFEDD5",
};

function formatRelativo(fechaISO: string): string {
  const diffMs = Date.now() - new Date(fechaISO).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH}h`;
  return `hace ${Math.floor(diffH / 24)}d`;
}

export function NotaSticky({
  nota,
  puedeBorrar,
  autoEditar = false,
  onEditar,
  onEmpezarEdicion,
  onEliminar,
}: {
  nota: NotaRow;
  puedeBorrar: boolean;
  /** Abre la nota directamente en edición al montar (nota recién creada). */
  autoEditar?: boolean;
  onEditar: (contenido: string) => void;
  onEmpezarEdicion: () => void;
  onEliminar: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: nota.id,
  });

  // Mismo motivo que en tarea-card.tsx: evita mismatch de hidratación por el
  // aria-describedby autoincremental de dnd-kit.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Lazy init (no efecto): solo importa el valor en el primer render de esta
  // instancia — cada nota es un componente nuevo por su `key`, así que esto
  // no vuelve a dispararse en re-renders posteriores.
  const [editando, setEditando] = useState(autoEditar);
  const [texto, setTexto] = useState(nota.contenido);

  function empezarEdicion() {
    onEmpezarEdicion();
    setTexto(nota.contenido);
    setEditando(true);
  }

  function guardar() {
    setEditando(false);
    const limpio = texto.trim();
    if (limpio && limpio !== nota.contenido) onEditar(limpio);
  }

  const style = {
    left: nota.pos_x,
    top: nota.pos_y,
    zIndex: isDragging ? 1000 : nota.z_index,
    backgroundColor: COLOR_BG[nota.color] ?? COLOR_BG.amarillo,
    transform: transform ? CSS.Translate.toString(transform) : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`absolute flex h-44 w-44 flex-col gap-1.5 rounded-lg p-3 shadow-md transition-shadow select-none ${
        isDragging ? "cursor-grabbing opacity-80 shadow-2xl" : "cursor-grab"
      }`}
      {...(mounted && !editando ? listeners : undefined)}
      {...(mounted && !editando ? attributes : undefined)}
    >
      {editando ? (
        <textarea
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={guardar}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              guardar();
            }
          }}
          maxLength={500}
          className="flex-1 resize-none bg-transparent text-sm leading-snug text-neutral-800 outline-none placeholder:text-neutral-500"
          placeholder="Escribí tu idea..."
        />
      ) : (
        <p
          onClick={empezarEdicion}
          className="flex-1 cursor-text overflow-hidden text-sm leading-snug whitespace-pre-wrap text-neutral-800"
        >
          {nota.contenido || <span className="text-neutral-500">Escribí tu idea...</span>}
        </p>
      )}

      <div className="flex items-center justify-between gap-1.5">
        <div className="flex min-w-0 items-center gap-1">
          <UserAvatar nombre={nota.autor_nombre} avatarColor={nota.autor_avatar_color} size="sm" />
          <span className="truncate text-[10px] text-neutral-600">
            {formatRelativo(nota.actualizada_en)}
          </span>
        </div>
        {puedeBorrar && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEliminar();
            }}
            className="shrink-0 text-neutral-500 hover:text-red-600"
            aria-label="Eliminar nota"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
