import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  // El estado inicial tiene que ser el mismo en el server y en el primer
  // render del cliente (el server no tiene `window`). Arrancar en
  // `undefined` en vez de leer window.innerWidth acá evita un mismatch de
  // hidratación real en viewports angostos — el sidebar entero se remontaba
  // porque el server asumía desktop y el cliente, en el primer render,
  // llegaba a asumir mobile antes de que corriera ningún efecto.
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
