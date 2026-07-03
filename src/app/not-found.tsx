import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-x-hidden bg-[#f7f9fc] px-6">
      <div className="max-w-md text-center">
        <p className="mb-5 text-[11px] uppercase tracking-[0.28em] text-electric">404</p>
        <h1 className="font-display text-[56px] font-black leading-[0.95] tracking-[-0.03em] text-ink md:text-[80px]">
          Off the map
        </h1>
        <p className="mt-5 text-[15px] leading-[1.6] text-ink-soft/70">
          This page drifted away from the surface. Let&rsquo;s get you back.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-[13px] font-medium text-white transition hover:scale-[1.02]"
        >
          Return home
        </Link>
      </div>
    </main>
  );
}
