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
 * The visual hero name ("ELIEZER RAPPEPORT") is rendered as one restrained
 * CSS glass treatment above the ambient fluid background.
 *
 * This component provides:
 *  - a visually-hidden, screen-reader-accessible `<h1>` for SEO + a11y, and
 *  - a CSS fallback that yields to the single WebGL water-material title when
 *    the renderer is ready.
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
