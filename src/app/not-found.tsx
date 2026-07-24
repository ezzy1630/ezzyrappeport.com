import Link from "next/link";
import PortfolioShell from "@/components/portfolio/PortfolioShell";

export default function NotFound() {
  return (
    <PortfolioShell heroName={false} showNav routeMode="index">
      <main id="main-content" className="not-found" data-depth-band="shallow" data-water-section="surface">
        <div className="not-found__water" aria-hidden="true" />
        <div className="not-found__copy">
          <p className="not-found__eyebrow">404</p>
          <h1>Drifted off the map</h1>
          <p>
            This page left the shallows. The water is still here. Return to the
            surface and keep diving.
          </p>
          <Link
            href="/"
            className="not-found__cta rv-pill-fill"
            data-liquid-hover
            data-magnetic="button"
          >
            <span data-magnetic-label>Return to the surface</span>
          </Link>
        </div>
      </main>
    </PortfolioShell>
  );
}
