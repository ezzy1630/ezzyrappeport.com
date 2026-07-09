"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Project } from "@/lib/portfolio/content";
import type { CardPersonality } from "@/lib/portfolio/liquid-glass-shader";
import {
  clearLiquidTarget,
  emitLiquidRipple,
  emitLiquidTarget,
} from "@/lib/portfolio/liquid-interaction";

type LiquidGlassCardProps = {
  project: Project;
  personality: CardPersonality;
  reducedMotion?: boolean;
  className?: string;
  onOpen?: (project: Project) => void;
};

const heroSubtitles: Partial<Record<Project["slug"], string>> = {
  monkeyclaw: "Multi-Agent Security System",
  velox: "Agent-First Browser",
  flowe: "Intelligent Student App",
  nexarad: "Medical Imaging AI",
};

export default function LiquidGlassCard({
  project,
  personality,
  className = "",
  onOpen,
}: LiquidGlassCardProps) {
  const containerRef = useRef<HTMLAnchorElement>(null);
  const displaySubtitle = heroSubtitles[project.slug] ?? project.subtitle;
  const targetId = `card-${project.slug}`;

  const emitTarget = (hover: number, pressed = 0) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    emitLiquidTarget({
      id: targetId,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      width: rect.width,
      height: rect.height,
      hover,
      pressed,
      time: performance.now(),
    });
  };

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
    emitTarget(1);
    emitCardRipple(e.clientX, e.clientY, 0.34);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    emitTarget(1);
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    container.style.setProperty("--card-x", `${e.clientX - rect.left}px`);
    container.style.setProperty("--card-y", `${e.clientY - rect.top}px`);
  };

  const onPointerLeave = () => {
    emitTarget(0);
    clearLiquidTarget(targetId);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    emitTarget(1, 1);
    emitCardRipple(e.clientX, e.clientY, 0.95);
  };

  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Modal-first: intercept plain clicks and open the modal in place.
    // Modifier-clicks (cmd/ctrl/shift/alt/middle) fall through to the real route.
    if (onOpen && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
      e.preventDefault();
      emitTarget(1, 1.15);
      emitCardRipple(e.clientX, e.clientY, 1.05);
      onOpen(project);
    }
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
      onClick={onClick}
      data-cursor="hover"
      aria-label={`Open ${project.title}: ${displaySubtitle}`}
    >
      <span className="liquid-glass-surface" aria-hidden="true" />
      <div className="liquid-glass-content">
        <span className="liquid-glass-index">{project.index}</span>
        <h3 className="liquid-glass-title">{project.title}</h3>
        <p className="liquid-glass-subtitle">{displaySubtitle}</p>
      </div>
      <span className="liquid-glass-arrow" aria-hidden="true">
        <ArrowUpRight className="liquid-glass-arrow-icon" strokeWidth={2.2} />
      </span>
    </Link>
  );
}
