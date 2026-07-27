import { CalendarDays } from "lucide-react";
import { EnConstruccion } from "@/components/features/en-construccion";

export default function CalendarioPage() {
  return (
    <EnConstruccion
      icon={CalendarDays}
      titulo="Calendario"
      descripcion="Vista mensual y semanal con tareas y eventos de Google Calendar juntos."
      modulo="M2.4"
    />
  );
}
