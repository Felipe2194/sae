"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { UserPlus, Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { crearUsuario } from "./actions";

export function CrearUsuarioDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<"miembro" | "administrador">("miembro");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Solo se llega acá si NO se eligió una contraseña propia — se generó una
  // sola y se muestra una única vez, mismo patrón que resetearPassword (ver
  // usuarios-table.tsx). Si el admin ya escribió la suya, no hace falta
  // mostrar nada más: ya la sabe.
  const [creado, setCreado] = useState<{ nombre: string; passwordTemporal: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  function resetForm() {
    setNombre("");
    setEmail("");
    setRol("miembro");
    setPassword("");
    setVerPassword(false);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !email.trim()) return;
    if (password.trim() && password.trim().length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const { passwordTemporal } = await crearUsuario({
          nombre: nombre.trim(),
          email: email.trim(),
          rol,
          password: password.trim() || undefined,
        });
        if (passwordTemporal) {
          setCreado({ nombre: nombre.trim(), passwordTemporal });
        } else {
          toast.success(`${nombre.trim()} creado — ya puede iniciar sesión.`);
        }
        resetForm();
        setOpen(false);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "No se pudo crear el usuario.",
        );
      }
    });
  }

  function copiarPassword() {
    if (!creado) return;
    navigator.clipboard.writeText(creado.passwordTemporal);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="size-4" />
        Agregar usuario
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Agregar usuario</DialogTitle>
            <DialogDescription>
              Se crea ya activo. Elegí una contraseña o dejala en blanco para
              generar una temporal.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cu-nombre" className="text-xs">
                Nombre *
              </Label>
              <Input
                id="cu-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre y apellido"
                required
                autoFocus
                className="h-9"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cu-email" className="text-xs">
                Email *
              </Label>
              <Input
                id="cu-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@frvm.utn.edu.ar"
                required
                className="h-9"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cu-password" className="text-xs">
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="cu-password"
                  type={verPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Vacío = se genera una temporal"
                  minLength={8}
                  className="h-9 pr-9"
                />
                <button
                  type="button"
                  onClick={() => setVerPassword((v) => !v)}
                  className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-9 items-center justify-center"
                  aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  tabIndex={-1}
                >
                  {verPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
              <p className="text-muted-foreground text-xs">
                Si la escribís acá ya la sabés — no hace falta copiarla después.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Rol</Label>
              <Select
                value={rol}
                onValueChange={(v) => v && setRol(v as "miembro" | "administrador")}
                items={{ miembro: "Miembro", administrador: "Administrador" }}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="miembro">Miembro</SelectItem>
                  <SelectItem value="administrador">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && <p className="text-destructive text-xs">{error}</p>}

            <DialogFooter>
              <Button
                type="submit"
                disabled={isPending || !nombre.trim() || !email.trim()}
              >
                {isPending ? "Creando..." : "Crear usuario"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={creado !== null}
        onOpenChange={(v) => !v && setCreado(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Usuario creado</DialogTitle>
            <DialogDescription>
              Compartile esta contraseña a {creado?.nombre} de forma segura.
              No se va a poder ver de nuevo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="bg-muted flex-1 rounded-lg border px-3 py-2 font-mono text-sm tracking-wide">
              {creado?.passwordTemporal}
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
