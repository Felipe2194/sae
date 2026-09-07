import { useSyncExternalStore } from "react";

const suscribirNada = () => () => {};

// Reemplaza el patrón `useState(false) + useEffect(() => setMounted(true))`
// usado para esperar a pasar la hidratación (contenido que solo puede
// calcularse en el cliente: tema real, ids autoincrementales de dnd-kit,
// etc.). `useSyncExternalStore` resuelve esto sin setState-en-efecto: React
// ya sabe tratar la discrepancia entre `getServerSnapshot` (false, durante
// SSR/hidratación) y `getSnapshot` (true, en el cliente) como un caso
// especial, sin la re-render en cascada que señala la regla de lint
// `react-hooks/set-state-in-effect`.
export function useHasMounted(): boolean {
  return useSyncExternalStore(
    suscribirNada,
    () => true,
    () => false,
  );
}
