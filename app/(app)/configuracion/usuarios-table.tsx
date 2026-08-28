"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { KeyRound, Monitor, Trash2, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  cambiarEstadoUsuario,
  cambiarRolUsuario,
  eliminarUsuario,
  marcarCuentaGenerica,
  resetearPassword,
} from "./actions";

export type UsuarioFila = {
  id: string;
  nombre: string;
  email: string;
  rol: "miembro" | "administrador";
  estado: "pendiente" | "activo" | "inactivo";
  creada_en: string;
  es_cuenta_generica: boolean;
};

const ESTADO_BADGE: Record<
  UsuarioFila["estado"],
  { label: string; className: string }
> = {
  pendiente: {
    label: "Pendiente",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  activo: {
    label: "Activo",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  inactivo: {
    label: "Inactivo",
    className: "bg-muted text-muted-foreground",
  },
};

const ROL_LABEL: Record<UsuarioFila["rol"], string> = {
  miembro: "Miembro",
  administrador: "Administrador",
};

// Lógica y estado compartidos entre la fila de tabla (desktop) y la tarjeta
// (mobile) — para no duplicar los handlers en dos componentes distintos.
function useUsuarioRowActions(usuario: UsuarioFila) {
  const [pending, startTransition] = useTransition();
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [isPendingReset, startReset] = useTransition();
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPendingDelete, startDelete] = useTransition();

  function aprobar() {
    startTransition(() => cambiarEstadoUsuario(usuario.id, "activo"));
  }

  function desactivar() {
    startTransition(() => cambiarEstadoUsuario(usuario.id, "inactivo"));
  }

  function reactivar() {
    startTransition(() => cambiarEstadoUsuario(usuario.id, "activo"));
  }

  function eliminar() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    startDelete(async () => {
      try {
        await eliminarUsuario(usuario.id);
        toast.success(`${usuario.nombre} eliminado.`);
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "No se pudo eliminar el usuario.",
        );
      }
      setConfirmDelete(false);
    });
  }

  function onRolChange(rol: string) {
    startTransition(() => cambiarRolUsuario(usuario.id, rol));
  }

  function toggleCuentaGenerica() {
    startTransition(() =>
      marcarCuentaGenerica(usuario.id, !usuario.es_cuenta_generica),
    );
  }

  function abrirReset() {
    setResetPasswordValue("");
    setResetError(null);
    setResetOpen(true);
  }

  function confirmarReset() {
    const elegida = resetPasswordValue.trim();
    if (elegida && elegida.length < 8) {
      setResetError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setResetError(null);
    startReset(async () => {
      try {
        const { passwordTemporal } = await resetearPassword(
          usuario.id,
          elegida || undefined,
        );
        setResetOpen(false);
        if (passwordTemporal) {
          setTempPassword(passwordTemporal);
        } else {
          toast.success("Contraseña actualizada.");
        }
      } catch (e) {
        setResetError(
          e instanceof Error ? e.message : "No se pudo resetear la contraseña.",
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

  return {
    pending,
    resetOpen,
    setResetOpen,
    resetPasswordValue,
    setResetPasswordValue,
    resetError,
    isPendingReset,
    tempPassword,
    setTempPassword,
    copiado,
    confirmDelete,
    setConfirmDelete,
    isPendingDelete,
    aprobar,
    desactivar,
    reactivar,
    eliminar,
    onRolChange,
    toggleCuentaGenerica,
    abrirReset,
    confirmarReset,
    copiarPassword,
  };
}

// Elegir una contraseña acá mismo (en vez de solo poder generar una al azar
// que se muestra una única vez) — perder esa temporal sin copiarla a tiempo
// dejaba a la persona sin poder entrar hasta que otro admin la reseteara de
// nuevo, mismo criterio que crear-usuario-dialog.tsx.
function ResetPasswordDialog({
  usuario,
  a,
}: {
  usuario: UsuarioFila;
  a: ReturnType<typeof useUsuarioRowActions>;
}) {
  const [ver, setVer] = useState(false);
  return (
    <Dialog open={a.resetOpen} onOpenChange={a.setResetOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Resetear contraseña</DialogTitle>
          <DialogDescription>
            Para {usuario.nombre}. Elegí una nueva o dejala en blanco para
            generar una temporal.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`reset-pw-${usuario.id}`} className="text-xs">
            Contraseña nueva
          </Label>
          <div className="relative">
            <Input
              id={`reset-pw-${usuario.id}`}
              type={ver ? "text" : "password"}
              value={a.resetPasswordValue}
              onChange={(e) => a.setResetPasswordValue(e.target.value)}
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
        {a.resetError && <p className="text-destructive text-xs">{a.resetError}</p>}
        <DialogFooter>
          <Button
            size="sm"
            onClick={a.confirmarReset}
            disabled={a.isPendingReset}
          >
            {a.isPendingReset ? "Guardando..." : "Resetear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PasswordDialog({
  usuario,
  tempPassword,
  setTempPassword,
  copiado,
  copiarPassword,
}: {
  usuario: UsuarioFila;
  tempPassword: string | null;
  setTempPassword: (v: string | null) => void;
  copiado: boolean;
  copiarPassword: () => void;
}) {
  return (
    <Dialog
      open={tempPassword !== null}
      onOpenChange={(v) => !v && setTempPassword(null)}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Contraseña restablecida</DialogTitle>
          <DialogDescription>
            Compartila con {usuario.nombre} de forma segura. No se va a poder
            ver de nuevo.
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
  );
}

function AccionesUsuario({
  usuario,
  esSelf,
  a,
}: {
  usuario: UsuarioFila;
  esSelf: boolean;
  a: ReturnType<typeof useUsuarioRowActions>;
}) {
  if (esSelf) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {usuario.estado === "pendiente" ? (
        <Button
          size="sm"
          onClick={a.aprobar}
          disabled={a.pending}
          className="h-8 text-xs"
        >
          Aprobar
        </Button>
      ) : usuario.estado === "activo" ? (
        <Button
          size="sm"
          variant="outline"
          onClick={a.desactivar}
          disabled={a.pending}
          className="text-destructive hover:text-destructive h-8 text-xs"
        >
          Desactivar
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={a.reactivar}
          disabled={a.pending}
          className="h-8 text-xs"
        >
          Reactivar
        </Button>
      )}

      {usuario.estado === "activo" && (
        <Button
          size="sm"
          variant="ghost"
          className={`h-8 text-xs ${usuario.es_cuenta_generica ? "text-primary" : "text-muted-foreground"}`}
          onClick={a.toggleCuentaGenerica}
          disabled={a.pending}
          title={
            usuario.es_cuenta_generica
              ? "Cuenta genérica de oficina — click para desmarcar"
              : "Marcar como cuenta genérica de oficina (para el selector de perfil rápido)"
          }
        >
          <Monitor className="size-3.5" />
        </Button>
      )}

      {usuario.estado !== "pendiente" && (
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground h-8 text-xs"
          onClick={a.abrirReset}
          title="Resetear contraseña"
        >
          <KeyRound className="size-3.5" />
        </Button>
      )}

      {/* Borrado definitivo — solo sobre cuentas ya inactivas, para no dar
          dos formas de "sacar a alguien del equipo" que se pisen. */}
      {usuario.estado === "inactivo" &&
        (a.confirmDelete ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-destructive text-xs">¿Eliminar para siempre?</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={() => a.setConfirmDelete(false)}
              disabled={a.isPendingDelete}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-8 text-xs"
              onClick={a.eliminar}
              disabled={a.isPendingDelete}
            >
              {a.isPendingDelete ? "Eliminando..." : "Eliminar"}
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive h-8 text-xs"
            onClick={a.eliminar}
            title="Eliminar usuario definitivamente"
          >
            <Trash2 className="size-3.5" />
          </Button>
        ))}
    </div>
  );
}

function RolUsuario({
  usuario,
  esSelf,
  a,
  className,
}: {
  usuario: UsuarioFila;
  esSelf: boolean;
  a: ReturnType<typeof useUsuarioRowActions>;
  className?: string;
}) {
  if (esSelf || usuario.estado !== "activo") {
    return (
      <span className="text-muted-foreground text-sm">
        {ROL_LABEL[usuario.rol]}
      </span>
    );
  }
  return (
    <Select
      value={usuario.rol}
      onValueChange={(rol) => rol && a.onRolChange(rol)}
      disabled={a.pending}
      items={{ miembro: "Miembro", administrador: "Administrador" }}
    >
      <SelectTrigger className={className ?? "h-8 w-36 text-xs"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="miembro">Miembro</SelectItem>
        <SelectItem value="administrador">Administrador</SelectItem>
      </SelectContent>
    </Select>
  );
}

function UsuarioRow({
  usuario,
  esSelf,
}: {
  usuario: UsuarioFila;
  esSelf: boolean;
}) {
  const a = useUsuarioRowActions(usuario);
  const badge = ESTADO_BADGE[usuario.estado];

  return (
    <tr className={`border-b last:border-0 ${a.pending ? "opacity-50" : ""}`}>
      <td className="px-4 py-3">
        <p className="text-sm leading-tight font-medium">
          {usuario.nombre}
          {esSelf && (
            <span className="text-muted-foreground ml-2 text-[11px] font-normal">
              (vos)
            </span>
          )}
          {usuario.es_cuenta_generica && (
            <Badge variant="outline" className="ml-2 align-middle text-[10px]">
              Cuenta de oficina
            </Badge>
          )}
        </p>
        <p className="text-muted-foreground text-xs">{usuario.email}</p>
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <Badge className={badge.className}>{badge.label}</Badge>
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <RolUsuario usuario={usuario} esSelf={esSelf} a={a} />
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <AccionesUsuario usuario={usuario} esSelf={esSelf} a={a} />
      </td>

      <ResetPasswordDialog usuario={usuario} a={a} />
      <PasswordDialog
        usuario={usuario}
        tempPassword={a.tempPassword}
        setTempPassword={a.setTempPassword}
        copiado={a.copiado}
        copiarPassword={a.copiarPassword}
      />
    </tr>
  );
}

function UsuarioCard({
  usuario,
  esSelf,
}: {
  usuario: UsuarioFila;
  esSelf: boolean;
}) {
  const a = useUsuarioRowActions(usuario);
  const badge = ESTADO_BADGE[usuario.estado];

  return (
    <div
      className={`flex flex-col gap-2.5 border-b p-4 last:border-0 ${a.pending ? "opacity-50" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm leading-tight font-medium">
            {usuario.nombre}
            {esSelf && (
              <span className="text-muted-foreground ml-2 text-[11px] font-normal">
                (vos)
              </span>
            )}
            {usuario.es_cuenta_generica && (
              <Badge
                variant="outline"
                className="ml-2 align-middle text-[10px]"
              >
                Cuenta de oficina
              </Badge>
            )}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {usuario.email}
          </p>
        </div>
        <Badge className={`shrink-0 ${badge.className}`}>{badge.label}</Badge>
      </div>

      <RolUsuario
        usuario={usuario}
        esSelf={esSelf}
        a={a}
        className="h-9 w-full text-sm"
      />

      <AccionesUsuario usuario={usuario} esSelf={esSelf} a={a} />

      <ResetPasswordDialog usuario={usuario} a={a} />
      <PasswordDialog
        usuario={usuario}
        tempPassword={a.tempPassword}
        setTempPassword={a.setTempPassword}
        copiado={a.copiado}
        copiarPassword={a.copiarPassword}
      />
    </div>
  );
}

export function UsuariosTable({
  usuarios,
  selfId,
}: {
  usuarios: UsuarioFila[];
  selfId: string;
}) {
  const pendientes = usuarios.filter((u) => u.estado === "pendiente");
  const resto = usuarios.filter((u) => u.estado !== "pendiente");
  const ordenados = [...pendientes, ...resto];

  if (ordenados.length === 0) {
    return (
      <p className="text-muted-foreground px-4 py-6 text-center text-sm">
        No hay usuarios.
      </p>
    );
  }

  return (
    <>
      {/* Desktop: tabla — alto acotado con scroll interno, para que una
          organización con muchos usuarios no estire toda la página. */}
      <div className="hidden max-h-96 overflow-auto md:block">
        <table className="w-full text-sm">
          <thead className="bg-card sticky top-0 z-10">
            <tr className="border-b">
              <th className="text-muted-foreground w-full px-4 py-3 text-left text-xs font-medium">
                Usuario
              </th>
              <th className="text-muted-foreground px-3 py-3 text-left text-xs font-medium whitespace-nowrap">
                Estado
              </th>
              <th className="text-muted-foreground px-3 py-3 text-left text-xs font-medium whitespace-nowrap">
                Rol
              </th>
              <th className="text-muted-foreground px-3 py-3 text-left text-xs font-medium whitespace-nowrap">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {ordenados.map((u) => (
              <UsuarioRow key={u.id} usuario={u} esSelf={u.id === selfId} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: tarjetas — la tabla con 4 columnas no entra sin cortar Rol */}
      <div className="max-h-96 overflow-y-auto md:hidden">
        {ordenados.map((u) => (
          <UsuarioCard key={u.id} usuario={u} esSelf={u.id === selfId} />
        ))}
      </div>
    </>
  );
}
