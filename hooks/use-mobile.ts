import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;

function suscribirse(callback: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function leerValorActual() {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

// El server no tiene `window`: `getServerSnapshot` (undefined, tratado como
// "no mobile" más abajo) evita un mismatch de hidratación real en viewports
// angostos — el sidebar entero se remontaba porque el server asumía desktop
// y el cliente, en el primer render, llegaba a asumir mobile antes de que
// corriera ningún efecto. `useSyncExternalStore` resuelve esto sin el
// useState + useEffect manual de antes (que hacía un setState extra apenas
// montado, señalado por la regla de lint `react-hooks/set-state-in-effect`).
function leerValorServer() {
  return undefined;
}

export function useIsMobile() {
  const isMobile = useSyncExternalStore(
    suscribirse,
    leerValorActual,
    leerValorServer,
  );
  return !!isMobile;
}
