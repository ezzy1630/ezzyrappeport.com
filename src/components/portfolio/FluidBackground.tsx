"use client";

import * as THREE from "three/webgpu";
import {
  Fn,
  vec2,
  vec3,
  vec4,
  float,
  uniform,
  uv,
  sin,
  mix,
  dot,
  normalize,
  pow,
  max,
  min,
  length,
  add,
  exp,
  smoothstep,
  abs,
  floor,
  fract,
} from "three/tsl";

/**
 * FluidBackground
 * ----------------
 * Full-screen WebGPU/WebGL2 canvas running a procedural fluid simulation:
 *  - Pearl-white base liquid surface
 *  - Cursor-driven ripple sources (ring buffer of recent events)
 *  - Ambient horizontal flow (FBM noise)
 *  - Specular studio highlights + restrained electric-blue caustics
 *  - Automatic fallback to WebGL2 when WebGPU is unavailable
 *
 * The cursor injects ripple events via a small uniforms array. The shader
 * sums decaying concentric waves from each event to produce the height field,
 * then derives normals and shades the surface as pearl-white glass-liquid.
 */

const RIPPLE_CAPACITY = 16; // max simultaneous cursor ripples tracked on GPU

type RippleEvent = {
  x: number; // UV x in [0,1]
  y: number; // UV y in [0,1]
  startTime: number; // seconds since page load
  intensity: number; // 0..1
};

export type FluidBackgroundHandle = {
  pushRipple: (x: number, y: number, intensity?: number) => void;
  setReducedMotion: (reduced: boolean) => void;
};

type Props = {
  reducedMotion?: boolean;
  className?: string;
};

export default function FluidBackground({ reducedMotion = false, className }: Props) {
  // This component self-mounts its canvas and runs the render loop.
  // We use a ref callback so the parent can keep a handle for pushing ripples.
  const mountRef = (node: HTMLDivElement | null) => {
    if (!node) return;
    if ((node as any).__fluidInitialized) return;
    (node as any).__fluidInitialized = true;

    initFluid(node, reducedMotion).catch((err) => {
      console.error("FluidBackground init failed:", err);
    });
  };

  return <div ref={mountRef} className={`fluid-canvas ${className ?? ""}`} aria-hidden="true" />;
}

async function initFluid(container: HTMLDivElement, initialReducedMotion: boolean) {
  // ------------------------------------------------------------------
  // Renderer
  // ------------------------------------------------------------------
  const renderer = new THREE.WebGPURenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0xf7f9fc, 1);

  // WebGPU initialization (will gracefully fall back to WebGL2 if unavailable)
  try {
    await renderer.init();
  } catch (err) {
    console.warn("WebGPU unavailable, falling back to WebGL2:", err);
  }

  const canvas = renderer.domElement;
  container.appendChild(canvas);

  // ------------------------------------------------------------------
  // Scene + camera (we only need a fullscreen quad)
  // ------------------------------------------------------------------
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // ------------------------------------------------------------------
  // Uniforms
  // ------------------------------------------------------------------
  const uResolution = uniform(new THREE.Vector2(window.innerWidth, window.innerHeight));
  const uTime = uniform(0);
  const uReducedMotion = uniform(initialReducedMotion ? 1 : 0);

  // Ripple ring buffer — individual uniforms per ripple slot.
  // Each uniform is a separate UniformNode; updating `.value` triggers
  // re-upload of just that uniform on the next render. This is the most
  // reliable approach across WebGPU and WebGL2 backends.
  type RippleUniform = { x: any; y: any; start: any; intensity: any };
  const rippleUniforms: RippleUniform[] = [];
  for (let i = 0; i < RIPPLE_CAPACITY; i++) {
    rippleUniforms.push({
      x: uniform(0),
      y: uniform(0),
      start: uniform(-100), // mark as expired
      intensity: uniform(0),
    });
  }

  let rippleWriteIdx = 0;
  function pushRipple(x: number, y: number, intensity = 1) {
    const now = performance.now() / 1000;
    const u = rippleUniforms[rippleWriteIdx];
    u.x.value = x;
    u.y.value = y;
    u.start.value = now;
    u.intensity.value = intensity;
    rippleWriteIdx = (rippleWriteIdx + 1) % RIPPLE_CAPACITY;
  }

  // Expose pushRipple on the container for external cursor tracking
  (container as any).__pushRipple = pushRipple;
  (container as any).__setReducedMotion = (reduced: boolean) => {
    uReducedMotion.value = reduced ? 1 : 0;
  };

  // ------------------------------------------------------------------
  // Fluid shader (TSL)
  // ------------------------------------------------------------------
  // Helper functions are plain JS that compose TSL nodes. They are
  // evaluated at JS execution time (during fragmentFn build), which
  // avoids the TSL Fn parameter-passing API and lets us use normal
  // control flow (loops, conditionals) to construct the node tree.
  const hash2 = (p: any) => {
    const q = p.mul(vec2(127.1, 311.7));
    return fract(sin(dot(q, vec2(1.0, 1.0))).mul(43758.5453));
  };

  const valueNoise = (p: any) => {
    const i = floor(p);
    const f = fract(p);
    const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));
    const a = hash2(i);
    const b = hash2(i.add(vec2(1.0, 0.0)));
    const c = hash2(i.add(vec2(0.0, 1.0)));
    const d = hash2(i.add(vec2(1.0, 1.0)));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  };

  const fbm = (p: any) => {
    let v: any = float(0.0);
    let a: any = float(0.5);
    let pp = p;
    for (let i = 0; i < 4; i++) {
      v = v.add(a.mul(valueNoise(pp)));
      pp = pp.mul(2.0);
      a = a.mul(0.5);
    }
    return v;
  };

  // Compute height field at a UV coordinate (plain JS, returns TSL node)
  const computeHeight = (p: any, t: any) => {
    // Base ambient flow — slow horizontal swirls with vertical eddies.
    // Multi-octave: large slow waves + medium ripples + tiny ripples.
    const flowUv1 = p.mul(vec2(2.0, 3.0)).add(vec2(t.mul(0.05), t.mul(0.025)));
    const flowUv2 = p.mul(vec2(5.5, 7.0)).add(vec2(t.mul(-0.04), t.mul(0.06)));
    const flow1 = fbm(flowUv1).sub(0.5).mul(0.32);
    const flow2 = fbm(flowUv2).sub(0.5).mul(0.14);
    const flow = flow1.add(flow2);

    // Sum ripple contributions — each ripple is read from its own uniform
    // (updated dynamically when pushRipple is called).
    let h: any = flow;
    for (let i = 0; i < RIPPLE_CAPACITY; i++) {
      const u = rippleUniforms[i];
      const rx = u.x;
      const ry = u.y;
      const rStart = u.start;
      const rInt = u.intensity;

      const age = t.sub(rStart);
      const alive = max(float(0.0), float(1.0).sub(age.mul(0.45))); // ~2.2s lifetime
      const valid = rStart.greaterThan(0.0).and(alive.greaterThan(0.01));

      const d = length(p.sub(vec2(rx, ry)).mul(vec2(1.6, 1.0)));
      const wavefront = age.mul(0.55);
      const ring = sin(d.mul(34.0).sub(wavefront.mul(11.0)));
      const envelope = exp(d.mul(d).mul(-7.0)).mul(exp(age.mul(-0.9)));
      const contribution = ring.mul(envelope).mul(alive).mul(rInt).mul(0.55);
      h = h.add(contribution.mul(valid));
    }
    return h;
  };

  // Main fragment — the only TSL Fn (entry point)
  const fragmentFn = Fn(() => {
    const p = uv();
    const t = uTime;

    // Height field + central differences for normal
    const eps = float(0.0025);
    const hC = computeHeight(p, t);
    const hX = computeHeight(p.add(vec2(eps, 0.0)), t);
    const hY = computeHeight(p.add(vec2(0.0, eps)), t);

    const dx = hX.sub(hC).div(eps);
    const dy = hY.sub(hC).div(eps);
    const normal = normalize(vec3(float(0.0).sub(dx), float(0.0).sub(dy), float(1.0)));

    // Lighting — soft studio HDRI-like
    const lightDir = normalize(vec3(0.35, 0.55, 0.85));
    const ndl = max(dot(normal, lightDir), float(0.0));
    const halfDir = normalize(add(lightDir, vec3(0.0, 0.0, 1.0)));
    const ndh = max(dot(normal, halfDir), float(0.0));
    const specular = pow(ndh, float(56.0)).mul(2.4);

    // Rim light — cool backlight
    const rim = pow(float(1.0).sub(max(normal.z, float(0.0))), float(2.2)).mul(0.5);

    // Pearl-white base color modulated by height — deepen shadows for visible relief
    const baseColor = vec3(0.969, 0.976, 0.988); // #f7f9fc
    const deepColor = vec3(0.780, 0.810, 0.870); // cool shadow (deeper for visible relief)
    const tinted = mix(baseColor, deepColor, smoothstep(-0.08, 0.20, hC).mul(0.7));

    // Blue caustic — appears where curvature is high (ripple edges)
    const curvature = abs(dx).add(abs(dy));
    const caustic = smoothstep(0.04, 0.40, curvature).mul(0.55);
    const blueCaustic = vec3(0.0, 0.4, 1.0).mul(caustic);

    // Blue underglow near bottom-right of viewport for depth
    const underGlow = smoothstep(0.65, 1.0, p.x.add(p.y.mul(0.4))).mul(0.22);
    const blueUnder = vec3(0.18, 0.45, 1.0).mul(underGlow);

    // Tiny droplet highlights — high-frequency sparkle
    const droplet = smoothstep(0.96, 1.0, valueNoise(p.mul(80.0).add(t.mul(0.3)))).mul(0.35);

    // Soft white streaks — specular ribbons across surface (stronger)
    const streakNoise = fbm(p.mul(vec2(3.0, 8.0)).add(vec2(t.mul(0.05), 0.0)));
    const streak = smoothstep(0.50, 0.85, streakNoise).mul(0.32);

    // Compose
    let color = tinted;
    color = color.mul(float(0.60).add(ndl.mul(0.45)));
    color = color.add(vec3(specular).mul(0.95));
    color = color.add(vec3(0.85, 0.90, 0.98).mul(streak));
    color = color.add(blueCaustic);
    color = color.add(blueUnder);
    color = color.add(vec3(1.0).mul(droplet));
    color = color.add(vec3(0.40, 0.55, 0.85).mul(rim));

    // Slight vignette for focus
    const vUv = p.sub(0.5);
    const vignette = float(1.0).sub(dot(vUv, vUv).mul(0.45));
    color = color.mul(vignette);

    // Reduced motion — fade toward static pearl
    const staticColor = mix(baseColor, deepColor, 0.1).mul(1.05);
    color = mix(color, staticColor, uReducedMotion);

    return vec4(color, 1.0);
  });

  const material = new THREE.NodeMaterial();
  material.fragmentNode = fragmentFn();
  material.depthTest = false;
  material.depthWrite = false;

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);

  // ------------------------------------------------------------------
  // Cursor tracking
  // ------------------------------------------------------------------
  let lastCursorX = 0;
  let lastCursorY = 0;
  let lastCursorTime = 0;

  function onPointerMove(e: PointerEvent) {
    const x = e.clientX / window.innerWidth;
    const y = 1.0 - e.clientY / window.innerHeight;
    const now = performance.now() / 1000;
    const dt = Math.max(now - lastCursorTime, 1 / 240);
    const dx = x - lastCursorX;
    const dy = y - lastCursorY;
    const speed = Math.sqrt(dx * dx + dy * dy) / dt;
    const intensity = Math.min(3.5, 1.2 + speed * 14);
    if (now - lastCursorTime > 0.018 || speed > 0.05) {
      pushRipple(x, y, intensity);
      lastCursorX = x;
      lastCursorY = y;
      lastCursorTime = now;
    }
  }
  function onPointerDown(e: PointerEvent) {
    const x = e.clientX / window.innerWidth;
    const y = 1.0 - e.clientY / window.innerHeight;
    pushRipple(x, y, 3.5);
  }
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });

  // ------------------------------------------------------------------
  // Resize
  // ------------------------------------------------------------------
  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(w, h);
    uResolution.value.set(w, h);
  }
  window.addEventListener("resize", onResize);

  // ------------------------------------------------------------------
  // Render loop
  // ------------------------------------------------------------------
  const startTime = performance.now();
  let rafId = 0;
  let running = true;
  let frameCount = 0;

  function frame() {
    if (!running) return;
    uTime.value = (performance.now() - startTime) / 1000;
    renderer.render(scene, camera);
    frameCount++;
    if (frameCount === 5) {
      (container as any).__rendering = true;
    }
    rafId = requestAnimationFrame(frame);
  }
  frame();

  // ------------------------------------------------------------------
  // Visibility — pause when tab hidden
  // ------------------------------------------------------------------
  function onVisibility() {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(rafId);
    } else if (!running) {
      running = true;
      frame();
    }
  }
  document.addEventListener("visibilitychange", onVisibility);

  // ------------------------------------------------------------------
  // Cleanup
  // ------------------------------------------------------------------
  (container as any).__cleanup = () => {
    running = false;
    cancelAnimationFrame(rafId);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibility);
    quad.geometry.dispose();
    material.dispose();
    renderer.dispose();
    if (canvas.parentElement === container) {
      container.removeChild(canvas);
    }
    (container as any).__fluidInitialized = false;
  };
}
