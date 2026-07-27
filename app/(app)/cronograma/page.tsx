import { Clock } from "lucide-react";
import { EnConstruccion } from "@/components/features/en-construccion";

export default function CronogramaPage() {
  return (
    <EnConstruccion
      icon={Clock}
      titulo="Cronograma semanal"
      descripcion="Grilla de lunes a viernes con quién cubre cada franja horaria."
      modulo="M2.1"
    />
  );
}
