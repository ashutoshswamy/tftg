import { Brand } from "@/components/brand";

// Frame for token pages (customer, driver, invoice, track). Phone first: a
// white brand bar, then one comfortable column on the grey ground.
export function PublicShell({
  children,
  width = "max-w-2xl",
}: {
  children: React.ReactNode;
  width?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="bg-panel px-5 py-3.5">
        <div className={`mx-auto ${width}`}>
          <Brand size={32} />
        </div>
      </header>
      <main className={`mx-auto w-full flex-1 px-4 py-6 sm:px-5 sm:py-8 ${width}`}>
        {children}
      </main>
    </div>
  );
}
