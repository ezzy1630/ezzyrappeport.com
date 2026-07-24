"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

type OverflowCue = {
  start: boolean;
  end: boolean;
};

function prefersReducedMotion() {
  return typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

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

/** Keep the active pill fully inside the horizontal rail viewport. */
function scrollActivePillIntoView(
  nav: HTMLElement | null,
  link: HTMLElement | null,
) {
  if (!nav || !link) return;
  const navStyle = window.getComputedStyle(nav);
  if (navStyle.overflowX !== "auto" && navStyle.overflowX !== "scroll") return;

  const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
  const navRect = nav.getBoundingClientRect();
  const linkRect = link.getBoundingClientRect();
  const leftPad = 12;
  const rightPad = 28;

  if (linkRect.left < navRect.left + leftPad) {
    nav.scrollBy({ left: linkRect.left - navRect.left - leftPad, behavior });
    return;
  }
  if (linkRect.right > navRect.right - rightPad) {
    nav.scrollBy({ left: linkRect.right - navRect.right + rightPad, behavior });
  }
}

function measureOverflowCue(nav: HTMLElement): OverflowCue {
  const overflow = nav.scrollWidth - nav.clientWidth > 2;
  if (!overflow) return { start: false, end: false };
  const remainingStart = nav.scrollLeft;
  const remainingEnd = nav.scrollWidth - (nav.scrollLeft + nav.clientWidth);
  return {
    start: remainingStart > 6,
    end: remainingEnd > 6,
  };
}

export default function CaseEvidenceRail({ problem, system, evidence, outcome }: Props) {
  const [active, setActive] = useState<RailKey>("problem");
  const [cue, setCue] = useState<OverflowCue>({ start: false, end: false });
  const copy: Record<RailKey, string> = { problem, system, evidence, outcome };
  const stickyRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<Partial<Record<RailKey, HTMLAnchorElement>>>({});

  const refreshOverflowCue = useCallback(() => {
    const nav = stickyRef.current;
    if (!nav) return;
    const next = measureOverflowCue(nav);
    setCue((prev) => (
      prev.start === next.start && prev.end === next.end ? prev : next
    ));
  }, []);

  useEffect(() => {
    const nav = stickyRef.current;
    const link = linkRefs.current[active] ?? null;
    const sync = () => {
      syncRailIndicator(nav, link);
      scrollActivePillIntoView(nav, link);
      refreshOverflowCue();
    };
    // Wait one frame so layout settles after active class / snap changes.
    const frame = window.requestAnimationFrame(sync);
    window.addEventListener("resize", sync, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", sync);
    };
  }, [active, refreshOverflowCue]);

  useEffect(() => {
    const nav = stickyRef.current;
    if (!nav) return;

    refreshOverflowCue();
    nav.addEventListener("scroll", refreshOverflowCue, { passive: true });
    window.addEventListener("resize", refreshOverflowCue, { passive: true });

    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(refreshOverflowCue);
    resizeObserver?.observe(nav);

    return () => {
      nav.removeEventListener("scroll", refreshOverflowCue);
      window.removeEventListener("resize", refreshOverflowCue);
      resizeObserver?.disconnect();
    };
  }, [refreshOverflowCue]);

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

  const nudgeRail = (direction: 1 | -1) => {
    const nav = stickyRef.current;
    if (!nav) return;
    const amount = Math.max(120, nav.clientWidth * 0.55) * direction;
    nav.scrollBy({
      left: amount,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  return (
    <section className={styles.evidenceRail} aria-label="Case narrative rail">
      <div
        className={styles.railStickyShell}
        data-can-scroll-start={cue.start ? "true" : "false"}
        data-can-scroll-end={cue.end ? "true" : "false"}
      >
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
        <span className={styles.railEdgeFadeStart} aria-hidden="true" />
        <span className={styles.railEdgeFade} aria-hidden="true" />
        <button
          type="button"
          className={styles.railChevron}
          aria-label="Show more case sections"
          tabIndex={cue.end ? 0 : -1}
          aria-hidden={cue.end ? undefined : true}
          onClick={() => nudgeRail(1)}
        >
          <span aria-hidden="true">›</span>
        </button>
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
