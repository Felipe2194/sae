"use client";

import { useTransition } from "react";
import { asignarTarea } from "./actions";

type Usuario = { id: string; nombre: string };

export function AsignarSelect({
  tareaId,
  responsableId,
  usuarios,
}: {
  tareaId: string;
  responsableId: string | null;
  usuarios: Usuario[];
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    startTransition(() => asignarTarea(tareaId, val === "" ? null : val));
  }

  return (
    <select
      defaultValue={responsableId ?? ""}
      onChange={handleChange}
      disabled={isPending}
      className="text-sm border rounded-md px-2 py-1 bg-background text-foreground disabled:opacity-50 w-full max-w-[180px]"
    >
      <option value="">Sin asignar</option>
      {usuarios.map((u) => (
        <option key={u.id} value={u.id}>
          {u.nombre}
        </option>
      ))}
    </select>
  );
}
