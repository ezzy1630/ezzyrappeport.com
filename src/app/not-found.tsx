import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found">
      <div className="not-found__water" aria-hidden="true" />
      <div className="not-found__copy">
        <p className="not-found__eyebrow">404</p>
        <h1>Drifted off the map</h1>
        <p>
          This page left the shallows. The water is still here — return to the
          surface and keep diving.
        </p>
        <Link href="/" className="not-found__cta" data-liquid-hover>
          Return to the surface
        </Link>
      </div>
    </main>
  );
}
