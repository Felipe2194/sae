"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Music2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Reproductor global de música de fondo — vive en el layout de (app), no en
// una página puntual, para que sobreviva la navegación entre secciones. El
// player nunca se desmonta: minimizar solo lo encoge a 0×0 con overflow
// hidden (nunca display:none ni un render condicional), así YouTube sigue
// reproduciendo aunque no se vea.
//
// El orden aleatorio de una playlist NO existe como parámetro de URL del
// embed (no hay "?shuffle=1" — se probó y no hace nada, YouTube no lo
// documenta). Lo único que lo habilita es la IFrame Player API
// (`player.setShuffle(true)`), así que el player se crea con
// `new YT.Player(...)` en vez de un <iframe src> estático.
//
// Las APIs de YouTube no traen tipos oficiales; se cargan como script
// global, no como paquete npm.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type YTGlobal = any;
declare global {
  interface Window {
    YT?: YTGlobal;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const DEFAULT_ID = process.env.NEXT_PUBLIC_YOUTUBE_EMBED_ID ?? "PLOr_yJOt73B0";
const DEFAULT_NOMBRE = process.env.NEXT_PUBLIC_YOUTUBE_EMBED_NOMBRE ?? "Playlist de la SAE";

// Tamaño fijo del embed — el panel flotante no es responsive (siempre w-72),
// así que le pasamos a la API el mismo tamaño en vez de dejar el default de
// YouTube (640x390, que desbordaría el panel).
const ANCHO = 288;
const ALTO = Math.round((ANCHO * 9) / 16);

let iframeApiPromise: Promise<void> | null = null;
function cargarIframeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (iframeApiPromise) return iframeApiPromise;
  iframeApiPromise = new Promise((resolve) => {
    const anterior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      anterior?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });
  return iframeApiPromise;
}

// Los IDs de playlist empiezan con "PL" y se cargan distinto a un video o
// transmisión suelta — se detecta solo.
function esPlaylist(id: string): boolean {
  return id.startsWith("PL");
}

function cuearOpcion(player: YTGlobal, embedId: string) {
  if (esPlaylist(embedId)) {
    player.cuePlaylist({ listType: "playlist", list: embedId });
    // No persiste entre cuePlaylist/loadPlaylist — hay que reafirmarlo cada
    // vez que se carga una playlist nueva (incluida la primera).
    player.setShuffle(true);
  } else {
    player.cueVideoById(embedId);
  }
}

// Extrae el ID de video o playlist de una URL de YouTube / YouTube Music en
// cualquiera de sus formatos habituales (watch?v=, playlist?list=, youtu.be/…).
function extraerEmbedId(url: string): string | null {
  try {
    const u = new URL(url);
    const list = u.searchParams.get("list");
    if (list) return list;
    const v = u.searchParams.get("v");
    if (v) return v;
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    return null;
  } catch {
    return null;
  }
}

export type PlaylistPersona = { usuarioId: string; nombre: string; url: string };

type Props = {
  playlists: PlaylistPersona[];
  usuarioActualId: string;
};

export function MusicPlayer({ playlists, usuarioActualId }: Props) {
  const opciones = useMemo(() => {
    const propias = playlists
      .map((p) => {
        const id = extraerEmbedId(p.url);
        if (!id) return null;
        const esPropia = p.usuarioId === usuarioActualId;
        return {
          value: p.usuarioId,
          label: esPropia ? "Tu playlist" : `Playlist de ${p.nombre.split(" ")[0]}`,
          embedId: id,
        };
      })
      .filter((o): o is NonNullable<typeof o> => o !== null);

    return [{ value: "_default", label: DEFAULT_NOMBRE, embedId: DEFAULT_ID }, ...propias];
  }, [playlists, usuarioActualId]);

  const tienePlaylistPropia = playlists.some((p) => p.usuarioId === usuarioActualId);
  const [seleccion, setSeleccion] = useState(
    tienePlaylistPropia ? usuarioActualId : "_default",
  );

  const actual = opciones.find((o) => o.value === seleccion) ?? opciones[0];
  const items = Object.fromEntries(opciones.map((o) => [o.value, o.label]));

  const [abierto, setAbierto] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTGlobal>(null);

  // Crea el player una sola vez (persiste mientras dure la sesión, no se
  // recrea al cambiar de playlist ni al navegar entre páginas).
  useEffect(() => {
    let cancelado = false;
    cargarIframeApi().then(() => {
      if (cancelado || !containerRef.current) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        width: ANCHO,
        height: ALTO,
        host: "https://www.youtube-nocookie.com",
        playerVars: { rel: 0 },
        events: {
          onReady: (e: { target: YTGlobal }) => cuearOpcion(e.target, actual.embedId),
        },
      });
    });
    return () => {
      cancelado = true;
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
    // Solo al montar: cambiar de playlist se maneja en el efecto de abajo
    // sobre el player ya creado, no recreándolo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cambiar de selección: recarga el player existente en vez de recrearlo.
  useEffect(() => {
    const player = playerRef.current;
    if (!player?.cuePlaylist) return; // todavía no está listo — onReady se ocupa
    cuearOpcion(player, actual.embedId);
  }, [actual.embedId]);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      <div
        className={`overflow-hidden rounded-xl border bg-card shadow-lg transition-all duration-200 ${
          abierto ? "w-72 h-auto opacity-100" : "size-0 border-transparent opacity-0"
        }`}
      >
        <div className="flex w-72 flex-col gap-2 p-3">
          {opciones.length > 1 && (
            <Select
              value={seleccion}
              onValueChange={(v) => setSeleccion(v ?? "_default")}
              items={items}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {opciones.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div
            className="overflow-hidden rounded-md"
            style={{ width: ANCHO, height: ALTO }}
          >
            <div ref={containerRef} />
          </div>
        </div>
      </div>

      <Button
        variant="default"
        size="icon"
        className="size-11 rounded-full shadow-lg"
        onClick={() => setAbierto((v) => !v)}
        aria-label={abierto ? "Minimizar música" : "Mostrar música"}
        title="Música"
      >
        {abierto ? <X className="size-5" /> : <Music2 className="size-5" />}
      </Button>
    </div>
  );
}
