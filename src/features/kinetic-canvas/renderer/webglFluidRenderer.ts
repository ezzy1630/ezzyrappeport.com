"use client";

import type { LiquidPhysics } from "../input/liquidInput";
import {
  clearHeroTextCanvasCache,
  createHeroGlyphAtlas,
  HERO_GLYPH_COUNT,
  type HeroGlyphMetadata,
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
import { GLYPH_PHYSICS_FRAGMENT_SOURCE } from "../shaders/glyphPhysics";
import {
  GLYPH_STATE_CODEC_SOURCE,
  unpackGlyphSigned16,
} from "../shaders/glyphStateCodec";
import {
  installGlyphDebug,
  isGlyphDebugEnabled,
  type GlyphDebugController,
  type GlyphDebugImpact,
  type GlyphDebugImpulseRequest,
  type GlyphDebugSnapshot,
} from "../debug/glyphDebug";
import { resolveGlyphImpulse } from "../physics/glyphImpulseModel";

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
uniform bool u_packedHeight;
uniform sampler2D u_velocity;
uniform sampler2D u_dye;
uniform sampler2D u_height;
uniform sampler2D u_pressure;
uniform sampler2D u_divergence;
uniform sampler2D u_obstacle;
uniform sampler2D u_text;
uniform sampler2D u_glyphState;
uniform vec4 u_glyphRest[${HERO_GLYPH_COUNT}];
uniform vec4 u_glyphAtlas[${HERO_GLYPH_COUNT}];
uniform float u_glyphDynamics;
uniform float u_glyphScrollOffset;

${GLYPH_STATE_CODEC_SOURCE}

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
float currentHeight(vec4 value) { return u_packedHeight ? decodeHeight(value.rg) : value.r; }
float previousHeight(vec4 value) { return u_packedHeight ? decodeHeight(value.ba) : value.g; }

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
  pulse += pointerRing * pointerEnv * 0.08;
  blue += max(pointerRing, 0.0) * pointerEnv * 0.22 + exp(-dp * 7.0) * u_pointer.z * 0.42;
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

vec2 rotateGlyph(vec2 value, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c) * value;
}

float glyphDome(float depth) {
  return sin(clamp(clamp(depth, 0.0, 1.0) / 0.85, 0.0, 1.0) * 1.57079632679);
}

vec3 glyphBoundary(vec2 solverUv) {
  vec2 screenUv = vec2(solverUv.x, 1.0 - solverUv.y);
  float coverage = 0.0;
  vec2 boundaryVelocity = vec2(0.0);
  bool nearFirstRow = abs(screenUv.y - (u_glyphRest[0].y - u_glyphScrollOffset)) < u_glyphRest[0].w * 1.45 + 0.038;
  bool nearSecondRow = abs(screenUv.y - (u_glyphRest[4].y - u_glyphScrollOffset)) < u_glyphRest[4].w * 1.45 + 0.038;
  for (int index = 0; index < ${HERO_GLYPH_COUNT}; index++) {
    if (index < 4 && !nearFirstRow) continue;
    if (index >= 4 && !nearSecondRow) continue;
    vec4 rest = u_glyphRest[index];
    rest.y -= u_glyphScrollOffset;
    if (abs(screenUv.y - rest.y) > rest.w * 1.35 + 0.032) continue;
    if (abs(screenUv.x - rest.x) > rest.z * 1.22 + 0.022) continue;
    vec4 transform = readGlyphState(u_glyphState, index, 0) * u_glyphDynamics;
    vec4 velocity = readGlyphState(u_glyphState, index, 1) * u_glyphDynamics;
    vec3 orientation = readGlyphState(u_glyphState, index, 2).xyz * u_glyphDynamics;
    vec3 angularVelocity = readGlyphState(u_glyphState, index, 3).xyz * u_glyphDynamics;
    float scale = 1.0 + transform.z * 2.4;
    vec2 tiltScale = max(vec2(cos(orientation.y), cos(orientation.x)), vec2(0.90));
    vec2 center = rest.xy + transform.xy + vec2(0.0, transform.w)
      + vec2(orientation.y, -orientation.x) * transform.z * 0.22;
    vec2 local = rotateGlyph(screenUv - center, -orientation.z)
      / max(rest.zw * scale * tiltScale, vec2(0.0001));
    local += vec2(orientation.y * local.y, -orientation.x * local.x) * 0.16;
    if (max(abs(local.x), abs(local.y)) > 1.08) continue;
    vec4 region = u_glyphAtlas[index];
    float glyphCoverage = 0.0;
    vec2 volumeParallax = vec2(orientation.y, -orientation.x) * 0.34;
    for (int volumeStep = 0; volumeStep < 9; volumeStep++) {
      float depth = 1.0 - float(volumeStep) * 0.25;
      vec2 rayLocal = local + volumeParallax * depth;
      vec2 tileUv = clamp(rayLocal * 0.5 + 0.5, vec2(0.002), vec2(0.998));
      vec2 atlasUv = region.xy + tileUv * region.zw;
      vec4 field = max(abs(rayLocal.x), abs(rayLocal.y)) < 0.995
        ? texture(u_text, atlasUv) : vec4(0.0);
      float signedDistance = field.r * 2.0 - 1.0 + 0.025;
      float volumeDistance = min(signedDistance, glyphDome(field.g) - abs(depth));
      glyphCoverage = max(glyphCoverage, smoothstep(-0.012, 0.012, volumeDistance));
    }
    if (glyphCoverage > coverage) {
      coverage = glyphCoverage;
      vec2 screenOffset = screenUv - center;
      vec2 tangential = angularVelocity.z * vec2(-screenOffset.y, screenOffset.x);
      boundaryVelocity = vec2(
        velocity.x + tangential.x,
        -velocity.y - velocity.w - tangential.y
      );
    }
  }
  return vec3(coverage, boundaryVelocity);
}

void main() {
  vec2 uv = v_uv;
  vec2 e = texel();
  vec2 pointer = u_pointer.xy;
  vec2 pointerVelocity = u_pointerVelocity;
  vec3 boundary = u_pass == 0 ? glyphBoundary(uv) : vec3(texture(u_obstacle, uv).r, 0.0, 0.0);
  float text = boundary.x;
  vec2 textGrad = u_pass == 1
    ? vec2(
        texture(u_obstacle, uv + vec2(e.x, 0.0)).r - texture(u_obstacle, uv - vec2(e.x, 0.0)).r,
        texture(u_obstacle, uv + vec2(0.0, e.y)).r - texture(u_obstacle, uv - vec2(0.0, e.y)).r
      )
    : vec2(0.0);
  float obstacle = clamp(text * 0.95, 0.0, 1.0);
  float edge = u_pass == 0
    ? smoothstep(0.01, 0.30, text) * (1.0 - smoothstep(0.72, 0.995, text))
    : texture(u_obstacle, uv).g;

  if (u_pass == 0) {
    outColor = vec4(obstacle, edge, clamp(boundary.yz * 0.5 + 0.5, 0.0, 1.0));
    return;
  }

  if (u_pass == 1) {
    vec2 priorVelocity = decodeVelocity(texture(u_velocity, uv));
    vec2 advectedUv = clamp(uv - priorVelocity * 0.018, vec2(0.0), vec2(1.0));
    vec2 vel = decodeVelocity(texture(u_velocity, advectedUv)) * 0.991;
    vec2 boundaryVelocity = (texture(u_obstacle, uv).ba - 0.5) * 2.0;
    float blue = 0.0;
    float pulse = ripplePulse(uv, pointer, blue);
    vec2 dir = uv - pointer;
    float len = max(length(dir), 0.001);
    float wake = exp(-len * 4.2) * u_pointer.z;
    // Normal pointer travel is a visible, low-energy splat. Click ripples
    // still arrive through the dedicated ripple field at a higher intensity.
    vel += normalize(dir) * (wake * 0.038 + pulse * 0.030);
    vel += pointerVelocity * wake * 0.34;
    vec2 ambientCurrent = vec2(
      sin(uv.y * 8.0 + u_time * 0.31) + cos((uv.x + uv.y) * 5.0 - u_time * 0.23),
      cos(uv.x * 7.0 - u_time * 0.27) - sin((uv.x - uv.y) * 4.0 + u_time * 0.19)
    ) * 0.00055;
    vel += ambientCurrent;
    float scrollImpulse = clamp(u_scroll.y, -0.22, 0.22);
    vel += vec2(0.0, -scrollImpulse * 0.018);
    vec2 obstacleNormal = normalize(textGrad + vec2(0.00001));
    vel += obstacleNormal * edge * (0.014 + abs(scrollImpulse) * 0.004);
    // A moving glyph is a no-slip boundary rather than a frozen mask. Its
    // spring motion therefore leaves a small coherent wake in the same field
    // that drives the glyph on the following frame.
    vel = mix(vel, boundaryVelocity, obstacle * 0.74);
    vel += boundaryVelocity * edge * 0.30;
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
    vec2 transportedUv = clamp(uv - decodeVelocity(texture(u_velocity, uv)) * 0.012, vec2(0.0), vec2(1.0));
    vec4 h = texture(u_height, transportedUv);
    float heightNow = currentHeight(h);
    float heightPrevious = previousHeight(h);
    float hL = currentHeight(texture(u_height, uv - vec2(e.x, 0.0)));
    float hR = currentHeight(texture(u_height, uv + vec2(e.x, 0.0)));
    float hB = currentHeight(texture(u_height, uv - vec2(0.0, e.y)));
    float hT = currentHeight(texture(u_height, uv + vec2(0.0, e.y)));
    float lap = hL + hR + hB + hT - 4.0 * heightNow;
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
    float next = (heightNow * 2.0 - heightPrevious + lap * (0.43 * deltaScale)) * pow(0.994, deltaScale)
      + pulse * 0.22 * deltaScale
      + directionalTrail * 0.055 * deltaScale
      + edgePressure * 0.028 * deltaScale
      + edge * 0.0025 * deltaScale
      + ambientSurface;
    next *= 1.0 - obstacle * 0.18;
    next = clamp(next, -0.12, 0.12);
    outColor = u_packedHeight
      ? vec4(encodeHeight(next), encodeHeight(heightNow))
      : vec4(next, heightNow, 0.0, 1.0);
    return;
  }

  if (u_pass == 7) {
    float hL = currentHeight(texture(u_height, uv - vec2(e.x, 0.0)));
    float hR = currentHeight(texture(u_height, uv + vec2(e.x, 0.0)));
    float hB = currentHeight(texture(u_height, uv - vec2(0.0, e.y)));
    float hT = currentHeight(texture(u_height, uv + vec2(0.0, e.y)));
    vec3 n = normalize(vec3((hL - hR) * 22.0, (hB - hT) * 22.0, 1.0));
    float displayHeight = currentHeight(texture(u_height, uv));
    outColor = vec4(n.xy * 0.5 + 0.5, encodeDisplayHeight(displayHeight), 1.0);
    return;
  }

  outColor = vec4(0.5, 0.5, 0.5, 1.0);
}
`;

const COPY_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
uniform sampler2D u_source;
in vec2 v_uv;
out vec4 outColor;
void main() { outColor = texture(u_source, v_uv); }
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

function applyPackedTargetProfile(current: KineticQuality): KineticQuality {
  if (current.tier === "high") {
    return { ...current, simWidth: 256, pressureIterations: 6 };
  }
  if (current.tier === "balanced") {
    return { ...current, simWidth: 208, pressureIterations: 4 };
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
  onRecover?: () => void,
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
  const searchParams = new URLSearchParams(window.location.search);
  const forcePackedGlyphState = searchParams.get("glyphState") === "packed";
  const glyphDebugEnabled = isGlyphDebugEnabled();
  const glyphMaterialTestEnabled = process.env.NODE_ENV !== "production"
    && searchParams.get("glyphMaterialTest") === "1";
  const supportsFloatTargets = !forcePackedGlyphState && Boolean(
    gl.getExtension("EXT_color_buffer_float")
    && gl.getExtension("OES_texture_float_linear"),
  )
    && supportsRenderTarget(gl, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);

  const program = createProgram(gl, VERTEX_SOURCE, FRAGMENT_SOURCE);
  const simProgram = createProgram(gl, VERTEX_SOURCE, SIM_FRAGMENT_SOURCE);
  const glyphPhysicsProgram = createProgram(gl, VERTEX_SOURCE, GLYPH_PHYSICS_FRAGMENT_SOURCE);
  const copyProgram = createProgram(gl, VERTEX_SOURCE, COPY_FRAGMENT_SOURCE);
  const copySourceLocation = gl.getUniformLocation(copyProgram, "u_source");
  gl.useProgram(program);

  const positionLocation = gl.getAttribLocation(program, "a_position");
  const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
  const timeLocation = gl.getUniformLocation(program, "u_time");
  const energyLocation = gl.getUniformLocation(program, "u_energy");
  const pointerLocation = gl.getUniformLocation(program, "u_pointer");
  const nameOpacityLocation = gl.getUniformLocation(program, "u_nameOpacity");
  const sceneIntensityLocation = gl.getUniformLocation(program, "u_sceneIntensity");
  const rippleLocations = Array.from({ length: RIPPLE_COUNT }, (_, i) =>
    gl.getUniformLocation(program, `u_ripples[${i}]`),
  );
  const textureLocation = gl.getUniformLocation(program, "u_texture");
  const textLocation = gl.getUniformLocation(program, "u_text");
  const textResolutionLocation = gl.getUniformLocation(program, "u_textResolution");
  const glyphStateLocation = gl.getUniformLocation(program, "u_glyphState");
  const glyphRestLocation = gl.getUniformLocation(program, "u_glyphRest[0]");
  const glyphAtlasLocation = gl.getUniformLocation(program, "u_glyphAtlas[0]");
  const glyphDynamicsLocation = gl.getUniformLocation(program, "u_glyphDynamics");
  const glyphScrollLocation = gl.getUniformLocation(program, "u_glyphScrollOffset");
  const packedGlyphStateLocation = gl.getUniformLocation(program, "u_packedGlyphState");
  const simNormalLocation = gl.getUniformLocation(program, "u_normalField");
  const velocityLocation = gl.getUniformLocation(program, "u_velocityField");
  const simObstacleLocation = gl.getUniformLocation(program, "u_obstacleField");
  const dyeLocation = gl.getUniformLocation(program, "u_dyeField");
  const scrollLocation = gl.getUniformLocation(program, "u_scroll");
  const simPassLocation = gl.getUniformLocation(simProgram, "u_pass");
  const simResolutionLocation = gl.getUniformLocation(simProgram, "u_resolution");
  const simPointerLocation = gl.getUniformLocation(simProgram, "u_pointer");
  const simPointerVelocityLocation = gl.getUniformLocation(simProgram, "u_pointerVelocity");
  const simTimeLocation = gl.getUniformLocation(simProgram, "u_time");
  const simDeltaLocation = gl.getUniformLocation(simProgram, "u_delta");
  const simPackedHeightLocation = gl.getUniformLocation(simProgram, "u_packedHeight");
  const simScrollLocation = gl.getUniformLocation(simProgram, "u_scroll");
  const simRippleLocations = Array.from({ length: RIPPLE_COUNT }, (_, i) =>
    gl.getUniformLocation(simProgram, `u_ripples[${i}]`),
  );
  const simHeightLocationRead = gl.getUniformLocation(simProgram, "u_height");
  const simVelocityLocationRead = gl.getUniformLocation(simProgram, "u_velocity");
  const simDyeLocationRead = gl.getUniformLocation(simProgram, "u_dye");
  const simPressureLocationRead = gl.getUniformLocation(simProgram, "u_pressure");
  const simDivergenceLocationRead = gl.getUniformLocation(simProgram, "u_divergence");
  const simObstacleLocationRead = gl.getUniformLocation(simProgram, "u_obstacle");
  const simTextLocationRead = gl.getUniformLocation(simProgram, "u_text");
  const simGlyphStateLocation = gl.getUniformLocation(simProgram, "u_glyphState");
  const simGlyphRestLocation = gl.getUniformLocation(simProgram, "u_glyphRest[0]");
  const simGlyphAtlasLocation = gl.getUniformLocation(simProgram, "u_glyphAtlas[0]");
  const simGlyphDynamicsLocation = gl.getUniformLocation(simProgram, "u_glyphDynamics");
  const simGlyphScrollLocation = gl.getUniformLocation(simProgram, "u_glyphScrollOffset");
  const simPackedGlyphStateLocation = gl.getUniformLocation(simProgram, "u_packedGlyphState");

  const glyphDeltaLocation = gl.getUniformLocation(glyphPhysicsProgram, "u_delta");
  const glyphTimeLocation = gl.getUniformLocation(glyphPhysicsProgram, "u_time");
  const glyphRestPhysicsLocation = gl.getUniformLocation(glyphPhysicsProgram, "u_glyphRest[0]");
  const glyphPropertiesLocation = gl.getUniformLocation(glyphPhysicsProgram, "u_glyphPhysics[0]");
  const glyphMaterialLocation = gl.getUniformLocation(glyphPhysicsProgram, "u_glyphMaterial[0]");
  const glyphStateReadLocation = gl.getUniformLocation(glyphPhysicsProgram, "u_state");
  const glyphVelocityReadLocation = gl.getUniformLocation(glyphPhysicsProgram, "u_velocity");
  const glyphNormalReadLocation = gl.getUniformLocation(glyphPhysicsProgram, "u_normal");
  const glyphPressureReadLocation = gl.getUniformLocation(glyphPhysicsProgram, "u_pressure");
  const glyphViewportLocation = gl.getUniformLocation(glyphPhysicsProgram, "u_viewport");
  const glyphPointerLocation = gl.getUniformLocation(glyphPhysicsProgram, "u_pointer");
  const glyphPointerVelocityLocation = gl.getUniformLocation(glyphPhysicsProgram, "u_pointerVelocity");
  const glyphDebugImpulseLocation = gl.getUniformLocation(glyphPhysicsProgram, "u_debugImpulse");
  const glyphDebugImpulseMetaLocation = gl.getUniformLocation(glyphPhysicsProgram, "u_debugImpulseMeta");
  const glyphPhysicsScrollLocation = gl.getUniformLocation(glyphPhysicsProgram, "u_glyphScrollOffset");
  const glyphPackedStateLocation = gl.getUniformLocation(glyphPhysicsProgram, "u_packedGlyphState");
  const glyphRippleLocations = Array.from(
    { length: RIPPLE_COUNT },
    (_, i) => gl.getUniformLocation(glyphPhysicsProgram, `u_ripples[${i}]`),
  );

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
  let textWidth = 1;
  let textHeight = 1;
  let glyphLayoutScrollY = window.scrollY;
  let glyphMetadata: HeroGlyphMetadata[] = [];
  let dpr = 1;
  let frame = 0;
  let resizeFrame = 0;
  let resizeTimer = 0;
  let revealFrame = 0;
  let running = false;
  let surfaceVisible = true;
  let observedDevicePixelRatio = window.devicePixelRatio;
  let lastRenderTime = 0;
  let lastSimTime = 0;
  let lastGlyphTime = 0;
  let statsStartedAt = performance.now();
  let renderedFrames = 0;
  let poorPerformanceWindows = 0;
  let healthyPerformanceWindows = 0;
  let adaptiveLevel = 0;
  const startedAt = performance.now();
  let simWidth = 1;
  let simHeight = 1;
  let heightField: DoubleBuffer | null = null;
  let velocityField: DoubleBuffer | null = null;
  let dyeField: DoubleBuffer | null = null;
  let pressureField: DoubleBuffer | null = null;
  let divergence: SingleBuffer | null = null;
  let obstacle: SingleBuffer | null = null;
  let normal: SingleBuffer | null = null;
  let glyphState: DoubleBuffer | null = null;
  let glyphDebugController: GlyphDebugController | null = null;
  let glyphDebugSnapshots: GlyphDebugSnapshot[] = [];
  let glyphDebugImpacts: Array<GlyphDebugImpact | null> = [];
  let lastTrackedPointerTime = -1;
  let lastTrackedRippleTime = -1;
  let lastGlyphDebugReadAt = -Infinity;
  let debugImpulse: {
    point: [number, number];
    direction: [number, number];
    strength: number;
    startedAt: number;
    selectedIndex: number;
    selectedMode: boolean;
  } | null = null;

  const renderInternalFormat = supportsFloatTargets ? gl.RGBA16F : gl.RGBA8;
  const renderFormat = gl.RGBA;
  const renderType = supportsFloatTargets ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
  const glyphStateHeight = supportsFloatTargets ? 4 : 8;
  canvas.dataset.glyphState = supportsFloatTargets ? "float16" : "packed16";

  glyphState = createDoubleBuffer(
    gl,
    HERO_GLYPH_COUNT,
    glyphStateHeight,
    renderInternalFormat,
    renderFormat,
    renderType,
  );
  [glyphState.read, glyphState.write].forEach((stateTexture) => {
    gl.bindTexture(gl.TEXTURE_2D, stateTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  });
  [glyphState.readFbo, glyphState.writeFbo].forEach((stateFbo) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, stateFbo);
    if (supportsFloatTargets) gl.clearColor(0, 0, 0, 0);
    else gl.clearColor(128 / 255, 0, 128 / 255, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  });
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  function bindTexture(unit: number, tex: WebGLTexture | null, uniform: WebGLUniformLocation | null) {
    if (!tex || !uniform) return;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(uniform, unit);
  }

  function flattenGlyphMetadata(select: (glyph: HeroGlyphMetadata) => readonly number[]) {
    const values = new Float32Array(HERO_GLYPH_COUNT * 4);
    glyphMetadata.forEach((glyph, index) => values.set(select(glyph), index * 4));
    return values;
  }

  function uploadGlyphMetadata() {
    if (glyphMetadata.length !== HERO_GLYPH_COUNT) return;
    const rests = flattenGlyphMetadata((glyph) => glyph.rest);
    const atlasRegions = flattenGlyphMetadata((glyph) => glyph.atlas);
    gl.useProgram(program);
    gl.uniform4fv(glyphRestLocation, rests);
    gl.uniform4fv(glyphAtlasLocation, atlasRegions);
    gl.uniform1f(glyphDynamicsLocation, 1);
    gl.uniform1i(packedGlyphStateLocation, supportsFloatTargets ? 0 : 1);
    gl.useProgram(simProgram);
    gl.uniform4fv(simGlyphRestLocation, rests);
    gl.uniform4fv(simGlyphAtlasLocation, atlasRegions);
    gl.uniform1f(simGlyphDynamicsLocation, 1);
    gl.uniform1i(simPackedGlyphStateLocation, supportsFloatTargets ? 0 : 1);
    gl.useProgram(glyphPhysicsProgram);
    gl.uniform4fv(glyphRestPhysicsLocation, rests);
    gl.uniform4fv(glyphPropertiesLocation, flattenGlyphMetadata((glyph) => glyph.physics));
    gl.uniform4fv(glyphMaterialLocation, flattenGlyphMetadata((glyph) => glyph.material));
    gl.uniform1i(glyphPackedStateLocation, supportsFloatTargets ? 0 : 1);
  }

  function recordDebugImpulse(
    point: [number, number],
    direction: [number, number],
    strength: number,
    selectedIndex: number,
    selectedMode: boolean,
  ) {
    const normalizedStrength = Math.max(0.05, Math.min(2, strength));
    debugImpulse = {
      point,
      direction,
      strength: normalizedStrength,
      // Use the renderer clock directly. `lastGlyphTime` can be stale after a
      // tab pause or immediately after reload, which used to expire a debug
      // impulse before the next GPU update observed it.
      startedAt: (performance.now() - startedAt) / 1000,
      selectedIndex,
      selectedMode,
    };
    const event = { point, direction, strength: normalizedStrength } as const;
    const viewport = [width, height] as const;
    const scrollOffset = (window.scrollY - glyphLayoutScrollY) / Math.max(height, 1);
    glyphDebugImpacts = glyphMetadata.map((glyph) => {
      const resolved = resolveGlyphImpulse({
        index: glyph.index,
        center: [glyph.rest[0], glyph.rest[1] - scrollOffset],
        halfSize: glyph.rest.slice(2, 4) as [number, number],
        mass: glyph.physics[0],
      }, event, viewport);
      const selectionWeight = selectedMode && glyph.index !== selectedIndex ? 0.06 : 1;
      return {
        source: "debug",
        position: [point[0] * width, point[1] * height],
        impulse: [resolved.force[0] * selectionWeight, resolved.force[1] * selectionWeight],
        strength: resolved.weight * normalizedStrength * selectionWeight,
        timestamp: performance.now(),
      };
    });
  }

  function applyGlyphDebugImpulse(request: GlyphDebugImpulseRequest) {
    if (!glyphDebugEnabled || glyphMetadata.length !== HERO_GLYPH_COUNT) return;
    if (request.kind === "between") {
      const first = glyphMetadata[request.firstGlyphIndex];
      const second = glyphMetadata[request.secondGlyphIndex];
      if (!first || !second) return;
      const scrollOffset = (window.scrollY - glyphLayoutScrollY) / Math.max(height, 1);
      recordDebugImpulse(
        [
          (first.rest[0] + second.rest[0]) * 0.5,
          (first.rest[1] + second.rest[1]) * 0.5 - scrollOffset,
        ],
        [0, -1],
        request.strength,
        -1,
        false,
      );
      return;
    }
    const glyph = glyphMetadata[request.glyphIndex];
    if (!glyph) return;
    const scrollOffset = (window.scrollY - glyphLayoutScrollY) / Math.max(height, 1);
    const anchorOffset = request.anchor === "left-edge" ? -0.82
      : request.anchor === "right-edge" ? 0.82 : 0;
    recordDebugImpulse(
      [glyph.rest[0] + glyph.rest[2] * anchorOffset, glyph.rest[1] - scrollOffset],
      [0, -1],
      request.strength,
      glyph.index,
      true,
    );
  }

  function captureInteractionImpacts(physics: LiquidPhysics) {
    if (!glyphDebugEnabled || glyphMetadata.length !== HERO_GLYPH_COUNT) return;
    const latestRipple = physics.ripples.at(-1);
    const hasNewRipple = Boolean(latestRipple && latestRipple.time > lastTrackedRippleTime);
    const hasNewPointer = physics.pointer.active && physics.pointer.time > lastTrackedPointerTime;
    if (!hasNewRipple && !hasNewPointer) return;
    const source = hasNewRipple ? "ripple" as const : "pointer" as const;
    const x = hasNewRipple ? latestRipple!.x : physics.pointer.x;
    const y = hasNewRipple ? latestRipple!.y : physics.pointer.y;
    const strength = hasNewRipple
      ? latestRipple!.intensity
      : Math.max(0.05, physics.pointer.energy * Math.min(1, physics.pointer.speed + 0.2));
    if (hasNewRipple) lastTrackedRippleTime = latestRipple!.time;
    else lastTrackedPointerTime = physics.pointer.time;
    const point = [x / Math.max(width, 1), y / Math.max(height, 1)] as const;
    const scrollOffset = (window.scrollY - glyphLayoutScrollY) / Math.max(height, 1);
    glyphDebugImpacts = glyphMetadata.map((glyph) => {
      const radialX = glyph.rest[0] - point[0];
      const radialY = glyph.rest[1] - scrollOffset - point[1];
      const directionLength = Math.max(Math.hypot(radialX, radialY), 0.0001);
      const direction = hasNewRipple
        ? [radialX / directionLength, radialY / directionLength] as const
        : [physics.pointer.vx / Math.max(width, 1), physics.pointer.vy / Math.max(height, 1)] as const;
      const resolved = resolveGlyphImpulse({
        index: glyph.index,
        center: [glyph.rest[0], glyph.rest[1] - scrollOffset],
        halfSize: glyph.rest.slice(2, 4) as [number, number],
        mass: glyph.physics[0],
      }, { point, direction, strength }, [width, height]);
      return {
        source,
        position: [x, y],
        impulse: resolved.force,
        strength: resolved.weight * strength,
        timestamp: hasNewRipple ? latestRipple!.time : physics.pointer.time,
      };
    });
  }

  function readGlyphDebugState() {
    if (!glyphDebugEnabled || !glyphState || glyphMetadata.length !== HERO_GLYPH_COUNT) return;
    const now = performance.now();
    if (now - lastGlyphDebugReadAt < 90) return;
    lastGlyphDebugReadAt = now;
    gl.bindFramebuffer(gl.FRAMEBUFFER, glyphState.readFbo);
    let readState: (index: number, row: number) => [number, number, number, number];
    if (supportsFloatTargets) {
      const values = new Float32Array(HERO_GLYPH_COUNT * 4 * 4);
      gl.readPixels(0, 0, HERO_GLYPH_COUNT, 4, gl.RGBA, gl.FLOAT, values);
      readState = (index, row) => {
        const offset = (row * HERO_GLYPH_COUNT + index) * 4;
        return [values[offset], values[offset + 1], values[offset + 2], values[offset + 3]];
      };
    } else {
      const values = new Uint8Array(HERO_GLYPH_COUNT * 8 * 4);
      gl.readPixels(0, 0, HERO_GLYPH_COUNT, 8, gl.RGBA, gl.UNSIGNED_BYTE, values);
      readState = (index, row) => {
        const lower = (row * 2 * HERO_GLYPH_COUNT + index) * 4;
        const upper = ((row * 2 + 1) * HERO_GLYPH_COUNT + index) * 4;
        return [
          unpackGlyphSigned16([values[lower], values[lower + 1]], row, 0),
          unpackGlyphSigned16([values[lower + 2], values[lower + 3]], row, 1),
          unpackGlyphSigned16([values[upper], values[upper + 1]], row, 2),
          unpackGlyphSigned16([values[upper + 2], values[upper + 3]], row, 3),
        ];
      };
    }
    glyphDebugSnapshots = glyphMetadata.map((glyph, index) => {
      const transform = readState(index, 0);
      const velocity = readState(index, 1);
      const orientation = readState(index, 2);
      const angularVelocity = readState(index, 3);
      const centerX = (glyph.rest[0] + transform[0]) * width;
      const scrollOffset = (window.scrollY - glyphLayoutScrollY) / Math.max(height, 1);
      const restY = glyph.rest[1] - scrollOffset;
      const centerY = (restY + transform[1] + transform[3]) * height;
      const halfWidth = glyph.rest[2] * width;
      const halfHeight = glyph.rest[3] * height;
      const velocityPixels = [velocity[0] * width, (velocity[1] + velocity[3]) * height] as const;
      const displacementPixels = [transform[0] * width, (transform[1] + transform[3]) * height] as const;
      const priorImpact = glyphDebugImpacts[index] ?? null;
      const measuredImpact = priorImpact && now - priorImpact.timestamp < 800
        ? {
            ...priorImpact,
            impulse: velocityPixels,
            strength: Math.hypot(...velocityPixels) * 0.02
              + Math.hypot(angularVelocity[0], angularVelocity[1], angularVelocity[2]) * 0.8
              + Math.hypot(...displacementPixels) * 0.06,
          }
        : priorImpact;
      glyphDebugImpacts[index] = measuredImpact;
      return {
        index: glyph.index,
        identity: glyph.glyph,
        restCenter: [glyph.rest[0] * width, restY * height],
        currentCenter: [centerX, centerY],
        bounds: {
          left: centerX - halfWidth,
          top: centerY - halfHeight,
          right: centerX + halfWidth,
          bottom: centerY + halfHeight,
        },
        displacement: displacementPixels,
        velocity: velocityPixels,
        orientation: [orientation[0], orientation[1], orientation[2]],
        angularVelocity: [angularVelocity[0], angularVelocity[1], angularVelocity[2]],
        latestImpact: measuredImpact,
      } satisfies GlyphDebugSnapshot;
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function updateGlyphPhysics(physics: LiquidPhysics, t: number) {
    if (
      !glyphState || !velocityField || !normal || !pressureField
      || glyphMetadata.length !== HERO_GLYPH_COUNT
    ) return;
    const delta = lastGlyphTime > 0 ? Math.min(0.034, t - lastGlyphTime) : 1 / 60;
    lastGlyphTime = t;
    gl.useProgram(glyphPhysicsProgram);
    gl.bindVertexArray(vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER, glyphState.writeFbo);
    gl.viewport(0, 0, HERO_GLYPH_COUNT, glyphStateHeight);
    gl.uniform1f(glyphDeltaLocation, delta);
    gl.uniform1f(glyphTimeLocation, t);
    gl.uniform2f(glyphViewportLocation, width, height);
    gl.uniform1f(
      glyphPhysicsScrollLocation,
      (window.scrollY - glyphLayoutScrollY) / Math.max(height, 1),
    );
    const pointer = physics.pointer;
    captureInteractionImpacts(physics);
    gl.uniform4f(
      glyphPointerLocation,
      pointer.x / Math.max(width, 1),
      pointer.y / Math.max(height, 1),
      pointer.energy,
      1,
    );
    gl.uniform2f(
      glyphPointerVelocityLocation,
      Math.max(-1.2, Math.min(1.2, pointer.vx / Math.max(width, 1))),
      Math.max(-1.2, Math.min(1.2, pointer.vy / Math.max(height, 1))),
    );
    const debugAge = debugImpulse ? t - debugImpulse.startedAt : 999;
    gl.uniform4f(
      glyphDebugImpulseLocation,
      debugImpulse?.point[0] ?? -999,
      debugImpulse?.point[1] ?? -999,
      debugImpulse?.direction[0] ?? 0,
      debugImpulse?.direction[1] ?? 0,
    );
    gl.uniform4f(
      glyphDebugImpulseMetaLocation,
      debugAge,
      debugImpulse?.strength ?? 0,
      debugImpulse?.selectedMode ? 1 : 0,
      debugImpulse?.selectedIndex ?? -1,
    );
    const rippleOffset = Math.max(0, physics.ripples.length - quality.activeRipples);
    for (let i = 0; i < RIPPLE_COUNT; i++) {
      const ripple = physics.ripples[rippleOffset + i];
      if (ripple && i < quality.activeRipples) {
        gl.uniform4f(
          glyphRippleLocations[i],
          ripple.x / Math.max(width, 1),
          ripple.y / Math.max(height, 1),
          t - ripple.age,
          ripple.intensity * quality.renderScale,
        );
      } else gl.uniform4f(glyphRippleLocations[i], -9999, -9999, -9999, 0);
    }
    bindTexture(0, glyphState.read, glyphStateReadLocation);
    bindTexture(1, velocityField.read, glyphVelocityReadLocation);
    bindTexture(2, normal.texture, glyphNormalReadLocation);
    bindTexture(3, pressureField.read, glyphPressureReadLocation);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    glyphState.swap();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    readGlyphDebugState();
  }

  function disposeSimBuffers() {
    const textures = [
      heightField?.read,
      heightField?.write,
      velocityField?.read,
      velocityField?.write,
      dyeField?.read,
      dyeField?.write,
      pressureField?.read,
      pressureField?.write,
      divergence?.texture,
      obstacle?.texture,
      normal?.texture,
    ];
    const fbos = [
      heightField?.readFbo,
      heightField?.writeFbo,
      velocityField?.readFbo,
      velocityField?.writeFbo,
      dyeField?.readFbo,
      dyeField?.writeFbo,
      pressureField?.readFbo,
      pressureField?.writeFbo,
      divergence?.fbo,
      obstacle?.fbo,
      normal?.fbo,
    ];
    textures.forEach((tex) => tex && gl.deleteTexture(tex));
    fbos.forEach((fbo) => fbo && gl.deleteFramebuffer(fbo));
    heightField = null;
    velocityField = null;
    dyeField = null;
    pressureField = null;
    divergence = null;
    obstacle = null;
    normal = null;
  }

  function deleteDoubleBuffer(buffer: DoubleBuffer | null) {
    if (!buffer) return;
    gl.deleteTexture(buffer.read);
    gl.deleteTexture(buffer.write);
    gl.deleteFramebuffer(buffer.readFbo);
    gl.deleteFramebuffer(buffer.writeFbo);
  }

  function deleteSingleBuffer(buffer: SingleBuffer | null) {
    if (!buffer) return;
    gl.deleteTexture(buffer.texture);
    gl.deleteFramebuffer(buffer.fbo);
  }

  function copyTexture(source: WebGLTexture, target: WebGLFramebuffer, targetWidth: number, targetHeight: number) {
    gl.useProgram(copyProgram);
    gl.bindVertexArray(vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.viewport(0, 0, targetWidth, targetHeight);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, source);
    gl.uniform1i(copySourceLocation, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function configureSim() {
    const previousHeightField = heightField;
    const previousVelocityField = velocityField;
    const previousDyeField = dyeField;
    const previousPressureField = pressureField;
    const previousDivergence = divergence;
    const previousObstacle = obstacle;
    const previousNormal = normal;
    simWidth = Math.max(1, quality.simWidth);
    simHeight = Math.max(96, Math.round(simWidth * (height / Math.max(width, 1))));
    let nextHeightField: DoubleBuffer | null = null;
    let nextVelocityField: DoubleBuffer | null = null;
    let nextDyeField: DoubleBuffer | null = null;
    let nextPressureField: DoubleBuffer | null = null;
    let nextDivergence: SingleBuffer | null = null;
    let nextObstacle: SingleBuffer | null = null;
    let nextNormal: SingleBuffer | null = null;
    try {
      nextHeightField = createDoubleBuffer(gl, simWidth, simHeight, renderInternalFormat, renderFormat, renderType);
      nextVelocityField = createDoubleBuffer(gl, simWidth, simHeight, renderInternalFormat, renderFormat, renderType);
      nextDyeField = createDoubleBuffer(gl, simWidth, simHeight, renderInternalFormat, renderFormat, renderType);
      nextPressureField = createDoubleBuffer(gl, simWidth, simHeight, renderInternalFormat, renderFormat, renderType);
      nextDivergence = createSingleBuffer(gl, simWidth, simHeight, renderInternalFormat, renderFormat, renderType);
      nextObstacle = createSingleBuffer(gl, simWidth, simHeight, renderInternalFormat, renderFormat, renderType);
      nextNormal = createSingleBuffer(gl, simWidth, simHeight, renderInternalFormat, renderFormat, renderType);
    } catch (error) {
      [nextHeightField?.read, nextHeightField?.write, nextVelocityField?.read, nextVelocityField?.write,
        nextDyeField?.read, nextDyeField?.write, nextPressureField?.read, nextPressureField?.write,
        nextDivergence?.texture, nextObstacle?.texture, nextNormal?.texture]
        .forEach((texture) => texture && gl.deleteTexture(texture));
      [nextHeightField?.readFbo, nextHeightField?.writeFbo, nextVelocityField?.readFbo, nextVelocityField?.writeFbo,
        nextDyeField?.readFbo, nextDyeField?.writeFbo, nextPressureField?.readFbo, nextPressureField?.writeFbo,
        nextDivergence?.fbo, nextObstacle?.fbo, nextNormal?.fbo]
        .forEach((fbo) => fbo && gl.deleteFramebuffer(fbo));
      throw error;
    }
    heightField = nextHeightField;
    velocityField = nextVelocityField;
    dyeField = nextDyeField;
    pressureField = nextPressureField;
    divergence = nextDivergence;
    obstacle = nextObstacle;
    normal = nextNormal;

    // Half-float height fields retain signed values and interpolate smoothly.
    // Only the RGBA8 compatibility path needs packed bytes and nearest reads.
    if (!supportsFloatTargets) {
      [heightField.read, heightField.write].forEach((texture) => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      });
    }

    const clearBuffer = (fbo: WebGLFramebuffer, r: number, g: number, b: number, a = 1) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.clearColor(r, g, b, a);
      gl.clear(gl.COLOR_BUFFER_BIT);
    };
    if (supportsFloatTargets) {
      clearBuffer(heightField.readFbo, 0, 0, 0, 1);
      clearBuffer(heightField.writeFbo, 0, 0, 0, 1);
    } else {
      const packedZeroHigh = 127 / 255;
      const packedZeroLow = 128 / 255;
      clearBuffer(heightField.readFbo, packedZeroHigh, packedZeroLow, packedZeroHigh, packedZeroLow);
      clearBuffer(heightField.writeFbo, packedZeroHigh, packedZeroLow, packedZeroHigh, packedZeroLow);
    }
    clearBuffer(obstacle.fbo, 0, 0, 0);
    clearBuffer(normal.fbo, 0.5, 0.5, 0.5);
    [velocityField.readFbo, velocityField.writeFbo].forEach((fbo) => clearBuffer(fbo, 0.5, 0.5, 0.5));
    [dyeField.readFbo, dyeField.writeFbo].forEach((fbo) => clearBuffer(fbo, 0, 0, 0));
    [pressureField.readFbo, pressureField.writeFbo].forEach((fbo) => clearBuffer(fbo, 0.5, 0, 0));
    clearBuffer(divergence.fbo, 0.5, 0, 0);

    // Preserve the live field through resize and adaptive-tier changes. The
    // GPU resamples into the new dimensions before old resources are deleted,
    // preventing water resets, blank frames, and dropped active ripples.
    if (previousHeightField && previousVelocityField && previousDyeField && previousPressureField) {
      copyTexture(previousHeightField.read, heightField.readFbo, simWidth, simHeight);
      copyTexture(previousHeightField.write, heightField.writeFbo, simWidth, simHeight);
      copyTexture(previousVelocityField.read, velocityField.readFbo, simWidth, simHeight);
      copyTexture(previousVelocityField.write, velocityField.writeFbo, simWidth, simHeight);
      copyTexture(previousDyeField.read, dyeField.readFbo, simWidth, simHeight);
      copyTexture(previousDyeField.write, dyeField.writeFbo, simWidth, simHeight);
      copyTexture(previousPressureField.read, pressureField.readFbo, simWidth, simHeight);
      copyTexture(previousPressureField.write, pressureField.writeFbo, simWidth, simHeight);
    }
    deleteDoubleBuffer(previousHeightField);
    deleteDoubleBuffer(previousVelocityField);
    deleteDoubleBuffer(previousDyeField);
    deleteDoubleBuffer(previousPressureField);
    deleteSingleBuffer(previousDivergence);
    deleteSingleBuffer(previousObstacle);
    deleteSingleBuffer(previousNormal);
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
    const normalizedPointerVx = Math.max(-1.2, Math.min(1.2, pointer.vx / Math.max(width, 1)));
    const normalizedPointerVy = Math.max(-1.2, Math.min(1.2, -pointer.vy / Math.max(height, 1)));
    gl.uniform2f(
      simPointerVelocityLocation,
      normalizedPointerVx,
      normalizedPointerVy,
    );
    gl.uniform1f(simTimeLocation, t);
    gl.uniform1f(simDeltaLocation, delta);
    gl.uniform1f(
      simGlyphScrollLocation,
      (window.scrollY - glyphLayoutScrollY) / Math.max(height, 1),
    );
    gl.uniform1i(simPackedHeightLocation, supportsFloatTargets ? 0 : 1);
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
          (1 - ripple.y / Math.max(height, 1)) * simHeight,
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
    if (!heightField || !velocityField || !dyeField || !pressureField || !divergence || !obstacle || !normal) return;
    const delta = lastSimTime > 0 ? Math.min(0.05, t - lastSimTime) : 1 / 60;
    lastSimTime = t;
    gl.useProgram(simProgram);
    setSimUniforms(physics, t, delta);
    bindTexture(2, heightField.read, simHeightLocationRead);
    bindTexture(0, velocityField.read, simVelocityLocationRead);
    bindTexture(1, dyeField.read, simDyeLocationRead);
    bindTexture(3, pressureField.read, simPressureLocationRead);
    bindTexture(6, textTexture, simTextLocationRead);
    bindTexture(9, glyphState?.read ?? null, simGlyphStateLocation);

    drawSim(0, obstacle.fbo);
    bindTexture(5, obstacle.texture, simObstacleLocationRead);
    drawSim(1, velocityField.writeFbo);
    velocityField.swap();
    bindTexture(0, velocityField.read, simVelocityLocationRead);
    drawSim(2, divergence.fbo);
    bindTexture(4, divergence.texture, simDivergenceLocationRead);
    for (let i = 0; i < quality.pressureIterations; i++) {
      bindTexture(3, pressureField.read, simPressureLocationRead);
      drawSim(3, pressureField.writeFbo);
      pressureField.swap();
    }
    bindTexture(3, pressureField.read, simPressureLocationRead);
    drawSim(4, velocityField.writeFbo);
    velocityField.swap();
    bindTexture(0, velocityField.read, simVelocityLocationRead);
    drawSim(5, dyeField.writeFbo);
    dyeField.swap();
    drawSim(6, heightField.writeFbo);
    heightField.swap();
    bindTexture(2, heightField.read, simHeightLocationRead);
    drawSim(7, normal.fbo);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function regenerateText() {
    if (!heroNameRef.current) return;
    // Four compact atlas columns keep every SDF isolated. The atlas is rebuilt
    // only on font/viewport changes; transforms live in the tiny GPU state.
    const tileSize = quality.tier === "high" ? 288 : quality.tier === "balanced" ? 240 : 192;
    glyphLayoutScrollY = window.scrollY;
    const atlas = createHeroGlyphAtlas(width, height, tileSize);
    glyphMetadata = atlas.glyphs;
    if (glyphMaterialTestEnabled && glyphMetadata.length === HERO_GLYPH_COUNT) {
      const representativeIndices = [0, 1, 4, 10]; // E, Z, R, O
      glyphMetadata = glyphMetadata.map((glyph) => {
        const slot = representativeIndices.indexOf(glyph.index);
        if (slot < 0) return { ...glyph, rest: [-2, -2, glyph.rest[2], glyph.rest[3]] };
        const halfHeight = 0.13;
        const aspect = glyph.rest[2] / Math.max(glyph.rest[3], 0.001);
        return {
          ...glyph,
          rest: [0.17 + slot * 0.22, 0.34, halfHeight * aspect, halfHeight],
        };
      });
      canvas.dataset.glyphMaterialTest = "EZRO";
    } else {
      delete canvas.dataset.glyphMaterialTest;
    }
    textWidth = atlas.canvas.width;
    textHeight = atlas.canvas.height;
    gl.bindTexture(gl.TEXTURE_2D, textTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
    uploadGlyphMetadata();
  }

  function configure() {
    width = window.innerWidth;
    height = window.innerHeight;
    quality = resolveKineticQuality(reducedMotionRef.current, staticModeRef.current);
    for (let level = 0; level < adaptiveLevel; level++) {
      quality = lowerQualityProfile(quality, width, height);
    }
    // Integer-packed fields require extra encode/decode work in every solver
    // pass. Preserve the display DPR, volumetric material, ripple count, and
    // 60 FPS target while modestly reducing only fluid-grid work.
    if (!supportsFloatTargets) quality = applyPackedTargetProfile(quality);
    if (quality.tier === "static") return;
    observedDevicePixelRatio = window.devicePixelRatio;
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
      updateGlyphPhysics(physics, t);
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
    gl.uniform2f(textResolutionLocation, textWidth, textHeight);
    bindTexture(9, glyphState?.read ?? null, glyphStateLocation);
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform1f(timeLocation, t);
    gl.uniform1f(energyLocation, pointer.energy);
    gl.uniform1f(nameOpacityLocation, nameOpacity);
    gl.uniform1f(sceneIntensityLocation, heroNameRef.current ? 1 : 0);
    gl.uniform1f(
      glyphScrollLocation,
      (window.scrollY - glyphLayoutScrollY) / Math.max(height, 1),
    );
    gl.uniform2f(pointerLocation, pointer.x * dpr, pointer.y * dpr);
    gl.uniform4f(scrollLocation, physics.scroll.progress, physics.scroll.velocity, physics.scroll.depth, physics.scroll.section);
    const rippleOffset = Math.max(0, physics.ripples.length - quality.activeRipples);
    for (let i = 0; i < RIPPLE_COUNT; i++) {
      const ripple = physics.ripples[rippleOffset + i];
      if (ripple && i < quality.activeRipples) {
        gl.uniform4f(rippleLocations[i], ripple.x * dpr, ripple.y * dpr, t - ripple.age, ripple.intensity * quality.renderScale);
      } else {
        gl.uniform4f(rippleLocations[i], -9999, -9999, -9999, 0);
      }
    }
    if (heightField && normal && obstacle) {
      bindTexture(5, normal.texture, simNormalLocation);
      bindTexture(6, obstacle.texture, simObstacleLocation);
      bindTexture(7, dyeField?.read ?? null, dyeLocation);
      bindTexture(8, velocityField?.read ?? null, velocityLocation);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    glyphDebugController?.tick();
  }
  function render(now = performance.now()) {
    if (!running) return;
    if (Math.abs(window.devicePixelRatio - observedDevicePixelRatio) > 0.01) {
      onResize();
      observedDevicePixelRatio = window.devicePixelRatio;
    }
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
    lastRenderTime = now - (elapsed % interval);
    paint((now - startedAt) / 1000);
    renderedFrames += 1;

    const statsElapsed = now - statsStartedAt;
    if (statsElapsed >= 2000) {
      const measuredFps = (renderedFrames * 1000) / statsElapsed;
      canvas.dataset.fps = Math.round(measuredFps).toString();
      // Only react to sustained frame-rate evidence. Long windows are usually
      // screenshots, tab suspension, or DevTools pauses and must not lower the
      // user's quality tier. Three genuinely poor windows are required before
      // reallocating; recovery is deliberately slower to avoid oscillation.
      if (statsElapsed < 3200 && measuredFps < quality.targetFps * 0.72) {
        poorPerformanceWindows += 1;
        healthyPerformanceWindows = 0;
      } else if (statsElapsed < 3200 && measuredFps > quality.targetFps * 0.92) {
        healthyPerformanceWindows += 1;
        poorPerformanceWindows = Math.max(0, poorPerformanceWindows - 1);
      }
      statsStartedAt = now;
      renderedFrames = 0;
      if (poorPerformanceWindows >= 3 && quality.tier !== "low") {
        adaptiveLevel += 1;
        poorPerformanceWindows = 0;
        configure();
        canvas.dataset.adaptive = "true";
      } else if (healthyPerformanceWindows >= 8 && adaptiveLevel > 0) {
        adaptiveLevel -= 1;
        healthyPerformanceWindows = 0;
        configure();
        canvas.dataset.adaptive = adaptiveLevel > 0 ? "true" : "recovered";
      }
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
      lastGlyphTime = 0;
      statsStartedAt = performance.now();
      renderedFrames = 0;
      scheduleRender();
    } else {
      canvas.dataset.paused = document.hidden ? "hidden" : "offscreen";
    }
  }

  function onVisibility() {
    if (!document.hidden) configure();
    syncRunning();
  }

  function onContextLost(event: Event) {
    event.preventDefault();
    running = false;
    cancelAnimationFrame(frame);
    canvas.dataset.paused = "context-lost";
  }

  function onContextRestored() {
    // A restored WebGL context does not retain reliable program/FBO state.
    // Recreate the renderer through its owner instead of attempting to paint
    // with stale handles and risking a blank or checkerboard canvas.
    onRecover?.();
  }

  canvas.style.opacity = "0";
  canvas.style.mixBlendMode = "normal";
  canvas.style.filter = "none";
  canvas.style.transition = "opacity 420ms ease";
  configure();
  glyphDebugController = installGlyphDebug({
    readSnapshots: () => glyphDebugSnapshots,
    applyImpulse: applyGlyphDebugImpulse,
  });
  window.addEventListener("resize", onResize, { passive: true });
  window.visualViewport?.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);

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
    window.visualViewport?.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibility);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    canvas.removeEventListener("webglcontextrestored", onContextRestored);
    image.removeEventListener("load", onFluidImageLoad);
    image.removeEventListener("error", onFluidImageError);
    image.src = "";
    glyphDebugController?.remove();
    glyphDebugController = null;
    gl.deleteTexture(texture);
    gl.deleteTexture(textTexture);
    deleteDoubleBuffer(glyphState);
    glyphState = null;
    disposeSimBuffers();
    gl.deleteBuffer(positionBuffer);
    gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
    gl.deleteProgram(simProgram);
    if (glyphPhysicsProgram) gl.deleteProgram(glyphPhysicsProgram);
    gl.deleteProgram(copyProgram);
  };
}
