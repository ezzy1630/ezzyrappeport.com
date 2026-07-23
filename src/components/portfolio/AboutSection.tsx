"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { bio } from "@/lib/portfolio/content";
import { subscribeLiquidPointer } from "@/lib/portfolio/liquid-interaction";
import styles from "./AboutSection.module.css";

const principles = [
  ["Systems over demos", "I care about the runtime, the failure modes, and the path from a promising prototype to dependable software."],
  ["Evidence over theater", "The strongest product story is a working system with visible constraints, measured outcomes, and honest boundaries."],
  ["Human agency first", "AI should make people more capable without making the decisions, provenance, or consequences harder to inspect."],
];

/**
 * AboutSection — the calm pocket.
 * The quietest water on the site: smaller ripples (the renderer's calm
 * uniform), and content resting at slightly different depth planes. Pointer
 * travel shifts the planes by a few pixels relative to one another — just
 * enough to feel the water's depth, never enough to chase the text.
 */
export default function AboutSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const planes = [...section.querySelectorAll<HTMLElement>("[data-depth-plane]")];
    if (planes.length === 0) return;
    let disposed = false;
    const unsubscribe = subscribeLiquidPointer((pointer) => {
      if (disposed) return;
      const rect = section.getBoundingClientRect();
      if (rect.bottom < -120 || rect.top > window.innerHeight + 120) return;
      const nx = (pointer.x / Math.max(window.innerWidth, 1) - 0.5) * 2;
      const ny = (pointer.y / Math.max(window.innerHeight, 1) - 0.5) * 2;
      const energy = Math.min(1, 0.35 + pointer.energy);
      for (const plane of planes) {
        const depth = Number(plane.dataset.depthPlane || "0");
        const x = (-nx * depth * 7 * energy).toFixed(2);
        const y = (-ny * depth * 5 * energy).toFixed(2);
        plane.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }
    });
    return () => {
      disposed = true;
      unsubscribe();
      for (const plane of planes) plane.style.transform = "";
    };
  }, []);

  return (
    <section id="about" ref={sectionRef} className={styles.section} aria-labelledby="about-title">
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>A working philosophy</p>
          <h2 id="about-title">Research taste. Production instincts.</h2>
        </div>
      </header>

      <div className={styles.layout}>
        <div className={styles.story} data-depth-plane="0.45">
          <blockquote>
            “I build at the intersection of engineering and intelligence, then stay
            for the hard part: making the system trustworthy, useful, and real.”
          </blockquote>
          <div className={styles.copy}>
            {bio.bodyParagraphs.slice(1).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            <p className={styles.signature}>
              <span aria-hidden="true">ER</span>
              <span><strong>{bio.name}</strong><small>{bio.taglineParts.join(" / ")}</small></span>
            </p>
          </div>
        </div>
        <figure className={styles.portrait} data-depth-plane="1">
          <div className={styles.portraitRing}>
            <Image
              src="/assets/ezzy-headshot.jpg"
              alt={`Portrait of ${bio.name}`}
              width={720}
              height={720}
              sizes="(max-width: 760px) 72vw, 34vw"
              className={styles.portraitImage}
            />
            <span className={styles.portraitWater} aria-hidden="true" />
          </div>
          <figcaption><MapPin aria-hidden="true" />{bio.location.title}</figcaption>
        </figure>
      </div>

      <ol className={styles.principles} aria-label="Operating principles" data-depth-plane="0.65">
        {principles.map(([title, description], index) => (
          <li key={title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h3>{title}</h3>
            <p>{description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
