"use client";

import { useMemo, useState } from "react";
import { Check, Plus, School } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ColegioOption = {
  id: string;
  nombre: string;
  ciudad: string | null;
  zona: string | null;
};

function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

type Props = {
  colegios: ColegioOption[];
  nombre: string;
  colegioSeleccionadoId: string | null;
  onChangeNombre: (nombre: string) => void;
  onSeleccionar: (colegio: ColegioOption) => void;
  onNuevo: (nombre: string) => void;
};

// Combobox de un solo campo para "Colegio / Evento": mientras se escribe,
// filtra el directorio y sugiere coincidencias; si no hay match exacto,
// ofrece crear uno nuevo con ese nombre. Reemplaza el <Select> + bloque
// "+ Nuevo colegio" anterior, que obligaba a elegir entre dos flujos
// distintos para la misma pregunta.
export function ColegioCombobox({
  colegios,
  nombre,
  colegioSeleccionadoId,
  onChangeNombre,
  onSeleccionar,
  onNuevo,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(0);

  const coincidencias = useMemo(() => {
    const q = normalizar(nombre);
    if (!q) return colegios.slice(0, 8);
    return colegios
      .filter((c) => normalizar(c.nombre).includes(q))
      .slice(0, 8);
  }, [colegios, nombre]);

  const hayMatchExacto = colegios.some(
    (c) => normalizar(c.nombre) === normalizar(nombre),
  );
  const mostrarCrearNuevo = nombre.trim().length > 0 && !hayMatchExacto;

  // Lista de opciones navegables: colegios filtrados + "crear nuevo" al final.
  const totalOpciones = coincidencias.length + (mostrarCrearNuevo ? 1 : 0);

  function elegir(index: number) {
    if (index < coincidencias.length) {
      onSeleccionar(coincidencias[index]);
    } else if (mostrarCrearNuevo) {
      onNuevo(nombre.trim());
    }
    setAbierto(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!abierto && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setAbierto(true);
      return;
    }
    if (!abierto) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setResaltado((r) => Math.min(r + 1, totalOpciones - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setResaltado((r) => Math.max(r - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (totalOpciones > 0) elegir(resaltado);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <School className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={nombre}
          onChange={(e) => {
            onChangeNombre(e.target.value);
            setResaltado(0);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          onBlur={() => setAbierto(false)}
          onKeyDown={handleKeyDown}
          placeholder="Escribí el nombre del colegio o evento..."
          className="h-11 pl-9 text-base"
          autoComplete="off"
        />
      </div>

      {abierto && (coincidencias.length > 0 || mostrarCrearNuevo) && (
        <div className="bg-popover/95 ring-foreground/10 supports-backdrop-filter:backdrop-blur-xl absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg shadow-md ring-1">
          {coincidencias.map((c, i) => (
            <button
              key={c.id}
              type="button"
              // onMouseDown en vez de onClick: dispara antes que el onBlur
              // del input, si no el blur cierra la lista antes de registrar
              // el click y la selección nunca llega a pasar.
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(i);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm",
                i === resaltado ? "bg-accent" : "hover:bg-accent/50",
              )}
            >
              {colegioSeleccionadoId === c.id && (
                <Check className="text-primary size-4 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.nombre}</p>
                {(c.ciudad || c.zona) && (
                  <p className="text-muted-foreground truncate text-xs">
                    {[c.ciudad, c.zona].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </button>
          ))}
          {mostrarCrearNuevo && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(coincidencias.length);
              }}
              className={cn(
                "text-primary flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium",
                resaltado === coincidencias.length
                  ? "bg-accent"
                  : "hover:bg-accent/50",
              )}
            >
              <Plus className="size-4 shrink-0" />
              Crear &quot;{nombre.trim()}&quot; como nuevo colegio/evento
            </button>
          )}
        </div>
      )}
    </div>
  );
}
