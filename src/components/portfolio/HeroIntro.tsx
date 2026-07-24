"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { bio } from "@/lib/portfolio/content";
import { emitLiquidPress } from "@/lib/portfolio/liquid-interaction";
import { readMotionPolicy } from "@/lib/portfolio/motion-policy";
import { useLiquidPersistentSurface } from "@/hooks/portfolio/use-liquid-dialogue";
import { BOOT_COPY_STAGGER_MS } from "@/features/kinetic-canvas/boot/heroBootState";
import styles from "./HeroIntro.module.css";

export default function HeroIntro() {
  const ctaRef = useRef<HTMLAnchorElement>(null);
  const [revealStep, setRevealStep] = useState(0);
  const revealed = revealStep >= 3;
  useLiquidPersistentSurface(ctaRef, { phaseOffsetMs: 320, strength: 0.18, radius: 46 });

  useEffect(() => {
    const timers: number[] = [];
    const begin = () => {
      setRevealStep(1);
      timers.push(window.setTimeout(() => setRevealStep(2), BOOT_COPY_STAGGER_MS));
      timers.push(window.setTimeout(() => setRevealStep(3), BOOT_COPY_STAGGER_MS * 2));
    };
    if (document.documentElement.dataset.heroRenderer === "ready") begin();
    else window.addEventListener("liquid-renderer-ready", begin, { once: true });
    timers.push(window.setTimeout(() => {
      setRevealStep((current) => (current === 0 ? 1 : current));
      timers.push(window.setTimeout(() => setRevealStep((current) => Math.max(current, 2)), BOOT_COPY_STAGGER_MS));
      timers.push(window.setTimeout(() => setRevealStep(3), BOOT_COPY_STAGGER_MS * 2));
    }, 900));
    return () => {
      window.removeEventListener("liquid-renderer-ready", begin);
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, []);

  const setCtaNode = (node: HTMLAnchorElement | null) => {
    ctaRef.current = node;
    if (!node) return;
    if (revealed) node.removeAttribute("inert");
    else node.setAttribute("inert", "");
  };

  const beginDescent = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!readMotionPolicy().liquidAllowed) return;
    const rect = event.currentTarget.getBoundingClientRect();
    emitLiquidPress({
      x: rect.left + rect.width * 0.5,
      y: rect.top + rect.height * 0.5,
      strength: 0.85,
      radius: 64,
    });
  };

  return (
    <div className={styles.intro} data-reveal={revealStep}>
      <p
        className={styles.roles}
        aria-label={bio.taglineParts.join(", ")}
        data-visible={revealStep >= 1 ? "true" : "false"}
      >
        {bio.taglineParts.map((part, index) => (
          <span key={part}>
            {index > 0 && <b aria-hidden="true">/</b>}
            {part}
          </span>
        ))}
      </p>
      <p className={styles.copy} data-visible={revealStep >= 2 ? "true" : "false"}>
        {bio.heroSentence}
      </p>
      <Link
        ref={setCtaNode}
        href="/#projects"
        className={`${styles.cta} liquid-dialogue rv-pill-fill`}
        data-liquid-hover
        data-magnetic="cta"
        data-sound-hover
        data-visible={revealed ? "true" : "false"}
        tabIndex={revealed ? undefined : -1}
        aria-hidden={revealed ? undefined : true}
        onClick={beginDescent}
      >
        <span data-magnetic-label>Explore work</span>
        <ArrowUpRight className={styles.ctaIcon} aria-hidden="true" />
      </Link>
    </div>
  );
}
