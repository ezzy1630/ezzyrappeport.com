"use client";

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import type { Project } from "@/lib/portfolio/content";
import { PERSONALITY_PRESETS, type CardPersonality } from "@/lib/portfolio/liquid-glass-shader";
import {
  clearLiquidTarget,
  emitLiquidRipple,
  emitLiquidTarget,
} from "@/lib/portfolio/liquid-interaction";

type LiquidGlassCardProps = {
  project: Pick<Project, "slug" | "title" | "subtitle" | "index" | "status">;
  personality: CardPersonality;
  className?: string;
};

const heroSubtitles: Partial<Record<Project["slug"], string>> = {
  monkeyclaw: "Multi-Agent Security System",
  velox: "Agent-First Browser",
  flowe: "Intelligent Student App",
  nexarad: "Medical Imaging AI",
};

const heroStatuses: Partial<Record<Project["slug"], string>> = {
  monkeyclaw: "PUBLIC DEMO",
  velox: "PUBLIC ALPHA",
  flowe: "PRIVATE BUILD",
  nexarad: "ACQUIRED / RESEARCH",
};

export default function LiquidGlassCard({
  project,
  personality,
  className = "",
}: LiquidGlassCardProps) {
  const containerRef = useRef<HTMLAnchorElement>(null);
  const router = useRouter();
  const rectRef = useRef<DOMRect | null>(null);
  const hoverTargetRef = useRef(0);
  const pointerFrameRef = useRef(0);
  const pendingPointerRef = useRef<{ x: number; y: number } | null>(null);
  const displaySubtitle = heroSubtitles[project.slug] ?? project.subtitle;
  const targetId = `card-${project.slug}`;
  const material = PERSONALITY_PRESETS[personality];

  const emitTarget = useCallback((hover: number, pressed = 0) => {
    hoverTargetRef.current = hover;
    const rect = rectRef.current;
    if (!rect) return;
    emitLiquidTarget({
      id: targetId,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      width: rect.width,
      height: rect.height,
      hover,
      hoverTarget: hover,
      pressed,
      seed: material.seed,
      organic: material.organicAmount,
      blueIntensity: material.blueIntensity,
      time: performance.now(),
    });
  }, [material, targetId]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const updateRect = () => {
      rectRef.current = element.getBoundingClientRect();
      emitTarget(hoverTargetRef.current);
    };
    const resizeObserver = new ResizeObserver(updateRect);
    resizeObserver.observe(element);
    updateRect();
    window.addEventListener("resize", updateRect, { passive: true });
    window.addEventListener("scroll", updateRect, { passive: true });
    return () => {
      window.cancelAnimationFrame(pointerFrameRef.current);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect);
      clearLiquidTarget(targetId);
    };
  }, [emitTarget, targetId]);

  const emitCardRipple = (clientX: number, clientY: number, intensity: number) => {
    emitLiquidRipple({
      x: clientX,
      y: clientY,
      intensity,
      time: performance.now(),
      age: 0,
    });
  };

  const onPointerEnter = (e: React.PointerEvent) => {
    rectRef.current = containerRef.current?.getBoundingClientRect() ?? null;
    emitTarget(1);
    emitCardRipple(e.clientX, e.clientY, 0.34);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    pendingPointerRef.current = { x: e.clientX, y: e.clientY };
    if (pointerFrameRef.current) return;
    pointerFrameRef.current = window.requestAnimationFrame(() => {
      pointerFrameRef.current = 0;
      const pointer = pendingPointerRef.current;
      const rect = rectRef.current;
      const container = containerRef.current;
      if (!pointer || !rect || !container) return;
      pendingPointerRef.current = null;
      container.style.setProperty("--card-x", `${pointer.x - rect.left}px`);
      container.style.setProperty("--card-y", `${pointer.y - rect.top}px`);
      emitTarget(1);
    });
  };

  const onPointerLeave = () => {
    window.cancelAnimationFrame(pointerFrameRef.current);
    pointerFrameRef.current = 0;
    pendingPointerRef.current = null;
    emitTarget(0);
  };

  const onFocus = () => {
    rectRef.current = containerRef.current?.getBoundingClientRect() ?? null;
    emitTarget(1);
  };

  const onBlur = () => emitTarget(0);

  const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!("startViewTransition" in document)) return;
    event.preventDefault();
    const transitionDocument = document as Document & {
      startViewTransition: (callback: () => void) => void;
    };
    transitionDocument.startViewTransition(() => router.push(`/project/${project.slug}`));
  };

  const onPointerDown = () => {
    emitTarget(1, 1);
  };

  return (
    <Link
      ref={containerRef}
      href={`/project/${project.slug}`}
      className={`liquid-glass-card group ${className}`}
      data-personality={personality}
      onPointerEnter={onPointerEnter}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
      onFocus={onFocus}
      onBlur={onBlur}
      onClick={onClick}
      style={{ viewTransitionName: `project-${project.slug}` }}
      data-cursor="hover"
      aria-label={`Open ${project.title}: ${displaySubtitle}`}
    >
      <span className="liquid-glass-surface" aria-hidden="true" />
      <div className="liquid-glass-content">
        <span className="liquid-glass-meta">
          <span className="liquid-glass-index">{project.index}</span>
          <span className="liquid-glass-status">{heroStatuses[project.slug] ?? project.status.toUpperCase()}</span>
        </span>
        <h3 className="liquid-glass-title">{project.title}</h3>
        <p className="liquid-glass-subtitle">{displaySubtitle}</p>
      </div>
      <span className="liquid-glass-arrow" aria-hidden="true">
        <ArrowUpRight className="liquid-glass-arrow-icon" strokeWidth={2.2} />
      </span>
    </Link>
  );
}
