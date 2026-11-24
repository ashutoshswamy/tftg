import { Brand } from "@/components/brand";
import { LandingBars } from "@/components/landing-bars";

// Same backdrop as the landing page: the logo card, then the form on top of
// the moving columns. Clerk's own widgets (no title) bring their own white
// card; the plain pages pass a title and get a matching white card here.
export function AuthShell({
  title,
  intro,
  children,
}: {
  title?: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh flex-1 flex-col items-center justify-center gap-6 overflow-hidden bg-[#070c16] px-4 py-10">
      <LandingBars />

      <div className="relative rounded-2xl bg-white px-6 py-4 shadow-[0_12px_40px_rgba(7,12,22,0.45)]">
        <Brand size={44} />
      </div>

      {title ? (
        <section className="relative w-full max-w-[26rem] space-y-6 rounded-2xl bg-white p-7 shadow-[0_12px_40px_rgba(7,12,22,0.45)] sm:p-8">
          <div className="space-y-2">
            <h1 className="page-title">{title}</h1>
            {intro && <p className="text-muted">{intro}</p>}
          </div>
          {children}
        </section>
      ) : (
        <div className="relative w-full max-w-[25rem] [&_.cl-cardBox]:max-w-full [&_.cl-rootBox]:w-full [&_.cl-cardBox]:w-full">
          {children}
        </div>
      )}
    </main>
  );
}
