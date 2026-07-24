"use client";

import { useEffect } from "react";
import { emitLiquidPress, emitLiquidWake } from "@/lib/portfolio/liquid-interaction";
import { readMotionPolicy } from "@/lib/portfolio/motion-policy";

type Props = {
  accent: string;
  depth: number;
};

/**
 * One route-scoped plunge. Seeds the case depth band + accent on the root,
 * then emits a wake/press after mount (never during render). Restores mutated
 * state on cleanup.
 */
export default function CaseArrivalWater({ accent, depth }: Props) {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".portfolio-root");
    const article = document.querySelector<HTMLElement>("[data-water-section='case']");
    const snapshot = {
      worldDepth: root?.style.getPropertyValue("--world-depth") ?? "",
      caseDepth: root?.style.getPropertyValue("--case-depth") ?? "",
      caseAccent: root?.dataset.caseAccent,
      articleAccent: article?.dataset.accent,
      articleDepth: article?.dataset.depth,
    };

    if (root) {
      root.style.setProperty("--world-depth", String(depth));
      root.style.setProperty("--case-depth", String(depth));
      root.dataset.caseAccent = accent;
    }
    if (article) {
      article.dataset.accent = accent;
      article.dataset.depth = String(depth);
    }

    let cancelled = false;
    if (readMotionPolicy().liquidAllowed && article) {
      const rect = article.getBoundingClientRect();
      const x = rect.left + rect.width * 0.62;
      const y = Math.min(window.innerHeight * 0.58, rect.top + window.innerHeight * 0.54);
      if (!cancelled) {
        emitLiquidWake({
          startX: x,
          startY: y + 44,
          endX: x,
          endY: y,
          strength: 0.34,
          radius: 72,
        });
        emitLiquidPress({ x, y, strength: 0.24, radius: 78 });
      }
    }

    return () => {
      cancelled = true;
      if (root) {
        if (snapshot.worldDepth) root.style.setProperty("--world-depth", snapshot.worldDepth);
        else root.style.removeProperty("--world-depth");
        if (snapshot.caseDepth) root.style.setProperty("--case-depth", snapshot.caseDepth);
        else root.style.removeProperty("--case-depth");
        if (snapshot.caseAccent !== undefined) root.dataset.caseAccent = snapshot.caseAccent;
        else delete root.dataset.caseAccent;
      }
      if (article) {
        if (snapshot.articleAccent !== undefined) article.dataset.accent = snapshot.articleAccent;
        else delete article.dataset.accent;
        if (snapshot.articleDepth !== undefined) article.dataset.depth = snapshot.articleDepth;
        else delete article.dataset.depth;
      }
    };
  }, [accent, depth]);

  return null;
}
