const LINE_1 = "ELIEZER";
const LINE_2 = "RAPPEPORT";

function HeroLine({ text, className }: { text: string; className?: string }) {
  return (
    <span className={`hero-name-fallback__line ${className ?? ""}`}>
      <span className="hero-name-fallback__word" data-text={text}>{text}</span>
    </span>
  );
}

/**
 * HeroName
 * --------
 * The visual hero name ("ELIEZER RAPPEPORT") is rendered inside the unified
 * fluid shader in `FluidScene` as submerged, refractive glass typography.
 *
 * This component provides:
 *  - a visually-hidden, screen-reader-accessible `<h1>` for SEO + a11y, and
 *  - a visible CSS "frosted-water" fallback name (`.hero-name-fallback`) that
 *    shows whenever the live WebGL renderer is NOT ready (e.g. WebGL2
 *    unavailable) and gracefully dissolves away once the shader takes over.
 */
export default function HeroName() {
  return (
    <>
      <h1 id="portfolio-title" className="sr-only" aria-label="Eliezer Rappeport">
        Eliezer Rappeport
      </h1>
      <div className="hero-name-fallback" aria-hidden="true">
        <HeroLine text={LINE_1} />
        <HeroLine text={LINE_2} />
      </div>
    </>
  );
}
