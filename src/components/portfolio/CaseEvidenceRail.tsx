"use client";

import { useEffect, useRef, useState } from "react";
import styles from "../../app/project/[slug]/ProjectDetail.module.css";

const railStates = [
  { key: "problem", label: "Problem" },
  { key: "system", label: "System" },
  { key: "evidence", label: "Evidence" },
  { key: "outcome", label: "Outcome" },
] as const;

type RailKey = (typeof railStates)[number]["key"];

type Props = {
  problem: string;
  system: string;
  evidence: string;
  outcome: string;
};

function syncRailIndicator(
  nav: HTMLElement | null,
  link: HTMLElement | null,
) {
  if (!nav || !link) return;
  const navRect = nav.getBoundingClientRect();
  const linkRect = link.getBoundingClientRect();
  nav.style.setProperty("--rail-indicator-y", `${linkRect.top - navRect.top}px`);
  nav.style.setProperty("--rail-indicator-h", `${linkRect.height}px`);
}

export default function CaseEvidenceRail({ problem, system, evidence, outcome }: Props) {
  const [active, setActive] = useState<RailKey>("problem");
  const copy: Record<RailKey, string> = { problem, system, evidence, outcome };
  const stickyRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<Partial<Record<RailKey, HTMLAnchorElement>>>({});

  useEffect(() => {
    const sync = () => syncRailIndicator(stickyRef.current, linkRefs.current[active] ?? null);
    sync();
    window.addEventListener("resize", sync, { passive: true });
    return () => window.removeEventListener("resize", sync);
  }, [active]);

  useEffect(() => {
    const panels = railStates
      .map((state) => document.getElementById(`case-${state.key}`))
      .filter((element): element is HTMLElement => Boolean(element));
    if (panels.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0]?.target;
        if (!top?.id.startsWith("case-")) return;
        const key = top.id.replace("case-", "") as RailKey;
        if (railStates.some((state) => state.key === key)) setActive(key);
      },
      { rootMargin: "-28% 0px -48% 0px", threshold: [0.15, 0.35, 0.55] },
    );

    for (const panel of panels) observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  return (
    <section className={styles.evidenceRail} aria-label="Case narrative rail">
      <div
        ref={stickyRef}
        className={styles.railSticky}
        role="navigation"
        aria-label="Case sections"
      >
        <span className={styles.railTrack} aria-hidden="true">
          <span className={styles.railIndicator} />
        </span>
        {railStates.map((state) => (
          <a
            key={state.key}
            ref={(element) => {
              if (element) linkRefs.current[state.key] = element;
            }}
            href={`#case-${state.key}`}
            className={styles.railLink}
            data-active={active === state.key ? "true" : "false"}
            data-band={state.key}
            aria-current={active === state.key ? "location" : undefined}
          >
            <span className={styles.railDot} aria-hidden="true" />
            {state.label}
          </a>
        ))}
      </div>
      <div className={styles.railPanels}>
        {railStates.map((state) => (
          <section
            key={state.key}
            id={`case-${state.key}`}
            className={styles.railPanel}
            data-band={state.key}
            data-active={active === state.key ? "true" : "false"}
            tabIndex={-1}
          >
            <h2>{state.label}</h2>
            <p>{copy[state.key]}</p>
          </section>
        ))}
      </div>
    </section>
  );
}
