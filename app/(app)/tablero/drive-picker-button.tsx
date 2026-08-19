"use client";

import { useState } from "react";
import { HardDrive, Loader2 } from "lucide-react";

// Las APIs de Google Identity Services y Picker no traen tipos oficiales;
// se cargan como scripts globales, no como paquete npm (ver
// docs/credenciales-pendientes.md sección 7).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GoogleGlobal = any;
declare global {
  interface Window {
    google?: GoogleGlobal;
    gapi?: GoogleGlobal;
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const PICKER_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY;
const SCOPE = "https://www.googleapis.com/auth/drive.file";

function cargarScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    document.head.appendChild(script);
  });
}

async function cargarPicker(): Promise<void> {
  await cargarScript("https://apis.google.com/js/api.js");
  await new Promise<void>((resolve) => window.gapi.load("picker", resolve));
}

async function cargarIdentityServices(): Promise<void> {
  await cargarScript("https://accounts.google.com/gsi/client");
}

type ArchivoElegido = { nombre: string; url: string };

export function DrivePickerButton({ onPicked }: { onPicked: (archivo: ArchivoElegido) => void }) {
  const [cargando, setCargando] = useState(false);

  if (!CLIENT_ID || !PICKER_API_KEY) return null;

  function abrirPicker(accessToken: string) {
    const picker = new window.google.picker.PickerBuilder()
      .addView(window.google.picker.ViewId.DOCS)
      .setOAuthToken(accessToken)
      .setDeveloperKey(PICKER_API_KEY)
      .setCallback((data: GoogleGlobal) => {
        if (data.action === window.google.picker.Action.PICKED) {
          const doc = data.docs[0];
          onPicked({ nombre: doc.name, url: doc.url });
        }
        if (data.action === window.google.picker.Action.PICKED || data.action === window.google.picker.Action.CANCEL) {
          setCargando(false);
        }
      })
      .build();
    picker.setVisible(true);
  }

  async function handleClick() {
    setCargando(true);
    try {
      await Promise.all([cargarIdentityServices(), cargarPicker()]);
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: (resp: GoogleGlobal) => {
          if (resp.error) {
            setCargando(false);
            return;
          }
          abrirPicker(resp.access_token);
        },
      });
      tokenClient.requestAccessToken();
    } catch {
      setCargando(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={cargando}
      className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 disabled:opacity-50"
    >
      {cargando ? <Loader2 className="size-3 animate-spin" /> : <HardDrive className="size-3" />}
      Drive
    </button>
  );
}
