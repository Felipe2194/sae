"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { crearOrganizacion } from "./actions";

function slugify(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function NuevaOrganizacionForm() {
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTocado, setSlugTocado] = useState(false);
  const [adminNombre, setAdminNombre] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ passwordTemporal: string; email: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  function onNombreChange(v: string) {
    setNombre(v);
    if (!slugTocado) setSlug(slugify(v));
  }

  function resetForm() {
    setNombre("");
    setSlug("");
    setSlugTocado(false);
    setAdminNombre("");
    setAdminEmail("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nombre.trim() || !slug.trim() || !adminNombre.trim() || !adminEmail.trim()) return;

    startTransition(async () => {
      try {
        const { passwordTemporal } = await crearOrganizacion({
          nombre,
          slug,
          adminNombre,
          adminEmail,
        });
        setResultado({ passwordTemporal, email: adminEmail.trim().toLowerCase() });
        resetForm();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo crear la organización");
      }
    });
  }

  function copiarPassword() {
    if (!resultado) return;
    navigator.clipboard.writeText(resultado.passwordTemporal);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nombre" className="text-xs">Nombre de la organización</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => onNombreChange(e.target.value)}
              placeholder="Secretaría de Bienestar Estudiantil"
              required
              className="h-9 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slug" className="text-xs">Slug</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => {
                setSlug(slugify(e.target.value));
                setSlugTocado(true);
              }}
              placeholder="secretaria-de-bienestar"
              required
              className="h-9 text-sm font-mono"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adminNombre" className="text-xs">Nombre de la cuenta genérica</Label>
            <Input
              id="adminNombre"
              value={adminNombre}
              onChange={(e) => setAdminNombre(e.target.value)}
              placeholder="Secretaría de Bienestar"
              required
              className="h-9 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adminEmail" className="text-xs">Email</Label>
            <Input
              id="adminEmail"
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="bienestar@frvm.utn.edu.ar"
              required
              className="h-9 text-sm"
            />
          </div>
        </div>

        {error && <p className="text-destructive text-xs">{error}</p>}

        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Creando…" : "Crear organización"}
          </Button>
        </div>
      </form>

      <Dialog open={resultado !== null} onOpenChange={(v) => !v && setResultado(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Organización creada</DialogTitle>
            <DialogDescription>
              Contraseña temporal para {resultado?.email}. No se va a poder ver de nuevo — compartila por un canal seguro.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg border bg-muted px-3 py-2 text-sm font-mono tracking-wide">
              {resultado?.passwordTemporal}
            </code>
            <Button size="sm" variant="outline" onClick={copiarPassword} className="h-9 shrink-0">
              {copiado ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
