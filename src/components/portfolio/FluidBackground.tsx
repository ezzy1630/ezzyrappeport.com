"use client";

import { useEffect, useRef } from "react";
import { emitLiquidPointer, emitLiquidRipple } from "@/lib/portfolio/liquid-interaction";

const TARGET_FPS = 60;
const MAX_DPR = 1.5;
const RIPPLE_COUNT = 8;
const FLUID_TEXTURE_SRC = "/assets/pearl-liquid-background.png";

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
  let coolShadow = vec3<f32>(0.72, 0.80, 0.92) * (0.105 + flowB * 0.105);
  var color = pearl - coolShadow;
  color = mix(color, material, 0.48);

  color = color - vec3<f32>(0.20, 0.30, 0.48) * sheetShadow * 0.42;
  color = color - vec3<f32>(0.13, 0.22, 0.36) * (river1 + river2 + river3) * 0.13;
  color = color + vec3<f32>(1.0) * (sheetTop * 0.26 + sheetCenter * 0.18 + sheetBottom * 0.24);
  color = color + vec3<f32>(0.34, 0.63, 1.0) * (sheetTop * 0.22 + sheetCenter * 0.14 + sheetBottom * 0.25);
  color = color + vec3<f32>(1.0) * (river1 * 0.86 + river2 * 0.70 + river3 * 0.76);
  color = color + vec3<f32>(0.0, 0.42, 1.0) * (river1 * 0.36 + river2 * 0.25 + river3 * 0.38);
  color = color + vec3<f32>(0.20, 0.55, 1.0) * (thin1 * 0.52 + thin2 * 0.48);
  color = color + vec3<f32>(1.0, 1.0, 1.0) * caustic * 0.25;
  color = color + vec3<f32>(0.0, 0.34, 1.0) * blueCaustic * 0.18;
  color = color + vec3<f32>(1.0) * cell * 0.15;
  color = color + vec3<f32>(0.52, 0.72, 1.0) * droplets * 0.26;
  color = color + vec3<f32>(1.0) * dropletRings * 0.36 + vec3<f32>(0.0, 0.38, 1.0) * dropletRings * 0.18;
  color = color + vec3<f32>(0.0, 0.36, 1.0) * ripple.x + vec3<f32>(1.0) * ripple.y;

  let pointerDistance = distance(uv, pointer);
  let wake = exp(-pointerDistance * 7.5) * u.energy;
  color = color + vec3<f32>(0.18, 0.48, 1.0) * wake * 0.16 + vec3<f32>(1.0) * wake * 0.12;

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
    context.configure({
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
          view: context.getCurrentTexture().createView(),
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
    canvas.dataset.renderer = "webgpu-fluid";
    container.appendChild(canvas);

    let disposed = false;
    let cleanup = createFallbackPointerBus();

    if (!reducedMotionRef.current) {
      startWebGpuRenderer(canvas, reducedMotionRef)
        .then((rendererCleanup) => {
          if (disposed) {
            rendererCleanup();
            return;
          }
          cleanup();
          cleanup = rendererCleanup;
          container.dataset.webgpu = "ready";
        })
        .catch(() => {
          canvas.remove();
          container.dataset.webgpu = "fallback";
        });
    } else {
      canvas.remove();
      container.dataset.webgpu = "reduced-motion";
    }

    return () => {
      disposed = true;
      cleanup();
      canvas.remove();
      delete container.dataset.webgpu;
    };
  }, []);

  return <div ref={mountRef} className={`fluid-canvas ${className ?? ""}`} aria-hidden="true" />;
}
