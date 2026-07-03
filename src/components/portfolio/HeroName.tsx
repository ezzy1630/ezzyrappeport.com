"use client";

/**
 * HeroName
 * --------
 * The visual hero name ("ELIEZER RAPPEPORT") is rendered inside the unified
 * fluid shader in `FluidScene` as a submerged, refractive glass volume.
 *
 * This component provides:
 *  - a visually-hidden, screen-reader-accessible `<h1>` for SEO + a11y, and
 *  - a visible CSS "frosted-water" fallback name (`.hero-name-fallback`) that
 *    shows whenever the live WebGL renderer is NOT ready (e.g. WebGL2
 *    unavailable) and gracefully dissolves away once the shader takes over.
 *    Guarantees the name is always visible — no blank hero on fallback devices.
 */
export default function HeroName() {
  return (
    <>
      <h1 className="sr-only" aria-label="Eliezer Rappeport">
        Eliezer Rappeport
      </h1>
      <div className="hero-name-fallback" aria-hidden="true">
        <span className="hero-name-fallback__desktop">ELIEZER</span>
        <span className="hero-name-fallback__desktop">RAPPEPORT</span>
        <span className="hero-name-fallback__mobile">ELIEZER</span>
        <span className="hero-name-fallback__mobile">RAPPE</span>
        <span className="hero-name-fallback__mobile">PORT</span>
      </div>
    </>
  );
}
