import { Settings } from "lucide-react";
import { EnConstruccion } from "@/components/features/en-construccion";

export default function AdminPage() {
  return (
    <EnConstruccion
      icon={Settings}
      titulo="Administración"
      descripcion="Aprobar registros pendientes, gestionar áreas y accesos rápidos, configurar la organización."
      modulo="M1.2"
    />
  );
}
