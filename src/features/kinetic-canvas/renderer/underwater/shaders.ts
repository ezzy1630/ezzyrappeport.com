export const FULLSCREEN_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const HEIGHTFIELD_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec4 uSplats[8];
  uniform int uSplatCount;

  float wave(vec2 p, float t) {
    float a = sin(p.x * 5.2 + p.y * 2.1 + t * 0.28) * 0.52;
    float b = sin(p.x * -2.7 + p.y * 4.6 - t * 0.21) * 0.31;
    float c = sin(p.x * 9.1 - p.y * 5.7 + t * 0.34) * 0.17;
    return (a + b + c) * 0.5;
  }

  void main() {
    vec2 p = (vUv - 0.5) * vec2(2.2, 1.35);
    float h = wave(p, uTime);
    for (int i = 0; i < 8; i++) {
      if (i >= uSplatCount) break;
      vec4 splat = uSplats[i];
      float distanceToSplat = length(vUv - splat.xy);
      h += exp(-distanceToSplat * distanceToSplat / max(splat.z * splat.z, 0.0001))
        * splat.w;
    }
    gl_FragColor = vec4(h * 0.5 + 0.5, 0.0, 0.0, 1.0);
  }
`;

export const BACKDROP_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const BACKDROP_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vWorld;
  uniform float uTime;
  uniform float uCausticStrength;
  uniform float uDepthAttenuation;

  float causticField(vec2 p, float time) {
    float low = sin(p.x * 7.0 + sin(p.y * 3.2 + time * 0.18) * 1.1);
    low += sin(p.y * 6.1 - p.x * 2.2 - time * 0.14);
    float ridge = 1.0 - smoothstep(0.08, 0.72, abs(low * 0.5));
    return ridge * ridge;
  }

  void main() {
    vec3 upper = vec3(0.80, 0.875, 0.91);
    vec3 lower = vec3(0.52, 0.66, 0.735);
    vec3 color = mix(upper, lower, smoothstep(0.05, 0.98, vUv.y));
    float studioDepth = exp(-pow((vUv.y - 0.45) / 0.34, 2.0));
    color *= 1.0 - studioDepth * 0.065;
    float edgeDepth = smoothstep(0.16, 0.62, abs(vUv.x - 0.52));
    color *= 1.0 - edgeDepth * 0.10;
    float bandA = exp(-pow((vUv.x + vUv.y * 0.36 - 0.48) / 0.18, 2.0));
    float bandB = exp(-pow((vUv.x - vUv.y * 0.24 - 0.72) / 0.13, 2.0));
    color += vec3(0.18, 0.20, 0.205) * (bandA * 0.48 + bandB * 0.34);
    float architectural = smoothstep(0.47, 0.5, vUv.x)
      * (1.0 - smoothstep(0.71, 0.75, vUv.x));
    architectural *= smoothstep(0.08, 0.2, vUv.y) * (1.0 - smoothstep(0.8, 0.94, vUv.y));
    color = mix(color, color * vec3(0.72, 0.84, 0.91), architectural * 0.36);
    float caustic = causticField(vWorld.xz * 0.85, uTime);
    color += vec3(0.72, 0.83, 0.88) * caustic * uCausticStrength;
    float distanceDepth = smoothstep(-1.0, 1.0, vWorld.y);
    color = mix(color, vec3(0.62, 0.75, 0.82), distanceDepth * uDepthAttenuation);
    gl_FragColor = vec4(color, 1.0);
  }
`;

export const DEPTH_FRAGMENT = /* glsl */ `
  precision highp float;
  void main() {
    gl_FragColor = vec4(vec3(gl_FragCoord.z), 1.0);
  }
`;

export const GLYPH_VERTEX = /* glsl */ `
  varying vec2 vScreenUv;
  varying vec3 vViewNormal;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec4 view = viewMatrix * world;
    vec4 clip = projectionMatrix * view;
    vScreenUv = clip.xy / clip.w * 0.5 + 0.5;
    vViewNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vWorldPosition = world.xyz;
    gl_Position = clip;
  }
`;

export const GLYPH_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vScreenUv;
  varying vec3 vViewNormal;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  uniform sampler2D uEnvironment;
  uniform sampler2D uFrontDepth;
  uniform sampler2D uBackDepth;
  uniform float uIor;
  uniform float uRoughness;
  uniform vec3 uAttenuationColor;
  uniform float uAbsorptionDistance;
  uniform float uTime;

  void main() {
    float frontDepth = texture2D(uFrontDepth, vScreenUv).r;
    float backDepth = texture2D(uBackDepth, vScreenUv).r;
    float geometricThickness = clamp((backDepth - frontDepth) * 155.0, 0.015, 0.68);
    float shoulder = 1.0 - abs(vViewNormal.z);
    float opticalThickness = max(geometricThickness, 0.11 + shoulder * 0.22)
      * (1.0 + shoulder * 1.35);
    float eta = (uIor - 1.0) / uIor;
    vec2 internalWarp = vec2(
      sin(vWorldPosition.z * 8.0 + uTime * 0.18),
      sin(vWorldPosition.x * 7.0 - uTime * 0.14)
    ) * 0.00045;
    vec2 refractedUv = clamp(
      vScreenUv + vViewNormal.xy * eta * opticalThickness * 0.052 + internalWarp,
      vec2(0.002),
      vec2(0.998)
    );
    vec3 environment = texture2D(uEnvironment, refractedUv).rgb;

    vec3 safeAttenuation = max(uAttenuationColor, vec3(0.02));
    vec3 absorption = -log(safeAttenuation) / max(uAbsorptionDistance, 0.01);
    vec3 transmittance = exp(-absorption * opticalThickness);
    vec3 body = environment * transmittance
      + uAttenuationColor * (1.0 - transmittance) * 0.42;
    body = mix(body, uAttenuationColor, 0.22 + opticalThickness * 0.12);

    vec3 viewDirection = vec3(0.0, 0.0, 1.0);
    float fresnelBase = pow((uIor - 1.0) / (uIor + 1.0), 2.0);
    float fresnel = fresnelBase + (1.0 - fresnelBase)
      * pow(1.0 - clamp(dot(vViewNormal, viewDirection), 0.0, 1.0), 5.0);
    vec3 keyDirection = normalize(vec3(-0.42, 0.68, 0.60));
    float broadHighlight = pow(max(dot(normalize(vViewNormal + keyDirection), viewDirection), 0.0),
      mix(18.0, 42.0, 1.0 - uRoughness));
    float shoulderGlow = smoothstep(0.18, 0.86, shoulder) * (1.0 - smoothstep(0.88, 1.0, shoulder));
    vec3 reflected = vec3(0.78, 0.88, 0.93) * (fresnel * 0.42 + broadHighlight * 0.22);
    reflected += vec3(0.48, 0.66, 0.76) * shoulderGlow * 0.08;
    gl_FragColor = vec4(body + reflected, 1.0);
  }
`;

export const FINAL_COMPOSITE_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uScene;
  uniform sampler2D uSceneDepth;
  uniform sampler2D uFrontDepth;
  uniform sampler2D uBackDepth;
  uniform sampler2D uHeightfield;
  uniform vec2 uResolution;
  uniform float uExposure;
  uniform float uSurfaceDistortion;
  uniform float uCausticStrength;
  uniform float uDepthAttenuation;

  vec3 aces(vec3 value) {
    const float a = 2.51;
    const float b = 0.03;
    const float c = 2.43;
    const float d = 0.59;
    const float e = 0.14;
    return clamp((value * (a * value + b)) / (value * (c * value + d) + e), 0.0, 1.0);
  }

  vec3 linearToSrgb(vec3 value) {
    vec3 low = value * 12.92;
    vec3 high = 1.055 * pow(max(value, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
    return mix(low, high, step(vec3(0.0031308), value));
  }

  float heightAt(vec2 uv) { return texture2D(uHeightfield, clamp(uv, 0.0, 1.0)).r * 2.0 - 1.0; }

  void main() {
    vec2 texel = 1.0 / max(uResolution, vec2(1.0));
    float h = heightAt(vUv);
    vec2 slope = vec2(
      heightAt(vUv + vec2(texel.x * 5.0, 0.0)) - heightAt(vUv - vec2(texel.x * 5.0, 0.0)),
      heightAt(vUv + vec2(0.0, texel.y * 5.0)) - heightAt(vUv - vec2(0.0, texel.y * 5.0))
    );
    float sceneDepth = texture2D(uSceneDepth, vUv).r;
    float frontDepth = texture2D(uFrontDepth, vUv).r;
    float backDepth = texture2D(uBackDepth, vUv).r;
    float glyphThickness = max(backDepth - frontDepth, 0.0);
    float depthTravel = smoothstep(0.25, 0.99, sceneDepth);
    vec2 refraction = slope * uSurfaceDistortion * (0.65 + depthTravel * 0.7);
    vec3 scene = texture2D(uScene, clamp(vUv + refraction, 0.002, 0.998)).rgb;

    // The same surface normal that refracts the complete scene drives the
    // restrained caustic modulation. Glyph thickness gates its interior reach.
    float focus = 1.0 - smoothstep(0.015, 0.19, length(slope));
    float caustic = focus * focus * uCausticStrength * (0.25 + depthTravel * 0.45);
    scene += vec3(0.72, 0.82, 0.86) * caustic * (1.0 + glyphThickness * 1.5);

    vec3 waterAbsorption = vec3(0.055, 0.025, 0.012) * depthTravel * uDepthAttenuation;
    scene *= exp(-waterAbsorption);
    scene = mix(scene, vec3(0.64, 0.76, 0.82), depthTravel * uDepthAttenuation * 0.24);

    vec3 normal = normalize(vec3(-slope * 7.0, 1.0));
    float fresnel = pow(1.0 - max(normal.z, 0.0), 5.0);
    float upperSurface = smoothstep(0.74, 1.0, 1.0 - vUv.y);
    scene += vec3(0.72, 0.82, 0.87) * fresnel * (0.025 + upperSurface * 0.045);
    scene += vec3(0.022, 0.032, 0.038) * h * 0.065;

    gl_FragColor = vec4(linearToSrgb(aces(scene * uExposure)), 1.0);
  }
`;
