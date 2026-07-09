"use client";

import { useEffect, useRef } from "react";
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
  project: Pick<Project, "slug" | "title" | "subtitle" | "index">;
  personality: CardPersonality;
  className?: string;
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
}: LiquidGlassCardProps) {
  const containerRef = useRef<HTMLAnchorElement>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const pointerFrameRef = useRef(0);
  const pendingPointerRef = useRef<{ x: number; y: number } | null>(null);
  const displaySubtitle = heroSubtitles[project.slug] ?? project.subtitle;
  const targetId = `card-${project.slug}`;

  const emitTarget = (hover: number, pressed = 0) => {
    const rect = rectRef.current;
    if (!rect) return;
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

  useEffect(() => {
    return () => window.cancelAnimationFrame(pointerFrameRef.current);
  }, []);

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
    rectRef.current = null;
    emitTarget(0);
    clearLiquidTarget(targetId);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    emitTarget(1, 1);
    emitCardRipple(e.clientX, e.clientY, 0.95);
  };

  return (
    <Link
      ref={containerRef}
      href={`/project/${project.slug}`}
      prefetch={false}
      className={`liquid-glass-card group ${className}`}
      data-personality={personality}
      onPointerEnter={onPointerEnter}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
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
