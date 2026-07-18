import { ArrowDownRight } from "lucide-react";
import Link from "next/link";
import { bio } from "@/lib/portfolio/content";

export default function HeroIntro() {
  return (
    <div className="hero-intro">
      <p className="hero-intro__roles" aria-label={bio.taglineParts.join(", ")}>
        {bio.taglineParts.map((part, index) => (
          <span key={part}>
            {index > 0 && <b aria-hidden="true">/</b>}
            {part}
          </span>
        ))}
      </p>
      <p className="hero-intro-copy">{bio.bodyParagraphs[0]}</p>
      <Link href="/#projects" className="hero-intro__cta" data-cursor="hover">
        <span>Explore work</span>
        <ArrowDownRight className="hero-intro__cta-icon" aria-hidden="true" />
      </Link>
    </div>
  );
}
