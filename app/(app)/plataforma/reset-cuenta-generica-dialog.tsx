"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { KeyRound, Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { resetearPasswordCuentaGenerica } from "./actions";

// Única forma de recuperar el acceso a una organización si se perdió la
// contraseña de su cuenta genérica (se muestra una sola vez al crearla) —
// sin esto, la única salida era pedirle a alguien con acceso directo a la
// base que la reseteara a mano.
export function ResetCuentaGenericaDialog({
  usuarioId,
  nombre,
}: {
  usuarioId: string;
  nombre: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [ver, setVer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  function resetForm() {
    setPassword("");
    setVer(false);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const elegida = password.trim();
    if (elegida && elegida.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const { passwordTemporal } = await resetearPasswordCuentaGenerica(
          usuarioId,
          elegida || undefined,
        );
        setOpen(false);
        resetForm();
        if (passwordTemporal) {
          setTempPassword(passwordTemporal);
        } else {
          toast.success("Contraseña actualizada.");
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "No se pudo resetear la contraseña.",
        );
      }
    });
  }

  function copiarPassword() {
    if (!tempPassword) return;
    navigator.clipboard.writeText(tempPassword);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="text-muted-foreground h-8 text-xs"
        onClick={() => setOpen(true)}
        title={`Resetear contraseña de ${nombre}`}
      >
        <KeyRound className="size-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Resetear contraseña</DialogTitle>
            <DialogDescription>
              Cuenta genérica de {nombre}. Elegí una nueva o dejala en blanco
              para generar una temporal.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rcg-password" className="text-xs">
                Contraseña nueva
              </Label>
              <div className="relative">
                <Input
                  id="rcg-password"
                  type={ver ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Vacío = se genera una temporal"
                  minLength={8}
                  autoFocus
                  className="h-9 pr-9"
                />
                <button
                  type="button"
                  onClick={() => setVer((v) => !v)}
                  className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-9 items-center justify-center"
                  aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
                  tabIndex={-1}
                >
                  {ver ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
            </div>

            {error && <p className="text-destructive text-xs">{error}</p>}

            <DialogFooter>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? "Guardando..." : "Resetear"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={tempPassword !== null}
        onOpenChange={(v) => !v && setTempPassword(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Contraseña restablecida</DialogTitle>
            <DialogDescription>
              Compartila con {nombre} de forma segura. No se va a poder ver
              de nuevo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="bg-muted flex-1 rounded-lg border px-3 py-2 font-mono text-sm tracking-wide">
              {tempPassword}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={copiarPassword}
              className="h-9 shrink-0"
            >
              {copiado ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
