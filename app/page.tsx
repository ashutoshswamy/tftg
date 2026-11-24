import Link from "next/link";
import { Brand } from "@/components/brand";
import { LandingBars } from "@/components/landing-bars";

export default function Home() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-8 overflow-hidden bg-[#070c16] px-6">
      <LandingBars />

      <h1 className="sr-only">Too Far To Go</h1>
      <div className="relative rounded-2xl bg-white px-8 py-6 shadow-[0_12px_40px_rgba(7,12,22,0.45)]">
        <Brand size={56} />
      </div>

      <Link
        href="/dashboard"
        className="relative inline-flex h-12 items-center justify-center rounded-full bg-white px-8 text-base font-semibold text-ink shadow-[0_8px_24px_rgba(7,12,22,0.35)] transition-transform duration-200 hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white active:scale-[0.98]"
      >
        Sign in
      </Link>
    </main>
  );
}
