"use client";

import { useRef, useState } from "react";
import { Play, Pause, Radio, Volume2, VolumeX, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Radio de fondo para la oficina — no requiere ninguna cuenta ni credencial.
// Configurable por si se quiere apuntar a otra emisora sin tocar código.
const STREAM_URL =
  process.env.NEXT_PUBLIC_RADIO_STREAM_URL ?? "https://ice1.somafm.com/groovesalad-128-mp3";
const NOMBRE_ESTACION = process.env.NEXT_PUBLIC_RADIO_NOMBRE ?? "Groove Salad · SomaFM (lofi)";

export function MusicWidget() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [muteado, setMuteado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;

    if (reproduciendo) {
      audio.pause();
      setReproduciendo(false);
      return;
    }

    setCargando(true);
    setError(false);
    audio
      .play()
      .then(() => setReproduciendo(true))
      .catch(() => setError(true))
      .finally(() => setCargando(false));
  }

  function toggleMute() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setMuteado(audio.muted);
  }

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Radio className="size-3.5 text-muted-foreground" />
          Música de la oficina
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex items-center gap-3">
        <Button
          size="icon-sm"
          variant={reproduciendo ? "default" : "outline"}
          onClick={toggle}
          disabled={cargando}
          aria-label={reproduciendo ? "Pausar" : "Reproducir"}
          className="shrink-0"
        >
          {cargando ? (
            <Loader2 className="size-4 animate-spin" />
          ) : reproduciendo ? (
            <Pause className="size-4" />
          ) : (
            <Play className="size-4" />
          )}
        </Button>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{NOMBRE_ESTACION}</p>
          <p className="text-[11px] text-muted-foreground">
            {error
              ? "No se pudo conectar al stream"
              : reproduciendo
                ? "En vivo"
                : "Pausado"}
          </p>
        </div>

        <button
          onClick={toggleMute}
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-label={muteado ? "Activar sonido" : "Silenciar"}
        >
          {muteado ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>

        {/* Stream en vivo sin pista de texto disponible */}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio ref={audioRef} src={STREAM_URL} preload="none" />
      </CardContent>
    </Card>
  );
}
