"use client";

import { useMemo, useState } from "react";
import { Music2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Música de fondo para la oficina vía embeds oficiales de YouTube en modo
// privacy-enhanced (youtube-nocookie.com) — no requiere cuenta ni credencial,
// y usa los controles nativos del reproductor (play/pausa/volumen), no hace
// falta reinventarlos. Además de la playlist por defecto de la org, cada
// persona puede guardar la suya en /perfil y elegirla acá.
const DEFAULT_ID = process.env.NEXT_PUBLIC_YOUTUBE_EMBED_ID ?? "PLOr_yJOt73B0";
const DEFAULT_NOMBRE = process.env.NEXT_PUBLIC_YOUTUBE_EMBED_NOMBRE ?? "Playlist de la SAE";

// Los IDs de playlist empiezan con "PL" y usan un formato de embed distinto
// al de un video/transmisión suelta — se detecta solo.
function embedSrcDesdeId(id: string): string {
  return id.startsWith("PL")
    ? `https://www.youtube-nocookie.com/embed/videoseries?list=${id}`
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

export function MusicWidget({ playlists, usuarioActualId }: Props) {
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

  return (
    <Collapsible defaultOpen={false}>
      <Card>
        <CollapsibleTrigger
          nativeButton={false}
          render={<CardHeader className="cursor-pointer select-none pb-2 pt-4 px-4" />}
        >
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Music2 className="size-3.5 text-muted-foreground" />
            Música de la oficina
          </CardTitle>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="flex flex-col gap-2 px-4 pb-4">
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
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
