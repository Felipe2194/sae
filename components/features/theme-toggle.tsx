"use client";

import { useTheme } from "@/components/theme-provider";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // Evita mismatch de hidratación: el tema real solo se conoce en el cliente.
  const mounted = useHasMounted();

  if (!mounted) {
    return <div className="size-8 shrink-0" aria-hidden />;
  }

  const esOscuro = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(esOscuro ? "light" : "dark")}
      aria-label={esOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={esOscuro ? "Modo claro" : "Modo oscuro"}
    >
      {esOscuro ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
