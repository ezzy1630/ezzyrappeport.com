import { ArrowDownRight } from "lucide-react";
import { bio } from "@/lib/portfolio/content";

export default function HeroIntro() {
  return (
    <div className="hero-intro">
      <p className="hero-intro__roles" aria-label={bio.taglineParts.join(", ")}>
        {bio.taglineParts.map((part, index) => (
          <span key={part}>
            {index > 0 && <i aria-hidden="true" />}
            {part}
          </span>
        ))}
      </p>
      <p className="hero-intro-copy">{bio.bodyParagraphs[0]}</p>
      <a href="#projects" className="hero-intro__cta" data-cursor="hover">
        <span>View featured work</span>
        <ArrowDownRight className="hero-intro__cta-icon" aria-hidden="true" />
      </a>
    </div>
  );
}
