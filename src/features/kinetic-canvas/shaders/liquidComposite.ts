import { HERO_GLYPH_COUNT } from "../materials/heroTextMask";
import { GLYPH_STATE_CODEC_SOURCE } from "./glyphStateCodec";

export const VERTEX_SOURCE = `#version 300 es
layout(location = 0) in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const FRAGMENT_SOURCE = `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_energy;
uniform vec2 u_pointer;
uniform vec4 u_ripples[8];
uniform sampler2D u_texture;
uniform sampler2D u_text;
uniform vec2 u_textResolution;
uniform sampler2D u_glyphState;
uniform vec4 u_glyphRest[${HERO_GLYPH_COUNT}];
uniform vec4 u_glyphAtlas[${HERO_GLYPH_COUNT}];
uniform float u_glyphDynamics;
uniform float u_glyphScrollOffset;
uniform sampler2D u_normalField;
uniform sampler2D u_velocityField;
uniform sampler2D u_obstacleField;
uniform sampler2D u_dyeField;
uniform float u_nameOpacity;
uniform float u_sceneIntensity;
uniform vec4 u_scroll;

${GLYPH_STATE_CODEC_SOURCE}

in vec2 v_uv;
out vec4 outColor;

float ridge(float value, float width) {
  return 1.0 - smoothstep(0.0, width, abs(value));
}

float caustics(vec2 p, float time) {
  float value = 0.0;
  mat2 rotation = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 2; i++) {
    float scale = 1.0 + float(i) * 0.35;
    value += abs(
      sin(p.x * 12.0 * scale + time * 0.45) +
      sin(p.y * 10.0 * scale - time * 0.35)
    ) * (0.5 / scale);
    p = rotation * p * 1.35 + float(i) * 1.3;
  }
  return value / 1.45;
}

vec2 cursorLens(vec2 uv, vec2 pointer, out float lens) {
  float distanceToPointer = distance(uv, pointer);
  lens = exp(-distanceToPointer * 4.6) * (0.42 + u_energy * 0.72);
  vec2 direction = uv - pointer;
  float lengthDirection = length(direction);
  vec2 normal = lengthDirection > 0.0001 ? direction / lengthDirection : vec2(0.0);
  return normal * lens * 0.022;
}

vec3 rippleField(vec2 position, vec2 pointer, float time) {
  float blue = 0.0;
  float white = 0.0;
  float warp = 0.0;
  float distanceToPointer = distance(position, pointer);
  float pulse = sin(distanceToPointer * 28.0 - time * 5.5);
  float envelope = exp(-distanceToPointer * 3.6) * u_energy;
  blue += max(pulse, 0.0) * envelope * 0.20;
  white += ridge(distanceToPointer - 0.078 - sin(time * 1.2) * 0.009, 0.026) * envelope * 0.20;
  warp += pulse * envelope * 0.030;

  for (int i = 0; i < 8; i++) {
    vec4 ripple = u_ripples[i];
    float age = time - ripple.z;
    if (age <= 0.0 || age >= 3.2 || ripple.w <= 0.001) continue;
    float distanceToRipple = distance(position * u_resolution, ripple.xy);
    float radius = 24.0 + age * 155.0;
    float ring = sin((distanceToRipple - radius) * 0.058);
    float rippleEnvelope = exp(-abs(distanceToRipple - radius) / 86.0) * (1.0 - age / 3.2) * ripple.w;
    blue += max(ring, 0.0) * rippleEnvelope * 0.30;
    white += max(-ring, 0.0) * rippleEnvelope * 0.34;
    warp += ring * rippleEnvelope * 0.028;
  }
  return vec3(blue, white, warp);
}

vec4 sampleSmoothField(sampler2D field, vec2 uv) {
  vec2 size = vec2(textureSize(field, 0));
  vec2 texel = 1.0 / size;
  vec2 position = clamp(uv, vec2(0.0), vec2(1.0));
  // The solver carries broad mass and momentum. A compact reconstruction
  // suppresses its enlarged texel lattice; the independent full-resolution
  // ripple field below supplies the crisp wave fronts and pointer detail.
  return texture(field, position) * 0.28
    + texture(field, position + vec2(texel.x, 0.0)) * 0.12
    + texture(field, position - vec2(texel.x, 0.0)) * 0.12
    + texture(field, position + vec2(0.0, texel.y)) * 0.12
    + texture(field, position - vec2(0.0, texel.y)) * 0.12
    + texture(field, position + texel) * 0.06
    + texture(field, position - texel) * 0.06
    + texture(field, position + vec2(texel.x, -texel.y)) * 0.06
    + texture(field, position + vec2(-texel.x, texel.y)) * 0.06;
}

vec2 sampleFluidVelocity(vec2 uv) {
  vec2 size = vec2(textureSize(u_velocityField, 0));
  vec2 texel = 1.0 / max(size, vec2(1.0));
  vec2 p = clamp(uv, vec2(0.0), vec2(1.0));
  vec2 velocity = (texture(u_velocityField, p).xy - 0.5) * 2.0 * 0.46;
  velocity += (texture(u_velocityField, clamp(p + vec2(texel.x, 0.0), vec2(0.0), vec2(1.0))).xy - 0.5) * 2.0 * 0.135;
  velocity += (texture(u_velocityField, clamp(p - vec2(texel.x, 0.0), vec2(0.0), vec2(1.0))).xy - 0.5) * 2.0 * 0.135;
  velocity += (texture(u_velocityField, clamp(p + vec2(0.0, texel.y), vec2(0.0), vec2(1.0))).xy - 0.5) * 2.0 * 0.135;
  velocity += (texture(u_velocityField, clamp(p - vec2(0.0, texel.y), vec2(0.0), vec2(1.0))).xy - 0.5) * 2.0 * 0.135;
  return clamp(velocity, vec2(-0.24), vec2(0.24));
}

vec3 sampleTransportedLight(vec2 uv) {
  vec2 size = vec2(textureSize(u_dyeField, 0));
  vec2 texel = 1.65 / max(size, vec2(1.0));
  vec2 p = clamp(uv, vec2(0.0), vec2(1.0));
  return texture(u_dyeField, p).rgb * 0.40
    + texture(u_dyeField, clamp(p + vec2(texel.x, 0.0), vec2(0.0), vec2(1.0))).rgb * 0.15
    + texture(u_dyeField, clamp(p - vec2(texel.x, 0.0), vec2(0.0), vec2(1.0))).rgb * 0.15
    + texture(u_dyeField, clamp(p + vec2(0.0, texel.y), vec2(0.0), vec2(1.0))).rgb * 0.15
    + texture(u_dyeField, clamp(p - vec2(0.0, texel.y), vec2(0.0), vec2(1.0))).rgb * 0.15;
}

vec3 samplePearlSurface(vec2 uv) {
  vec2 texel = 1.35 / max(u_resolution, vec2(1.0));
  vec2 p = clamp(uv, vec2(0.0), vec2(1.0));
  return texture(u_texture, p).rgb * 0.58
    + texture(u_texture, clamp(p + texel, vec2(0.0), vec2(1.0))).rgb * 0.21
    + texture(u_texture, clamp(p - texel, vec2(0.0), vec2(1.0))).rgb * 0.21;
}

vec2 rotateGlyph(vec2 value, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c) * value;
}

vec3 orientGlyphNormal(vec3 value, vec3 orientation) {
  float cx = cos(orientation.x);
  float sx = sin(orientation.x);
  value.yz = mat2(cx, -sx, sx, cx) * value.yz;
  float cy = cos(orientation.y);
  float sy = sin(orientation.y);
  value.xz = mat2(cy, sy, -sy, cy) * value.xz;
  value.xy = rotateGlyph(value.xy, orientation.z);
  return normalize(value);
}

vec4 sampleGlyphField(int index, vec2 local) {
  if (max(abs(local.x), abs(local.y)) >= 0.995) return vec4(0.0);
  vec4 region = u_glyphAtlas[index];
  vec2 tileUv = clamp(local * 0.5 + 0.5, vec2(0.002), vec2(0.998));
  vec2 atlasUv = region.xy + tileUv * region.zw;
  return texture(u_text, atlasUv);
}

float glyphDome(float depth) {
  float normalizedDepth = clamp(depth, 0.0, 1.0);
  return sin(normalizedDepth * 1.57079632679);
}

void main() {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  float time = u_time * mix(0.28, 1.0, u_sceneIntensity);
  vec2 pointer = vec2(u_pointer.x / u_resolution.x, 1.0 - u_pointer.y / u_resolution.y);
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec2 simulationUv = vec2(uv.x, 1.0 - uv.y);
  float transition = smoothstep(0.035, 0.84, u_scroll.z);
  float frontWave = sin(uv.x * 7.5 + u_time * 0.62) * 0.012
    + sin(uv.x * 15.0 - u_time * 0.38) * 0.004;
  float transitionFront = 1.12 - transition * 1.36 + frontWave * transition;
  float frontDistance = uv.y - transitionFront;
  float waterline = exp(-abs(frontDistance) * 30.0) * transition;
  float crestUnderside = exp(-abs(frontDistance + 0.034) * 42.0) * transition;
  float submergedTransition = (1.0 - smoothstep(-0.18, 0.14, frontDistance)) * transition;
  float surfacePull = waterline * (0.012 + abs(u_scroll.y) * 0.022);
  uv.x += sin(uv.y * 11.0 + u_time * 0.55) * surfacePull;
  uv.y += transition * transition * 0.032 - surfacePull * 0.72;
  vec2 plane = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  float mobilePoster = smoothstep(0.82, 0.56, aspect);

  float lensStrength;
  vec2 lensOffset = cursorLens(uv, pointer, lensStrength);
  vec3 surfaceSample = sampleSmoothField(u_normalField, simulationUv).rgb;
  vec3 simulationNormal = normalize(vec3(surfaceSample.xy * 2.0 - 1.0, 1.0));
  float simulationHeight = (surfaceSample.z - 0.5) * 0.25;
  vec2 fluidVelocity = sampleFluidVelocity(simulationUv);
  vec4 simulationObstacle = texture(u_obstacleField, simulationUv);
  vec3 transportedLight = sampleTransportedLight(simulationUv);
  vec3 physicalRipple = vec3(
    max(-simulationHeight, 0.0) * 0.70,
    max(simulationHeight, 0.0) * 0.85,
    simulationHeight * 0.55
  );
  // The physical solver supplies the evolving surface while this full-screen
  // analytic field preserves fine rings between simulation texels.
  vec3 ripple = physicalRipple + rippleField(uv, pointer, time);
  float scrollImpulse = clamp(u_scroll.y, -0.22, 0.22);

  float flowA = 0.5 + 0.25 * (
    sin(dot(plane, vec2(3.8, 2.4)) + time * 0.42) +
    sin(dot(plane, vec2(-2.1, 5.2)) - time * 0.31)
  );
  float flowB = 0.5 + 0.25 * (
    sin(dot(plane, vec2(7.2, -3.1)) - time * 0.54) +
    cos(dot(plane, vec2(4.1, 6.6)) + time * 0.37)
  );
  float flowC = 0.5 + 0.5 * sin(dot(plane, vec2(6.2, -4.7)) + time * 0.72);

  plane.x += (flowA - 0.5) * 0.034 + ripple.z * 0.82 + simulationNormal.x * 0.028 + scrollImpulse * 0.004;
  plane.y += (flowB - 0.5) * 0.026 + ripple.z * 0.34 + simulationNormal.y * 0.024 - scrollImpulse * 0.006;

  vec2 baseUv = uv + lensOffset + simulationNormal.xy * 0.022 + ripple.z * vec2(0.34, 0.16) + vec2(0.0, -scrollImpulse * 0.003);
  vec2 flowUv = clamp(
    baseUv + vec2((flowA - 0.5) * 0.018, (flowB - 0.5) * 0.014),
    vec2(0.0),
    vec2(1.0)
  );

  vec3 blue = vec3(0.14, 0.40, 0.78);
  vec3 white = vec3(0.969, 0.976, 0.988);
  vec3 silver = vec3(0.867, 0.890, 0.925);
  vec2 surfaceChroma = simulationNormal.xy * 0.0011;
  vec3 pearlSurface = samplePearlSurface(flowUv);
  vec3 chromaticSurface = vec3(
    texture(u_texture, clamp(flowUv + surfaceChroma, vec2(0.0), vec2(1.0))).r,
    pearlSurface.g,
    texture(u_texture, clamp(flowUv - surfaceChroma, vec2(0.0), vec2(1.0))).b
  );
  vec3 base = mix(pearlSurface, chromaticSurface, 0.32);
  base = mix(base, white, 0.12);
  base += vec3(0.004, 0.006, 0.012);
  float depthVeil = smoothstep(0.04, 1.0, uv.y);
  base = mix(base, vec3(0.91, 0.95, 0.995), depthVeil * 0.035);

  float caustic = caustics(plane * 3.1 + vec2(time * 0.035, -time * 0.026), time * 0.42);
  float causticMask = smoothstep(0.3, 0.9, flowC) * 0.35;
  float liquidRidge = ridge(flowA - 0.52, 0.20) * 0.34 + ridge(flowB - 0.48, 0.18) * 0.22;
  base += vec3(0.90, 0.96, 1.0) * caustic * 0.09 * (0.65 + causticMask);
  base += vec3(0.92, 0.97, 1.0) * pow(caustic, 2.15) * (0.52 + liquidRidge) * 0.032;
  base += silver * liquidRidge * 0.05;

  vec3 viewDirection = vec3(0.0, 0.0, 1.0);
  vec3 surfaceLight = normalize(vec3(-0.42, -0.58, 0.70));
  vec3 halfVector = normalize(surfaceLight + viewDirection);
  float surfaceFresnel = 0.02 + 0.98 * pow(1.0 - max(dot(simulationNormal, viewDirection), 0.0), 5.0);
  float surfaceSpecular = pow(max(dot(simulationNormal, halfVector), 0.0), 42.0);
  float focusedCaustic = pow(clamp(1.0 - length(simulationNormal.xy) * 1.5, 0.0, 1.0), 7.0);
  base = mix(base, white, surfaceFresnel * 0.10);
  base += white * surfaceSpecular * (0.085 + u_energy * 0.07);
  base += vec3(0.70, 0.87, 1.0) * focusedCaustic * abs(simulationHeight) * 0.34;
  base += white * ripple.y * 0.11 + blue * ripple.x * 0.075;
  base += transportedLight * vec3(0.12, 0.20, 0.32) * 0.08;
  // The hero exits through a moving optical surface: the scene compresses at
  // the crest, catches a thin caustic edge, then settles into the pearl field
  // behind the work section. This is intentionally more than an opacity fade.
  base = mix(base, vec3(0.958, 0.976, 0.997), transition * 0.12 + submergedTransition * 0.08);
  base += white * waterline * (0.20 + abs(scrollImpulse) * 0.08);
  base += vec3(0.38, 0.66, 1.0) * waterline * 0.10;
  base -= vec3(0.040, 0.085, 0.160) * crestUnderside * 0.16;
  base -= vec3(0.018, 0.036, 0.068) * submergedTransition * (1.0 - waterline) * 0.12;

  // Resolve one isolated SDF tile per glyph. Transform inversion happens in
  // the glyph's own coordinates, so repeated letters retain separate bounds,
  // state, refraction, and depth while remaining in one batched full-screen pass.
  int activeGlyph = -1;
  float signedDistance = -1.0;
  vec4 titleField = vec4(0.0);
  vec2 glyphLocal = vec2(4.0);
  vec4 glyphTransform = vec4(0.0);
  vec3 glyphOrientation = vec3(0.0);
  vec4 glyphRest = vec4(0.0);
  bool insideTitleField = uv.y > 0.08 && uv.y < 0.62;
  if (insideTitleField) {
    bool nearFirstRow = abs(uv.y - (u_glyphRest[0].y - u_glyphScrollOffset)) < u_glyphRest[0].w * 1.45 + 0.038;
    bool nearSecondRow = abs(uv.y - (u_glyphRest[4].y - u_glyphScrollOffset)) < u_glyphRest[4].w * 1.45 + 0.038;
    for (int glyphIndex = 0; glyphIndex < ${HERO_GLYPH_COUNT}; glyphIndex++) {
      if (glyphIndex < 4 && !nearFirstRow) continue;
      if (glyphIndex >= 4 && !nearSecondRow) continue;
      vec4 rest = u_glyphRest[glyphIndex];
      rest.y -= u_glyphScrollOffset;
      if (abs(uv.y - rest.y) > rest.w * 1.35 + 0.032) continue;
      if (abs(uv.x - rest.x) > rest.z * 1.22 + 0.022) continue;
      vec4 state = readGlyphState(u_glyphState, glyphIndex, 0) * u_glyphDynamics;
      vec3 orientation = readGlyphState(u_glyphState, glyphIndex, 2).xyz * u_glyphDynamics;
      float perspectiveScale = 1.0 + state.z * 2.4;
      vec2 tiltScale = max(vec2(cos(orientation.y), cos(orientation.x)), vec2(0.90));
      vec2 center = rest.xy + state.xy + vec2(0.0, state.w)
        + vec2(orientation.y, -orientation.x) * state.z * 0.22;
      vec2 halfSize = max(rest.zw * perspectiveScale * tiltScale, vec2(0.0001));
      vec2 local = rotateGlyph(uv - center, -orientation.z) / halfSize;
      local += vec2(orientation.y * local.y, -orientation.x * local.x) * 0.16;
      if (max(abs(local.x), abs(local.y)) > 1.08) continue;
      vec4 field = sampleGlyphField(glyphIndex, local);
      float candidate = field.r * 2.0 - 1.0;
      if (candidate > signedDistance) {
        signedDistance = candidate;
        activeGlyph = glyphIndex;
        titleField = field;
        glyphLocal = local;
        glyphTransform = state;
        glyphOrientation = orientation;
        glyphRest = rest;
      }
    }
  }
  signedDistance += 0.025;
  float titleAA = max(fwidth(signedDistance) * 1.25, mix(0.0042, 0.0072, mobilePoster));
  float frontFaceMask = smoothstep(-titleAA, titleAA, signedDistance) * u_nameOpacity;

  // Bounded front-to-back intersection through a rounded 2.5D SDF volume.
  // Depth follows the locally normalized medial field and parallax exists only
  // when the physical body tilts; there are no fixed-direction mask copies.
  vec4 surfaceField = titleField;
  vec2 surfaceLocal = glyphLocal;
  float surfaceDepth = 0.0;
  float rayCoverage = 0.0;
  vec2 volumeParallax = vec2(glyphOrientation.y, -glyphOrientation.x) * 0.34;
  if (activeGlyph >= 0) {
    for (int volumeStep = 0; volumeStep < 9; volumeStep++) {
      float depth = 1.0 - float(volumeStep) * 0.25;
      vec2 rayLocal = glyphLocal + volumeParallax * depth;
      vec4 rayField = sampleGlyphField(activeGlyph, rayLocal);
      float raySignedDistance = rayField.r * 2.0 - 1.0 + 0.025;
      float rayDome = glyphDome(rayField.g);
      float volumeDistance = min(raySignedDistance, rayDome - abs(depth));
      float coverage = smoothstep(-titleAA, titleAA, volumeDistance);
      if (coverage > rayCoverage) {
        rayCoverage = coverage;
        surfaceField = rayField;
        surfaceLocal = rayLocal;
        surfaceDepth = depth;
      }
    }
  }
  titleField = surfaceField;
  glyphLocal = surfaceLocal;
  float letterMask = rayCoverage * u_nameOpacity;
  float sideVolume = max(letterMask - frontFaceMask, 0.0);
  float thickness = max(titleField.g, frontFaceMask * 0.035) * u_nameOpacity;
  float bevel = titleField.b * u_nameOpacity;
  float interior = smoothstep(0.10, 0.56, thickness);
  float innerBevel = bevel * letterMask;
  float outerHalo = (smoothstep(-0.075, -0.012, signedDistance) - letterMask) * u_nameOpacity;
  float glassWall = (1.0 - smoothstep(0.10, 0.42, thickness)) * letterMask;
  float edgeRim = smoothstep(0.025, 0.12, thickness) * (1.0 - smoothstep(0.32, 0.58, thickness)) * letterMask;
  float outerMeniscus = exp(-abs(signedDistance) * 34.0) * u_nameOpacity;
  float innerMeniscus = exp(-abs(thickness - 0.19) * 13.0) * letterMask;
  vec2 atlasPixel = activeGlyph >= 0
    ? 2.0 / max(u_textResolution * u_glyphAtlas[activeGlyph].zw, vec2(1.0))
    : vec2(0.01);
  vec4 fieldRight = activeGlyph >= 0 ? sampleGlyphField(activeGlyph, glyphLocal + vec2(atlasPixel.x, 0.0)) : vec4(0.0);
  vec4 fieldLeft = activeGlyph >= 0 ? sampleGlyphField(activeGlyph, glyphLocal - vec2(atlasPixel.x, 0.0)) : vec4(0.0);
  vec4 fieldUp = activeGlyph >= 0 ? sampleGlyphField(activeGlyph, glyphLocal + vec2(0.0, atlasPixel.y)) : vec4(0.0);
  vec4 fieldDown = activeGlyph >= 0 ? sampleGlyphField(activeGlyph, glyphLocal - vec2(0.0, atlasPixel.y)) : vec4(0.0);
  vec4 fieldUpperRight = activeGlyph >= 0 ? sampleGlyphField(activeGlyph, glyphLocal + atlasPixel) : vec4(0.0);
  vec4 fieldUpperLeft = activeGlyph >= 0 ? sampleGlyphField(activeGlyph, glyphLocal + vec2(-atlasPixel.x, atlasPixel.y)) : vec4(0.0);
  vec4 fieldLowerRight = activeGlyph >= 0 ? sampleGlyphField(activeGlyph, glyphLocal + vec2(atlasPixel.x, -atlasPixel.y)) : vec4(0.0);
  vec4 fieldLowerLeft = activeGlyph >= 0 ? sampleGlyphField(activeGlyph, glyphLocal - atlasPixel) : vec4(0.0);
  float sdRight = fieldRight.r;
  float sdLeft = fieldLeft.r;
  float sdUp = fieldUp.r;
  float sdDown = fieldDown.r;
  vec2 coverageGradient = vec2(sdRight - sdLeft, sdUp - sdDown);
  coverageGradient = rotateGlyph(coverageGradient, glyphOrientation.z);
  vec2 volumeGradient = vec2(
    glyphDome(fieldUpperRight.g) + 2.0 * glyphDome(fieldRight.g) + glyphDome(fieldLowerRight.g)
      - glyphDome(fieldUpperLeft.g) - 2.0 * glyphDome(fieldLeft.g) - glyphDome(fieldLowerLeft.g),
    glyphDome(fieldUpperLeft.g) + 2.0 * glyphDome(fieldUp.g) + glyphDome(fieldUpperRight.g)
      - glyphDome(fieldLowerLeft.g) - 2.0 * glyphDome(fieldDown.g) - glyphDome(fieldLowerRight.g)
  ) * 0.25;
  float dome = glyphDome(thickness);
  // The thickness channel spans the entire stroke. Scale its two-texel
  // derivative into a true dome normal; the former low multiplier left most
  // of the face front-facing and therefore visually flat.
  vec3 normal = orientGlyphNormal(normalize(vec3(-volumeGradient * 24.0, 0.42 + dome * 0.48)), glyphOrientation);
  normal = normalize(vec3(normal.xy + simulationNormal.xy * 0.09 + fluidVelocity * 0.16, normal.z));

  // Fine solver detail remains optical while the broad GPU state moves the
  // actual glyph volume. This prevents shimmer and cross-glyph contamination.
  float faceDepth = mix(0.48, 1.0, dome);
  vec2 sampleWarp = ripple.z * vec2(0.62, 0.29)
    + simulationNormal.xy * (0.011 + faceDepth * 0.010)
    + fluidVelocity * (0.024 + faceDepth * 0.018)
    + lensOffset * 0.50;
  float opticalPath = letterMask * (0.28 + dome * 0.92 + glassWall * 0.20 + abs(surfaceDepth) * 0.10);
  vec2 refraction = uv + sampleWarp + normal.xy * (0.016 + opticalPath * 0.032);
  vec2 backRefraction = uv + sampleWarp * 0.44 - normal.xy * (0.010 + opticalPath * 0.019);
  vec2 chroma = normal.xy * (0.0008 + opticalPath * 0.0015);
  vec3 refractedFront = vec3(
    texture(u_texture, clamp(refraction + chroma, vec2(0.0), vec2(1.0))).r * 0.97,
    texture(u_texture, clamp(refraction, vec2(0.0), vec2(1.0))).g * 0.99,
    texture(u_texture, clamp(refraction - chroma, vec2(0.0), vec2(1.0))).b * 1.02
  );
  vec3 refractedBack = texture(u_texture, clamp(backRefraction, vec2(0.0), vec2(1.0))).rgb;
  vec3 refracted = mix(refractedBack, refractedFront, 0.52 + dome * 0.20);
  refracted += vec3(0.006, 0.009, 0.016);

  vec3 titleTint = mix(vec3(0.76, 0.83, 0.91), vec3(0.72, 0.81, 0.91), mobilePoster);
  vec3 letterBody = mix(refracted, titleTint, 0.075 + glassWall * 0.15 + opticalPath * 0.025);
  letterBody += white * interior * (0.006 + dome * 0.006);
  float volumeCore = interior * letterMask;
  float internalDepth = pow(clamp(1.0 - dome, 0.0, 1.0), 1.25) * volumeCore;
  float curvedWall = pow(clamp(1.0 - normal.z, 0.0, 1.0), 0.72) * letterMask;
  letterBody = mix(letterBody, refracted * vec3(0.985, 1.0, 1.018), volumeCore * 0.34);
  letterBody -= vec3(0.022, 0.043, 0.075) * internalDepth;
  letterBody -= vec3(0.008, 0.019, 0.038) * opticalPath * (0.28 + dome * 0.20);
  letterBody -= vec3(0.018, 0.038, 0.068) * glassWall;
  letterBody -= vec3(0.026, 0.050, 0.082) * curvedWall * 0.72;

  vec3 topLeftLight = normalize(vec3(-0.48, -0.66, 0.58));
  float lightFacing = max(dot(normal, topLeftLight), 0.0);
  float directionalHighlight = pow(lightFacing, 4.2);
  float oppositeShade = pow(max(dot(normal, -topLeftLight), 0.0), 3.0);
  float fresnel = pow(1.0 - clamp(normal.z, 0.0, 1.0), 2.1);
  float upperLeftCurve = glassWall * smoothstep(
    0.08,
    0.72,
    dot(normal.xy, normalize(vec2(-0.58, -0.82)))
  );
  float lowerRightCurve = glassWall * smoothstep(
    0.04,
    0.70,
    dot(normal.xy, normalize(vec2(0.54, 0.84)))
  );
  letterBody += white * lightFacing * 0.075;
  letterBody += white * directionalHighlight * (0.28 + glassWall * 0.32);
  letterBody += white * fresnel * (0.22 + glassWall * 0.30);
  letterBody += white * upperLeftCurve * 0.31;
  letterBody -= vec3(0.038, 0.072, 0.118) * lowerRightCurve;
  letterBody -= vec3(0.024, 0.050, 0.090) * oppositeShade * (0.18 + glassWall * 0.44);
  letterBody += blue * caustic * 0.028 * interior;

  vec3 color = base;
  float sideDepth = sideVolume * (0.42 + abs(surfaceDepth) * 0.42);
  vec3 sideWallTint = mix(vec3(0.82, 0.88, 0.95), vec3(0.66, 0.76, 0.87), abs(surfaceDepth));
  vec3 sideWall = mix(refracted, sideWallTint, 0.13 + sideDepth * 0.16);
  color = mix(color, sideWall, sideVolume * 0.92);
  color += white * sideVolume * 0.12;
  color += blue * sideVolume * 0.026;
  color -= vec3(0.024, 0.055, 0.105) * outerHalo * 0.62;
  color = mix(color, letterBody, letterMask * mix(0.95, 0.98, mobilePoster));
  // Preserve a readable glass body even when the refracted pearl background is
  // nearly white. Highlights are layered afterward, so this is optical density
  // rather than a flat fill painted over the volume.
  vec3 volumeAbsorption = vec3(0.070, 0.043, 0.018)
    * (0.62 + opticalPath * 0.38 + glassWall * 0.32);
  color *= vec3(1.0) - volumeAbsorption * letterMask;
  color += vec3(0.008, 0.016, 0.030) * interior * letterMask;
  color -= vec3(0.008, 0.020, 0.044) * interior * letterMask;
  color -= vec3(0.035, 0.055, 0.085) * letterMask * mobilePoster * 0.20;
  color += white * innerBevel * 0.20;
  color += white * edgeRim * 0.30;
  float curvedSheen = exp(
    -pow(glyphLocal.x + 0.30 + glyphOrientation.y * 1.8, 2.0) * 5.5
    -pow(glyphLocal.y + 0.36 - glyphOrientation.x * 1.8, 2.0) * 12.0
  ) * smoothstep(0.08, 0.46, thickness) * letterMask;
  color += white * curvedSheen * 0.36;
  color += white * sideVolume * max(coverageGradient.x - coverageGradient.y, 0.0) * 0.14;
  color += white * outerMeniscus * 0.30;
  color -= vec3(0.022, 0.052, 0.105) * innerMeniscus * 0.16;
  color += blue * outerMeniscus * max(coverageGradient.x - coverageGradient.y, 0.0) * 0.16;
  color += blue * glassWall * 0.032;
  float titleCaustic = pow(caustic, 2.0) * innerBevel * 0.52;
  color += white * titleCaustic * 0.18 + blue * titleCaustic * 0.075;
  float movingHighlight = clamp(dot(fluidVelocity, normalize(vec2(-0.72, -0.69))) * 2.8 + 0.5, 0.0, 1.0);
  color += (white * ripple.y * 0.30 + blue * ripple.x * 0.22) * letterMask;
  color += white * simulationHeight * 0.13 * letterMask;
  color += mix(blue, white, movingHighlight) * length(fluidVelocity) * 0.22 * (innerBevel + glassWall);
  color += white * max(glyphTransform.w, 0.0) * (innerBevel + edgeRim) * 0.9;
  color -= vec3(0.025, 0.055, 0.11) * max(-glyphTransform.w, 0.0) * letterMask * 1.8;
  color += white * lensStrength * 0.025 + blue * lensStrength * 0.008;

  float vignette = smoothstep(1.25, 0.12, distance((uv - 0.5) * vec2(aspect, 1.0), vec2(0.0)));
  color = mix(color * white, color, vignette);
  float peak = max(max(color.r, color.g), color.b);
  if (peak > 1.0) color /= peak;
  outColor = vec4(pow(max(color, vec3(0.0)), vec3(0.97)), 1.0);
}
`;
