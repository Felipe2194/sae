"use client";

import { useState, useEffect, useTransition, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, LayoutDashboard, Layers3, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { buscar, type ResultadoBusqueda } from "@/app/(app)/actions";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function BuscadorGlobal() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  const [selected, setSelected] = useState(0);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 250);

  // Abrir con Cmd/Ctrl+K
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Buscar cuando cambia el query debounceado
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpiar resultados al vaciar la búsqueda
      setResultados([]);
      return;
    }
    startTransition(async () => {
      const res = await buscar(debouncedQuery);
      setResultados(res);
      setSelected(0);
    });
  }, [debouncedQuery]);

  // Limpiar al cerrar
  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) {
      setQuery("");
      setResultados([]);
      setSelected(0);
    }
  }

  const navegar = useCallback(
    (href: string) => {
      handleOpenChange(false);
      router.push(href);
    },
    [router],
  );

  // Navegación con teclado
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (resultados[selected]) navegar(resultados[selected].href);
    }
  }

  const tareas = resultados.filter((r) => r.tipo === "tarea");
  const areas = resultados.filter((r) => r.tipo === "area");

  // Índice global → índice de la lista plana de resultados en pantalla
  const ordenados = [...tareas, ...areas];

  return (
    <>
      {/* Trigger en el header */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
        aria-label="Buscar"
      >
        <Search className="size-3.5 shrink-0" />
        <span className="hidden sm:inline">Buscar…</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-background px-1.5 text-[10px] font-mono text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
          {/* Input */}
          <div className="flex items-center gap-2 border-b px-4 py-3">
            {pending ? (
              <Loader2 className="size-4 text-muted-foreground shrink-0 animate-spin" />
            ) : (
              <Search className="size-4 text-muted-foreground shrink-0" />
            )}
            <input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar tareas, áreas…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button
                onClick={() => { setQuery(""); setResultados([]); }}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Resultados */}
          <div className="max-h-80 overflow-y-auto py-2">
            {!query.trim() && (
              <p className="text-center text-xs text-muted-foreground py-8">
                Escribí para buscar tareas y áreas
              </p>
            )}

            {query.trim() && resultados.length === 0 && !pending && (
              <p className="text-center text-xs text-muted-foreground py-8">
                Sin resultados para &ldquo;{query}&rdquo;
              </p>
            )}

            {tareas.length > 0 && (
              <div>
                <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Tareas
                </p>
                {tareas.map((r) => {
                  const idx = ordenados.indexOf(r);
                  return (
                    <button
                      key={r.id}
                      onClick={() => navegar(r.href)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        selected === idx ? "bg-accent" : "hover:bg-accent/50"
                      }`}
                    >
                      <div
                        className="size-2 rounded-full shrink-0"
                        style={{ backgroundColor: r.color ?? "#94a3b8" }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{r.titulo}</p>
                        {r.subtitulo && (
                          <p className="text-xs text-muted-foreground truncate">{r.subtitulo}</p>
                        )}
                      </div>
                      <LayoutDashboard className="size-3.5 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}

            {areas.length > 0 && (
              <div>
                <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Áreas
                </p>
                {areas.map((r) => {
                  const idx = ordenados.indexOf(r);
                  return (
                    <button
                      key={r.id}
                      onClick={() => navegar(r.href)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        selected === idx ? "bg-accent" : "hover:bg-accent/50"
                      }`}
                    >
                      <div
                        className="size-2 rounded-full shrink-0"
                        style={{ backgroundColor: r.color ?? "#94a3b8" }}
                      />
                      <p className="flex-1 text-sm truncate">{r.titulo}</p>
                      <Layers3 className="size-3.5 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t px-4 py-2 flex gap-3 text-[10px] text-muted-foreground">
            <span><kbd className="font-mono">↑↓</kbd> navegar</span>
            <span><kbd className="font-mono">↵</kbd> abrir</span>
            <span><kbd className="font-mono">Esc</kbd> cerrar</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
