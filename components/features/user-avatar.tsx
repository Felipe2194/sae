import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";

export const AVATAR_COLOR_DEFAULT = "oklch(0.62 0.19 42)";

export type UsuarioAvatar = { id: string; nombre: string; avatar_color: string | null };

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function UserAvatar({
  nombre,
  avatarColor,
  size = "default",
  className,
}: {
  nombre: string;
  avatarColor: string | null;
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  return (
    <Avatar size={size} className={className} title={nombre}>
      <AvatarFallback
        className="font-semibold text-white"
        style={{ backgroundColor: avatarColor ?? AVATAR_COLOR_DEFAULT }}
      >
        {iniciales(nombre)}
      </AvatarFallback>
    </Avatar>
  );
}

// Stack de avatares superpuestos (responsable + co-asignados), con burbuja
// "+N" para lo que no entra en `max`.
export function UserAvatarStack({
  usuarios,
  size = "sm",
  max = 3,
}: {
  usuarios: UsuarioAvatar[];
  size?: "default" | "sm" | "lg";
  max?: number;
}) {
  if (usuarios.length === 0) return null;
  const visibles = usuarios.slice(0, max);
  const restantes = usuarios.length - visibles.length;

  return (
    <AvatarGroup>
      {visibles.map((u) => (
        <UserAvatar key={u.id} nombre={u.nombre} avatarColor={u.avatar_color} size={size} />
      ))}
      {restantes > 0 && <AvatarGroupCount>+{restantes}</AvatarGroupCount>}
    </AvatarGroup>
  );
}
