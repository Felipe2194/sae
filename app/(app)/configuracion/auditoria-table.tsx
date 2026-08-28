const ENTIDAD_LABEL: Record<string, string> = {
  usuario: "Usuario",
  area: "Proyecto",
  visita: "Visita",
  tarea: "Tarea",
};

export type AuditoriaFila = {
  id: string;
  creado_en: string;
  autor_nombre: string | null;
  entidad: string;
  entidad_nombre: string | null;
  campo: string;
  valor_antes: string | null;
  valor_despues: string | null;
};

function formatFechaHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Cambio({ antes, despues }: { antes: string | null; despues: string | null }) {
  if (antes && despues) {
    return (
      <span className="truncate">
        <span className="text-muted-foreground line-through">{antes}</span>{" "}
        →{" "}
        <span className="font-medium">{despues}</span>
      </span>
    );
  }
  if (despues) {
    return <span className="font-medium">{despues}</span>;
  }
  if (antes) {
    return <span className="text-muted-foreground line-through">{antes}</span>;
  }
  return <span className="text-muted-foreground">—</span>;
}

export function AuditoriaTable({ entradas }: { entradas: AuditoriaFila[] }) {
  if (entradas.length === 0) {
    return (
      <p className="text-muted-foreground px-4 py-6 text-center text-sm">
        Todavía no hay actividad registrada.
      </p>
    );
  }

  return (
    <>
      {/* Desktop: tabla — mismo patrón de alto acotado con scroll interno y
          encabezado fijo que Usuarios/Asignar tareas, para consistencia. */}
      <div className="hidden max-h-96 overflow-auto md:block">
        <table className="w-full text-sm">
          <thead className="bg-card sticky top-0 z-10">
            <tr className="border-b">
              <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium whitespace-nowrap">
                Fecha
              </th>
              <th className="text-muted-foreground px-3 py-3 text-left text-xs font-medium whitespace-nowrap">
                Quién
              </th>
              <th className="text-muted-foreground w-full px-3 py-3 text-left text-xs font-medium">
                Qué cambió
              </th>
            </tr>
          </thead>
          <tbody>
            {entradas.map((e) => (
              <tr key={e.id} className="border-b last:border-0">
                <td className="text-muted-foreground px-4 py-2.5 text-xs whitespace-nowrap">
                  {formatFechaHora(e.creado_en)}
                </td>
                <td className="px-3 py-2.5 text-sm whitespace-nowrap">
                  {e.autor_nombre ?? "—"}
                </td>
                <td className="px-3 py-2.5 text-sm">
                  <span className="text-muted-foreground">
                    {ENTIDAD_LABEL[e.entidad] ?? e.entidad}
                    {e.entidad_nombre && (
                      <>
                        {" "}
                        <span className="text-foreground font-medium">
                          {e.entidad_nombre}
                        </span>
                      </>
                    )}
                    {" — "}
                    {e.campo}:{" "}
                  </span>
                  <Cambio antes={e.valor_antes} despues={e.valor_despues} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: tarjetas */}
      <div className="max-h-96 divide-y overflow-y-auto md:hidden">
        {entradas.map((e) => (
          <div key={e.id} className="flex flex-col gap-1 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{e.autor_nombre ?? "—"}</span>
              <span className="text-muted-foreground text-xs whitespace-nowrap">
                {formatFechaHora(e.creado_en)}
              </span>
            </div>
            <p className="text-muted-foreground text-xs">
              {ENTIDAD_LABEL[e.entidad] ?? e.entidad}
              {e.entidad_nombre && (
                <> · <span className="text-foreground font-medium">{e.entidad_nombre}</span></>
              )}
              {" — "}
              {e.campo}
            </p>
            <p className="text-sm">
              <Cambio antes={e.valor_antes} despues={e.valor_despues} />
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
