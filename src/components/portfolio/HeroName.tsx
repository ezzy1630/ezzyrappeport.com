import { portfolioIdentity } from "@/lib/portfolio/identity";

const [LINE_1, LINE_2] = portfolioIdentity.titleLines;

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
 * The visual hero name ("EZZY RAPPEPORT") is rendered as individual glyph
 * volumes above the ambient fluid background.
 *
 * This component provides:
 *  - a visually-hidden, screen-reader-accessible `<h1>` for SEO + a11y, and
 *  - a CSS fallback that mirrors the WebGL glyph material when the renderer
 *    is unavailable or still starting.
 */
export default function HeroName() {
  return (
    <>
      <h1 id="portfolio-title" className="sr-only" aria-label={portfolioIdentity.name}>
        {portfolioIdentity.name}
      </h1>
      <div className="hero-name-fallback" aria-hidden="true">
        <HeroLine text={LINE_1} className="hero-name-fallback__line--first" />
        <HeroLine text={LINE_2} className="hero-name-fallback__line--second" />
      </div>
    </>
  );
}
