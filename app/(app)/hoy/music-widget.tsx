"use client";

import { Music2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Música de fondo para la oficina vía un embed oficial de YouTube en modo
// privacy-enhanced (youtube-nocookie.com) — no requiere cuenta ni credencial,
// y usa los controles nativos del reproductor de YouTube (play/pausa/
// volumen), no hace falta reinventarlos. Configurable con el ID de un video
// o transmisión propia; por defecto un lofi 24/7 conocido y confiable.
const EMBED_ID = process.env.NEXT_PUBLIC_YOUTUBE_EMBED_ID ?? "5yx6BWlEVcY";
const NOMBRE =
  process.env.NEXT_PUBLIC_YOUTUBE_EMBED_NOMBRE ?? "Chillhop Radio — jazzy & lofi hip hop beats";

export function MusicWidget() {
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
            <div className="aspect-video w-full overflow-hidden rounded-md">
              <iframe
                className="size-full"
                src={`https://www.youtube-nocookie.com/embed/${EMBED_ID}?rel=0`}
                title={NOMBRE}
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            </div>
            <p className="truncate text-[11px] text-muted-foreground">{NOMBRE}</p>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
