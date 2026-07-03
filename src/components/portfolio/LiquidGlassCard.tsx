"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import { ArrowUpRight } from "lucide-react";
import type { Project } from "@/lib/portfolio/content";
import {
  PERSONALITY_PRESETS,
  VERTEX_SHADER,
  FRAGMENT_SHADER,
  type CardPersonality,
} from "@/lib/portfolio/liquid-glass-shader";

type LiquidGlassCardProps = {
  project: Project;
  personality: CardPersonality;
  reducedMotion?: boolean;
  className?: string;
};

const compactSubtitles: Partial<Record<Project["slug"], string>> = {
  monkeyclaw: "Security Agent",
  velox: "Research Browser",
  flowe: "Productivity App",
  nexarad: "Radiology Platform",
  etch: "Hardware Verification",
};

export default function LiquidGlassCard({
  project,
  personality,
  reducedMotion = false,
  className = "",
}: LiquidGlassCardProps) {
  const personalityPreset = PERSONALITY_PRESETS[personality];
  const displaySubtitle = compactSubtitles[project.slug] ?? project.subtitle;
  const containerRef = useRef<HTMLAnchorElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const clickPulseRef = useRef<{ t: number; origin: [number, number] } | null>(null);
  const [arrowHover, setArrowHover] = useState(false);

  const hoverRef = useRef(0);
  const activeRef = useRef(0);
  const localPointerRef = useRef<[number, number]>([0, 0]);
  const sizeRef = useRef<[number, number]>([0, 0]);
  const visibleRef = useRef(true);
  const dprRef = useRef(1);

  const animate = useCallback((time: number) => {
    const material = materialRef.current;
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!material || !renderer || !canvas) return;

    const elapsed = (time - startTimeRef.current) / 1000;
    material.uniforms.u_time.value = elapsed;
    material.uniforms.u_hover.value += (hoverRef.current - material.uniforms.u_hover.value) * 0.08;
    material.uniforms.u_active.value += (activeRef.current - material.uniforms.u_active.value) * 0.15;
    material.uniforms.u_pointer.value.set(localPointerRef.current[0], localPointerRef.current[1]);

    let pulse = 0;
    if (clickPulseRef.current) {
      const age = elapsed - clickPulseRef.current.t;
      pulse = age < 0.7 ? (1.0 - age / 0.7) : 0;
      if (age > 0.7) clickPulseRef.current = null;
    }
    material.uniforms.u_clickPulse.value = pulse;
    if (clickPulseRef.current) {
      material.uniforms.u_clickOrigin.value.set(
        clickPulseRef.current.origin[0],
        clickPulseRef.current.origin[1]
      );
    }

    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene || !camera) return;

    renderer.render(scene, camera);

    if (visibleRef.current) {
      rafRef.current = requestAnimationFrame(animate);
    } else {
      rafRef.current = 0;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Lazily create the WebGL context only when the card is first scrolled
    // into view, and tear it down on unmount. Caps the number of live GL
    // contexts (the hero cards mount immediately; below-the-fold cards defer).
    let renderer: THREE.WebGLRenderer | null = null;
    let geometry: THREE.PlaneGeometry | null = null;
    let material: THREE.ShaderMaterial | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const computeDpr = () => {
      const isCoarse = window.matchMedia("(pointer: coarse)").matches;
      const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      return Math.min(window.devicePixelRatio || 1, isCoarse || isReduced ? 1.0 : 2);
    };

    const mountRenderer = () => {
      if (renderer) return;
      const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: "high-performance" });
      r.setClearColor(0x000000, 0);
      const dpr = computeDpr();
      dprRef.current = dpr;
      r.setPixelRatio(dpr);
      renderer = r;
      rendererRef.current = r;

      const geo = new THREE.PlaneGeometry(2, 2);
      geometry = geo;
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
        uniforms: {
          u_resolution: { value: new THREE.Vector2(1, 1) },
          u_time: { value: 0 },
          u_hover: { value: 0 },
          u_active: { value: 0 },
          u_pointer: { value: new THREE.Vector2(0, 0) },
          u_clickPulse: { value: 0 },
          u_clickOrigin: { value: new THREE.Vector2(0, 0) },
          u_reducedMotion: { value: reducedMotion ? 1 : 0 },
          u_blueIntensity: { value: personalityPreset.blueIntensity },
          u_organicAmount: { value: personalityPreset.organicAmount },
          u_thickness: { value: personalityPreset.thickness },
          u_causticSpeed: { value: personalityPreset.causticSpeed },
          u_rimSoftness: { value: personalityPreset.rimSoftness },
          u_specularIntensity: { value: personalityPreset.specularIntensity },
          u_lowerWeight: { value: personalityPreset.lowerWeight },
          u_edgeSoftness: { value: personalityPreset.edgeSoftness },
          u_seed: { value: personalityPreset.seed },
        },
      });
      material = mat;
      materialRef.current = mat;
      const scene = new THREE.Scene();
      scene.add(new THREE.Mesh(geo, mat));
      sceneRef.current = scene;
      cameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

      const rect = container.getBoundingClientRect();
      r.setSize(rect.width, rect.height, false);
      mat.uniforms.u_resolution.value.set(Math.max(1, Math.floor(rect.width * dpr)), Math.max(1, Math.floor(rect.height * dpr)));
      sizeRef.current = [rect.width, rect.height];

      startTimeRef.current = performance.now();
      visibleRef.current = true;
      rafRef.current = requestAnimationFrame(animate);
    };

    const disposeRenderer = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      resizeObserver?.disconnect();
      resizeObserver = null;
      geometry?.dispose();
      material?.dispose();
      renderer?.dispose();
      rendererRef.current = null;
      materialRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      renderer = null;
      geometry = null;
      material = null;
    };

    resizeObserver = new ResizeObserver(() => {
      if (!renderer || !material || !container) return;
      const rect = container.getBoundingClientRect();
      const dpr = computeDpr();
      dprRef.current = dpr;
      renderer.setPixelRatio(dpr);
      renderer.setSize(rect.width, rect.height, false);
      material.uniforms.u_resolution.value.set(Math.max(1, Math.floor(rect.width * dpr)), Math.max(1, Math.floor(rect.height * dpr)));
      sizeRef.current = [rect.width, rect.height];
    });
    resizeObserver.observe(container);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          if (!renderer) mountRenderer();
          else if (rafRef.current === 0) rafRef.current = requestAnimationFrame(animate);
        }
      },
      { rootMargin: "120px 0px", threshold: 0 },
    );
    intersectionObserver.observe(container);

    return () => {
      disposeRenderer();
      intersectionObserver.disconnect();
    };
  }, [animate, personalityPreset, reducedMotion]);

  useEffect(() => {
    const material = materialRef.current;
    if (!material) return;
    material.uniforms.u_reducedMotion.value = reducedMotion ? 1 : 0;
  }, [reducedMotion]);

  const updatePointer = (e: React.PointerEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = rect.height - (e.clientY - rect.top);
    localPointerRef.current = [x * dprRef.current, y * dprRef.current];
  };

  const onPointerEnter = (e: React.PointerEvent) => {
    hoverRef.current = 1;
    updatePointer(e);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    hoverRef.current = 1;
    updatePointer(e);
  };

  const onPointerLeave = () => {
    hoverRef.current = 0;
    activeRef.current = 0;
    setArrowHover(false);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    activeRef.current = 1;
    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      const originX = (e.clientX - rect.left) * dprRef.current;
      const originY = (rect.height - (e.clientY - rect.top)) * dprRef.current;
      clickPulseRef.current = {
        t: (performance.now() - startTimeRef.current) / 1000,
        origin: [originX, originY],
      };
    }
  };

  const onPointerUp = () => {
    activeRef.current = 0;
  };

  const onArrowEnter = (e: React.PointerEvent) => {
    e.preventDefault();
    setArrowHover(true);
    hoverRef.current = 1;
  };

  const onArrowLeave = (e: React.PointerEvent) => {
    e.preventDefault();
    setArrowHover(false);
  };

  return (
    <Link
      ref={containerRef}
      href={`/project/${project.slug}`}
      className={`liquid-glass-card group ${className}`}
      onPointerEnter={onPointerEnter}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      data-cursor="hover"
      aria-label={`Open ${project.title}: ${project.subtitle}`}
    >
      <canvas
        ref={canvasRef}
        className="liquid-glass-canvas"
        aria-hidden="true"
      />
      <div className="liquid-glass-content">
        <span className="liquid-glass-index">{project.index}</span>
        <h3 className="liquid-glass-title">{project.title}</h3>
        <p className="liquid-glass-subtitle">{displaySubtitle}</p>
      </div>
      <span
        className={`liquid-glass-arrow ${arrowHover ? "liquid-glass-arrow--hover" : ""}`}
        aria-hidden="true"
        onPointerEnter={onArrowEnter}
        onPointerLeave={onArrowLeave}
      >
        <ArrowUpRight className="liquid-glass-arrow-icon" strokeWidth={2.2} />
      </span>
    </Link>
  );
}
