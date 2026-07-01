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
    // Art-directed pearl relief: broad shallow waves plus long horizontal
    // refractive folds. The reference reads as pooled glass, not fine noise.
    const warpA = fbm(p.mul(vec2(1.35, 1.05)).add(vec2(t.mul(0.006), t.mul(0.004)))).sub(0.5);
    const warpB = fbm(p.mul(vec2(3.8, 2.9)).sub(vec2(t.mul(0.010), t.mul(0.005)))).sub(0.5);
    const q = p.add(vec2(warpA.mul(0.085).add(warpB.mul(0.026)), warpA.mul(0.048).sub(warpB.mul(0.020))));
    const broad1 = sin(q.x.mul(3.0).add(q.y.mul(5.8)).add(t.mul(0.030))).mul(0.052);
    const broad2 = sin(q.x.mul(-2.6).add(q.y.mul(3.2)).sub(t.mul(0.026))).mul(0.044);
    const broad3 = sin(q.x.mul(7.6).sub(q.y.mul(1.4)).add(warpA.mul(3.4))).mul(0.018);

    const ridge = (
      baseY: number,
      waveAmp: number,
      freq: number,
      phase: number,
      width: number,
      strength: number
    ) => {
      const line = float(baseY)
        .add(sin(q.x.mul(freq).add(phase).add(t.mul(0.026))).mul(waveAmp))
        .add(fbm(q.mul(vec2(2.2, 4.2)).add(vec2(phase, phase * 0.37))).sub(0.5).mul(0.040));
      const d = abs(q.y.sub(line));
      return exp(d.mul(d).mul(-1 / (width * width))).mul(strength);
    };

    let h: any = broad1
      .add(broad2)
      .add(broad3)
      .add(ridge(0.92, 0.034, 7.1, 0.5, 0.070, 0.074))
      .add(ridge(0.62, 0.040, 6.4, 5.2, 0.084, 0.068))
      .add(ridge(0.28, 0.038, 6.9, 4.2, 0.078, 0.070));

    const droplet = (cx: number, cy: number, sx: number, sy: number, amp: number) => {
      const d = p.sub(vec2(cx, cy)).mul(vec2(sx, sy));
      const r2 = dot(d, d);
      const core = exp(r2.mul(-1.0)).mul(amp);
      const rim = smoothstep(0.18, 0.33, r2).mul(float(1.0).sub(smoothstep(0.33, 0.52, r2))).mul(amp * 0.55);
      return core.add(rim);
    };

    h = h
      .add(droplet(0.955, 0.82, 31.0, 40.0, 0.090))
      .add(droplet(0.865, 0.89, 25.0, 35.0, 0.068))
      .add(droplet(0.065, 0.67, 27.0, 35.0, 0.074))
      .add(droplet(0.42, 0.37, 30.0, 40.0, 0.056))
      .add(droplet(0.94, 0.56, 32.0, 42.0, 0.062))
      .add(fbm(p.mul(vec2(7.0, 8.5)).add(vec2(t.mul(0.010), 0.0))).sub(0.5).mul(0.026));

    // Sum ripple contributions — each ripple is read from its own uniform
    // (updated dynamically when pushRipple is called).
    for (let i = 0; i < RIPPLE_CAPACITY; i++) {
      const u = rippleUniforms[i];
      const rx = u.x;
      const ry = u.y;
      const rStart = u.start;
      const rInt = u.intensity;

      const age = t.sub(rStart);
      const alive = max(float(0.0), float(1.0).sub(age.mul(0.62))); // ~1.6s lifetime
      const valid = rStart.greaterThan(0.0).and(alive.greaterThan(0.01));

      const d = length(p.sub(vec2(rx, ry)).mul(vec2(1.68, 1.0)));
      const wavefront = age.mul(0.52);
      const frontDelta = d.sub(wavefront);
      const frontEnvelope = exp(frontDelta.mul(frontDelta).mul(-145.0)).mul(exp(age.mul(-0.92)));
      const innerEnvelope = exp(d.mul(d).mul(-25.0)).mul(exp(age.mul(-1.18)));
      const bowl = exp(d.mul(d).mul(-14.0)).mul(-0.135);
      const primaryRing = sin(d.mul(102.0).sub(age.mul(42.0))).mul(frontEnvelope).mul(0.34);
      const secondaryRings = sin(d.mul(168.0).sub(age.mul(74.0))).mul(innerEnvelope).mul(0.12);
      const glassRim = smoothstep(0.045, 0.10, d)
        .mul(float(1.0).sub(smoothstep(0.30, 0.54, d)))
        .mul(0.13);
      const contribution = bowl.add(primaryRing).add(secondaryRings).add(glassRim).mul(alive).mul(rInt);
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

    // Lighting — soft studio HDRI-like with hard white ribbon glints
    const lightDir = normalize(vec3(-0.28, 0.60, 0.82));
    const ndl = max(dot(normal, lightDir), float(0.0));
    const halfDir = normalize(add(lightDir, vec3(0.0, 0.0, 1.0)));
    const ndh = max(dot(normal, halfDir), float(0.0));
    const specular = pow(ndh, float(132.0)).mul(4.8);
    const grazingLight = normalize(vec3(0.72, -0.18, 0.66));
    const grazing = pow(max(dot(normal, grazingLight), float(0.0)), float(240.0)).mul(7.0);

    // Rim light — cool backlight
    const rim = pow(float(1.0).sub(max(normal.z, float(0.0))), float(1.65)).mul(0.74);

    const curvature = abs(dx).add(abs(dy));

    // Pearl-white base color modulated by height and slope for visible relief.
    const baseColor = vec3(0.996, 0.998, 1.0);
    const midColor = vec3(0.900, 0.928, 0.982);
    const deepColor = vec3(0.600, 0.690, 0.855);
    const heightShade = smoothstep(-0.075, 0.26, hC);
    const slopeShade = smoothstep(0.26, 1.10, curvature);
    let tinted = mix(baseColor, midColor, heightShade.mul(0.50));
    tinted = mix(tinted, deepColor, slopeShade.mul(0.30));

    // Blue caustics collect on ripple/fold edges and around the liquid frame.
    const edgeDistance = min(min(p.x, float(1.0).sub(p.x)), min(p.y, float(1.0).sub(p.y)));
    const edgeCaustic = float(1.0).sub(smoothstep(0.0, 0.18, edgeDistance)).mul(0.16);
    const rippleCaustic = smoothstep(0.34, 1.16, curvature).mul(0.30);
    const blueCaustic = vec3(0.0, 0.34, 1.0).mul(edgeCaustic.add(rippleCaustic));

    // Stronger lower/right underglow keeps the WebGPU layer legible over the PNG.
    const underGlow = smoothstep(0.78, 1.22, p.x.add(p.y.mul(0.34))).mul(0.13);
    const blueUnder = vec3(0.10, 0.42, 1.0).mul(underGlow);

    // Tiny droplet highlights — high-frequency sparkle
    const droplet = smoothstep(0.988, 1.0, valueNoise(p.mul(118.0).add(t.mul(0.12)))).mul(0.18);

    // Crisp white streaks — long specular ribbons across folds.
    const ribbonFlow = p.y
      .mul(18.0)
      .add(p.x.mul(6.4))
      .add(fbm(p.mul(vec2(2.4, 4.2)).add(vec2(0.0, t.mul(0.010)))).mul(5.2))
      .add(t.mul(0.026));
    const ribbon = smoothstep(0.925, 0.996, abs(sin(ribbonFlow)))
      .mul(smoothstep(0.18, 0.96, curvature))
      .mul(0.62);
    const streakNoise = fbm(p.mul(vec2(5.4, 10.5)).add(vec2(t.mul(0.012), 0.0)));
    const softStreak = smoothstep(0.58, 0.90, streakNoise).mul(0.24);

    // Compose
    let color = tinted;
    color = color.mul(float(0.76).add(ndl.mul(0.46)));
    color = color.add(vec3(specular).mul(1.08));
    color = color.add(vec3(grazing).mul(0.72));
    color = color.add(vec3(0.96, 0.985, 1.0).mul(ribbon));
    color = color.add(vec3(0.88, 0.93, 1.0).mul(softStreak));
    color = color.add(blueCaustic);
    color = color.add(blueUnder);
    color = color.add(vec3(1.0).mul(droplet));
    color = color.add(vec3(0.46, 0.64, 1.0).mul(rim));

    // Slight vignette for focus
    const vUv = p.sub(0.5);
    const vignette = float(1.0).sub(dot(vUv, vUv).mul(0.16));
    color = color.mul(vignette);

    // Reduced motion — fade toward static pearl
    const staticColor = mix(baseColor, midColor, 0.18).mul(1.06);
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
    const intensity = Math.min(1.65, 0.55 + speed * 4.2);
    if (now - lastCursorTime > 0.035 || speed > 0.08) {
      pushRipple(x, y, intensity);
      lastCursorX = x;
      lastCursorY = y;
      lastCursorTime = now;
    }
  }
  function onPointerDown(e: PointerEvent) {
    const x = e.clientX / window.innerWidth;
    const y = 1.0 - e.clientY / window.innerHeight;
    pushRipple(x, y, 1.8);
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
