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
        <div className="flex flex-col items-center gap-8 text-center">
          <div className="bg-white rounded-2xl px-8 py-5 shadow-lg">
            <Image
              src="/LogoUTN.png"
              alt="UTN Villa María"
              width={220}
              height={56}
              className="object-contain"
              priority
            />
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
        {/* Logo visible solo en mobile */}
        <div className="flex flex-col items-center gap-2 mb-8 lg:hidden">
          <Image
            src="/LogoUTN.png"
            alt="UTN Villa María"
            width={180}
            height={46}
            className="object-contain"
            priority
          />
          <p className="text-muted-foreground text-sm mt-1">Sistema de Administración Estudiantil</p>
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
