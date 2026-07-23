"use client";

import { useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { bio } from "@/lib/portfolio/content";
import { emitLiquidPress } from "@/lib/portfolio/liquid-interaction";
import { useLiquidPersistentSurface } from "@/hooks/portfolio/use-liquid-dialogue";
import styles from "./HeroIntro.module.css";

export default function HeroIntro() {
  const ctaRef = useRef<HTMLAnchorElement>(null);
  useLiquidPersistentSurface(ctaRef, { phaseOffsetMs: 320, strength: 0.18, radius: 46 });

  // The click begins the descent: one clean droplet pulse at the button, then
  // the native anchor carries the camera beneath the hero.
  const beginDescent = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    emitLiquidPress({
      x: rect.left + rect.width * 0.5,
      y: rect.top + rect.height * 0.5,
      strength: 0.85,
      radius: 64,
    });
  };

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
      <Link
        ref={ctaRef}
        href="/#projects"
        className={`${styles.cta} liquid-dialogue`}
        data-cursor="hover"
        data-liquid-hover
        onClick={beginDescent}
      >
        <span>Explore work</span>
        <ArrowUpRight className={styles.ctaIcon} aria-hidden="true" />
      </Link>
    </div>
  );
}
