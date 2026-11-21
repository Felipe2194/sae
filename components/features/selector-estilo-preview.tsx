"use client";

import { useCallback, useEffect, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { CLAVE_ESTILO, ESTILOS_PREVIEW } from "@/lib/estilos-preview";

// Selector flotante de estilos para comparar diseños en los deploys de
// preview. Solo lo monta app/layout.tsx fuera de producción. Usa estilos
// inline (y no componentes de components/ui) para que los estilos que está
// probando no lo deformen.
//
// Atajos: [ y ] cambian al anterior/siguiente (fuera de campos de texto).

const FUENTE = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export function SelectorEstiloPreview() {
  const { resolvedTheme } = useTheme();
  const [estilo, setEstilo] = useState("actual");
  const [abierto, setAbierto] = useState(false);
  const [minimizado, setMinimizado] = useState(false);

  // El script de <head> ya aplicó el estilo guardado; acá solo se lee para
  // mostrarlo (en un efecto, para no romper la hidratación).
  useEffect(() => {
    const actual = document.documentElement.getAttribute("data-estilo");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (actual) setEstilo(actual);
  }, []);

  const aplicar = useCallback(
    (id: string) => {
      const def = ESTILOS_PREVIEW.find((e) => e.id === id);
      if (!def) return;
      const root = document.documentElement;
      root.setAttribute("data-estilo", id);
      if (def.esquema) root.setAttribute("data-esquema", def.esquema);
      else root.removeAttribute("data-esquema");
      const esquema = def.esquema ?? resolvedTheme;
      root.classList.toggle("dark", esquema === "dark");
      root.style.colorScheme = esquema;
      try {
        localStorage.setItem(CLAVE_ESTILO, id);
      } catch {}
      const url = new URL(window.location.href);
      if (url.searchParams.has("estilo")) {
        url.searchParams.delete("estilo");
        window.history.replaceState(null, "", url);
      }
      setEstilo(id);
    },
    [resolvedTheme],
  );

  const indice = Math.max(0, ESTILOS_PREVIEW.findIndex((e) => e.id === estilo));
  const mover = useCallback(
    (delta: number) => {
      const n = ESTILOS_PREVIEW.length;
      aplicar(ESTILOS_PREVIEW[(indice + delta + n) % n].id);
    },
    [aplicar, indice],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "]") mover(1);
      else if (e.key === "[") mover(-1);
      else if (e.key === "Escape") setAbierto(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mover]);

  const caja: React.CSSProperties = {
    fontFamily: FUENTE,
    fontSize: 13,
    lineHeight: 1.3,
    color: "#f5f5f5",
    background: "rgba(17,17,17,0.94)",
    border: "1px solid rgba(255,255,255,0.15)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    borderRadius: 12,
    letterSpacing: "normal",
    textTransform: "none",
    fontWeight: 500,
    fontSizeAdjust: "none",
  };
  const boton: React.CSSProperties = {
    all: "unset",
    cursor: "pointer",
    padding: "6px 9px",
    borderRadius: 8,
    fontFamily: FUENTE,
  };

  if (minimizado) {
    return (
      <button
        type="button"
        onClick={() => setMinimizado(false)}
        title="Mostrar selector de estilos"
        style={{ ...caja, ...boton, position: "fixed", left: 12, bottom: 12, zIndex: 2147483000, padding: "8px 11px" }}
      >
        🎨
      </button>
    );
  }

  return (
    <div style={{ position: "fixed", left: 12, bottom: 12, zIndex: 2147483000 }}>
      {abierto && (
        <div
          role="listbox"
          aria-label="Estilos"
          style={{
            ...caja,
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: 0,
            width: 280,
            maxHeight: "70vh",
            overflowY: "auto",
            padding: 6,
          }}
        >
          {ESTILOS_PREVIEW.map((e, i) => {
            const activo = e.id === estilo;
            return (
              <button
                key={e.id}
                type="button"
                role="option"
                aria-selected={activo}
                onClick={() => {
                  aplicar(e.id);
                  setAbierto(false);
                }}
                style={{
                  ...boton,
                  display: "flex",
                  gap: 8,
                  width: "calc(100% - 18px)",
                  background: activo ? "#ff6b1a" : "transparent",
                  color: activo ? "#111" : "#f5f5f5",
                  fontWeight: activo ? 700 : 500,
                }}
              >
                <span style={{ opacity: 0.6, width: 18, textAlign: "right" }}>{i}</span>
                <span>{e.nombre}</span>
              </button>
            );
          })}
        </div>
      )}
      <div style={{ ...caja, display: "flex", alignItems: "center", gap: 2, padding: 4 }}>
        <button type="button" onClick={() => mover(-1)} title="Anterior ( [ )" style={boton}>
          ◀
        </button>
        <button
          type="button"
          onClick={() => setAbierto((a) => !a)}
          aria-expanded={abierto}
          title="Elegir estilo"
          style={{ ...boton, minWidth: 170, textAlign: "center", fontWeight: 700 }}
        >
          🎨 {indice}. {ESTILOS_PREVIEW[indice].nombre}
        </button>
        <button type="button" onClick={() => mover(1)} title="Siguiente ( ] )" style={boton}>
          ▶
        </button>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setMinimizado(true);
          }}
          title="Minimizar"
          style={{ ...boton, opacity: 0.6 }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
