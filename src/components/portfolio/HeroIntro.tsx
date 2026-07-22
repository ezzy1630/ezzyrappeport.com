import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { bio } from "@/lib/portfolio/content";
import styles from "./HeroIntro.module.css";

export default function HeroIntro() {
  return (
    <div className={styles.intro}>
      <p className={styles.roles} aria-label={bio.taglineParts.join(", ")}>
        {bio.taglineParts.map((part, index) => (
          <span key={part}>
            {index > 0 && <b aria-hidden="true">/</b>}
            {part}
          </span>
        ))}
      </p>
      <p className={styles.copy}>{bio.heroSentence}</p>
      <Link href="/#projects" className={styles.cta} data-cursor="hover">
        <span>Explore work</span>
        <ArrowUpRight className={styles.ctaIcon} aria-hidden="true" />
      </Link>
    </div>
  );
}
