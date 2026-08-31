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
// setShuffle() no hace nada si se llama mientras el player todavía está
// cargando el primer video de la playlist (documentado: "This function has
// no effect if you call it while the video player is loading the first
// video in the playlist") — y cuePlaylist() dispara esa carga de forma
// asíncrona, así que llamarlo justo después, en el mismo tick, cae siempre
// en esa ventana muerta. Por eso el fix anterior (setShuffle pegado a
// cuePlaylist) no cambiaba nada. Se llama en cambio desde onStateChange,
// cuando el player realmente ya llegó al estado "cued" (5).
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
  const claveAlmacenamiento = `sae:musica:seleccion:${usuarioActualId}`;

  // Se recuerda qué playlist eligió cada usuario (por perfil) para que no se
  // pierda al recargar la página o navegar — sin esto, el player siempre
  // volvía a arrancar con la playlist propia (si existía) ignorando que el
  // usuario había elegido la de la SAE u otra persona.
  const [seleccion, setSeleccionEstado] = useState(() => {
    if (typeof window !== "undefined") {
      const guardada = window.localStorage.getItem(claveAlmacenamiento);
      if (guardada) return guardada;
    }
    return tienePlaylistPropia ? usuarioActualId : "_default";
  });

  const setSeleccion = (v: string) => {
    setSeleccionEstado(v);
    window.localStorage.setItem(claveAlmacenamiento, v);
  };

  const actual = opciones.find((o) => o.value === seleccion) ?? opciones[0];
  const items = Object.fromEntries(opciones.map((o) => [o.value, o.label]));

  const [abierto, setAbierto] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTGlobal>(null);
  // Evita procesar como "primer cueo" el segundo evento CUED que dispara
  // el propio cuePlaylist() de más abajo (el que reposiciona el índice
  // aleatorio) — sin esto, ese segundo CUED intentaría elegir otro índice
  // random de nuevo, y encima seguiría reentrando indefinidamente.
  const saltandoIndiceRef = useRef(false);

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
          // No en onReady/cuePlaylist: ver comentario sobre setShuffle más
          // arriba. Se reafirma cada vez que se vuelve a este estado (cada
          // cuePlaylist nuevo, incluido un cambio de selección).
          //
          // setShuffle(true) por sí solo NO alcanza para que arranque en un
          // tema al azar: solo reordena qué sigue después del video ya
          // cueado (que cuePlaylist siempre deja en el índice 0 — se probó
          // recargando varias veces, siempre el mismo primer tema). Para que
          // el arranque también sea al azar hay que saltar nosotros a un
          // índice random una vez que getPlaylist() ya tiene la lista
          // cargada — pero con cuePlaylist({ index }) y NO con
          // playVideoAt(), que sí arranca la reproducción (eso hacía sonar
          // música apenas se entraba al sistema, sin tocar play). cuePlaylist
          // deja el video cueado y en pausa, igual que el cueo inicial.
          onStateChange: (e: { data: number; target: YTGlobal }) => {
            if (e.data !== window.YT.PlayerState.CUED) return;
            if (saltandoIndiceRef.current) {
              saltandoIndiceRef.current = false;
              return;
            }
            e.target.setShuffle(true);
            const lista = e.target.getPlaylist?.();
            const listId = e.target.getPlaylistId?.();
            if (Array.isArray(lista) && lista.length > 1 && listId) {
              const indice = Math.floor(Math.random() * lista.length);
              saltandoIndiceRef.current = true;
              e.target.cuePlaylist({ listType: "playlist", list: listId, index: indice });
            }
          },
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
        <div className="w-72">
          {opciones.length > 1 && (
            <div className="p-3 pb-2">
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
            </div>
          )}
          {/* Sin padding: el video va al ras de los bordes del panel (ANCHO
              coincide con el w-72 del panel — si tuviera el mismo padding
              que el selector, el iframe de 288px se desbordaría del
              contenedor de 264px de contenido y quedaría recortado y
              descentrado por el overflow-hidden del panel). */}
          <div style={{ width: ANCHO, height: ALTO }}>
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
