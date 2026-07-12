"use client";

import type { LiquidPhysics } from "../input/liquidInput";
import {
  clearHeroTextCanvasCache,
  createHeroTextCanvas,
  type HeroTextLineLayout,
} from "../materials/heroTextMask";
import {
  FLUID_TEXTURE_FALLBACK_SRC,
  FLUID_TEXTURE_SRC,
  RIPPLE_COUNT,
  resolveKineticQuality,
  type KineticQuality,
} from "./quality";
import {
  pixelBudgetedDpr,
  QUALITY_PIXEL_BUDGETS,
  downgradeQualityTier,
  TARGET_FPS_BY_TIER,
} from "./quality-policy";
import { FRAGMENT_SOURCE, VERTEX_SOURCE } from "../shaders/liquidComposite";

type DoubleBuffer = {
  read: WebGLTexture;
  write: WebGLTexture;
  readFbo: WebGLFramebuffer;
  writeFbo: WebGLFramebuffer;
  swap: () => void;
};

type SingleBuffer = {
  texture: WebGLTexture;
  fbo: WebGLFramebuffer;
};

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
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? "unknown program error";
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    gl.deleteProgram(program);
    throw new Error(log);
  }
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  return program;
}

function createRenderTexture(gl: WebGL2RenderingContext, width: number, height: number, internalFormat: number, format: number, type: number) {
  const texture = gl.createTexture();
  if (!texture) throw new Error("Unable to create fluid texture");
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, null);
  return texture;
}

function createFramebuffer(gl: WebGL2RenderingContext, texture: WebGLTexture) {
  const fbo = gl.createFramebuffer();
  if (!fbo) throw new Error("Unable to create fluid framebuffer");
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    gl.deleteFramebuffer(fbo);
    throw new Error("Fluid framebuffer is incomplete");
  }
  return fbo;
}

function createSingleBuffer(gl: WebGL2RenderingContext, width: number, height: number, internalFormat: number, format: number, type: number): SingleBuffer {
  const texture = createRenderTexture(gl, width, height, internalFormat, format, type);
  try {
    return { texture, fbo: createFramebuffer(gl, texture) };
  } catch (error) {
    gl.deleteTexture(texture);
    throw error;
  }
}

function createDoubleBuffer(gl: WebGL2RenderingContext, width: number, height: number, internalFormat: number, format: number, type: number): DoubleBuffer {
  const a = createSingleBuffer(gl, width, height, internalFormat, format, type);
  let b: SingleBuffer;
  try {
    b = createSingleBuffer(gl, width, height, internalFormat, format, type);
  } catch (error) {
    gl.deleteTexture(a.texture);
    gl.deleteFramebuffer(a.fbo);
    throw error;
  }
  return {
    read: a.texture,
    write: b.texture,
    readFbo: a.fbo,
    writeFbo: b.fbo,
    swap() {
      [this.read, this.write] = [this.write, this.read];
      [this.readFbo, this.writeFbo] = [this.writeFbo, this.readFbo];
    },
  };
}

function supportsRenderTarget(
  gl: WebGL2RenderingContext,
  internalFormat: number,
  format: number,
  type: number,
) {
  const texture = createRenderTexture(gl, 2, 2, internalFormat, format, type);
  try {
    const fbo = createFramebuffer(gl, texture);
    gl.deleteFramebuffer(fbo);
    return true;
  } catch {
    return false;
  } finally {
    gl.deleteTexture(texture);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
}

const SIM_FRAGMENT_SOURCE = `#version 300 es
precision highp float;

uniform int u_pass;
uniform vec2 u_resolution;
uniform vec4 u_pointer;
uniform vec2 u_pointerVelocity;
uniform vec4 u_ripples[8];
uniform vec4 u_scroll;
uniform float u_time;
uniform float u_delta;
uniform sampler2D u_velocity;
uniform sampler2D u_dye;
uniform sampler2D u_height;
uniform sampler2D u_pressure;
uniform sampler2D u_divergence;
uniform sampler2D u_obstacle;
uniform sampler2D u_text;

in vec2 v_uv;
out vec4 outColor;

vec2 texel() { return 1.0 / max(u_resolution, vec2(1.0)); }
vec2 decodeVelocity(vec4 v) { return (v.xy - 0.5) * 2.0; }
vec4 encodeVelocity(vec2 v) { return vec4(clamp(v * 0.5 + 0.5, 0.0, 1.0), 0.5, 1.0); }
vec2 packUnitFloat(float value) {
  vec2 packed = fract(clamp(value, 0.0, 0.99999) * vec2(1.0, 255.0));
  packed.x -= packed.y / 255.0;
  return packed;
}
float unpackUnitFloat(vec2 packed) { return packed.x + packed.y / 255.0; }
float decodeHeight(vec2 packed) { return (unpackUnitFloat(packed) - 0.5) * 0.25; }
vec2 encodeHeight(float value) { return packUnitFloat(clamp(value * 4.0 + 0.5, 0.0, 1.0)); }
float encodeDisplayHeight(float value) { return clamp(value * 4.0 + 0.5, 0.0, 1.0); }

float roundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float ripplePulse(vec2 uv, vec2 pointer, out float blue) {
  blue = 0.0;
  float pulse = 0.0;
  float dp = distance(uv, pointer);
  float pointerRing = sin(dp * 68.0 - u_time * 10.0);
  float pointerEnv = exp(-dp * 5.2) * u_pointer.z;
  pulse += pointerRing * pointerEnv * 0.05;
  blue += max(pointerRing, 0.0) * pointerEnv * 0.14 + exp(-dp * 7.0) * u_pointer.z * 0.28;
  for (int i = 0; i < 8; i++) {
    vec4 r = u_ripples[i];
    float age = u_time - r.z;
    if (age <= 0.0 || age > 3.2 || r.w <= 0.001) continue;
    float d = distance(uv * u_resolution, r.xy);
    float radius = 22.0 + age * 185.0;
    float ring = sin((d - radius) * 0.075);
    float env = exp(-abs(d - radius) / 76.0) * (1.0 - age / 3.2) * r.w;
    pulse += ring * env * 0.28;
    blue += max(ring, 0.0) * env * 0.62 + max(-ring, 0.0) * env * 0.24;
  }
  return pulse;
}

void main() {
  vec2 uv = v_uv;
  vec2 e = texel();
  vec2 pointer = u_pointer.xy;
  vec2 pointerVelocity = u_pointerVelocity;
  float text = texture(u_text, uv).a;
  vec2 textGrad = vec2(
    texture(u_text, uv + vec2(e.x, 0.0)).a - texture(u_text, uv - vec2(e.x, 0.0)).a,
    texture(u_text, uv + vec2(0.0, e.y)).a - texture(u_text, uv - vec2(0.0, e.y)).a
  );
  float obstacle = clamp(text * 0.95, 0.0, 1.0);
  float edge = clamp(length(textGrad) * 14.0, 0.0, 1.0);

  if (u_pass == 0) {
    outColor = vec4(obstacle, edge, text, 0.0);
    return;
  }

  if (u_pass == 1) {
    vec2 vel = decodeVelocity(texture(u_velocity, uv)) * 0.986;
    float blue = 0.0;
    float pulse = ripplePulse(uv, pointer, blue);
    vec2 dir = uv - pointer;
    float len = max(length(dir), 0.001);
    float wake = exp(-len * 4.2) * u_pointer.z;
    // Normal pointer travel is a visible, low-energy splat. Click ripples
    // still arrive through the dedicated ripple field at a higher intensity.
    vel += normalize(dir) * (wake * 0.052 + pulse * 0.032);
    vel += u_pointer.zw * 0.00009;
    float scrollImpulse = clamp(u_scroll.y, -0.22, 0.22);
    vel += vec2(0.0, -scrollImpulse * 0.018);
    vec2 obstacleNormal = normalize(textGrad + vec2(0.00001));
    vel += obstacleNormal * edge * (0.014 + abs(scrollImpulse) * 0.004);
    vel *= 1.0 - obstacle * 0.92;
    outColor = encodeVelocity(vel);
    return;
  }

  if (u_pass == 2) {
    vec2 vl = decodeVelocity(texture(u_velocity, uv - vec2(e.x, 0.0)));
    vec2 vr = decodeVelocity(texture(u_velocity, uv + vec2(e.x, 0.0)));
    vec2 vb = decodeVelocity(texture(u_velocity, uv - vec2(0.0, e.y)));
    vec2 vt = decodeVelocity(texture(u_velocity, uv + vec2(0.0, e.y)));
    float div = (vr.x - vl.x + vt.y - vb.y) * 0.5;
    outColor = vec4(div * 0.5 + 0.5, 0.0, 0.0, 1.0);
    return;
  }

  if (u_pass == 3) {
    float div = texture(u_divergence, uv).r - 0.5;
    float pL = texture(u_pressure, uv - vec2(e.x, 0.0)).r;
    float pR = texture(u_pressure, uv + vec2(e.x, 0.0)).r;
    float pB = texture(u_pressure, uv - vec2(0.0, e.y)).r;
    float pT = texture(u_pressure, uv + vec2(0.0, e.y)).r;
    float p = (pL + pR + pB + pT - div) * 0.25;
    outColor = vec4(mix(p, 0.5, obstacle), 0.0, 0.0, 1.0);
    return;
  }

  if (u_pass == 4) {
    vec2 vel = decodeVelocity(texture(u_velocity, uv));
    float pL = texture(u_pressure, uv - vec2(e.x, 0.0)).r;
    float pR = texture(u_pressure, uv + vec2(e.x, 0.0)).r;
    float pB = texture(u_pressure, uv - vec2(0.0, e.y)).r;
    float pT = texture(u_pressure, uv + vec2(0.0, e.y)).r;
    vel -= vec2(pR - pL, pT - pB) * 0.22;
    vel *= 1.0 - obstacle * 0.96;
    outColor = encodeVelocity(vel);
    return;
  }

  if (u_pass == 5) {
    vec2 vel = decodeVelocity(texture(u_velocity, uv));
    float scrollImpulse = clamp(u_scroll.y, -0.22, 0.22);
    vec4 dye = texture(u_dye, clamp(uv - vel * 0.022 - vec2(0.0, scrollImpulse * 0.0015), vec2(0.0), vec2(1.0))) * 0.982;
    float blue = 0.0;
    float pulse = ripplePulse(uv, pointer, blue);
    dye.rgb += vec3(0.08, 0.44, 1.0) * blue * 0.18 + vec3(1.0) * abs(pulse) * 0.08;
    dye.rgb += vec3(0.08, 0.42, 1.0) * edge * 0.018;
    outColor = vec4(clamp(dye.rgb, 0.0, 1.0), 1.0);
    return;
  }

  if (u_pass == 6) {
    vec4 h = texture(u_height, uv);
    float currentHeight = decodeHeight(h.rg);
    float previousHeight = decodeHeight(h.ba);
    float hL = decodeHeight(texture(u_height, uv - vec2(e.x, 0.0)).rg);
    float hR = decodeHeight(texture(u_height, uv + vec2(e.x, 0.0)).rg);
    float hB = decodeHeight(texture(u_height, uv - vec2(0.0, e.y)).rg);
    float hT = decodeHeight(texture(u_height, uv + vec2(0.0, e.y)).rg);
    float lap = hL + hR + hB + hT - 4.0 * currentHeight;
    float blue = 0.0;
    float pulse = ripplePulse(uv, pointer, blue);
    vec2 fromPointer = uv - pointer;
    float pointerDistance = length(fromPointer);
    vec2 velocityDirection = normalize(pointerVelocity + vec2(0.00001));
    float directionalTrail = exp(-pointerDistance * 7.5)
      * dot(normalize(fromPointer + vec2(0.00001)), velocityDirection)
      * min(length(pointerVelocity) * 5.0, 1.0)
      * u_pointer.z;
    float edgePressure = exp(-pointerDistance * 8.5) * edge * u_pointer.z;
    float deltaScale = clamp(u_delta * 60.0, 0.5, 1.35);
    float ambientSurface = (
      sin(uv.x * 17.0 + uv.y * 7.0 + u_time * 0.58)
      + cos(uv.y * 13.0 - uv.x * 5.0 - u_time * 0.46)
    ) * 0.00018;
    float next = (currentHeight * 2.0 - previousHeight + lap * (0.43 * deltaScale)) * pow(0.994, deltaScale)
      + pulse * 0.22 * deltaScale
      + directionalTrail * 0.035 * deltaScale
      + edgePressure * 0.018 * deltaScale
      + edge * 0.0025 * deltaScale
      + ambientSurface;
    next *= 1.0 - obstacle * 0.18;
    next = clamp(next, -0.12, 0.12);
    outColor = vec4(encodeHeight(next), encodeHeight(currentHeight));
    return;
  }

  if (u_pass == 7) {
    float hL = decodeHeight(texture(u_height, uv - vec2(e.x, 0.0)).rg);
    float hR = decodeHeight(texture(u_height, uv + vec2(e.x, 0.0)).rg);
    float hB = decodeHeight(texture(u_height, uv - vec2(0.0, e.y)).rg);
    float hT = decodeHeight(texture(u_height, uv + vec2(0.0, e.y)).rg);
    vec3 n = normalize(vec3((hL - hR) * 22.0, (hB - hT) * 22.0, 1.0));
    float displayHeight = decodeHeight(texture(u_height, uv).rg);
    outColor = vec4(n.xy * 0.5 + 0.5, encodeDisplayHeight(displayHeight), 1.0);
    return;
  }

  outColor = vec4(0.5, 0.5, 0.5, 1.0);
}
`;

function lowerQualityProfile(current: KineticQuality, width: number, height: number): KineticQuality {
  const nextTier = downgradeQualityTier(current.tier);
  if (nextTier === "balanced") {
    return {
      ...current,
      tier: "balanced",
      dpr: pixelBudgetedDpr(width, height, current.dpr, 1.25, QUALITY_PIXEL_BUDGETS.balanced),
      maxDpr: 1.25,
      targetFps: TARGET_FPS_BY_TIER.balanced,
      simWidth: 224,
      textMaxDim: 1536,
      activeRipples: 6,
      renderScale: 0.9,
      pixelBudget: QUALITY_PIXEL_BUDGETS.balanced,
    };
  }
  if (nextTier === "low") {
    return {
      ...current,
      tier: "low",
      dpr: pixelBudgetedDpr(width, height, current.dpr, 1, QUALITY_PIXEL_BUDGETS.low),
      maxDpr: 1,
      targetFps: TARGET_FPS_BY_TIER.low,
      simWidth: 128,
      textMaxDim: 1024,
      activeRipples: 4,
      renderScale: 0.8,
      pixelBudget: QUALITY_PIXEL_BUDGETS.low,
    };
  }
  return current;
}

export function startFluidRenderer(
  canvas: HTMLCanvasElement,
  getPhysics: () => LiquidPhysics,
  reducedMotionRef: { current: boolean },
  staticModeRef: { current: boolean },
  heroNameRef: { current: boolean },
  initialQuality?: KineticQuality,
  onReady?: () => void,
): () => void {
  let quality = initialQuality ?? resolveKineticQuality(reducedMotionRef.current, staticModeRef.current);
  if (quality.tier === "static") return () => {};

  const glContext = canvas.getContext("webgl2", {
    antialias: false,
    alpha: true,
    premultipliedAlpha: false,
  });
  if (!glContext) throw new Error("WebGL2 unavailable");
  const gl: WebGL2RenderingContext = glContext;
  const supportsFloatTargets = Boolean(
    gl.getExtension("EXT_color_buffer_float")
    && gl.getExtension("OES_texture_float_linear"),
  )
    && supportsRenderTarget(gl, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);

  const program = createProgram(gl, VERTEX_SOURCE, FRAGMENT_SOURCE);
  const simProgram = createProgram(gl, VERTEX_SOURCE, SIM_FRAGMENT_SOURCE);
  gl.useProgram(program);

  const positionLocation = gl.getAttribLocation(program, "a_position");
  const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
  const timeLocation = gl.getUniformLocation(program, "u_time");
  const energyLocation = gl.getUniformLocation(program, "u_energy");
  const pointerLocation = gl.getUniformLocation(program, "u_pointer");
  const nameOpacityLocation = gl.getUniformLocation(program, "u_nameOpacity");
  const sceneIntensityLocation = gl.getUniformLocation(program, "u_sceneIntensity");
  const textureLocation = gl.getUniformLocation(program, "u_texture");
  const textLocation = gl.getUniformLocation(program, "u_text");
  const simNormalLocation = gl.getUniformLocation(program, "u_normalField");
  const simObstacleLocation = gl.getUniformLocation(program, "u_obstacleField");
  const scrollLocation = gl.getUniformLocation(program, "u_scroll");
  const simPassLocation = gl.getUniformLocation(simProgram, "u_pass");
  const simResolutionLocation = gl.getUniformLocation(simProgram, "u_resolution");
  const simPointerLocation = gl.getUniformLocation(simProgram, "u_pointer");
  const simPointerVelocityLocation = gl.getUniformLocation(simProgram, "u_pointerVelocity");
  const simTimeLocation = gl.getUniformLocation(simProgram, "u_time");
  const simDeltaLocation = gl.getUniformLocation(simProgram, "u_delta");
  const simScrollLocation = gl.getUniformLocation(simProgram, "u_scroll");
  const simRippleLocations = Array.from({ length: RIPPLE_COUNT }, (_, i) =>
    gl.getUniformLocation(simProgram, `u_ripples[${i}]`),
  );
  const simHeightLocationRead = gl.getUniformLocation(simProgram, "u_height");
  const simObstacleLocationRead = gl.getUniformLocation(simProgram, "u_obstacle");
  const simTextLocationRead = gl.getUniformLocation(simProgram, "u_text");

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  // pearl background texture
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([248, 251, 255, 255]));
  let disposed = false;
  const image = new Image();
  image.decoding = "async";
  const loadFluidImage = (src: string, fallback = false) => {
    image.dataset.fallback = fallback ? "true" : "false";
    image.src = src;
  };
  const onFluidImageLoad = () => {
    if (disposed) return;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  };
  const onFluidImageError = () => {
    if (disposed) return;
    if (image.dataset.fallback !== "true") loadFluidImage(FLUID_TEXTURE_FALLBACK_SRC, true);
  };
  image.addEventListener("load", onFluidImageLoad);
  image.addEventListener("error", onFluidImageError);
  loadFluidImage(FLUID_TEXTURE_SRC);

  // hero-name coverage texture
  const textTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, textTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));

  let width = 0;
  let height = 0;
  let dpr = 1;
  let frame = 0;
  let resizeFrame = 0;
  let resizeTimer = 0;
  let revealFrame = 0;
  let running = false;
  let surfaceVisible = true;
  let lastRenderTime = 0;
  let lastSimTime = 0;
  let statsStartedAt = performance.now();
  let renderedFrames = 0;
  let lateFrames = 0;
  let adaptiveLevel = 0;
  const startedAt = performance.now();
  let simWidth = 1;
  let simHeight = 1;
  let heightField: DoubleBuffer | null = null;
  let obstacle: SingleBuffer | null = null;
  let normal: SingleBuffer | null = null;

  const renderInternalFormat = supportsFloatTargets ? gl.RGBA16F : gl.RGBA8;
  const renderFormat = gl.RGBA;
  const renderType = supportsFloatTargets ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;

  function bindTexture(unit: number, tex: WebGLTexture | null, uniform: WebGLUniformLocation | null) {
    if (!tex || !uniform) return;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(uniform, unit);
  }

  function disposeSimBuffers() {
    const textures = [
      heightField?.read,
      heightField?.write,
      obstacle?.texture,
      normal?.texture,
    ];
    const fbos = [
      heightField?.readFbo,
      heightField?.writeFbo,
      obstacle?.fbo,
      normal?.fbo,
    ];
    textures.forEach((tex) => tex && gl.deleteTexture(tex));
    fbos.forEach((fbo) => fbo && gl.deleteFramebuffer(fbo));
    heightField = null;
    obstacle = null;
    normal = null;
  }

  function configureSim() {
    simWidth = Math.max(1, quality.simWidth);
    simHeight = Math.max(96, Math.round(simWidth * (height / Math.max(width, 1))));
    disposeSimBuffers();
    let nextHeightField: DoubleBuffer | null = null;
    let nextObstacle: SingleBuffer | null = null;
    let nextNormal: SingleBuffer | null = null;
    try {
      nextHeightField = createDoubleBuffer(gl, simWidth, simHeight, renderInternalFormat, renderFormat, renderType);
      nextObstacle = createSingleBuffer(gl, simWidth, simHeight, renderInternalFormat, renderFormat, renderType);
      nextNormal = createSingleBuffer(gl, simWidth, simHeight, renderInternalFormat, renderFormat, renderType);
    } catch (error) {
      [nextHeightField?.read, nextHeightField?.write, nextObstacle?.texture, nextNormal?.texture]
        .forEach((texture) => texture && gl.deleteTexture(texture));
      [nextHeightField?.readFbo, nextHeightField?.writeFbo, nextObstacle?.fbo, nextNormal?.fbo]
        .forEach((fbo) => fbo && gl.deleteFramebuffer(fbo));
      throw error;
    }
    heightField = nextHeightField;
    obstacle = nextObstacle;
    normal = nextNormal;

    // Packed height values must not be interpolated byte-by-byte. Normals are
    // derived at simulation resolution and remain linearly filtered, which
    // produces a smooth full-resolution optical surface.
    [heightField.read, heightField.write].forEach((texture) => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    });

    const clearBuffer = (fbo: WebGLFramebuffer, r: number, g: number, b: number, a = 1) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.clearColor(r, g, b, a);
      gl.clear(gl.COLOR_BUFFER_BIT);
    };
    const packedZeroHigh = 127 / 255;
    const packedZeroLow = 128 / 255;
    clearBuffer(heightField.readFbo, packedZeroHigh, packedZeroLow, packedZeroHigh, packedZeroLow);
    clearBuffer(heightField.writeFbo, packedZeroHigh, packedZeroLow, packedZeroHigh, packedZeroLow);
    clearBuffer(obstacle.fbo, 0, 0, 0);
    clearBuffer(normal.fbo, 0.5, 0.5, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function setSimUniforms(physics: LiquidPhysics, t: number, delta: number) {
    const pointer = physics.pointer;
    gl.uniform2f(simResolutionLocation, simWidth, simHeight);
    gl.uniform4f(
      simPointerLocation,
      pointer.x / Math.max(width, 1),
      1 - pointer.y / Math.max(height, 1),
      pointer.energy,
      pointer.vy / Math.max(height, 1),
    );
    gl.uniform2f(
      simPointerVelocityLocation,
      pointer.vx / Math.max(width, 1),
      -pointer.vy / Math.max(height, 1),
    );
    gl.uniform1f(simTimeLocation, t);
    gl.uniform1f(simDeltaLocation, delta);
    gl.uniform4f(
      simScrollLocation,
      physics.scroll.progress,
      physics.scroll.velocity,
      physics.scroll.depth,
      physics.scroll.section,
    );
    const rippleOffset = Math.max(0, physics.ripples.length - quality.activeRipples);
    for (let i = 0; i < RIPPLE_COUNT; i++) {
      const ripple = physics.ripples[rippleOffset + i];
      if (ripple && i < quality.activeRipples) {
        gl.uniform4f(
          simRippleLocations[i],
          ripple.x / Math.max(width, 1) * simWidth,
          ripple.y / Math.max(height, 1) * simHeight,
          t - ripple.age,
          ripple.intensity * quality.renderScale,
        );
      }
      else gl.uniform4f(simRippleLocations[i], -9999, -9999, -9999, 0);
    }
  }

  function drawSim(pass: number, fbo: WebGLFramebuffer | null) {
    gl.useProgram(simProgram);
    gl.bindVertexArray(vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, simWidth, simHeight);
    gl.uniform1i(simPassLocation, pass);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function updateSimulation(physics: LiquidPhysics, t: number) {
    if (!heightField || !obstacle || !normal) return;
    const delta = lastSimTime > 0 ? Math.min(0.05, t - lastSimTime) : 1 / 60;
    lastSimTime = t;
    gl.useProgram(simProgram);
    setSimUniforms(physics, t, delta);
    bindTexture(2, heightField.read, simHeightLocationRead);
    bindTexture(5, obstacle.texture, simObstacleLocationRead);
    bindTexture(6, textTexture, simTextLocationRead);

    drawSim(0, obstacle.fbo);
    drawSim(6, heightField.writeFbo);
    heightField.swap();
    bindTexture(2, heightField.read, simHeightLocationRead);
    drawSim(7, normal.fbo);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function regenerateText() {
    if (!heroNameRef.current) return;
    // Keep the glyph field sharp independently from the simulation grid. The
    // fluid solver stays pixel-budgeted while the title gets a stable raster
    // floor on high-DPR and balanced displays.
    const textScale = quality.tier === "high" ? 1.6 : quality.tier === "balanced" ? 1.45 : 1.25;
    const textFloor = Math.round(width * textScale);
    const texW = Math.min(Math.max(960, textFloor), quality.textMaxDim);
    const texH = Math.max(1, Math.round(texW * (height / Math.max(width, 1))));
    const scaleX = texW / Math.max(width, 1);
    const scaleY = texH / Math.max(height, 1);
    const titleLayout = Array.from(
      document.querySelectorAll<HTMLElement>(".hero-name-fallback__word"),
    ).map<HeroTextLineLayout>((word) => {
      const rect = word.getBoundingClientRect();
      const style = getComputedStyle(word);
      return {
        x: rect.left * scaleX,
        y: (rect.top + window.scrollY) * scaleY,
        width: rect.width * scaleX,
        height: rect.height * scaleY,
        fontSize: Number.parseFloat(style.fontSize) * scaleY,
        tracking: Number.parseFloat(style.letterSpacing) * scaleX,
      };
    });
    const textCanvas = createHeroTextCanvas(texW, texH, titleLayout);
    gl.bindTexture(gl.TEXTURE_2D, textTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);
  }

  function configure() {
    width = window.innerWidth;
    height = window.innerHeight;
    quality = resolveKineticQuality(reducedMotionRef.current, staticModeRef.current);
    for (let level = 0; level < adaptiveLevel; level++) {
      quality = lowerQualityProfile(quality, width, height);
    }
    if (quality.tier === "static") return;
    canvas.dataset.quality = quality.tier;
    if (canvas.parentElement) canvas.parentElement.dataset.quality = quality.tier;
    dpr = quality.dpr;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    if (canvas.style.opacity !== "0") {
      canvas.style.opacity = "1";
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    configureSim();
    regenerateText();
  }

  function onResize() {
    cancelAnimationFrame(resizeFrame);
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      resizeFrame = requestAnimationFrame(configure);
    }, 140);
  }

  function paint(t: number) {
    const physics = getPhysics();
    const simulationFps = Math.min(60, quality.targetFps);
    if (lastSimTime === 0 || t - lastSimTime >= 1 / simulationFps) {
      updateSimulation(physics, t);
    }
    const pointer = physics.pointer;
    const scrollY = heroNameRef.current ? window.scrollY : 9999;
    const fadeStart = height * 0.14;
    const fadeEnd = height * 0.56;
    const fadeProgress = Math.min(1, Math.max(0, (scrollY - fadeStart) / Math.max(1, fadeEnd - fadeStart)));
    const nameOpacity = heroNameRef.current ? 1 - fadeProgress * fadeProgress * (3 - 2 * fadeProgress) : 0;
    // Keep the text field resident while it fades. Clearing and rebuilding the
    // texture at a scroll threshold caused visible flashes and simulation gaps.

    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(textureLocation, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, textTexture);
    gl.uniform1i(textLocation, 1);
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform1f(timeLocation, t);
    gl.uniform1f(energyLocation, pointer.energy);
    gl.uniform1f(nameOpacityLocation, nameOpacity);
    gl.uniform1f(sceneIntensityLocation, heroNameRef.current ? 1 : 0);
    gl.uniform2f(pointerLocation, pointer.x * dpr, pointer.y * dpr);
    gl.uniform4f(scrollLocation, physics.scroll.progress, physics.scroll.velocity, physics.scroll.depth, physics.scroll.section);
    if (heightField && normal && obstacle) {
      bindTexture(5, normal.texture, simNormalLocation);
      bindTexture(6, obstacle.texture, simObstacleLocation);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function render(now = performance.now()) {
    if (!running) return;
    const frozen = reducedMotionRef.current || staticModeRef.current;
    if (frozen) {
      paint(0);
      frame = 0;
      return; // single static frame; the name still renders
    }
    const compositeFps = quality.targetFps;
    const interval = 1000 / compositeFps;
    const elapsed = now - lastRenderTime;
    if (elapsed < interval) {
    scheduleRender();
      return;
    }
    if (lastRenderTime > 0 && elapsed > interval * 1.2 && elapsed < interval * 4) {
      lateFrames += 1;
    } else if (elapsed >= interval * 4) {
      // Tab switches, screenshots, and main-thread pauses are not evidence that
      // the sustained quality tier is too high.
      lateFrames = 0;
    } else {
      lateFrames = Math.max(0, lateFrames - 1);
    }
    lastRenderTime = now - (elapsed % interval);
    paint((now - startedAt) / 1000);
    renderedFrames += 1;

    const statsElapsed = now - statsStartedAt;
    if (statsElapsed >= 2000) {
      canvas.dataset.fps = Math.round((renderedFrames * 1000) / statsElapsed).toString();
      statsStartedAt = now;
      renderedFrames = 0;
    }

    // Require sustained misses before reallocating the simulation. A handful
    // of delayed frames during hydration or DevTools activity should not cause
    // a permanent resolution drop and a visible reconfiguration hitch.
    if (lateFrames >= 45 && quality.tier !== "low") {
      adaptiveLevel += 1;
      lateFrames = 0;
      configure();
      canvas.dataset.adaptive = "true";
    }
    scheduleRender();
  }

  function scheduleRender() {
    if (!running) return;
    // Stay aligned to display vsync. Combining setTimeout with rAF frequently
    // misses the next refresh and turns a nominal 45–60 FPS tier into ~30 FPS.
    frame = requestAnimationFrame(render);
  }

  function syncRunning() {
    const shouldRun = !document.hidden && surfaceVisible;
    if (shouldRun === running) return;
    running = shouldRun;
    cancelAnimationFrame(frame);
    if (running) {
      delete canvas.dataset.paused;
      lastRenderTime = 0;
      lastSimTime = 0;
      statsStartedAt = performance.now();
      renderedFrames = 0;
      scheduleRender();
    } else {
      canvas.dataset.paused = document.hidden ? "hidden" : "offscreen";
    }
  }

  function onVisibility() {
    syncRunning();
  }

  canvas.style.opacity = "0";
  canvas.style.mixBlendMode = "normal";
  canvas.style.filter = "none";
  canvas.style.transition = "opacity 420ms ease";
  configure();
  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);

  const renderSurface = document.querySelector<HTMLElement>(
    heroNameRef.current ? ".hero-shell" : ".case-hero",
  );
  let surfaceObserver: IntersectionObserver | null = null;
  if (renderSurface && "IntersectionObserver" in window) {
    const rect = renderSurface.getBoundingClientRect();
    surfaceVisible = rect.bottom > -180 && rect.top < window.innerHeight + 180;
    surfaceObserver = new IntersectionObserver(
      ([entry]) => {
        surfaceVisible = Boolean(entry?.isIntersecting);
        syncRunning();
      },
      { rootMargin: "180px 0px" },
    );
    surfaceObserver.observe(renderSurface);
  }
  syncRunning();
  revealFrame = requestAnimationFrame(() => {
    canvas.style.opacity = "1";
    onReady?.();
  });

  // Re-rasterize once the hero font has loaded; repaint a static frame in
  // frozen mode so the real glyphs appear.
  if (typeof document !== "undefined" && document.fonts?.status !== "loaded") {
    document.fonts.ready
      .then(() => {
        if (disposed) return;
        clearHeroTextCanvasCache();
        regenerateText();
        if (reducedMotionRef.current || staticModeRef.current) paint(0);
      })
      .catch(() => {});
  }

  return () => {
    disposed = true;
    running = false;
    cancelAnimationFrame(frame);
    window.clearTimeout(resizeTimer);
    cancelAnimationFrame(resizeFrame);
    cancelAnimationFrame(revealFrame);
    surfaceObserver?.disconnect();
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibility);
    image.removeEventListener("load", onFluidImageLoad);
    image.removeEventListener("error", onFluidImageError);
    image.src = "";
    gl.deleteTexture(texture);
    gl.deleteTexture(textTexture);
    disposeSimBuffers();
    gl.deleteBuffer(positionBuffer);
    gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
    gl.deleteProgram(simProgram);
  };
}
