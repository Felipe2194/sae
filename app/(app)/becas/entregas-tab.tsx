"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Circle, Copy, ExternalLink, Flag, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { mensajeDeError } from "@/lib/errores";
import {
  nombreCompleto,
  type Area,
  type Asignacion,
  type Entrega,
  type EstadoEntrega,
  type Estudiante,
  type Programa,
} from "@/lib/becas/tipos";
import { marcarEntrega } from "./actions";
import type { DatosBecas } from "./becas-cliente";
import { Selector } from "./selector";

const TODOS = "_";

function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

type Fila = { beca: Asignacion; estudiante: Estudiante; area: Area | null };

export function EntregasTab({
  anio,
  programas,
  entregas,
  asignaciones,
  estudiantes,
  areas,
  marcadas,
  esAdmin,
}: DatosBecas) {
  const [, startTransition] = useTransition();
  const programasConEntregas = useMemo(
    () => programas.filter((p) => entregas.some((e) => e.programa_id === p.id)),
    [programas, entregas],
  );
  const [programaId, setProgramaId] = useState(programasConEntregas[0]?.id ?? "");
  const [areaId, setAreaId] = useState(TODOS);
  const [tutor, setTutor] = useState(TODOS);
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [observando, setObservando] = useState<{ fila: Fila; entrega: Entrega } | null>(null);
  const [recordando, setRecordando] = useState<Entrega | null>(null);

  // Cambios ya enviados que todavía no volvieron del servidor, para que el
  // tilde se vea al instante. Clave "asignacion|entrega".
  const [enVuelo, setEnVuelo] = useState<Map<string, EstadoEntrega>>(new Map());

  const programa = programasConEntregas.find((p) => p.id === programaId) ?? programasConEntregas[0];
  const columnas = useMemo(
    () => (programa ? entregas.filter((e) => e.programa_id === programa.id) : []),
    [entregas, programa],
  );

  const estudiantePorId = useMemo(() => new Map(estudiantes.map((e) => [e.id, e])), [estudiantes]);
  const areaPorId = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);
  const marcadaPorClave = useMemo(
    () => new Map(marcadas.map((m) => [`${m.asignacion_id}|${m.entrega_id}`, m])),
    [marcadas],
  );

  const estadoDe = (becaId: string, entregaId: string): EstadoEntrega => {
    const clave = `${becaId}|${entregaId}`;
    return enVuelo.get(clave) ?? marcadaPorClave.get(clave)?.estado ?? "pendiente";
  };

  // Becas activas del programa elegido, con su estudiante y área.
  const filasPrograma = useMemo<Fila[]>(() => {
    if (!programa) return [];
    return asignaciones
      .filter((a) => a.programa_id === programa.id && a.estado === "activa")
      .flatMap((beca) => {
        const estudiante = estudiantePorId.get(beca.estudiante_id);
        if (!estudiante) return [];
        return [{ beca, estudiante, area: beca.area_id ? (areaPorId.get(beca.area_id) ?? null) : null }];
      })
      .sort((x, y) => nombreCompleto(x.estudiante).localeCompare(nombreCompleto(y.estudiante), "es"));
  }, [asignaciones, programa, estudiantePorId, areaPorId]);

  const areasDelPrograma = useMemo(() => {
    const ids = new Set(filasPrograma.map((f) => f.area?.id).filter(Boolean));
    return areas.filter((a) => ids.has(a.id));
  }, [filasPrograma, areas]);
  const tutores = useMemo(
    () => [...new Set(areasDelPrograma.map((a) => a.tutor_nombre).filter((t): t is string => !!t))].sort(),
    [areasDelPrograma],
  );

  const filas = filasPrograma.filter((f) => {
    if (areaId !== TODOS && f.area?.id !== areaId) return false;
    if (tutor !== TODOS && f.area?.tutor_nombre !== tutor) return false;
    if (soloPendientes && columnas.every((c) => estadoDe(f.beca.id, c.id) === "recibida")) return false;
    return true;
  });

  function marcar(fila: Fila, entrega: Entrega, estado: EstadoEntrega, observacion: string | null) {
    const clave = `${fila.beca.id}|${entrega.id}`;
    setEnVuelo((m) => new Map(m).set(clave, estado));
    startTransition(async () => {
      try {
        const r = await marcarEntrega(fila.beca.id, entrega.id, estado, observacion);
        if ("error" in r) toast.error(r.error);
      } catch (err) {
        toast.error(mensajeDeError(err, "No se pudo marcar la entrega."));
      }
      setEnVuelo((m) => {
        const copia = new Map(m);
        copia.delete(clave);
        return copia;
      });
    });
  }

  if (programasConEntregas.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <p className="font-medium">Ningún programa tiene entregas definidas para {anio}</p>
          <p className="text-muted-foreground max-w-md text-sm">
            Una entrega es algo que cada becario tiene que presentar (por ejemplo, &ldquo;Informe
            septiembre&rdquo;).{" "}
            {esAdmin
              ? "Definilas en la pestaña Programas y acá vas a poder tildar quién ya entregó."
              : "Las define un administrador en la pestaña Programas."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Selector
          ariaLabel="Programa"
          className="w-56"
          value={programa.id}
          onChange={(v) => {
            setProgramaId(v);
            setAreaId(TODOS);
            setTutor(TODOS);
          }}
          opciones={programasConEntregas.map((p) => ({ value: p.id, label: p.nombre }))}
        />
        <Selector
          ariaLabel="Área"
          className="w-52"
          value={areaId}
          onChange={setAreaId}
          opciones={[
            { value: TODOS, label: "Todas las áreas" },
            ...areasDelPrograma.map((a) => ({ value: a.id, label: a.nombre })),
          ]}
        />
        <Selector
          ariaLabel="Tutor"
          className="w-52"
          value={tutor}
          onChange={setTutor}
          opciones={[{ value: TODOS, label: "Todos los tutores" }, ...tutores.map((t) => ({ value: t, label: t }))]}
        />
        <label className="flex cursor-pointer items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={soloPendientes}
            onChange={(e) => setSoloPendientes(e.target.checked)}
            className="accent-primary size-4"
          />
          Solo con pendientes
        </label>
      </div>

      <Card>
        <CardContent className="p-0">
          {filas.length === 0 ? (
            <p className="text-muted-foreground px-4 py-10 text-center text-sm">
              {filasPrograma.length === 0
                ? `No hay becarios activos de ${programa.nombre} en ${anio}.`
                : "No hay becarios que coincidan con ese filtro."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left align-bottom text-xs">
                    <th className="text-muted-foreground px-3 py-2 font-medium">Becario</th>
                    {columnas.map((c) => {
                      const recibidas = filasPrograma.filter(
                        (f) => estadoDe(f.beca.id, c.id) === "recibida",
                      ).length;
                      return (
                        <th key={c.id} className="px-3 py-2 font-medium">
                          <div className="flex flex-col gap-0.5">
                            <span>{c.nombre}</span>
                            <span className="text-muted-foreground font-normal">
                              {c.vence_el ? `Vence ${fechaCorta(c.vence_el)} · ` : ""}
                              {recibidas}/{filasPrograma.length}
                              {c.a_cargo === "tutor" ? " · del tutor" : ""}
                            </span>
                            <Button
                              size="xs"
                              variant="outline"
                              className="mt-1 w-fit"
                              onClick={() => setRecordando(c)}
                            >
                              <Mail className="size-3" />
                              Recordatorio
                            </Button>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.beca.id} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <p className="font-medium">{nombreCompleto(f.estudiante)}</p>
                        <p className="text-muted-foreground text-xs">
                          {[f.area?.nombre, f.area?.tutor_nombre].filter(Boolean).join(" · ") ||
                            "Sin área asignada"}
                        </p>
                      </td>
                      {columnas.map((c) => {
                        const estado = estadoDe(f.beca.id, c.id);
                        const nota = marcadaPorClave.get(`${f.beca.id}|${c.id}`)?.observacion;
                        return (
                          <td key={c.id} className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  estado === "observada"
                                    ? setObservando({ fila: f, entrega: c })
                                    : marcar(f, c, estado === "recibida" ? "pendiente" : "recibida", null)
                                }
                                title={estado === "observada" && nota ? nota : undefined}
                                className={cn(
                                  "flex h-8 min-w-28 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors",
                                  estado === "recibida" &&
                                    "border-green-300 bg-green-100 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-200",
                                  estado === "observada" &&
                                    "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
                                  estado === "pendiente" && "text-muted-foreground hover:bg-muted",
                                )}
                              >
                                {estado === "recibida" && <Check className="size-3.5" />}
                                {estado === "observada" && <Flag className="size-3.5" />}
                                {estado === "pendiente" && <Circle className="size-3.5" />}
                                {estado === "recibida" ? "Recibida" : estado === "observada" ? "Observada" : "Pendiente"}
                              </button>
                              {estado !== "observada" && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-muted-foreground size-7"
                                  aria-label="Observar"
                                  title="Marcar como observada (le falta algo)"
                                  onClick={() => setObservando({ fila: f, entrega: c })}
                                >
                                  <Flag className="size-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {observando && (
        <ObservarDialog
          key={`${observando.fila.beca.id}|${observando.entrega.id}`}
          nombre={nombreCompleto(observando.fila.estudiante)}
          entrega={observando.entrega}
          notaInicial={
            marcadaPorClave.get(`${observando.fila.beca.id}|${observando.entrega.id}`)?.observacion ?? ""
          }
          yaObservada={estadoDe(observando.fila.beca.id, observando.entrega.id) === "observada"}
          onMarcar={(estado, nota) => {
            marcar(observando.fila, observando.entrega, estado, nota);
            setObservando(null);
          }}
          onClose={() => setObservando(null)}
        />
      )}

      {recordando && (
        <RecordatorioDialog
          key={recordando.id}
          anio={anio}
          programa={programa}
          entrega={recordando}
          // Deben la entrega: todo lo que no esté recibido (pendiente u observada).
          deudores={filasPrograma.filter((f) => estadoDe(f.beca.id, recordando.id) !== "recibida")}
          onClose={() => setRecordando(null)}
        />
      )}
    </div>
  );
}

function ObservarDialog({
  nombre,
  entrega,
  notaInicial,
  yaObservada,
  onMarcar,
  onClose,
}: {
  nombre: string;
  entrega: Entrega;
  notaInicial: string;
  yaObservada: boolean;
  onMarcar: (estado: EstadoEntrega, nota: string | null) => void;
  onClose: () => void;
}) {
  const [nota, setNota] = useState(notaInicial);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Observar entrega</DialogTitle>
          <DialogDescription>
            {entrega.nombre} · {nombre}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Qué le falta</Label>
          <Textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={3}
            placeholder="Ej: falta la firma del tutor"
            autoFocus
          />
        </div>
        <DialogFooter className="gap-2">
          {yaObservada && (
            <>
              <Button variant="ghost" onClick={() => onMarcar("pendiente", null)}>
                Volver a pendiente
              </Button>
              <Button variant="outline" onClick={() => onMarcar("recibida", null)}>
                Marcar recibida
              </Button>
            </>
          )}
          <Button onClick={() => onMarcar("observada", nota.trim() || null)}>
            {yaObservada ? "Guardar" : "Marcar observada"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Largo máximo razonable de una URL para que el navegador y Gmail la acepten.
const MAX_URL = 1900;

function RecordatorioDialog({
  anio,
  programa,
  entrega,
  deudores,
  onClose,
}: {
  anio: number;
  programa: Programa;
  entrega: Entrega;
  deudores: Fila[];
  onClose: () => void;
}) {
  // Si la entrega es del tutor, el recordatorio va a los tutores de las
  // áreas que deben; si no, a los becarios.
  const paraTutores = entrega.a_cargo === "tutor";
  const { mails, sinMail } = useMemo(() => {
    const mails = new Set<string>();
    const sinMail = new Set<string>();
    for (const f of deudores) {
      if (paraTutores) {
        if (f.area?.tutor_email) mails.add(f.area.tutor_email);
        else sinMail.add(f.area?.tutor_nombre ?? `Tutor de ${nombreCompleto(f.estudiante)}`);
      } else if (f.estudiante.email) mails.add(f.estudiante.email);
      else sinMail.add(nombreCompleto(f.estudiante));
    }
    return { mails: [...mails], sinMail: [...sinMail] };
  }, [deudores, paraTutores]);

  const [asunto, setAsunto] = useState(`Recordatorio: ${entrega.nombre} · Beca ${programa.nombre} ${anio}`);
  const [cuerpo, setCuerpo] = useState(
    [
      "Estimado/a:",
      "",
      paraTutores
        ? `Le recordamos que se encuentra pendiente la entrega de "${entrega.nombre}" de los/as becarios/as a su cargo en la beca ${programa.nombre} ${anio}${entrega.vence_el ? `, con fecha límite el ${fechaCorta(entrega.vence_el)}` : ""}.`
        : `Le recordamos que se encuentra pendiente la entrega de "${entrega.nombre}" correspondiente a la beca ${programa.nombre} ${anio}${entrega.vence_el ? `, con fecha límite el ${fechaCorta(entrega.vence_el)}` : ""}.`,
      "",
      "Por favor, envíela a la brevedad respondiendo a este correo. Si ya la presentó, desestime este mensaje.",
      "",
      "Ante cualquier inquietud, no dude en consultar.",
      "",
      "Saludos cordiales,",
      "Secretaría de Asuntos Estudiantiles",
    ].join("\n"),
  );

  const destinatarios = mails.join(", ");

  async function copiar(texto: string, queEs: string) {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(`${queEs} en el portapapeles.`);
    } catch {
      toast.error("No se pudo copiar. Seleccioná el texto y copialo a mano.");
    }
  }

  // Los destinatarios van en CCO para que no se vean entre sí. Si son
  // tantos que la URL quedaría demasiado larga, el link abre el mensaje sin
  // ellos y se pegan a mano con "Copiar destinatarios".
  const base = `su=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
  const conCco = `https://mail.google.com/mail/?view=cm&fs=1&bcc=${encodeURIComponent(mails.join(","))}&${base}`;
  const entranEnElLink = conCco.length <= MAX_URL;
  const urlGmail = entranEnElLink ? conCco : `https://mail.google.com/mail/?view=cm&fs=1&${base}`;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Recordatorio · {entrega.nombre}</DialogTitle>
          <DialogDescription>
            {deudores.length === 0
              ? "Nadie debe esta entrega."
              : `${deudores.length} becario${deudores.length !== 1 ? "s deben" : " debe"} esta entrega. El mensaje no se envía desde acá: copialo o abrilo en el correo.`}
          </DialogDescription>
        </DialogHeader>

        {deudores.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs">
                  Destinatarios ({mails.length}) {paraTutores ? "· tutores" : ""} — pegalos en CCO
                </Label>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={mails.length === 0}
                  onClick={() => copiar(destinatarios, "Destinatarios")}
                >
                  <Copy className="size-3" />
                  Copiar destinatarios
                </Button>
              </div>
              <Textarea readOnly value={destinatarios} rows={3} className="text-xs" />
              {sinMail.length > 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Sin mail cargado ({sinMail.length}): {sinMail.join("; ")}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Asunto</Label>
              <Input value={asunto} onChange={(e) => setAsunto(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs">Mensaje</Label>
                <Button size="xs" variant="outline" onClick={() => copiar(cuerpo, "Mensaje")}>
                  <Copy className="size-3" />
                  Copiar mensaje
                </Button>
              </div>
              <Textarea value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} rows={10} />
            </div>
            {!entranEnElLink && (
              <p className="text-muted-foreground text-xs">
                Son muchos destinatarios para incluirlos en el link: &ldquo;Abrir en Gmail&rdquo; abre el
                mensaje y los destinatarios se pegan con &ldquo;Copiar destinatarios&rdquo;.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
          {deudores.length > 0 && (
            <Button
              nativeButton={false}
              render={<a href={urlGmail} target="_blank" rel="noopener noreferrer" />}
            >
              <ExternalLink className="size-4" />
              Abrir en Gmail
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
