import type { LucideIcon } from "lucide-react";

export function EnConstruccion({
  icon: Icon,
  titulo,
  descripcion,
  modulo,
}: {
  icon: LucideIcon;
  titulo: string;
  descripcion: string;
  modulo: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
      <Icon className="text-muted-foreground size-8" />
      <h1 className="text-xl font-semibold tracking-tight">{titulo}</h1>
      <p className="text-muted-foreground max-w-sm text-sm">{descripcion}</p>
      <p className="text-muted-foreground text-xs">
        Planificado para {modulo} — ver
        docs/planes_extraidos/plan-de-construccion.md
      </p>
    </div>
  );
}
