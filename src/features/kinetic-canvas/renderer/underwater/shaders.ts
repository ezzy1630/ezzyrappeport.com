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
  uniform sampler2D uPrevious;
  uniform vec2 uTexel;
  uniform float uDt;
  uniform float uTime;
  uniform float uAspect;
  uniform float uAmbient;
  uniform vec4 uSplats[8]; // end.xy, radius, pressure
  uniform vec4 uSegments[8]; // start.xy, end.xy
  uniform vec4 uDirections[8]; // direction.xy, wake, reserved
  uniform int uSplatCount;

  float segmentDistance(vec2 point, vec2 start, vec2 end) {
    vec2 scale = vec2(uAspect, 1.0);
    vec2 pa = (point - start) * scale;
    vec2 ba = (end - start) * scale;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.000001), 0.0, 1.0);
    return length(pa - ba * h);
  }

  void main() {
    vec2 state = texture2D(uPrevious, vUv).rg;
    float height = state.r;
    float velocity = state.g;
    float left = texture2D(uPrevious, vUv - vec2(uTexel.x, 0.0)).r;
    float right = texture2D(uPrevious, vUv + vec2(uTexel.x, 0.0)).r;
    float down = texture2D(uPrevious, vUv - vec2(0.0, uTexel.y)).r;
    float up = texture2D(uPrevious, vUv + vec2(0.0, uTexel.y)).r;
    float laplacian = left + right + down + up - height * 4.0;
    velocity += laplacian * 31.0 * uDt;
    velocity -= height * 2.2 * uDt;
    velocity *= exp(-1.72 * uDt);
    float edge = smoothstep(0.0, 0.035, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
    velocity *= mix(0.82, 1.0, edge);

    vec2 ambientPoint = vec2(
      0.5 + sin(uTime * 0.19) * 0.31,
      0.78 + cos(uTime * 0.13) * 0.08
    );
    velocity += sin(uTime * 0.43 + vUv.x * 4.1) * exp(-length((vUv - ambientPoint) * vec2(uAspect, 1.0)) * 5.0)
      * uAmbient * uDt;
    for (int i = 0; i < 8; i++) {
      if (i >= uSplatCount) break;
      vec4 splat = uSplats[i];
      vec4 segment = uSegments[i];
      vec4 direction = uDirections[i];
      float distanceToWake = segmentDistance(vUv, segment.xy, segment.zw);
      float wake = exp(-pow(distanceToWake / max(splat.z, 0.002), 2.0));
      vec2 fromEnd = (vUv - splat.xy) * vec2(uAspect, 1.0);
      vec2 directionUv = normalize(direction.xy * vec2(uAspect, 1.0) + vec2(0.00001));
      float directional = dot(fromEnd, directionUv);
      float pressure = exp(-dot(fromEnd, fromEnd) / max(splat.z * splat.z, 0.00001));
      velocity += (pressure * splat.w + wake * direction.z * (0.55 - directional * 2.2)) * uDt * 18.0;
    }
    height = clamp(height + velocity * uDt, -0.22, 0.22);
    gl_FragColor = vec4(height, velocity, 0.0, 1.0);
  }
`;

export const BACKDROP_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 clip = projectionMatrix * viewMatrix * world;
    vUv = clip.xy / clip.w * 0.5 + 0.5;
    gl_Position = clip;
  }
`;

/* ============================================================
   SUNLIT SHALLOWS — environment composition, back to front:
   sun bloom (upper-left), visible rippling surface across the top,
   soft god-ray shafts, a bright gradually-deepening water column,
   and a warm sand floor with living counter-moving caustics.
   vUv.y = 0 at the bottom of the frame, 1 at the top (the surface).
   ============================================================ */
export const BACKDROP_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vWorld;
  uniform float uTime;
  uniform float uCausticStrength;
  uniform float uDepthAttenuation;
  uniform float uAspect;
  uniform float uDebugUv;
  uniform float uMotion;

  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * vnoise(p);
      p = p * 2.03 + vec2(19.7, 7.3);
      a *= 0.5;
    }
    return v;
  }

  /* Caustic ridged field: two folded noises create living webs of
     refracted light rather than a uniform or swimming-pool grid. */
  float causticField(vec2 p, float t) {
    float n1 = vnoise(p * 3.0 + vec2(t * 0.18, t * 0.11));
    float n2 = vnoise(p * 3.6 - vec2(t * 0.14, t * 0.20) + 4.2);
    float ridge = 1.0 - smoothstep(0.0, 0.18, abs(n1 - n2));
    return pow(ridge, 2.4);
  }

  void main() {
    float t = uTime * uMotion;
    vec2 p = vec2(vUv.x * uAspect, vUv.y);
    if (uDebugUv > 0.5) { gl_FragColor = vec4(vUv, 0.0, 1.0); return; }

    /* palette */
    vec3 pearl = vec3(0.976, 0.988, 1.0);
    vec3 shallows = vec3(0.914, 0.958, 0.987);
    vec3 cerulean = vec3(0.820, 0.906, 0.964);
    vec3 ceruleanDeep = vec3(0.690, 0.824, 0.906);
    vec3 steel = vec3(0.680, 0.782, 0.858);
    vec3 sandCol = vec3(0.925, 0.952, 0.980);
    vec3 sandShadow = vec3(0.790, 0.861, 0.925);
    vec3 sunTint = vec3(1.0, 0.972, 0.918);
    vec3 causticTint = vec3(0.82, 0.94, 1.0);

    /* 4. water column: bright shallows grading to a luminous depth */
    vec3 color = mix(steel, ceruleanDeep, smoothstep(0.03, 0.34, vUv.y));
    color = mix(color, cerulean, smoothstep(0.28, 0.58, vUv.y));
    color = mix(color, shallows, smoothstep(0.52, 0.82, vUv.y));
    color = mix(color, pearl, smoothstep(0.80, 1.0, vUv.y));
    color = mix(color, color * (1.0 - uDepthAttenuation), (1.0 - vUv.y) * 0.55);
    float columnDrift = fbm(p * 1.15 + vec2(t * 0.012, t * 0.007));
    color += (columnDrift - 0.5) * 0.018;

    /* 1. sun bloom, upper-left */
    float sunDist = distance(p, vec2(0.15 * uAspect, 1.07));
    float bloom = exp(-sunDist * 1.4);
    float bloomCore = exp(-sunDist * 3.3);
    color += sunTint * (bloom * 0.30 + bloomCore * 0.36);

    /* 3. god-ray shafts descending from the surface, drifting slowly */
    float shaft = 0.0;
    float rayDepth = smoothstep(0.16, 1.0, vUv.y);
    float lean = (1.0 - vUv.y) * 0.30 * uAspect * 0.24;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float cx = (0.16 + fi * 0.205) * uAspect + sin(t * 0.10 + fi * 1.9) * 0.05;
      float width = 0.024 + hash21(vec2(fi, 3.1)) * 0.034;
      float x = p.x + lean;
      float d = abs(x - cx);
      float intensity = 0.45 + 0.55 * hash21(vec2(fi, 7.7));
      shaft += (1.0 - smoothstep(0.0, width, d)) * intensity;
    }
    shaft *= rayDepth * (0.45 + 0.55 * fbm(p * 2.0 + t * 0.05));
    color += sunTint * shaft * 0.11;

    /* 5. sand floor with living caustics (lower third) */
    float sandMask = 1.0 - smoothstep(0.20, 0.72, vUv.y);
    float sandLight = 0.80 + 0.20 * (1.0 - smoothstep(0.10, 0.95, vUv.x + (1.0 - vUv.y) * 0.35));
    vec3 sandColor = mix(sandShadow, sandCol, sandLight);
    float dune = fbm(vec2(p.x * 1.5, vUv.y * 6.0) + t * 0.008);
    sandColor += (dune - 0.5) * 0.05;
    float caA = causticField(p * 1.2, t);
    float caB = causticField(p * 1.45 + 13.1, -t * 0.82);
    float caustic = min(caA + caB * 0.72, 1.5);
    float causticZone = 1.0 - smoothstep(0.10, 0.76, vUv.y);
    sandColor += causticTint * caustic * causticZone * uCausticStrength * 0.9;
    color = mix(color, sandColor, sandMask);

    /* 2. visible water surface across the top of the frame */
    float surfaceMask = smoothstep(0.79, 1.0, vUv.y);
    vec2 surfP = vec2(p.x * 2.3, vUv.y * 5.0);
    float wave = fbm(surfP + vec2(t * 0.20, t * 0.05));
    float waveB = fbm(surfP * 1.7 - vec2(t * 0.16, t * 0.09) + 6.3);
    float surfaceNormal = wave - waveB;
    float glitterCell = vnoise(surfP * 6.0 + vec2(t * 0.55, t * 0.2));
    float glitter = pow(max(0.0, glitterCell - 0.60) / 0.40, 3.0);
    glitter *= smoothstep(0.30, 1.0, vUv.y);
    vec3 surfaceColor = mix(pearl, sunTint, clamp(0.5 + surfaceNormal, 0.0, 1.0));
    surfaceColor += sunTint * glitter * 0.9;
    color = mix(color, surfaceColor, surfaceMask * 0.92);
    float meniscus = smoothstep(0.982, 1.0, vUv.y + surfaceNormal * 0.012);
    color += sunTint * meniscus * 0.4;

    /* 1b. refracted sun disc just under the surface, upper-left */
    float disc = exp(-distance(p, vec2(0.17 * uAspect, 0.965)) * 6.5);
    color += sunTint * disc * 0.5;

    /* unified luminous grade */
    color = max(color, vec3(0.0));
    color = color / (1.0 + color * 0.05);
    float vignette = 1.0 - smoothstep(0.30, 1.28, length((vUv - vec2(0.5, 0.56)) * vec2(uAspect * 0.78, 1.08)));
    color *= mix(0.95, 1.02, vignette);
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
  uniform float uCameraNear;
  uniform float uCameraFar;
  uniform vec3 uCameraPosition;
  uniform vec3 uKeyPosition;
  uniform vec3 uKeyColor;
  uniform float uKeyIntensity;
  uniform vec3 uFillPosition;
  uniform vec3 uFillColor;
  uniform float uFillIntensity;
  uniform int uRefractionTaps;
  uniform float uCausticStrength;

  float linearViewDepth(float depth) {
    float viewZ = (uCameraNear * uCameraFar) / ((uCameraFar - uCameraNear) * depth - uCameraFar);
    return -viewZ;
  }

  vec3 sampleEnvironment(vec2 uv, vec2 direction, float radius) {
    vec3 color = texture2D(uEnvironment, uv).rgb;
    if (uRefractionTaps <= 1) return color;
    color += texture2D(uEnvironment, clamp(uv + direction * radius, 0.002, 0.998)).rgb;
    color += texture2D(uEnvironment, clamp(uv - direction * radius, 0.002, 0.998)).rgb;
    if (uRefractionTaps <= 3) return color / 3.0;
    vec2 perpendicular = vec2(-direction.y, direction.x);
    color += texture2D(uEnvironment, clamp(uv + perpendicular * radius * 0.72, 0.002, 0.998)).rgb;
    color += texture2D(uEnvironment, clamp(uv - perpendicular * radius * 0.72, 0.002, 0.998)).rgb;
    return color / 5.0;
  }

  float hash21g(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }
  float vnoiseg(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21g(i), hash21g(i + vec2(1, 0)), u.x),
               mix(hash21g(i + vec2(0, 1)), hash21g(i + vec2(1, 1)), u.x), u.y);
  }
  /* pale cerulean used for the grazing-edge internal reflection */
  vec3 ceruleanEdge() { return vec3(0.62, 0.82, 0.90); }

  void main() {
    float frontDepth = linearViewDepth(texture2D(uFrontDepth, vScreenUv).r);
    float backDepth = linearViewDepth(texture2D(uBackDepth, vScreenUv).r);
    float geometricThickness = clamp(backDepth - frontDepth, 0.008, 0.60);
    float shoulder = 1.0 - abs(vViewNormal.z);
    float opticalThickness = geometricThickness * (1.0 + shoulder * 1.65) + shoulder * 0.05;
    float eta = (uIor - 1.0) / uIor;

    /* micro-bubble inclusions: tiny internal roughness/normal variation so
       the crystal feels embedded, not painted. Embedded, not surface. */
    float bubbles = vnoiseg(vWorldPosition.xz * 34.0 + vWorldPosition.yy * 21.0);
    float bubbleMask = smoothstep(0.78, 0.98, bubbles);
    float internalRough = uRoughness + bubbleMask * 0.10;

    vec2 internalWarp = vec2(
      sin(vWorldPosition.z * 7.0 + uTime * 0.10),
      sin(vWorldPosition.x * 6.0 - uTime * 0.08)
    ) * 0.0006;
    vec2 refractionDirection = normalize(vViewNormal.xy + vec2(0.0001));
    vec2 refractedUv = clamp(
      vScreenUv + vViewNormal.xy * eta * opticalThickness * 0.115 + internalWarp,
      vec2(0.002), vec2(0.998)
    );
    float samplingRadius = 0.0006 + internalRough * 0.014 + shoulder * 0.0016;
    vec3 environment = sampleEnvironment(refractedUv, refractionDirection, samplingRadius);
    vec3 directEnvironment = texture2D(uEnvironment, vScreenUv).rgb;

    /* pale-cerulean attenuation through the letterform depth */
    vec3 safeAttenuation = max(uAttenuationColor, vec3(0.05));
    vec3 absorption = -log(safeAttenuation) / max(uAbsorptionDistance, 0.01);
    vec3 transmittance = exp(-absorption * opticalThickness);
    /* clear transmissive body: sharp refraction, luminous interior */
    vec3 body = environment * transmittance
      + uAttenuationColor * (1.0 - transmittance) * 0.34;
    body += (environment - directEnvironment) * (0.55 + shoulder * 0.30);
    /* keep faces bright and glassy, deepen only at grazing edges */
    body *= mix(0.96, 0.82, shoulder * shoulder);
    /* embedded micro-bubbles catch a faint internal sparkle */
    body += vec3(0.86, 0.95, 0.99) * bubbleMask * transmittance * 0.16;

    /* strong controlled Fresnel rims */
    vec3 viewDirection = normalize(uCameraPosition - vWorldPosition);
    float fresnelBase = pow((uIor - 1.0) / (uIor + 1.0), 2.0);
    float fresnel = fresnelBase + (1.0 - fresnelBase)
      * pow(1.0 - clamp(dot(vWorldNormal, viewDirection), 0.0, 1.0), 4.0);

    /* crisp key + soft fill speculars (clearcoat-like bright edge) */
    vec3 keyDirection = normalize(uKeyPosition - vWorldPosition);
    vec3 fillDirection = normalize(uFillPosition - vWorldPosition);
    vec3 keyHalf = normalize(keyDirection + viewDirection);
    vec3 fillHalf = normalize(fillDirection + viewDirection);
    float keySpec = pow(max(dot(vWorldNormal, keyHalf), 0.0), mix(90.0, 240.0, 1.0 - uRoughness));
    float fillSpec = pow(max(dot(vWorldNormal, fillHalf), 0.0), 40.0);
    float lowerBounce = max(dot(vWorldNormal, normalize(vec3(0.1, -0.5, 0.3))), 0.0);

    /* edge/internal reflection: refracted environment at grazing angles,
       never a muddy dark sidewall */
    float grazing = smoothstep(0.35, 0.95, shoulder);
    vec2 reflectedUv = clamp(vScreenUv - vViewNormal.xy * (0.016 + opticalThickness * 0.03), 0.002, 0.998);
    vec3 reflectedEnvironment = texture2D(uEnvironment, reflectedUv).rgb;
    vec3 edgeWater = mix(reflectedEnvironment * 0.9, ceruleanEdge(), 0.35);
    body = mix(body, edgeWater, grazing * 0.55);

    /* caustic fire concentrating through the letterforms */
    float causticFold = pow(0.5 + 0.5 * sin(vWorldPosition.x * 4.2 + vWorldPosition.z * 5.4 - uTime * 0.16), 7.0)
      * (0.3 + shoulder * 0.7);

    vec3 reflected = vec3(0.92, 0.97, 1.0) * fresnel * 0.55;
    reflected += uKeyColor * keySpec * uKeyIntensity * 0.045;
    reflected += uFillColor * fillSpec * uFillIntensity * 0.022;
    reflected += vec3(0.55, 0.70, 0.78) * lowerBounce * 0.05;
    reflected += vec3(0.78, 0.90, 0.94) * causticFold * uCausticStrength * 0.34;
    gl_FragColor = vec4(max(body + reflected, vec3(0.0)), 1.0);
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
  uniform vec2 uHeightTexel;
  uniform float uExposure;
  uniform float uSurfaceDistortion;
  uniform float uCausticStrength;
  uniform float uDepthAttenuation;
  uniform float uCameraNear;
  uniform float uCameraFar;
  uniform float uTime;
  uniform int uQualityTier;
  uniform int uDebugView;

  vec3 underwaterToneMap(vec3 value) {
    // Bright-shallows shoulder: keep the pale luminous midrange, roll only
    // the hottest highlights so whites stay bright without harsh clipping.
    vec3 shouldered = value / (vec3(1.0) + value * 0.10);
    return clamp(shouldered * 1.03, 0.0, 1.0);
  }

  vec3 linearToSrgb(vec3 value) {
    vec3 low = value * 12.92;
    vec3 high = 1.055 * pow(max(value, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
    return mix(low, high, step(vec3(0.0031308), value));
  }

  float heightAt(vec2 uv) { return texture2D(uHeightfield, clamp(uv, 0.0, 1.0)).r; }
  float linearViewDepth(float depth) {
    float viewZ = (uCameraNear * uCameraFar) / ((uCameraFar - uCameraNear) * depth - uCameraFar);
    return -viewZ;
  }

  vec3 sampleScene(vec2 uv, vec2 direction, float radius) {
    vec3 color = texture2D(uScene, uv).rgb;
    if (uQualityTier <= 0) return color;
    color += texture2D(uScene, clamp(uv + direction * radius, 0.002, 0.998)).rgb;
    color += texture2D(uScene, clamp(uv - direction * radius, 0.002, 0.998)).rgb;
    if (uQualityTier == 1) return color / 3.0;
    vec2 perpendicular = vec2(-direction.y, direction.x);
    color += texture2D(uScene, clamp(uv + perpendicular * radius * 0.7, 0.002, 0.998)).rgb;
    color += texture2D(uScene, clamp(uv - perpendicular * radius * 0.7, 0.002, 0.998)).rgb;
    return color / 5.0;
  }

  void main() {
    vec2 texel = uHeightTexel;
    float h = heightAt(vUv);
    vec2 nearSlope = vec2(
      heightAt(vUv + vec2(texel.x * 2.0, 0.0)) - heightAt(vUv - vec2(texel.x * 2.0, 0.0)),
      heightAt(vUv + vec2(0.0, texel.y * 2.0)) - heightAt(vUv - vec2(0.0, texel.y * 2.0))
    );
    vec2 farSlope = vec2(
      heightAt(vUv + vec2(texel.x * 9.0, 0.0)) - heightAt(vUv - vec2(texel.x * 9.0, 0.0)),
      heightAt(vUv + vec2(0.0, texel.y * 9.0)) - heightAt(vUv - vec2(0.0, texel.y * 9.0))
    );
    vec2 slope = nearSlope * 0.58 + farSlope * 0.42;
    float sceneDepth = texture2D(uSceneDepth, vUv).r;
    float frontDepth = texture2D(uFrontDepth, vUv).r;
    float backDepth = texture2D(uBackDepth, vUv).r;
    float glyphThickness = max(linearViewDepth(backDepth) - linearViewDepth(frontDepth), 0.0);
    float sceneLinearDepth = linearViewDepth(sceneDepth);
    float depthTravel = clamp((sceneLinearDepth - uCameraNear) / max(uCameraFar * 0.42, 0.001), 0.0, 1.0);
    if (uDebugView == 1) {
      float debugHeight = heightAt(vUv);
      gl_FragColor = vec4(vec3(debugHeight * 8.0 + 0.5), 1.0);
      return;
    }
    if (uDebugView == 2) {
      float value = clamp(linearViewDepth(frontDepth) / uCameraFar, 0.0, 1.0);
      gl_FragColor = vec4(vec3(value), 1.0);
      return;
    }
    if (uDebugView == 3) {
      float value = clamp(linearViewDepth(backDepth) / uCameraFar, 0.0, 1.0);
      gl_FragColor = vec4(vec3(value), 1.0);
      return;
    }
    if (uDebugView == 4) {
      gl_FragColor = vec4(vec3(clamp(glyphThickness * 2.4, 0.0, 1.0)), 1.0);
      return;
    }
    if (uDebugView == 5) {
      gl_FragColor = vec4(linearToSrgb(texture2D(uScene, vUv).rgb), 1.0);
      return;
    }
    float upperIdentity = smoothstep(0.48, 0.96, vUv.y);
    float copyCalm = 1.0 - exp(-pow((vUv.y - 0.37) / 0.15, 2.0)) * 0.30;
    float regionalStrength = (0.46 + upperIdentity * 0.72) * copyCalm;
    vec2 slowSwell = vec2(
      sin(vUv.y * 5.2 + uTime * 0.13),
      cos(vUv.x * 5.8 - uTime * 0.11)
    ) * 0.00045 * (0.35 + upperIdentity * 0.65);
    vec2 surfaceVector = slope * regionalStrength + slowSwell;
    vec2 refraction = surfaceVector * uSurfaceDistortion * (0.72 + depthTravel * 0.72);
    vec2 refractionDirection = normalize(surfaceVector + vec2(0.00001));
    vec3 scene = sampleScene(
      clamp(vUv + refraction, 0.002, 0.998),
      refractionDirection,
      0.0007 + length(surfaceVector) * 0.35
    );

    /* crisp contact shadow anchoring the glyphs to the sand */
    float glyphHere = step(frontDepth, 0.9995);
    vec2 shadowDirection = vec2(-0.005, 0.0075) * (0.72 + depthTravel * 0.4);
    float projectedShadow = 0.0;
    projectedShadow += step(texture2D(uFrontDepth, clamp(vUv + shadowDirection, 0.002, 0.998)).r, 0.9995);
    projectedShadow += step(texture2D(uFrontDepth, clamp(vUv + shadowDirection * 1.8, 0.002, 0.998)).r, 0.9995);
    projectedShadow += step(texture2D(uFrontDepth, clamp(vUv + shadowDirection * 2.7, 0.002, 0.998)).r, 0.9995);
    projectedShadow = projectedShadow / 3.0 * (1.0 - glyphHere);
    scene *= 1.0 - projectedShadow * (0.07 + depthTravel * 0.04);

    // The same surface normal that refracts the complete scene drives the
    // restrained caustic modulation. Glyph thickness gates its interior reach.
    float compression = smoothstep(0.003, 0.028, abs(dot(surfaceVector, normalize(vec2(0.72, 0.38)))));
    float focus = 1.0 - smoothstep(0.008, 0.11, length(surfaceVector));
    float caustic = (focus * focus * 0.35 + compression * 0.65) * uCausticStrength
      * (0.20 + depthTravel * 0.34) * (0.45 + upperIdentity * 0.55);
    scene += vec3(0.72, 0.88, 0.92) * caustic * (1.0 + glyphThickness * 0.85);

    /* bright shallows absorption: gentle, luminous, never muddy */
    vec3 waterAbsorption = vec3(0.035, 0.018, 0.008) * depthTravel * uDepthAttenuation;
    scene *= exp(-waterAbsorption);
    scene = mix(scene, vec3(0.72, 0.86, 0.92), depthTravel * uDepthAttenuation * 0.20);

    /* surface sheen + sun glitter near the top of the frame */
    vec3 normal = normalize(vec3(-surfaceVector * 13.0, 1.0));
    float fresnel = pow(1.0 - max(normal.z, 0.0), 5.0);
    float surfaceSheet = smoothstep(0.70, 0.98, vUv.y);
    float glitterBand = pow(0.5 + 0.5 * sin(vUv.x * 14.0 + vUv.y * 5.0 - uTime * 0.22), 9.0) * surfaceSheet;
    scene += vec3(0.80, 0.92, 0.96) * fresnel * (0.03 + surfaceSheet * 0.14);
    scene += vec3(0.9, 0.97, 1.0) * glitterBand * 0.05;
    scene += vec3(0.05, 0.07, 0.08) * h * 0.06;

    gl_FragColor = vec4(linearToSrgb(underwaterToneMap(scene * uExposure)), 1.0);
  }
`;
