import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { InlineScript } from "@/components/inline-script";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SAE · UTN FRVM",
  description: "Sistema de Administración Estudiantil — UTN Facultad Regional Villa María",
};

// Debe coincidir con la resolución de tema de components/theme-provider.tsx.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");var resolved=(t==="light"||t==="dark")?t:(t==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):"dark");document.documentElement.classList.toggle("dark",resolved==="dark");document.documentElement.style.colorScheme=resolved;}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <InlineScript html={THEME_SCRIPT} />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
