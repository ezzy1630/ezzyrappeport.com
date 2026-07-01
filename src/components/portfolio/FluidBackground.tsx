"use client";

import { useEffect, useRef } from "react";

const TARGET_FPS = 30;
const MAX_DPR = 1.25;
const MAX_RIPPLES = 6;

type Props = {
  reducedMotion?: boolean;
  className?: string;
};

type Ripple = {
  x: number;
  y: number;
  start: number;
  intensity: number;
};

export default function FluidBackground({ reducedMotion = false, className }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const reducedMotionRef = useRef(reducedMotion);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const canvas = document.createElement("canvas");
    const maybeContext = canvas.getContext("2d", { alpha: false });
    if (maybeContext === null) return;
    const ctx = maybeContext!;
    container.appendChild(canvas);

    let width = 0;
    let height = 0;
    let rafId = 0;
    let running = true;
    let lastRenderTime = 0;
    const startTime = performance.now();
    const ripples: Ripple[] = [];
    const frameInterval = 1000 / TARGET_FPS;

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function pushRipple(clientX: number, clientY: number, intensity = 1) {
      ripples.push({
        x: clientX,
        y: clientY,
        start: performance.now(),
        intensity,
      });
      if (ripples.length > MAX_RIPPLES) ripples.shift();
    }

    function drawBlob(cx: number, cy: number, rx: number, ry: number, t: number, phase: number) {
      ctx.beginPath();
      const steps = 72;
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const wobble =
          1 +
          Math.sin(a * 2.4 + t * 0.12 + phase) * 0.045 +
          Math.cos(a * 4.2 - t * 0.08 + phase) * 0.028;
        const x = cx + Math.cos(a) * rx * wobble;
        const y = cy + Math.sin(a) * ry * wobble;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      const fill = ctx.createRadialGradient(cx - rx * 0.28, cy - ry * 0.35, 0, cx, cy, Math.max(rx, ry));
      fill.addColorStop(0, "rgba(255,255,255,0.97)");
      fill.addColorStop(0.42, "rgba(230,238,252,0.56)");
      fill.addColorStop(0.72, "rgba(147,179,232,0.23)");
      fill.addColorStop(1, "rgba(255,255,255,0.22)");
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.78)";
      ctx.lineWidth = 1.35;
      ctx.stroke();
    }

    function drawCausticRibbon(
      startX: number,
      startY: number,
      spanX: number,
      spanY: number,
      t: number,
      phase: number,
      blue = false
    ) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.filter = blue ? "blur(2.8px)" : "blur(2px)";
      ctx.globalCompositeOperation = blue ? "multiply" : "screen";

      for (let layer = 0; layer < 2; layer++) {
        const offset = (layer - 0.5) * 10;
        ctx.beginPath();
        ctx.moveTo(startX, startY + offset);
        ctx.bezierCurveTo(
          startX + spanX * 0.22,
          startY - spanY * (0.42 + Math.sin(t * 0.08 + phase) * 0.10) + offset,
          startX + spanX * 0.48,
          startY + spanY * (0.34 + Math.cos(t * 0.07 + phase) * 0.09) + offset,
          startX + spanX * 0.66,
          startY - spanY * 0.12 + offset
        );
        ctx.bezierCurveTo(
          startX + spanX * 0.82,
          startY - spanY * 0.54 + offset,
          startX + spanX * 0.96,
          startY + spanY * 0.38 + offset,
          startX + spanX,
          startY + Math.sin(t * 0.10 + phase) * 14 + offset
        );
        ctx.strokeStyle = blue
          ? `rgba(0,102,255,${0.12 - layer * 0.035})`
          : `rgba(255,255,255,${0.62 - layer * 0.14})`;
        ctx.lineWidth = blue ? 2.2 - layer * 0.4 : 5.2 - layer * 1.2;
        ctx.stroke();
      }

      ctx.restore();
    }

    function draw(now = performance.now()) {
      if (!running) return;

      if (!reducedMotionRef.current && now - lastRenderTime < frameInterval) {
        rafId = requestAnimationFrame(draw);
        return;
      }
      lastRenderTime = now;

      const t = reducedMotionRef.current ? 0 : (now - startTime) / 1000;
      ctx.clearRect(0, 0, width, height);

      const base = ctx.createLinearGradient(0, 0, width, height);
      base.addColorStop(0, "#fbfcff");
      base.addColorStop(0.42, "#eef3fb");
      base.addColorStop(1, "#f8fbff");
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.filter = "blur(13px)";
      drawBlob(width * 0.12, height * 0.30, width * 0.42, height * 0.17, t, 0.4);
      drawBlob(width * 0.72, height * 0.22, width * 0.50, height * 0.18, t, 2.1);
      drawBlob(width * 0.50, height * 0.72, width * 0.66, height * 0.21, t, 4.2);
      ctx.restore();

      ctx.save();
      ctx.lineCap = "round";
      for (let i = 0; i < 7; i++) {
        const y = height * (0.10 + i * 0.145) + Math.sin(t * 0.16 + i) * 16;
        const amp = 14 + i * 1.8;
        ctx.beginPath();
        for (let x = -64; x <= width + 64; x += 24) {
          const yy =
            y +
            Math.sin(x * 0.0052 + t * 0.10 + i * 0.7) * amp +
            Math.sin(x * 0.014 - t * 0.08 + i) * (amp * 0.28);
          if (x === -64) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.strokeStyle = i % 3 === 1 ? "rgba(0,102,255,0.16)" : "rgba(255,255,255,0.58)";
        ctx.lineWidth = i % 3 === 1 ? 2.4 : 6.2;
        ctx.filter = i % 3 === 1 ? "blur(3px)" : "blur(2px)";
        ctx.stroke();
      }
      ctx.restore();

      drawCausticRibbon(-width * 0.06, height * 0.18, width * 1.10, height * 0.16, t, 0.2);
      drawCausticRibbon(width * 0.18, height * 0.36, width * 0.92, height * 0.18, t, 1.8, true);
      drawCausticRibbon(-width * 0.10, height * 0.70, width * 1.14, height * 0.20, t, 3.1);
      drawCausticRibbon(width * 0.44, height * 0.08, width * 0.64, height * 0.22, t, 4.4, true);

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (const [px, py, r] of [
        [0.91, 0.18, 22],
        [0.84, 0.84, 16],
        [0.08, 0.62, 20],
        [0.43, 0.72, 14],
        [0.70, 0.42, 16],
      ] as const) {
        const x = width * px + Math.sin(t * 0.16 + px * 9) * 7;
        const y = height * py + Math.cos(t * 0.12 + py * 7) * 5;
        const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 1, x, y, r * 2.0);
        g.addColorStop(0, "rgba(255,255,255,0.98)");
        g.addColorStop(0.42, "rgba(197,217,249,0.36)");
        g.addColorStop(0.70, "rgba(0,102,255,0.22)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.85, r * 0.68, -0.32, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      for (let i = ripples.length - 1; i >= 0; i--) {
        const ripple = ripples[i];
        const age = (now - ripple.start) / 1000;
        if (age > 2.2) {
          ripples.splice(i, 1);
          continue;
        }
        const alpha = (1 - age / 2.2) * ripple.intensity;
        const radius = 18 + age * 150;
        for (let ring = 0; ring < 4; ring++) {
          ctx.beginPath();
          ctx.arc(ripple.x, ripple.y, radius + ring * 15, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0,102,255,${0.10 * alpha * (1 - ring * 0.18)})`;
          ctx.lineWidth = ring === 0 ? 1.5 : 1;
          ctx.stroke();
        }
      }
      ctx.restore();

      (container as any).__rendering = true;
      if (reducedMotionRef.current) return;
      rafId = requestAnimationFrame(draw);
    }

    function onPointerDown(e: PointerEvent) {
      pushRipple(e.clientX, e.clientY, 0.8);
      if (reducedMotionRef.current) draw();
    }

    let lastMoveRipple = 0;
    let lastX = 0;
    let lastY = 0;
    let lastMoveTime = 0;

    function onPointerMove(e: PointerEvent) {
      const now = performance.now() / 1000;
      if (now - lastMoveRipple > 0.24) {
        const dt = Math.max(now - lastMoveTime, 0.001);
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        const speed = Math.sqrt(dx * dx + dy * dy) / Math.max(width, height) / dt;
        pushRipple(e.clientX, e.clientY, Math.min(0.62, 0.16 + speed * 0.65));
        lastMoveRipple = now;
      }
      lastX = e.clientX;
      lastY = e.clientY;
      lastMoveTime = now;
    }

    function onVisibility() {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(rafId);
      } else if (!running) {
        running = true;
        rafId = requestAnimationFrame(draw);
      }
    }

    resize();
    draw();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.remove();
    };
  }, []);

  return <div ref={mountRef} className={`fluid-canvas ${className ?? ""}`} aria-hidden="true" />;
}
