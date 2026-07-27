import { Users } from "lucide-react";
import { EnConstruccion } from "@/components/features/en-construccion";

export default function CoordinacionPage() {
  return (
    <EnConstruccion
      icon={Users}
      titulo="Panel del coordinador"
      descripcion="Métricas de tareas completadas y pendientes, carga por persona y por área, y bitácoras del equipo."
      modulo="M3.1"
    />
  );
}
