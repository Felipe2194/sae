"use client";

import { useMemo, useState } from "react";
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
// iframe nunca se desmonta: minimizar solo lo encoge a 0×0 con overflow
// hidden (nunca display:none ni un render condicional), así YouTube sigue
// reproduciendo aunque no se vea. Embeds oficiales en modo privacy-enhanced
// (youtube-nocookie.com) — no requiere cuenta ni credencial, y usa los
// controles nativos del reproductor.
const DEFAULT_ID = process.env.NEXT_PUBLIC_YOUTUBE_EMBED_ID ?? "PLOr_yJOt73B0";
const DEFAULT_NOMBRE = process.env.NEXT_PUBLIC_YOUTUBE_EMBED_NOMBRE ?? "Playlist de la SAE";

// Los IDs de playlist empiezan con "PL" y usan un formato de embed distinto
// al de un video/transmisión suelta — se detecta solo. shuffle=1 hace que
// cada playlist arranque en orden aleatorio en vez de repetir siempre el
// mismo primer tema.
function embedSrcDesdeId(id: string): string {
  return id.startsWith("PL")
    ? `https://www.youtube-nocookie.com/embed/videoseries?list=${id}&shuffle=1`
    : `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
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
          <div className="aspect-video w-full overflow-hidden rounded-md">
            <iframe
              key={actual.embedId}
              className="size-full"
              src={embedSrcDesdeId(actual.embedId)}
              title={actual.label}
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
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
