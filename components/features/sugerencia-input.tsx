"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  sugerencias: string[];
  placeholder?: string;
  className?: string;
};

// Input de texto libre con autocompletado contra valores ya cargados (p.ej.
// ciudades/zonas de otros colegios) — para no terminar con "Villa Maria",
// "Villa María" y "villa maria" como tres localidades distintas. A
// diferencia de ColegioCombobox no hay noción de "crear": lo que se escribe
// siempre es un valor válido, la sugerencia solo evita reescribirlo mal.
export function SugerenciaInput({
  value,
  onChange,
  sugerencias,
  placeholder,
  className,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(0);

  const opciones = useMemo(() => {
    const q = normalizar(value);
    const unicas = Array.from(new Set(sugerencias.filter(Boolean)));
    const filtradas = q
      ? unicas.filter((s) => normalizar(s).includes(q) && normalizar(s) !== q)
      : unicas;
    return filtradas.sort((a, b) => a.localeCompare(b)).slice(0, 8);
  }, [sugerencias, value]);

  function elegir(opcion: string) {
    onChange(opcion);
    setAbierto(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!abierto || opciones.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setResaltado((r) => Math.min(r + 1, opciones.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setResaltado((r) => Math.max(r - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      elegir(opciones[resaltado]);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  }

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setResaltado(0);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setAbierto(false)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {abierto && opciones.length > 0 && (
        <div className="bg-popover/95 ring-foreground/10 supports-backdrop-filter:backdrop-blur-xl absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg shadow-md ring-1">
          {opciones.map((op, i) => (
            <button
              key={op}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(op);
              }}
              className={cn(
                "block w-full truncate px-3 py-2 text-left text-sm",
                i === resaltado ? "bg-accent" : "hover:bg-accent/50",
              )}
            >
              {op}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
