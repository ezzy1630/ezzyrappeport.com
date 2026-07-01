"use client";

import { useEffect, useRef } from "react";

const TARGET_FPS = 36;
const MAX_DPR = 1.35;
const MAX_RIPPLES = 7;
const BACKGROUND_SRC = "/assets/pearl-liquid-background.png";

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

type PointerState = {
  x: number;
  y: number;
  active: boolean;
  lastRipple: number;
  lastX: number;
  lastY: number;
  lastMoveTime: number;
};

type CoverRect = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

function getCoverRect(image: HTMLImageElement, width: number, height: number): CoverRect {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const canvasRatio = width / height;

  if (canvasRatio > imageRatio) {
    const sh = image.naturalWidth / canvasRatio;
    return {
      sx: 0,
      sy: (image.naturalHeight - sh) / 2,
      sw: image.naturalWidth,
      sh,
    };
  }

  const sw = image.naturalHeight * canvasRatio;
  return {
    sx: (image.naturalWidth - sw) / 2,
    sy: 0,
    sw,
    sh: image.naturalHeight,
  };
}

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
    if (!maybeContext) return;

    const ctx = maybeContext;
    const image = new Image();
    image.decoding = "async";
    image.src = BACKGROUND_SRC;
    container.appendChild(canvas);

    let width = 0;
    let height = 0;
    let rafId = 0;
    let running = true;
    let imageReady = false;
    let lastRenderTime = 0;
    const startTime = performance.now();
    const frameInterval = 1000 / TARGET_FPS;
    const ripples: Ripple[] = [];
    const pointer: PointerState = {
      x: window.innerWidth * 0.66,
      y: window.innerHeight * 0.54,
      active: false,
      lastRipple: 0,
      lastX: 0,
      lastY: 0,
      lastMoveTime: 0,
    };

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

    function rippleDisplacement(x: number, y: number, now: number) {
      let offset = 0;
      for (const ripple of ripples) {
        const age = (now - ripple.start) / 1000;
        if (age <= 0 || age > 2.7) continue;

        const dx = x - ripple.x;
        const dy = y - ripple.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const radius = 18 + age * 188;
        const wave = Math.sin((distance - radius) * 0.105);
        const envelope = Math.exp(-Math.abs(distance - radius) / 56) * (1 - age / 2.7);
        offset += wave * envelope * ripple.intensity * 18;
      }
      return offset;
    }

    function drawImageBase(t: number, now: number) {
      if (!imageReady) {
        const base = ctx.createLinearGradient(0, 0, width, height);
        base.addColorStop(0, "#fbfcff");
        base.addColorStop(0.5, "#eef3fb");
        base.addColorStop(1, "#fbfdff");
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, width, height);
        return;
      }

      const cover = getCoverRect(image, width, height);
      ctx.drawImage(image, cover.sx, cover.sy, cover.sw, cover.sh, 0, 0, width, height);

      if (reducedMotionRef.current) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = "rgba(255,255,255,0.20)";
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
        return;
      }

      const strips = reducedMotionRef.current ? 1 : Math.max(42, Math.min(96, Math.round(width / 22)));
      const sliceWidth = width / strips;

      ctx.save();
      ctx.globalAlpha = 0.34;
      for (let i = 0; i < strips; i++) {
        const dx = i * sliceWidth;
        const progress = i / strips;
        const sampleX = dx + sliceWidth * 0.5;
        const sampleY = height * (0.46 + Math.sin(progress * 8.2 + t * 0.12) * 0.18);
        const waveX =
          Math.sin(progress * 16 + t * 0.34) * 2.2 +
          Math.sin(progress * 41 - t * 0.22) * 1.35 +
          rippleDisplacement(sampleX, sampleY, now) * 0.08;
        const waveY =
          Math.cos(progress * 12 - t * 0.18) * 1.4 +
          rippleDisplacement(sampleX, sampleY, now) * 0.035;
        const sourceX = cover.sx + cover.sw * progress;
        const sourceW = cover.sw / strips + 1;

        ctx.drawImage(
          image,
          sourceX,
          cover.sy,
          sourceW,
          cover.sh,
          dx + waveX - 1,
          waveY - 1,
          sliceWidth + 3,
          height + 2
        );
      }
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = "rgba(255,255,255,0.20)";
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    function drawRibbon(
      y: number,
      amplitude: number,
      thickness: number,
      t: number,
      phase: number,
      blue = false,
      alpha = 1
    ) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalCompositeOperation = blue ? "multiply" : "screen";
      ctx.filter = blue ? "blur(3px)" : "blur(2.4px)";

      for (let pass = 0; pass < 3; pass++) {
        ctx.beginPath();
        for (let x = -80; x <= width + 80; x += 18) {
          const yy =
            y +
            Math.sin(x * 0.006 + t * 0.18 + phase) * amplitude +
            Math.sin(x * 0.018 - t * 0.11 + phase * 1.7) * amplitude * 0.27 +
            rippleDisplacement(x, y, performance.now()) * 0.055;
          if (x === -80) ctx.moveTo(x, yy + pass * 3.5);
          else ctx.lineTo(x, yy + pass * 3.5);
        }
        ctx.strokeStyle = blue
          ? `rgba(0,92,255,${(0.17 - pass * 0.035) * alpha})`
          : `rgba(255,255,255,${(0.70 - pass * 0.12) * alpha})`;
        ctx.lineWidth = blue ? thickness * (0.48 - pass * 0.08) : thickness * (1 - pass * 0.18);
        ctx.stroke();
      }

      ctx.restore();
    }

    function drawSpecular(x: number, y: number, length: number, angle: number, alpha: number) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.globalCompositeOperation = "screen";
      ctx.filter = "blur(1.2px)";
      const g = ctx.createLinearGradient(-length / 2, 0, length / 2, 0);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.42, `rgba(255,255,255,${alpha})`);
      g.addColorStop(0.58, `rgba(255,255,255,${alpha * 0.88})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = Math.max(2, length * 0.012);
      ctx.beginPath();
      ctx.moveTo(-length / 2, 0);
      ctx.bezierCurveTo(-length * 0.15, -8, length * 0.15, 8, length / 2, 0);
      ctx.stroke();
      ctx.restore();
    }

    function drawDroplet(cx: number, cy: number, rx: number, ry: number, t: number, phase: number) {
      const wobble = reducedMotionRef.current ? 0 : Math.sin(t * 0.28 + phase) * 0.08;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.sin(phase) * 0.35);

      const fill = ctx.createRadialGradient(-rx * 0.25, -ry * 0.35, 0, 0, 0, Math.max(rx, ry) * 1.5);
      fill.addColorStop(0, "rgba(255,255,255,0.96)");
      fill.addColorStop(0.48, "rgba(231,239,253,0.42)");
      fill.addColorStop(0.72, "rgba(70,137,255,0.16)");
      fill.addColorStop(1, "rgba(255,255,255,0)");

      ctx.globalCompositeOperation = "screen";
      ctx.filter = "blur(1px)";
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * (1 + wobble), ry * (1 - wobble * 0.4), 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = "multiply";
      ctx.filter = "blur(0.7px)";
      ctx.strokeStyle = "rgba(0,90,255,0.20)";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * 0.74, ry * 0.46, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    function drawPointerGlow(now: number) {
      const ageBoost = ripples.length > 0 ? 1 : 0;
      const glow = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, Math.min(width, height) * 0.25);
      glow.addColorStop(0, `rgba(0,96,255,${pointer.active ? 0.24 : 0.10 + ageBoost * 0.035})`);
      glow.addColorStop(0.28, "rgba(67,145,255,0.12)");
      glow.addColorStop(0.62, "rgba(255,255,255,0.055)");
      glow.addColorStop(1, "rgba(255,255,255,0)");

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      if (pointer.active) {
        for (let ring = 0; ring < 5; ring++) {
          ctx.beginPath();
          ctx.arc(pointer.x, pointer.y, 31 + ring * 18, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255,255,255,${0.26 - ring * 0.035})`;
          ctx.lineWidth = ring === 0 ? 2.1 : 1.15;
          ctx.stroke();
        }
      }
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      if (pointer.active) {
        for (let ring = 0; ring < 5; ring++) {
          ctx.beginPath();
          ctx.arc(pointer.x, pointer.y, 28 + ring * 18, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0,86,255,${0.18 - ring * 0.025})`;
          ctx.lineWidth = ring === 0 ? 1.9 : 1.05;
          ctx.stroke();
        }
      }

      for (let i = ripples.length - 1; i >= 0; i--) {
        const ripple = ripples[i];
        const age = (now - ripple.start) / 1000;
        if (age > 2.7) {
          ripples.splice(i, 1);
          continue;
        }
        const alpha = (1 - age / 2.7) * ripple.intensity;
        const radius = 20 + age * 188;
        for (let ring = 0; ring < 5; ring++) {
          ctx.beginPath();
          ctx.arc(ripple.x, ripple.y, radius + ring * 13, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0,86,255,${0.18 * alpha * (1 - ring * 0.14)})`;
          ctx.lineWidth = ring === 0 ? 1.9 : 1.05;
          ctx.stroke();
        }
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

      drawImageBase(t, now);

      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      const vignette = ctx.createRadialGradient(width * 0.54, height * 0.42, 0, width * 0.54, height * 0.42, width * 0.72);
      vignette.addColorStop(0, "rgba(255,255,255,0)");
      vignette.addColorStop(0.68, "rgba(185,199,222,0.035)");
      vignette.addColorStop(1, "rgba(132,153,190,0.10)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      drawRibbon(height * 0.13, height * 0.025, 7, t, 0.2, false, 0.72);
      drawRibbon(height * 0.29, height * 0.022, 4.5, t, 1.7, true, 0.7);
      drawRibbon(height * 0.63, height * 0.030, 6.5, t, 3.2, false, 0.88);
      drawRibbon(height * 0.78, height * 0.036, 5.2, t, 4.9, true, 0.85);
      drawRibbon(height * 0.91, height * 0.020, 7, t, 6.0, false, 0.58);

      for (const [px, py, rx, ry, phase] of [
        [0.045, 0.37, 24, 10, 0.3],
        [0.422, 0.63, 16, 8, 1.5],
        [0.705, 0.18, 13, 8, 2.4],
        [0.895, 0.43, 14, 8, 3.2],
        [0.838, 0.84, 17, 9, 4.2],
        [0.338, 0.84, 14, 8, 5.1],
      ] as const) {
        drawDroplet(width * px, height * py, rx, ry, t, phase);
      }

      drawSpecular(width * 0.18, height * 0.11, width * 0.26, -0.10, 0.42);
      drawSpecular(width * 0.53, height * 0.16, width * 0.32, 0.04, 0.35);
      drawSpecular(width * 0.77, height * 0.56, width * 0.26, -0.08, 0.31);
      drawSpecular(width * 0.36, height * 0.74, width * 0.22, 0.12, 0.28);

      drawPointerGlow(now);

      if (reducedMotionRef.current) return;
      rafId = requestAnimationFrame(draw);
    }

    function onImageReady() {
      imageReady = true;
      draw();
    }

    function onPointerDown(e: PointerEvent) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
      pushRipple(e.clientX, e.clientY, 1.05);
      if (reducedMotionRef.current) draw();
    }

    function onPointerMove(e: PointerEvent) {
      const now = performance.now();
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;

      if (now - pointer.lastRipple > 185) {
        const dt = Math.max((now - pointer.lastMoveTime) / 1000, 0.001);
        const dx = e.clientX - pointer.lastX;
        const dy = e.clientY - pointer.lastY;
        const speed = Math.sqrt(dx * dx + dy * dy) / Math.max(width, height) / dt;
        pushRipple(e.clientX, e.clientY, Math.min(0.78, 0.14 + speed * 0.62));
        pointer.lastRipple = now;
      }

      pointer.lastX = e.clientX;
      pointer.lastY = e.clientY;
      pointer.lastMoveTime = now;
    }

    function onPointerLeave() {
      pointer.active = false;
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

    image.addEventListener("load", onImageReady);
    resize();
    draw();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      image.removeEventListener("load", onImageReady);
      canvas.remove();
    };
  }, []);

  return <div ref={mountRef} className={`fluid-canvas ${className ?? ""}`} aria-hidden="true" />;
}
