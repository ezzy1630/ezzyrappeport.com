"use client";

import { useEffect, useRef } from "react";
import { emitLiquidPointer, emitLiquidRipple } from "@/lib/portfolio/liquid-interaction";

const TARGET_FPS = 60;
const MAX_DPR = 1.5;
const RIPPLE_COUNT = 8;
const FLUID_TEXTURE_SRC = "/assets/pearl-liquid-background.png";

type Props = {
  reducedMotion?: boolean;
  staticMode?: boolean;
  className?: string;
};

type Ripple = {
  x: number;
  y: number;
  start: number;
  intensity: number;
};

type CoverRect = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

type PointerState = {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  lastX: number;
  lastY: number;
  lastMoveTime: number;
  lastRipple: number;
  vx: number;
  vy: number;
  energy: number;
  active: boolean;
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

const SHADER = /* wgsl */ `
struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  energy: f32,
  pointer: vec2<f32>,
  velocity: vec2<f32>,
  ripples: array<vec4<f32>, 8>,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var fluidSampler: sampler;
@group(0) @binding(2) var fluidTexture: texture_2d<f32>;

fn hash(p: vec2<f32>) -> f32 {
  let h = dot(p, vec2<f32>(127.1, 311.7));
  return fract(sin(h) * 43758.5453123);
}

fn noise(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let a = hash(i);
  let b = hash(i + vec2<f32>(1.0, 0.0));
  let c = hash(i + vec2<f32>(0.0, 1.0));
  let d = hash(i + vec2<f32>(1.0, 1.0));
  let m = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, m.x), mix(c, d, m.x), m.y);
}

fn fbm(p0: vec2<f32>) -> f32 {
  var p = p0;
  var a = 0.5;
  var v = 0.0;
  for (var i = 0; i < 5; i = i + 1) {
    v = v + noise(p) * a;
    p = mat2x2<f32>(1.62, 1.08, -1.08, 1.62) * p + 9.7;
    a = a * 0.52;
  }
  return v;
}

fn ridge(v: f32, width: f32) -> f32 {
  return 1.0 - smoothstep(0.0, width, abs(v));
}

fn ellipse_ring(uv: vec2<f32>, center: vec2<f32>, radius: f32, squash: vec2<f32>, width: f32) -> f32 {
  let d = length((uv - center) * squash);
  return ridge(d - radius, width);
}

fn ripple_field(pos: vec2<f32>, pointer: vec2<f32>, time: f32) -> vec3<f32> {
  var blue = 0.0;
  var white = 0.0;
  var warp = 0.0;

  let dp = distance(pos, pointer);
  let pointerRing = sin(dp * 78.0 - time * 8.0);
  let pointerEnv = exp(-dp * 5.0) * u.energy;
  blue = blue + max(pointerRing, 0.0) * pointerEnv * 0.22;
  white = white + ridge(dp - 0.052 - sin(time * 1.8) * 0.006, 0.006) * pointerEnv * 0.42;
  warp = warp + pointerRing * pointerEnv * 0.022;

  for (var i = 0; i < 8; i = i + 1) {
    let r = u.ripples[i];
    let age = time - r.z;
    if (age > 0.0 && age < 2.35 && r.w > 0.001) {
      let d = distance(pos * u.resolution, r.xy);
      let radius = 18.0 + age * 210.0;
      let ring = sin((d - radius) * 0.105);
      let env = exp(-abs(d - radius) / 54.0) * (1.0 - age / 2.35) * r.w;
      blue = blue + max(ring, 0.0) * env * 0.26;
      white = white + max(-ring, 0.0) * env * 0.34;
      warp = warp + ring * env * 0.030;
    }
  }

  return vec3<f32>(blue, white, warp);
}

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );

  var out: VertexOut;
  let p = positions[vertexIndex];
  out.position = vec4<f32>(p, 0.0, 1.0);
  out.uv = p * 0.5 + 0.5;
  return out;
}

@fragment
fn fs(in: VertexOut) -> @location(0) vec4<f32> {
  let aspect = u.resolution.x / max(u.resolution.y, 1.0);
  let t = u.time;
  let pointerUv = u.pointer / u.resolution;
  let pointer = vec2<f32>(pointerUv.x, 1.0 - pointerUv.y);
  var uv = vec2<f32>(in.uv.x, 1.0 - in.uv.y);
  var p = vec2<f32>((uv.x - 0.5) * aspect, uv.y - 0.5);

  let flowA = fbm(p * 2.2 + vec2<f32>(t * 0.035, -t * 0.018));
  let flowB = fbm(p * 4.8 + vec2<f32>(-t * 0.052, t * 0.026));
  let flowC = fbm(p * 9.0 + vec2<f32>(t * 0.082, t * 0.042));
  let ripple = ripple_field(uv, pointer, t);

  p.x = p.x + (flowA - 0.5) * 0.028 + ripple.z;
  p.y = p.y + (flowB - 0.5) * 0.020 + ripple.z * 0.42;
  let sampleWarp = vec2<f32>(
    (flowA - 0.5) * 0.045 + sin(uv.y * 9.0 + t * 0.18) * 0.010 + ripple.z * 0.46,
    (flowB - 0.5) * 0.035 + cos(uv.x * 7.0 - t * 0.16) * 0.008 + ripple.z * 0.20
  );
  let materialUv = clamp(uv + sampleWarp + vec2<f32>(sin(t * 0.035) * 0.012, cos(t * 0.030) * 0.010), vec2<f32>(0.0), vec2<f32>(1.0));
  let material = textureSample(fluidTexture, fluidSampler, materialUv).rgb;

  let river1 = ridge(p.y - 0.285 - sin(p.x * 5.2 + t * 0.24) * 0.045 - sin(p.x * 13.0 - t * 0.16) * 0.016, 0.034);
  let river2 = ridge(p.y + 0.040 - sin(p.x * 4.4 - t * 0.18) * 0.036 - sin(p.x * 16.0 + t * 0.12) * 0.012, 0.030);
  let river3 = ridge(p.y + 0.315 - sin(p.x * 5.8 + t * 0.20) * 0.050, 0.040);
  let sheetTop = ridge(p.y - 0.352 - sin(p.x * 4.8 + t * 0.20) * 0.050 - sin(p.x * 15.0 - t * 0.14) * 0.018, 0.070);
  let sheetCenter = ridge(p.y + 0.060 - sin(p.x * 3.6 - t * 0.16) * 0.044, 0.088);
  let sheetBottom = ridge(p.y + 0.360 - sin(p.x * 5.4 + t * 0.18) * 0.052, 0.078);
  let sheetShadow = max(sheetTop - river1 * 0.74, 0.0) + max(sheetCenter - river2 * 0.68, 0.0) + max(sheetBottom - river3 * 0.72, 0.0);
  let thin1 = ridge(p.y - 0.200 - sin(p.x * 11.0 + t * 0.46) * 0.014, 0.006);
  let thin2 = ridge(p.y + 0.205 - sin(p.x * 9.5 - t * 0.38) * 0.016, 0.006);

  let cell = smoothstep(0.58, 0.93, flowA) * (1.0 - smoothstep(0.84, 1.0, flowB));
  let caustic = pow(max(0.0, sin((flowA * 12.0 + flowB * 7.5 + p.x * 3.0 - t * 0.55))), 3.2);
  let blueCaustic = pow(max(0.0, sin((flowB * 15.0 - p.y * 8.0 + t * 0.7))), 4.6);
  let droplets = smoothstep(0.74, 0.91, flowC) * (1.0 - smoothstep(0.89, 0.99, flowA));
  let dropletRings =
    ellipse_ring(uv, vec2<f32>(0.045, 0.38), 0.020, vec2<f32>(1.0, 2.7), 0.004) +
    ellipse_ring(uv, vec2<f32>(0.405, 0.63), 0.018, vec2<f32>(1.0, 2.15), 0.0035) +
    ellipse_ring(uv, vec2<f32>(0.705, 0.18), 0.014, vec2<f32>(1.0, 1.9), 0.003) +
    ellipse_ring(uv, vec2<f32>(0.895, 0.44), 0.015, vec2<f32>(1.0, 2.1), 0.003) +
    ellipse_ring(uv, vec2<f32>(0.842, 0.84), 0.017, vec2<f32>(1.0, 2.15), 0.0035);

  let pearl = mix(
    vec3<f32>(0.925, 0.948, 0.982),
    vec3<f32>(1.0, 1.0, 0.995),
    smoothstep(-0.32, 0.42, p.y) * 0.58 + flowA * 0.28
  );
  let coolShadow = vec3<f32>(0.66, 0.76, 0.92) * (0.115 + flowB * 0.125);
  let materialLift = material + vec3<f32>(0.020, 0.030, 0.045);
  var color = mix(pearl - coolShadow, materialLift, 0.82);

  color = color - vec3<f32>(0.20, 0.30, 0.48) * sheetShadow * 0.34;
  color = color - vec3<f32>(0.12, 0.21, 0.35) * (river1 + river2 + river3) * 0.09;
  color = color + vec3<f32>(1.0) * (sheetTop * 0.21 + sheetCenter * 0.14 + sheetBottom * 0.20);
  color = color + vec3<f32>(0.25, 0.57, 1.0) * (sheetTop * 0.17 + sheetCenter * 0.11 + sheetBottom * 0.20);
  color = color + vec3<f32>(1.0) * (river1 * 0.58 + river2 * 0.46 + river3 * 0.52);
  color = color + vec3<f32>(0.0, 0.42, 1.0) * (river1 * 0.26 + river2 * 0.18 + river3 * 0.28);
  color = color + vec3<f32>(0.08, 0.48, 1.0) * (thin1 * 0.42 + thin2 * 0.38);
  color = color + vec3<f32>(1.0, 1.0, 1.0) * caustic * 0.18;
  color = color + vec3<f32>(0.0, 0.34, 1.0) * blueCaustic * 0.12;
  color = color + vec3<f32>(1.0) * cell * 0.15;
  color = color + vec3<f32>(0.52, 0.72, 1.0) * droplets * 0.26;
  color = color + vec3<f32>(1.0) * dropletRings * 0.36 + vec3<f32>(0.0, 0.38, 1.0) * dropletRings * 0.18;
  color = color + vec3<f32>(0.0, 0.36, 1.0) * ripple.x * 0.82 + vec3<f32>(1.0) * ripple.y * 0.88;

  let pointerDistance = distance(uv, pointer);
  let wake = exp(-pointerDistance * 7.5) * u.energy;
  color = color + vec3<f32>(0.18, 0.48, 1.0) * wake * 0.10 + vec3<f32>(1.0) * wake * 0.09;

  let vignette = smoothstep(0.85, 0.08, distance((uv - 0.5) * vec2<f32>(aspect, 1.0), vec2<f32>(0.0)));
  color = mix(color * vec3<f32>(0.92, 0.95, 1.0), color, vignette);
  color = pow(max(color, vec3<f32>(0.0)), vec3<f32>(0.92));

  return vec4<f32>(color, 1.0);
}
`;

function emitPointer(state: PointerState, speed: number) {
  emitLiquidPointer({
    x: state.targetX,
    y: state.targetY,
    active: state.active,
    speed,
    time: performance.now(),
  });
}

function createFallbackPointerBus() {
  const pointer: PointerState = {
    x: window.innerWidth * 0.62,
    y: window.innerHeight * 0.54,
    targetX: window.innerWidth * 0.62,
    targetY: window.innerHeight * 0.54,
    lastX: 0,
    lastY: 0,
    lastMoveTime: 0,
    lastRipple: 0,
    vx: 0,
    vy: 0,
    energy: 0,
    active: false,
  };

  function move(e: PointerEvent) {
    const now = performance.now();
    const first = pointer.lastMoveTime === 0;
    const dt = first ? 0.016 : Math.max((now - pointer.lastMoveTime) / 1000, 0.001);
    const dx = first ? 0 : e.clientX - pointer.lastX;
    const dy = first ? 0 : e.clientY - pointer.lastY;
    const speed = Math.hypot(dx, dy) / Math.max(window.innerWidth, window.innerHeight) / dt;
    pointer.targetX = e.clientX;
    pointer.targetY = e.clientY;
    pointer.active = true;
    emitPointer(pointer, speed);
    if (now - pointer.lastRipple > 180) {
      emitLiquidRipple({ x: e.clientX, y: e.clientY, intensity: Math.min(0.82, 0.18 + speed * 0.52), time: now });
      pointer.lastRipple = now;
    }
    pointer.lastX = e.clientX;
    pointer.lastY = e.clientY;
    pointer.lastMoveTime = now;
  }

  function end() {
    pointer.active = false;
    emitPointer(pointer, 0);
  }

  window.addEventListener("pointermove", move, { passive: true });
  window.addEventListener("pointerdown", move, { passive: true });
  window.addEventListener("pointerup", end, { passive: true });
  window.addEventListener("pointercancel", end, { passive: true });
  window.addEventListener("pointerleave", end);

  return () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerdown", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", end);
    window.removeEventListener("pointerleave", end);
  };
}

function startCanvasFallbackRenderer(canvas: HTMLCanvasElement, reducedMotionRef: React.MutableRefObject<boolean>) {
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return createFallbackPointerBus();

  const ctx = context;
  const image = new Image();
  image.decoding = "async";
  image.src = FLUID_TEXTURE_SRC;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let frame = 0;
  let running = true;
  let imageReady = false;
  let lastRenderTime = 0;
  let lastInputTime = performance.now();
  let nextIdleRipple = 1.2;
  const startedAt = performance.now();
  const ripples: Ripple[] = [];
  const pointer: PointerState = {
    x: window.innerWidth * 0.62,
    y: window.innerHeight * 0.54,
    targetX: window.innerWidth * 0.62,
    targetY: window.innerHeight * 0.54,
    lastX: 0,
    lastY: 0,
    lastMoveTime: 0,
    lastRipple: 0,
    vx: 0,
    vy: 0,
    energy: 0.04,
    active: false,
  };

  function configure() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function pushRipple(x: number, y: number, intensity: number) {
    const time = performance.now();
    ripples.push({ x, y, start: time, intensity });
    if (ripples.length > RIPPLE_COUNT) ripples.shift();
    emitLiquidRipple({ x, y, intensity, time });
  }

  function rippleOffset(x: number, y: number, now: number) {
    let offset = 0;
    for (const ripple of ripples) {
      const age = (now - ripple.start) / 1000;
      if (age <= 0 || age > 2.4) continue;
      const distance = Math.hypot(x - ripple.x, y - ripple.y);
      const radius = 18 + age * 215;
      const wave = Math.sin((distance - radius) * 0.108);
      const envelope = Math.exp(-Math.abs(distance - radius) / 52) * (1 - age / 2.4);
      offset += wave * envelope * ripple.intensity * 26;
    }
    return offset;
  }

  function pointerOffset(x: number, y: number, t: number) {
    const distance = Math.hypot(x - pointer.x, y - pointer.y);
    const wake = Math.sin(distance * 0.043 - t * 8.5) * Math.exp(-distance / 230) * pointer.energy * 18;
    return wake + ((x - pointer.x) * pointer.vx + (y - pointer.y) * pointer.vy) / Math.max(distance, 1) * 0.012 * Math.exp(-distance / 190);
  }

  function drawTexture(t: number, now: number) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#f8fbff");
    gradient.addColorStop(0.38, "#edf4ff");
    gradient.addColorStop(0.70, "#fbfdff");
    gradient.addColorStop(1, "#e7f0fb");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    if (!imageReady) return;
    const cover = getCoverRect(image, width, height);
    const strips = Math.max(70, Math.min(150, Math.round(width / 13)));
    const sliceWidth = width / strips;

    ctx.save();
    ctx.globalAlpha = 0.88;
    for (let i = 0; i < strips; i++) {
      const progress = i / strips;
      const dx = i * sliceWidth;
      const sampleX = dx + sliceWidth * 0.5;
      const sampleY = height * (0.42 + Math.sin(progress * 9.2 + t * 0.18) * 0.18);
      const warpX =
        Math.sin(progress * 18.5 + t * 0.52) * 4.4 +
        Math.sin(progress * 47 - t * 0.33) * 2.2 +
        rippleOffset(sampleX, sampleY, now) * 0.15 +
        pointerOffset(sampleX, sampleY, t) * 0.34;
      const warpY =
        Math.cos(progress * 12.0 - t * 0.30) * 3.0 +
        rippleOffset(sampleX, sampleY, now) * 0.05 +
        pointerOffset(sampleX, sampleY, t) * 0.10;
      ctx.drawImage(
        image,
        cover.sx + cover.sw * progress,
        cover.sy,
        cover.sw / strips + 1,
        cover.sh,
        dx + warpX - 2,
        warpY - 2,
        sliceWidth + 4,
        height + 4
      );
    }
    ctx.restore();
  }

  function drawRidge(y: number, amplitude: number, phase: number, blue: boolean, t: number, now: number) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = blue ? "multiply" : "screen";
    ctx.filter = blue ? "blur(2.6px)" : "blur(2px)";
    for (let pass = 0; pass < 3; pass++) {
      ctx.beginPath();
      for (let x = -90; x <= width + 90; x += 18) {
        const yy =
          y +
          Math.sin(x * 0.0058 + t * 0.25 + phase) * amplitude +
          Math.sin(x * 0.018 - t * 0.17 + phase) * amplitude * 0.28 +
          rippleOffset(x, y, now) * 0.05 +
          pointerOffset(x, y, t) * 0.08;
        if (x === -90) ctx.moveTo(x, yy + pass * 3.2);
        else ctx.lineTo(x, yy + pass * 3.2);
      }
      ctx.strokeStyle = blue
        ? `rgba(0,82,255,${0.19 - pass * 0.035})`
        : `rgba(255,255,255,${0.78 - pass * 0.13})`;
      ctx.lineWidth = blue ? 2.6 - pass * 0.45 : 8.5 - pass * 1.4;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDroplets(t: number) {
    ctx.save();
    for (const [px, py, rx, ry, phase] of [
      [0.045, 0.38, 25, 9, 0.3],
      [0.405, 0.63, 18, 8, 1.5],
      [0.705, 0.18, 14, 7, 2.4],
      [0.895, 0.44, 15, 7, 3.2],
      [0.842, 0.84, 18, 8, 4.2],
    ] as const) {
      const x = width * px + Math.sin(t * 0.18 + phase) * 5;
      const y = height * py + Math.cos(t * 0.16 + phase) * 4;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(phase) * 0.3);
      ctx.globalCompositeOperation = "screen";
      ctx.filter = "blur(0.7px)";
      ctx.strokeStyle = "rgba(255,255,255,0.82)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalCompositeOperation = "multiply";
      ctx.strokeStyle = "rgba(0,86,255,0.16)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * 0.78, ry * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawRipples(now: number) {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    for (let i = ripples.length - 1; i >= 0; i--) {
      const ripple = ripples[i];
      const age = (now - ripple.start) / 1000;
      if (age > 2.4) {
        ripples.splice(i, 1);
        continue;
      }
      const alpha = (1 - age / 2.4) * ripple.intensity;
      const radius = 18 + age * 215;
      for (let ring = 0; ring < 4; ring++) {
        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, radius + ring * 15, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,80,255,${0.16 * alpha * (1 - ring * 0.15)})`;
        ctx.lineWidth = ring === 0 ? 2.0 : 1.05;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function draw(now = performance.now()) {
    if (!running) return;
    if (!reducedMotionRef.current && now - lastRenderTime < 1000 / 48) {
      frame = requestAnimationFrame(draw);
      return;
    }
    lastRenderTime = now;
    const t = reducedMotionRef.current ? 0 : (now - startedAt) / 1000;

    if (!pointer.active && now - lastInputTime > 1300 && t > nextIdleRipple) {
      pushRipple(
        width * (0.18 + ((Math.sin(t * 0.37) + 1) * 0.5) * 0.64),
        height * (0.18 + ((Math.cos(t * 0.29 + 1.2) + 1) * 0.5) * 0.56),
        0.20
      );
      nextIdleRipple = t + 1.8 + ((Math.sin(t * 1.7) + 1) * 0.5) * 1.1;
    }

    pointer.x += (pointer.targetX - pointer.x) * 0.18;
    pointer.y += (pointer.targetY - pointer.y) * 0.18;
    pointer.energy += ((pointer.active ? 0.48 : 0.06) - pointer.energy) * 0.05;

    ctx.clearRect(0, 0, width, height);
    drawTexture(t, now);
    drawRidge(height * 0.18, height * 0.038, 0.2, false, t, now);
    drawRidge(height * 0.29, height * 0.028, 1.6, true, t, now);
    drawRidge(height * 0.64, height * 0.035, 3.1, false, t, now);
    drawRidge(height * 0.79, height * 0.034, 4.9, true, t, now);
    drawDroplets(t);
    drawRipples(now);

    if (!reducedMotionRef.current) frame = requestAnimationFrame(draw);
  }

  function onPointerMove(e: PointerEvent) {
    const now = performance.now();
    lastInputTime = now;
    const first = pointer.lastMoveTime === 0;
    const dt = first ? 0.016 : Math.max((now - pointer.lastMoveTime) / 1000, 0.001);
    const dx = first ? 0 : e.clientX - pointer.lastX;
    const dy = first ? 0 : e.clientY - pointer.lastY;
    const speed = Math.hypot(dx, dy) / Math.max(width, height) / dt;

    pointer.targetX = e.clientX;
    pointer.targetY = e.clientY;
    pointer.vx += (dx / dt - pointer.vx) * 0.18;
    pointer.vy += (dy / dt - pointer.vy) * 0.18;
    pointer.active = true;
    pointer.energy = Math.min(1.2, Math.max(pointer.energy, 0.22 + speed * 0.38));
    emitPointer(pointer, speed);

    if (now - pointer.lastRipple > 155) {
      pushRipple(e.clientX, e.clientY, Math.min(0.90, 0.18 + speed * 0.54));
      pointer.lastRipple = now;
    }

    pointer.lastX = e.clientX;
    pointer.lastY = e.clientY;
    pointer.lastMoveTime = now;
  }

  function onPointerDown(e: PointerEvent) {
    lastInputTime = performance.now();
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.targetX = e.clientX;
    pointer.targetY = e.clientY;
    pointer.lastX = e.clientX;
    pointer.lastY = e.clientY;
    pointer.lastMoveTime = performance.now();
    pointer.active = true;
    pointer.energy = Math.max(pointer.energy, 0.74);
    emitPointer(pointer, 0.5);
    pushRipple(e.clientX, e.clientY, 1);
  }

  function onPointerEnd() {
    pointer.active = false;
    pointer.vx *= 0.35;
    pointer.vy *= 0.35;
    emitPointer(pointer, 0);
  }

  function onVisibility() {
    running = !document.hidden;
    if (running) frame = requestAnimationFrame(draw);
    else cancelAnimationFrame(frame);
  }

  image.addEventListener("load", () => {
    imageReady = true;
  });
  configure();
  window.addEventListener("resize", configure);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("pointerup", onPointerEnd, { passive: true });
  window.addEventListener("pointercancel", onPointerEnd, { passive: true });
  window.addEventListener("pointerleave", onPointerEnd);
  document.addEventListener("visibilitychange", onVisibility);
  frame = requestAnimationFrame(draw);

  return () => {
    running = false;
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", configure);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointerup", onPointerEnd);
    window.removeEventListener("pointercancel", onPointerEnd);
    window.removeEventListener("pointerleave", onPointerEnd);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

async function startWebGpuRenderer(canvas: HTMLCanvasElement, reducedMotionRef: React.MutableRefObject<boolean>) {
  const gpu = (navigator as Navigator & { gpu?: unknown }).gpu as
    | {
        requestAdapter: (options?: unknown) => Promise<unknown>;
        getPreferredCanvasFormat: () => unknown;
      }
    | undefined;

  if (!gpu) throw new Error("WebGPU is not available");

  const adapter = (await gpu.requestAdapter({ powerPreference: "high-performance" })) as
    | { requestDevice: () => Promise<unknown> }
    | null;
  if (!adapter) throw new Error("WebGPU adapter is not available");

  const device = (await adapter.requestDevice()) as {
    createShaderModule: (descriptor: unknown) => unknown;
    createRenderPipeline: (descriptor: unknown) => unknown;
    createBuffer: (descriptor: unknown) => unknown;
    createSampler: (descriptor: unknown) => unknown;
    createTexture: (descriptor: unknown) => { createView: () => unknown };
    createBindGroup: (descriptor: unknown) => unknown;
    createCommandEncoder: () => {
      beginRenderPass: (descriptor: unknown) => {
        setPipeline: (pipeline: unknown) => void;
        setBindGroup: (index: number, bindGroup: unknown) => void;
        draw: (count: number) => void;
        end: () => void;
      };
      finish: () => unknown;
    };
    queue: {
      writeBuffer: (buffer: unknown, offset: number, data: ArrayBufferView) => void;
      copyExternalImageToTexture: (source: unknown, destination: unknown, copySize: unknown) => void;
      submit: (buffers: unknown[]) => void;
    };
  };

  const context = canvas.getContext("webgpu" as never) as
    | {
        configure: (descriptor: unknown) => void;
        getCurrentTexture: () => { createView: () => unknown };
      }
    | null;
  if (!context) throw new Error("WebGPU context is not available");
  const gpuContext = context;

  const format = gpu.getPreferredCanvasFormat();
  const shaderModule = device.createShaderModule({ label: "portfolio-fluid-shader", code: SHADER });
  const pipeline = device.createRenderPipeline({
    label: "portfolio-fluid-pipeline",
    layout: "auto",
    vertex: { module: shaderModule, entryPoint: "vs" },
    fragment: { module: shaderModule, entryPoint: "fs", targets: [{ format }] },
    primitive: { topology: "triangle-list" },
  }) as { getBindGroupLayout: (index: number) => unknown };

  const textureResponse = await fetch(FLUID_TEXTURE_SRC);
  const textureBlob = await textureResponse.blob();
  const textureBitmap = await createImageBitmap(textureBlob);
  const fluidTexture = device.createTexture({
    label: "portfolio-fluid-material",
    size: [textureBitmap.width, textureBitmap.height, 1],
    format: "rgba8unorm",
    usage: 0x0004 | 0x0002 | 0x0010,
  });
  device.queue.copyExternalImageToTexture(
    { source: textureBitmap },
    { texture: fluidTexture },
    [textureBitmap.width, textureBitmap.height]
  );
  const fluidSampler = device.createSampler({
    label: "portfolio-fluid-sampler",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    magFilter: "linear",
    minFilter: "linear",
  });

  const uniformValues = new Float32Array(8 + RIPPLE_COUNT * 4);
  const uniformBuffer = device.createBuffer({
    label: "portfolio-fluid-uniforms",
    size: uniformValues.byteLength,
    usage: 0x0040 | 0x0008,
  });
  const bindGroup = device.createBindGroup({
    label: "portfolio-fluid-bind-group",
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: fluidSampler },
      { binding: 2, resource: fluidTexture.createView() },
    ],
  });

  const pointer: PointerState = {
    x: window.innerWidth * 0.62,
    y: window.innerHeight * 0.54,
    targetX: window.innerWidth * 0.62,
    targetY: window.innerHeight * 0.54,
    lastX: 0,
    lastY: 0,
    lastMoveTime: 0,
    lastRipple: 0,
    vx: 0,
    vy: 0,
    energy: 0,
    active: false,
  };
  const ripples: Ripple[] = [];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let frame = 0;
  let running = true;
  let lastRenderTime = 0;
  let lastInputTime = performance.now();
  let nextIdleRipple = 1.4;
  const startedAt = performance.now();

  function configure() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    gpuContext.configure({
      device,
      format,
      alphaMode: "opaque",
      width: canvas.width,
      height: canvas.height,
    });
  }

  function pushRipple(x: number, y: number, intensity: number) {
    const time = (performance.now() - startedAt) / 1000;
    ripples.push({ x: x * dpr, y: y * dpr, start: time, intensity });
    if (ripples.length > RIPPLE_COUNT) ripples.shift();
    emitLiquidRipple({ x, y, intensity, time: performance.now() });
  }

  function onPointerMove(e: PointerEvent) {
    const now = performance.now();
    lastInputTime = now;
    const first = pointer.lastMoveTime === 0;
    const dt = first ? 0.016 : Math.max((now - pointer.lastMoveTime) / 1000, 0.001);
    const dx = first ? 0 : e.clientX - pointer.lastX;
    const dy = first ? 0 : e.clientY - pointer.lastY;
    const speed = Math.hypot(dx, dy) / Math.max(width, height) / dt;

    pointer.targetX = e.clientX;
    pointer.targetY = e.clientY;
    pointer.vx += (dx / dt - pointer.vx) * 0.2;
    pointer.vy += (dy / dt - pointer.vy) * 0.2;
    pointer.energy = Math.min(1.25, Math.max(pointer.energy, 0.18 + speed * 0.42));
    pointer.active = true;

    emitPointer(pointer, speed);
    if (now - pointer.lastRipple > 145) {
      pushRipple(e.clientX, e.clientY, Math.min(0.95, 0.18 + speed * 0.58));
      pointer.lastRipple = now;
    }

    pointer.lastX = e.clientX;
    pointer.lastY = e.clientY;
    pointer.lastMoveTime = now;
  }

  function onPointerDown(e: PointerEvent) {
    lastInputTime = performance.now();
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.targetX = e.clientX;
    pointer.targetY = e.clientY;
    pointer.lastX = e.clientX;
    pointer.lastY = e.clientY;
    pointer.lastMoveTime = performance.now();
    pointer.energy = Math.max(pointer.energy, 0.68);
    pointer.active = true;
    emitPointer(pointer, 0.5);
    pushRipple(e.clientX, e.clientY, 1.05);
  }

  function onPointerEnd() {
    pointer.active = false;
    pointer.vx *= 0.35;
    pointer.vy *= 0.35;
    emitPointer(pointer, 0);
  }

  function onVisibility() {
    running = !document.hidden;
    if (running) frame = requestAnimationFrame(render);
    else cancelAnimationFrame(frame);
  }

  function render(now = performance.now()) {
    if (!running) return;
    if (reducedMotionRef.current) return;

    const interval = 1000 / TARGET_FPS;
    if (now - lastRenderTime < interval) {
      frame = requestAnimationFrame(render);
      return;
    }
    lastRenderTime = now;

    const t = (now - startedAt) / 1000;
    const idleFor = now - lastInputTime;
    if (!pointer.active && idleFor > 1400 && t > nextIdleRipple) {
      const idleX = width * (0.18 + ((Math.sin(t * 0.37) + 1) * 0.5) * 0.64);
      const idleY = height * (0.18 + ((Math.cos(t * 0.29 + 1.2) + 1) * 0.5) * 0.56);
      pushRipple(idleX, idleY, 0.18);
      nextIdleRipple = t + 1.9 + ((Math.sin(t * 1.7) + 1) * 0.5) * 1.1;
    }

    pointer.x += (pointer.targetX - pointer.x) * 0.16;
    pointer.y += (pointer.targetY - pointer.y) * 0.16;
    pointer.energy += ((pointer.active ? 0.38 : 0.03) - pointer.energy) * 0.04;

    uniformValues[0] = canvas.width;
    uniformValues[1] = canvas.height;
    uniformValues[2] = t;
    uniformValues[3] = pointer.energy;
    uniformValues[4] = pointer.x * dpr;
    uniformValues[5] = pointer.y * dpr;
    uniformValues[6] = pointer.vx * dpr;
    uniformValues[7] = pointer.vy * dpr;

    for (let i = 0; i < RIPPLE_COUNT; i++) {
      const ripple = ripples[i];
      const offset = 8 + i * 4;
      uniformValues[offset] = ripple?.x ?? -9999;
      uniformValues[offset + 1] = ripple?.y ?? -9999;
      uniformValues[offset + 2] = ripple?.start ?? -9999;
      uniformValues[offset + 3] = ripple?.intensity ?? 0;
    }

    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: gpuContext.getCurrentTexture().createView(),
          loadOp: "clear",
          clearValue: { r: 0.98, g: 0.99, b: 1.0, a: 1.0 },
          storeOp: "store",
        },
      ],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
    pass.end();
    device.queue.submit([encoder.finish()]);

    frame = requestAnimationFrame(render);
  }

  configure();
  window.addEventListener("resize", configure);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("pointerup", onPointerEnd, { passive: true });
  window.addEventListener("pointercancel", onPointerEnd, { passive: true });
  window.addEventListener("pointerleave", onPointerEnd);
  document.addEventListener("visibilitychange", onVisibility);
  frame = requestAnimationFrame(render);

  return () => {
    running = false;
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", configure);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointerup", onPointerEnd);
    window.removeEventListener("pointercancel", onPointerEnd);
    window.removeEventListener("pointerleave", onPointerEnd);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

function createShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create WebGL shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "unknown shader error";
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string) {
  const program = gl.createProgram();
  if (!program) throw new Error("Unable to create WebGL program");
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? "unknown program link error";
    gl.deleteProgram(program);
    throw new Error(log);
  }
  return program;
}

function startWebGlRenderer(canvas: HTMLCanvasElement, reducedMotionRef: React.MutableRefObject<boolean>) {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance",
  });
  if (!gl) throw new Error("WebGL2 is not available");

  const vertexSource = `#version 300 es
    in vec2 a_position;
    out vec2 v_uv;
    void main() {
      v_uv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentSource = `#version 300 es
    precision highp float;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_energy;
    uniform vec2 u_pointer;
    uniform vec4 u_ripples[8];
    uniform sampler2D u_texture;
    in vec2 v_uv;
    out vec4 outColor;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      vec2 m = f * f * (3.0 - 2.0 * f);
      return mix(mix(a, b, m.x), mix(c, d, m.x), m.y);
    }

    float fbm(vec2 p) {
      float value = 0.0;
      float amp = 0.5;
      for (int i = 0; i < 5; i++) {
        value += noise(p) * amp;
        p = mat2(1.62, 1.08, -1.08, 1.62) * p + 9.7;
        amp *= 0.52;
      }
      return value;
    }

    float ridge(float v, float width) {
      return 1.0 - smoothstep(0.0, width, abs(v));
    }

    float ellipseRing(vec2 uv, vec2 center, float radius, vec2 squash, float width) {
      float d = length((uv - center) * squash);
      return ridge(d - radius, width);
    }

    vec3 rippleField(vec2 uv, vec2 pointer, float t) {
      float blue = 0.0;
      float white = 0.0;
      float warp = 0.0;
      float dp = distance(uv, pointer);
      float pointerRing = sin(dp * 78.0 - t * 8.0);
      float pointerEnv = exp(-dp * 5.2) * u_energy;
      blue += max(pointerRing, 0.0) * pointerEnv * 0.23;
      white += ridge(dp - 0.052 - sin(t * 1.8) * 0.006, 0.006) * pointerEnv * 0.44;
      warp += pointerRing * pointerEnv * 0.024;

      for (int i = 0; i < 8; i++) {
        vec4 r = u_ripples[i];
        float age = t - r.z;
        if (age > 0.0 && age < 2.35 && r.w > 0.001) {
          float d = distance(uv * u_resolution, r.xy);
          float radius = 18.0 + age * 210.0;
          float ring = sin((d - radius) * 0.105);
          float env = exp(-abs(d - radius) / 54.0) * (1.0 - age / 2.35) * r.w;
          blue += max(ring, 0.0) * env * 0.27;
          white += max(-ring, 0.0) * env * 0.34;
          warp += ring * env * 0.031;
        }
      }
      return vec3(blue, white, warp);
    }

    void main() {
      float aspect = u_resolution.x / max(u_resolution.y, 1.0);
      float t = u_time;
      vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
      vec2 pointer = vec2(u_pointer.x / u_resolution.x, 1.0 - u_pointer.y / u_resolution.y);
      vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
      float flowA = fbm(p * 2.2 + vec2(t * 0.035, -t * 0.018));
      float flowB = fbm(p * 4.8 + vec2(-t * 0.052, t * 0.026));
      float flowC = fbm(p * 9.0 + vec2(t * 0.082, t * 0.042));
      vec3 ripple = rippleField(uv, pointer, t);

      p.x += (flowA - 0.5) * 0.028 + ripple.z;
      p.y += (flowB - 0.5) * 0.020 + ripple.z * 0.42;
      vec2 sampleWarp = vec2(
        (flowA - 0.5) * 0.045 + sin(uv.y * 9.0 + t * 0.18) * 0.010 + ripple.z * 0.46,
        (flowB - 0.5) * 0.035 + cos(uv.x * 7.0 - t * 0.16) * 0.008 + ripple.z * 0.20
      );
      vec3 material = texture(u_texture, clamp(uv + sampleWarp, vec2(0.0), vec2(1.0))).rgb;

      float river1 = ridge(p.y - 0.285 - sin(p.x * 5.2 + t * 0.24) * 0.045 - sin(p.x * 13.0 - t * 0.16) * 0.016, 0.034);
      float river2 = ridge(p.y + 0.040 - sin(p.x * 4.4 - t * 0.18) * 0.036 - sin(p.x * 16.0 + t * 0.12) * 0.012, 0.030);
      float river3 = ridge(p.y + 0.315 - sin(p.x * 5.8 + t * 0.20) * 0.050, 0.040);
      float sheetTop = ridge(p.y - 0.352 - sin(p.x * 4.8 + t * 0.20) * 0.050, 0.070);
      float sheetCenter = ridge(p.y + 0.060 - sin(p.x * 3.6 - t * 0.16) * 0.044, 0.088);
      float sheetBottom = ridge(p.y + 0.360 - sin(p.x * 5.4 + t * 0.18) * 0.052, 0.078);
      float sheetShadow = max(sheetTop - river1 * 0.74, 0.0) + max(sheetCenter - river2 * 0.68, 0.0) + max(sheetBottom - river3 * 0.72, 0.0);
      float caustic = pow(max(0.0, sin(flowA * 12.0 + flowB * 7.5 + p.x * 3.0 - t * 0.55)), 3.2);
      float blueCaustic = pow(max(0.0, sin(flowB * 15.0 - p.y * 8.0 + t * 0.7)), 4.6);
      float droplets = smoothstep(0.74, 0.91, flowC) * (1.0 - smoothstep(0.89, 0.99, flowA));
      float rings =
        ellipseRing(uv, vec2(0.045, 0.38), 0.020, vec2(1.0, 2.7), 0.004) +
        ellipseRing(uv, vec2(0.405, 0.63), 0.018, vec2(1.0, 2.15), 0.0035) +
        ellipseRing(uv, vec2(0.705, 0.18), 0.014, vec2(1.0, 1.9), 0.003) +
        ellipseRing(uv, vec2(0.895, 0.44), 0.015, vec2(1.0, 2.1), 0.003) +
        ellipseRing(uv, vec2(0.842, 0.84), 0.017, vec2(1.0, 2.15), 0.0035);

      vec3 pearl = mix(vec3(0.925, 0.948, 0.982), vec3(1.0, 1.0, 0.995), smoothstep(-0.32, 0.42, p.y) * 0.58 + flowA * 0.28);
      vec3 color = mix(pearl - vec3(0.66, 0.76, 0.92) * (0.115 + flowB * 0.125), material + vec3(0.020, 0.030, 0.045), 0.82);
      color -= vec3(0.20, 0.30, 0.48) * sheetShadow * 0.34;
      color += vec3(1.0) * (sheetTop * 0.21 + sheetCenter * 0.14 + sheetBottom * 0.20);
      color += vec3(0.25, 0.57, 1.0) * (sheetTop * 0.17 + sheetCenter * 0.11 + sheetBottom * 0.20);
      color += vec3(1.0) * (river1 * 0.58 + river2 * 0.46 + river3 * 0.52);
      color += vec3(0.0, 0.42, 1.0) * (river1 * 0.26 + river2 * 0.18 + river3 * 0.28);
      color += vec3(1.0) * caustic * 0.18 + vec3(0.0, 0.34, 1.0) * blueCaustic * 0.12;
      color += vec3(0.52, 0.72, 1.0) * droplets * 0.26;
      color += vec3(1.0) * rings * 0.36 + vec3(0.0, 0.38, 1.0) * rings * 0.18;
      color += vec3(0.0, 0.36, 1.0) * ripple.x * 0.82 + vec3(1.0) * ripple.y * 0.88;
      float vignette = smoothstep(0.85, 0.08, distance((uv - 0.5) * vec2(aspect, 1.0), vec2(0.0)));
      color = mix(color * vec3(0.92, 0.95, 1.0), color, vignette);
      outColor = vec4(pow(max(color, vec3(0.0)), vec3(0.92)), 1.0);
    }
  `;

  const program = createProgram(gl, vertexSource, fragmentSource);
  const positionLocation = gl.getAttribLocation(program, "a_position");
  const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
  const timeLocation = gl.getUniformLocation(program, "u_time");
  const energyLocation = gl.getUniformLocation(program, "u_energy");
  const pointerLocation = gl.getUniformLocation(program, "u_pointer");
  const textureLocation = gl.getUniformLocation(program, "u_texture");
  const rippleLocations = Array.from({ length: RIPPLE_COUNT }, (_, i) => gl.getUniformLocation(program, `u_ripples[${i}]`));
  const vao = gl.createVertexArray();
  const positionBuffer = gl.createBuffer();
  const texture = gl.createTexture();
  if (!vao || !positionBuffer || !texture) throw new Error("Unable to allocate WebGL resources");

  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([248, 251, 255, 255]));

  const image = new Image();
  image.decoding = "async";
  image.src = FLUID_TEXTURE_SRC;
  image.addEventListener("load", () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  });

  const pointer: PointerState = {
    x: window.innerWidth * 0.62,
    y: window.innerHeight * 0.54,
    targetX: window.innerWidth * 0.62,
    targetY: window.innerHeight * 0.54,
    lastX: 0,
    lastY: 0,
    lastMoveTime: 0,
    lastRipple: 0,
    vx: 0,
    vy: 0,
    energy: 0,
    active: false,
  };
  const ripples: Ripple[] = [];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let frame = 0;
  let running = true;
  let lastRenderTime = 0;
  let lastInputTime = performance.now();
  let nextIdleRipple = 1.4;
  const startedAt = performance.now();

  function configure() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function pushRipple(x: number, y: number, intensity: number) {
    const time = (performance.now() - startedAt) / 1000;
    ripples.push({ x: x * dpr, y: y * dpr, start: time, intensity });
    if (ripples.length > RIPPLE_COUNT) ripples.shift();
    emitLiquidRipple({ x, y, intensity, time: performance.now() });
  }

  function onPointerMove(e: PointerEvent) {
    const now = performance.now();
    lastInputTime = now;
    const first = pointer.lastMoveTime === 0;
    const dt = first ? 0.016 : Math.max((now - pointer.lastMoveTime) / 1000, 0.001);
    const dx = first ? 0 : e.clientX - pointer.lastX;
    const dy = first ? 0 : e.clientY - pointer.lastY;
    const speed = Math.hypot(dx, dy) / Math.max(width, height) / dt;
    pointer.targetX = e.clientX;
    pointer.targetY = e.clientY;
    pointer.vx += (dx / dt - pointer.vx) * 0.2;
    pointer.vy += (dy / dt - pointer.vy) * 0.2;
    pointer.energy = Math.min(1.25, Math.max(pointer.energy, 0.18 + speed * 0.42));
    pointer.active = true;
    emitPointer(pointer, speed);
    if (now - pointer.lastRipple > 145) {
      pushRipple(e.clientX, e.clientY, Math.min(0.95, 0.18 + speed * 0.58));
      pointer.lastRipple = now;
    }
    pointer.lastX = e.clientX;
    pointer.lastY = e.clientY;
    pointer.lastMoveTime = now;
  }

  function onPointerDown(e: PointerEvent) {
    lastInputTime = performance.now();
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.targetX = e.clientX;
    pointer.targetY = e.clientY;
    pointer.lastX = e.clientX;
    pointer.lastY = e.clientY;
    pointer.lastMoveTime = performance.now();
    pointer.energy = Math.max(pointer.energy, 0.68);
    pointer.active = true;
    emitPointer(pointer, 0.5);
    pushRipple(e.clientX, e.clientY, 1.05);
  }

  function onPointerEnd() {
    pointer.active = false;
    pointer.vx *= 0.35;
    pointer.vy *= 0.35;
    emitPointer(pointer, 0);
  }

  function render(now = performance.now()) {
    if (!running || reducedMotionRef.current) return;
    if (now - lastRenderTime < 1000 / 45) {
      frame = requestAnimationFrame(render);
      return;
    }
    lastRenderTime = now;
    const t = (now - startedAt) / 1000;
    const idleFor = now - lastInputTime;
    if (!pointer.active && idleFor > 1400 && t > nextIdleRipple) {
      pushRipple(
        width * (0.18 + ((Math.sin(t * 0.37) + 1) * 0.5) * 0.64),
        height * (0.18 + ((Math.cos(t * 0.29 + 1.2) + 1) * 0.5) * 0.56),
        0.18
      );
      nextIdleRipple = t + 1.9 + ((Math.sin(t * 1.7) + 1) * 0.5) * 1.1;
    }

    pointer.x += (pointer.targetX - pointer.x) * 0.16;
    pointer.y += (pointer.targetY - pointer.y) * 0.16;
    pointer.energy += ((pointer.active ? 0.38 : 0.03) - pointer.energy) * 0.04;

    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(textureLocation, 0);
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform1f(timeLocation, t);
    gl.uniform1f(energyLocation, pointer.energy);
    gl.uniform2f(pointerLocation, pointer.x * dpr, pointer.y * dpr);
    for (let i = 0; i < RIPPLE_COUNT; i++) {
      const ripple = ripples[i];
      gl.uniform4f(rippleLocations[i], ripple?.x ?? -9999, ripple?.y ?? -9999, ripple?.start ?? -9999, ripple?.intensity ?? 0);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    frame = requestAnimationFrame(render);
  }

  function onVisibility() {
    running = !document.hidden;
    if (running) frame = requestAnimationFrame(render);
    else cancelAnimationFrame(frame);
  }

  configure();
  window.addEventListener("resize", configure);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("pointerup", onPointerEnd, { passive: true });
  window.addEventListener("pointercancel", onPointerEnd, { passive: true });
  window.addEventListener("pointerleave", onPointerEnd);
  document.addEventListener("visibilitychange", onVisibility);
  frame = requestAnimationFrame(render);

  return () => {
    running = false;
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", configure);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointerup", onPointerEnd);
    window.removeEventListener("pointercancel", onPointerEnd);
    window.removeEventListener("pointerleave", onPointerEnd);
    document.removeEventListener("visibilitychange", onVisibility);
    gl.deleteTexture(texture);
    gl.deleteBuffer(positionBuffer);
    gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
  };
}

export default function FluidBackground({ reducedMotion = false, staticMode = false, className }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const reducedMotionRef = useRef(reducedMotion);
  const staticModeRef = useRef(staticMode);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
    staticModeRef.current = staticMode;
  }, [reducedMotion, staticMode]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let disposed = false;
    let cleanup = () => {};
    let rendererCanvas: HTMLCanvasElement | null = null;

    const attachRenderer = (canvas: HTMLCanvasElement, rendererCleanup: () => void, state: "ready" | "webgl2") => {
      if (disposed) {
        rendererCleanup();
        canvas.remove();
        return;
      }

      cleanup();
      cleanup = rendererCleanup;
      rendererCanvas = canvas;
      container.appendChild(canvas);
      container.dataset.webgpu = state;
    };

    const startInteractiveRenderer = async () => {
      if (reducedMotionRef.current || staticModeRef.current) {
        container.dataset.webgpu = "static";
        return;
      }

      container.dataset.webgpu = "starting";

      const webgpuCanvas = document.createElement("canvas");
      webgpuCanvas.dataset.renderer = "webgpu-fluid";
      let webgpuTimedOut = false;
      let webgpuTimeout = 0;
      let webgpuPromise: Promise<() => void> | null = null;

      try {
        webgpuPromise = startWebGpuRenderer(webgpuCanvas, reducedMotionRef);
        const timeoutPromise = new Promise<never>((_, reject) => {
          webgpuTimeout = window.setTimeout(() => {
            webgpuTimedOut = true;
            reject(new Error("WebGPU startup timed out"));
          }, 1800);
        });

        const rendererCleanup = await Promise.race([webgpuPromise, timeoutPromise]);
        window.clearTimeout(webgpuTimeout);
        attachRenderer(webgpuCanvas, rendererCleanup, "ready");
        return;
      } catch {
        window.clearTimeout(webgpuTimeout);
        if (webgpuTimedOut) {
          void webgpuPromise?.then((rendererCleanup) => rendererCleanup()).catch(() => {});
        }
        webgpuCanvas.remove();
      }

      const webglCanvas = document.createElement("canvas");
      webglCanvas.dataset.renderer = "webgl2-fluid";

      try {
        const rendererCleanup = startWebGlRenderer(webglCanvas, reducedMotionRef);
        attachRenderer(webglCanvas, rendererCleanup, "webgl2");
      } catch {
        webglCanvas.remove();
        container.dataset.webgpu = "static";
        cleanup = createFallbackPointerBus();
      }
    };

    if (reducedMotionRef.current || staticModeRef.current) {
      container.dataset.webgpu = "static";
    } else {
      void startInteractiveRenderer();
    }

    return () => {
      disposed = true;
      cleanup();
      rendererCanvas?.remove();
      delete container.dataset.webgpu;
    };
  }, []);

  return <div ref={mountRef} className={`fluid-canvas ${className ?? ""}`} aria-hidden="true" />;
}
