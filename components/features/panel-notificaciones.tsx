"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, CheckCheck, MessageSquare, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchNotificaciones,
  marcarLeida,
  marcarTodasLeidas,
  type NotificacionRow,
} from "@/app/(app)/notificaciones/actions";

function formatRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

const TIPO_ICON: Record<string, React.ElementType> = {
  tarea_asignada: UserCheck,
  comentario: MessageSquare,
};

export function PanelNotificaciones() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificacionRow[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    function cargar() {
      fetchNotificaciones().then(({ items, noLeidas }) => {
        if (!cancelled) {
          setItems(items);
          setNoLeidas(noLeidas);
        }
      });
    }
    cargar();
    // Polling cada 3 min — antes eran 30s, un costo innecesario de DB/red
    // para algo que no es urgente. Para compensar la menor frecuencia,
    // se refresca también al volver a la pestaña y al abrir el panel.
    const interval = setInterval(cargar, 3 * 60 * 1000);
    function alVolverAPestaña() {
      if (document.visibilityState === "visible") cargar();
    }
    document.addEventListener("visibilitychange", alVolverAPestaña);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", alVolverAPestaña);
    };
  }, []);

  useEffect(() => {
    if (open) {
      fetchNotificaciones().then(({ items, noLeidas }) => {
        setItems(items);
        setNoLeidas(noLeidas);
      });
    }
  }, [open]);

  function handleClick(n: NotificacionRow) {
    if (!n.leida) {
      startTransition(async () => {
        await marcarLeida(n.id);
        setItems((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, leida: true } : item)),
        );
        setNoLeidas((c) => Math.max(0, c - 1));
      });
    }
    setOpen(false);
    if (n.href) router.push(n.href);
  }

  function handleMarcarTodas() {
    startTransition(async () => {
      await marcarTodasLeidas();
      setItems((prev) => prev.map((n) => ({ ...n, leida: true })));
      setNoLeidas(0);
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center size-9 rounded-md hover:bg-muted transition-colors"
        aria-label="Notificaciones"
      >
        <Bell className="size-4" />
        {noLeidas > 0 && (
          <span className="absolute top-1 right-1 size-4 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center leading-none">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-xl border bg-card shadow-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="text-sm font-semibold">Notificaciones</span>
              {noLeidas > 0 && (
                <button
                  onClick={handleMarcarTodas}
                  disabled={pending}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <CheckCheck className="size-3.5" />
                  Marcar todas
                </button>
              )}
            </div>

            {/* Lista */}
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Bell className="size-7 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Sin notificaciones</p>
                </div>
              ) : (
                items.map((n) => {
                  const Icon = TIPO_ICON[n.tipo] ?? Bell;
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b last:border-b-0 ${
                        !n.leida ? "bg-primary/5" : ""
                      }`}
                    >
                      <div className={`mt-0.5 shrink-0 size-7 rounded-full flex items-center justify-center ${!n.leida ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        <Icon className="size-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-snug ${!n.leida ? "font-medium" : ""}`}>
                          {n.titulo}
                        </p>
                        {n.cuerpo && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {n.cuerpo}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {formatRelativo(n.creada_en)}
                        </p>
                      </div>
                      {!n.leida && (
                        <span className="mt-1.5 size-2 rounded-full bg-primary shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
