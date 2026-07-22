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
  white += ridge(distanceToPointer - 0.078 - sin(time * 1.2) * 0.009, 0.022) * envelope * 0.07;
  warp += pulse * envelope * 0.027;

  for (int i = 0; i < 8; i++) {
    vec4 ripple = u_ripples[i];
    float age = time - ripple.z;
    if (age <= 0.0 || age >= 3.2 || ripple.w <= 0.001) continue;
    float distanceToRipple = distance(position * u_resolution, ripple.xy);
    float radius = 24.0 + age * 155.0;
    float ring = sin((distanceToRipple - radius) * 0.058);
    float rippleEnvelope = exp(-abs(distanceToRipple - radius) / 58.0) * (1.0 - age / 3.2) * ripple.w;
    blue += max(ring, 0.0) * rippleEnvelope * 0.22;
    white += max(-ring, 0.0) * rippleEnvelope * 0.14;
    warp += ring * rippleEnvelope * 0.024;
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

vec3 proceduralWater(vec2 uv, float aspect, float time, float scrollDepth) {
  vec2 world = vec2((uv.x - 0.5) * aspect, uv.y + scrollDepth * 1.72);
  float broad = sin(world.x * 4.2 + world.y * 2.1 + time * 0.22)
    + sin(world.x * -2.7 + world.y * 5.3 - time * 0.17);
  float crossWave = sin(world.x * 11.0 - world.y * 6.4 + time * 0.31)
    * cos(world.x * 4.8 + world.y * 8.2 - time * 0.19);
  float depth = clamp(scrollDepth * 0.72 + uv.y * 0.16, 0.0, 1.0);
  vec3 shallow = vec3(0.885, 0.930, 0.982);
  vec3 deep = vec3(0.610, 0.765, 0.930);
  vec3 color = mix(shallow, deep, depth * 0.52);
  color += vec3(0.055, 0.095, 0.160) * broad * 0.22;
  color += vec3(0.070, 0.120, 0.190) * crossWave * 0.090;
  float fold = smoothstep(1.05, 1.82, abs(broad));
  color = mix(color, vec3(0.965, 0.985, 1.0), fold * 0.22);
  float trough = smoothstep(0.52, 1.0, -crossWave);
  color -= vec3(0.025, 0.052, 0.095) * trough;
  float sunShaft = pow(max(0.0, sin(world.x * 2.4 + world.y * 0.72 - time * 0.08)), 7.0);
  color += vec3(0.095, 0.130, 0.190) * sunShaft * (1.0 - depth * 0.45);
  return color;
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

float inflatedHeight(float wallDistance) {
  // A quarter-circle shoulder reaches a calm, nearly planar crown. This reads
  // as an inflated acrylic body instead of continuously beveling the entire
  // stroke like a carved slab.
  float shoulder = clamp(wallDistance / 0.40, 0.0, 1.0);
  return sqrt(max(1.0 - pow(1.0 - shoulder, 2.0), 0.0));
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
  // The supplied pearl texture is now only fine material variation. The world
  // itself is a scroll-coherent, time-varying body of water, rather than a
  // photograph with distortion applied over it.
  vec3 livingWater = proceduralWater(flowUv, aspect, time, u_scroll.x);
  vec3 photographicDetail = mix(pearlSurface, chromaticSurface, 0.32);
  vec3 base = livingWater;
  base = mix(base, white, 0.035);
  base += vec3(0.002, 0.004, 0.010);
  float depthVeil = smoothstep(0.04, 1.0, uv.y);
  base = mix(base, vec3(0.84, 0.91, 0.985), depthVeil * 0.025);

  float caustic = caustics(plane * 3.1 + vec2(time * 0.035, -time * 0.026), time * 0.42);
  float causticMask = smoothstep(0.3, 0.9, flowC) * 0.35;
  float liquidRidge = ridge(flowA - 0.52, 0.20) * 0.34 + ridge(flowB - 0.48, 0.18) * 0.22;
  float causticFocus = smoothstep(0.62, 1.18, caustic);
  base -= vec3(0.032, 0.064, 0.118) * (1.0 - causticFocus) * 0.38;
  base += white * causticFocus * 0.085;
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
  base += white * ripple.y * 0.030 + blue * ripple.x * 0.065;
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
  // A restrained offset softens raster quantization without swelling counters
  // or turning the silhouette into an outlined block.
  signedDistance += 0.014;
  float titleAA = max(fwidth(signedDistance) * 1.25, mix(0.0042, 0.0072, mobilePoster));
  float frontFaceMask = smoothstep(-titleAA, titleAA, signedDistance) * u_nameOpacity;

  // Solve a continuous inflated height surface. Three fixed-point samples are
  // enough to follow tilt parallax without exposing discrete extrusion slices
  // or paying for a full ray march in every title pixel.
  vec4 surfaceField = titleField;
  vec2 surfaceLocal = glyphLocal;
  vec2 volumeParallax = vec2(glyphOrientation.y, -glyphOrientation.x) * 0.34;
  if (activeGlyph >= 0) {
    for (int surfaceStep = 0; surfaceStep < 3; surfaceStep++) {
      surfaceField = sampleGlyphField(activeGlyph, surfaceLocal);
      float surfaceHeight = inflatedHeight(surfaceField.g);
      surfaceLocal = glyphLocal + volumeParallax * surfaceHeight * 0.78;
    }
    surfaceField = sampleGlyphField(activeGlyph, surfaceLocal);
  }
  titleField = surfaceField;
  glyphLocal = surfaceLocal;
  float surfaceSignedDistance = titleField.r * 2.0 - 1.0 + 0.014;
  float surfaceMask = smoothstep(-titleAA, titleAA, surfaceSignedDistance) * u_nameOpacity;
  float letterMask = max(frontFaceMask, surfaceMask);
  float sideVolume = max(frontFaceMask - surfaceMask, 0.0);
  float wallDistance = max(titleField.g, surfaceMask * 0.012) * u_nameOpacity;
  float dome = inflatedHeight(wallDistance);
  float interior = smoothstep(0.72, 0.98, dome) * letterMask;
  float shoulder = (1.0 - smoothstep(0.82, 0.995, dome)) * letterMask;
  vec2 atlasPixel = activeGlyph >= 0
    ? 1.25 / max(u_textResolution * u_glyphAtlas[activeGlyph].zw, vec2(1.0))
    : vec2(0.01);
  vec4 fieldRight = activeGlyph >= 0 ? sampleGlyphField(activeGlyph, glyphLocal + vec2(atlasPixel.x, 0.0)) : vec4(0.0);
  vec4 fieldLeft = activeGlyph >= 0 ? sampleGlyphField(activeGlyph, glyphLocal - vec2(atlasPixel.x, 0.0)) : vec4(0.0);
  vec4 fieldUp = activeGlyph >= 0 ? sampleGlyphField(activeGlyph, glyphLocal + vec2(0.0, atlasPixel.y)) : vec4(0.0);
  vec4 fieldDown = activeGlyph >= 0 ? sampleGlyphField(activeGlyph, glyphLocal - vec2(0.0, atlasPixel.y)) : vec4(0.0);
  vec2 heightGradient = vec2(
    inflatedHeight(fieldRight.g) - inflatedHeight(fieldLeft.g),
    inflatedHeight(fieldUp.g) - inflatedHeight(fieldDown.g)
  );
  vec2 coverageGradient = vec2(fieldRight.r - fieldLeft.r, fieldUp.r - fieldDown.r);
  coverageGradient = rotateGlyph(coverageGradient, glyphOrientation.z);
  vec3 normal = orientGlyphNormal(
    normalize(vec3(-heightGradient * 10.0, 0.74)),
    glyphOrientation
  );
  normal = normalize(vec3(normal.xy + simulationNormal.xy * 0.075 + fluidVelocity * 0.12, normal.z));

  // Fine solver detail remains optical while the broad GPU state moves the
  // actual glyph volume. This prevents shimmer and cross-glyph contamination.
  float faceDepth = mix(0.48, 1.0, dome);
  vec2 sampleWarp = ripple.z * vec2(0.62, 0.29)
    + simulationNormal.xy * (0.011 + faceDepth * 0.010)
    + fluidVelocity * (0.024 + faceDepth * 0.018)
    + lensOffset * 0.50;
  float opticalPath = letterMask * (0.34 + dome * 1.72 + shoulder * 0.22);
  vec2 volumeLens = glyphLocal * dome * 0.018;
  vec2 refraction = uv + sampleWarp - volumeLens + normal.xy * (0.022 + opticalPath * 0.040);
  vec2 backRefraction = uv + sampleWarp * 0.46 + volumeLens * 0.42
    - normal.xy * (0.012 + opticalPath * 0.023);
  vec2 chroma = normal.xy * (0.00055 + opticalPath * 0.0011);
  vec3 refractedFrontBase = proceduralWater(refraction, aspect, time, u_scroll.x);
  vec3 refractedFront = vec3(
    proceduralWater(refraction + chroma, aspect, time, u_scroll.x).r * 0.97,
    refractedFrontBase.g * 0.99,
    proceduralWater(refraction - chroma, aspect, time, u_scroll.x).b * 1.02
  );
  vec3 refractedBack = proceduralWater(backRefraction, aspect, time, u_scroll.x);
  vec3 refracted = mix(refractedBack, refractedFront, 0.48 + dome * 0.24);
  vec3 absorption = mix(vec3(0.066, 0.048, 0.030), vec3(0.082, 0.060, 0.036), mobilePoster);
  vec3 transmission = mix(base, refracted, 0.80) * exp(-absorption * opticalPath);

  vec3 topLeftLight = normalize(vec3(-0.48, -0.66, 0.58));
  vec3 halfLight = normalize(topLeftLight + vec3(0.0, 0.0, 1.0));
  float lightFacing = max(dot(normal, topLeftLight), 0.0);
  float tightSpecular = pow(max(dot(normal, halfLight), 0.0), 72.0);
  float broadSpecular = pow(max(dot(normal, halfLight), 0.0), 16.0);
  float fresnel = 0.035 + 0.965 * pow(1.0 - clamp(normal.z, 0.0, 1.0), 5.0);
  float directionalShoulder = shoulder * max(
    dot(normalize(coverageGradient + vec2(0.0001)), normalize(vec2(-0.58, -0.82))),
    0.0
  );
  vec3 environmentReflection = mix(vec3(0.48, 0.62, 0.78), white, 0.60 + lightFacing * 0.22);
  vec3 letterBody = mix(transmission, environmentReflection, fresnel * 0.34);
  // A low-density body tint gives the clear core optical presence on a pale
  // environment without resorting to an outline. Thick paths absorb slightly
  // more, as real acrylic/water glass does.
  vec3 bodyTint = vec3(0.70, 0.81, 0.94);
  letterBody = mix(letterBody, bodyTint, min(0.15, 0.060 + opticalPath * 0.040));
  letterBody -= vec3(0.034, 0.054, 0.082) * opticalPath * 0.20;
  letterBody -= vec3(0.030, 0.046, 0.070) * interior * (0.16 + dome * 0.12);
  letterBody += white * tightSpecular * 0.56;
  letterBody += white * broadSpecular * 0.080;
  letterBody += white * directionalShoulder * 0.15;
  float lowerRightFacing = max(dot(normal.xy, normalize(vec2(0.54, 0.84))), 0.0);
  letterBody -= vec3(0.090, 0.120, 0.165) * shoulder * lowerRightFacing * 0.22;
  letterBody -= vec3(0.038, 0.058, 0.088) * shoulder * (1.0 - lightFacing) * 0.18;
  letterBody += blue * pow(caustic, 2.0) * interior * 0.025;
  float crownSheen = exp(-pow(glyphLocal.y + 0.34, 2.0) * 10.0)
    * smoothstep(0.82, 0.995, dome)
    * smoothstep(-0.92, 0.72, glyphLocal.x) * letterMask;
  letterBody += white * crownSheen * 0.14;
  float faceGlint = exp(
    -pow(glyphLocal.x + 0.34, 2.0) * 8.0
    -pow(glyphLocal.y + 0.48, 2.0) * 16.0
  ) * interior;
  float internalWave = pow(max(
    sin(glyphLocal.x * 5.8 - glyphLocal.y * 3.4 + time * 0.34) * 0.5 + 0.5,
    0.0
  ), 7.0) * interior;
  letterBody += white * faceGlint * 0.24;
  letterBody += vec3(0.72, 0.86, 1.0) * internalWave * 0.070;

  vec3 color = base;
  vec3 sideWall = refracted * vec3(0.78, 0.87, 0.97);
  color = mix(color, sideWall, sideVolume * 0.68);
  color = mix(color, letterBody, surfaceMask * mix(0.96, 0.985, mobilePoster));
  color -= vec3(0.035, 0.055, 0.085) * letterMask * mobilePoster * 0.20;
  float movingHighlight = clamp(dot(fluidVelocity, normalize(vec2(-0.72, -0.69))) * 2.8 + 0.5, 0.0, 1.0);
  color += (white * ripple.y * 0.055 + blue * ripple.x * 0.10) * letterMask;
  color += white * simulationHeight * 0.040 * letterMask;
  color += mix(blue, white, movingHighlight) * length(fluidVelocity) * 0.12 * shoulder;
  color += white * max(glyphTransform.w, 0.0) * shoulder * 0.18;
  color -= vec3(0.025, 0.055, 0.11) * max(-glyphTransform.w, 0.0) * letterMask * 1.8;
  color += white * lensStrength * 0.008 + blue * lensStrength * 0.006;

  float vignette = smoothstep(1.25, 0.12, distance((uv - 0.5) * vec2(aspect, 1.0), vec2(0.0)));
  color = mix(color * white, color, vignette);
  float peak = max(max(color.r, color.g), color.b);
  // Compress only the highlight excess. Full normalization pulled every
  // channel toward white during a click and flattened the entire scene.
  color /= 1.0 + max(peak - 1.0, 0.0) * 0.65;
  outColor = vec4(pow(max(color, vec3(0.0)), vec3(0.97)), 1.0);
}
`;
