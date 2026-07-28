import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 min-h-screen">
      {/* Panel izquierdo — identidad UTN */}
      <div className="hidden lg:flex lg:w-2/5 flex-col items-center justify-center bg-[oklch(0.62_0.19_42)] text-white p-12 gap-8">
        <div className="flex flex-col items-center gap-6 text-center">
          {/* Logo UTN — reemplazá "logo-utn.png" cuando lo exportes del .ai */}
          <div className="w-32 h-32 bg-white/15 rounded-2xl flex items-center justify-center">
            <Image
              src="/LogoUTN.png"
              alt="Logo UTN"
              width={110}
              height={110}
              className="object-contain"
              style={{ display: "block" }}
            />
          </div>
          <div>
            <p className="text-sm font-medium tracking-widest uppercase opacity-80">
              Universidad Tecnológica Nacional
            </p>
            <h1 className="text-3xl font-bold mt-1">Facultad Regional</h1>
            <h2 className="text-3xl font-bold">Villa María</h2>
          </div>
          <div className="border-t border-white/30 pt-6 w-full">
            <p className="text-lg font-semibold">SAE</p>
            <p className="text-sm opacity-75 mt-1">
              Sistema de Administración Estudiantil
            </p>
          </div>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex flex-1 flex-col items-center justify-center p-6">
        {/* Logo pequeño visible solo en mobile */}
        <div className="flex flex-col items-center gap-2 mb-8 lg:hidden">
          <div className="size-12 rounded-xl bg-[oklch(0.62_0.19_42)] flex items-center justify-center text-white text-xl font-bold">
            S
          </div>
          <div className="text-center">
            <p className="font-semibold text-base">SAE · UTN FRVM</p>
            <p className="text-muted-foreground text-sm">Facultad Regional Villa María</p>
          </div>
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
