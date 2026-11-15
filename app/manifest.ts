import type { MetadataRoute } from "next";

// Permite "Agregar a la pantalla de inicio" en el celular: el sistema se abre
// como una app (sin la barra del navegador) directo en /hoy.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SAE · UTN FRVM",
    short_name: "SAE",
    description: "Sistema de Administración Estudiantil — UTN Facultad Regional Villa María",
    start_url: "/hoy",
    display: "standalone",
    background_color: "#0f0f10",
    theme_color: "#f5a705",
    lang: "es-AR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
