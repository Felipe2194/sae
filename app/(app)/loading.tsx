import { Skeleton } from "@/components/ui/skeleton";

// Se muestra al instante al navegar entre secciones, mientras el servidor
// arma la página (cada una consulta la base antes de responder). Sin esto el
// click en el menú no daba ninguna señal hasta que llegaba la página entera.
// El menú lateral y el encabezado no se vuelven a cargar: viven en el layout.
export default function Cargando() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Cargando">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
