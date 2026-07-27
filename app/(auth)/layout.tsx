export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-md text-base font-semibold">
            S
          </div>
          <span className="font-semibold">SAE FRVM</span>
        </div>
        {children}
      </div>
    </div>
  );
}
