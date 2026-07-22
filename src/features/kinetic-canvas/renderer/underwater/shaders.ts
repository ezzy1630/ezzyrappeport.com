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
    vUv = uv;
    vWorld = vec3(position.xy, 0.0);
    gl_Position = vec4(position.xy, 0.999, 1.0);
  }
`;

/* Live underwater volume. Authored optical light fields seed the irregular
   reflection/caustic hierarchy; procedural waves, volume, absorption, and the
   shared heightfield provide time, depth, and physical response. */
export const BACKDROP_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uOpticalShallowLandscape;
  uniform sampler2D uOpticalShallowPortrait;
  uniform sampler2D uOpticalMidDepth;
  uniform sampler2D uOpticalDeepBasin;
  uniform float uTime;
  uniform float uAspect;
  uniform float uPortrait;
  uniform float uTheme;
  uniform float uDebugUv;
  uniform float uMotion;

  vec2 coverUv(vec2 uv, float imageAspect) {
    vec2 scale = vec2(1.0);
    if (uAspect > imageAspect) scale.y = imageAspect / uAspect;
    else scale.x = uAspect / imageAspect;
    return (uv - 0.5) * scale + 0.5;
  }

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }

  float noise21(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0)), u.x),
      u.y
    );
  }

  vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
  }

  mat2 rotate2d(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
  }

  vec2 waveNormal(vec2 p, float time) {
    vec2 n = vec2(0.0);
    n += vec2(cos(dot(p, vec2(1.0, 0.22)) * 7.2 + time * 0.72),
      sin(dot(p, vec2(0.18, 1.0)) * 8.4 - time * 0.58));
    n += vec2(cos(dot(p, vec2(-0.66, 0.75)) * 13.6 - time * 0.44),
      sin(dot(p, vec2(0.82, 0.57)) * 11.8 + time * 0.51)) * 0.52;
    n += vec2(cos(p.y * 24.0 + time * 0.31), sin(p.x * 22.0 - time * 0.37)) * 0.19;
    return n;
  }

  vec3 sampleOpticalDetail(vec2 screenUv) {
    if (uTheme > 0.72) {
      return texture2D(uOpticalDeepBasin, clamp(coverUv(screenUv, 1672.0 / 941.0), 0.003, 0.997)).rgb;
    }
    if (uTheme > 0.20) {
      return texture2D(uOpticalMidDepth, clamp(coverUv(screenUv, 1672.0 / 941.0), 0.003, 0.997)).rgb;
    }
    if (uPortrait > 0.5) {
      return texture2D(uOpticalShallowPortrait, clamp(coverUv(screenUv, 390.0 / 844.0), 0.003, 0.997)).rgb;
    }
    return texture2D(uOpticalShallowLandscape, clamp(coverUv(screenUv, 1672.0 / 941.0), 0.003, 0.997)).rgb;
  }

  float causticNetwork(vec2 point, float time) {
    vec2 p = point * 0.145;
    p += vec2(
      sin(p.y * 0.72 - time * 0.23) + sin(p.x * 0.31 + time * 0.17),
      cos(p.x * 0.67 + time * 0.19) - cos(p.y * 0.36 - time * 0.14)
    ) * 0.82;
    float foldA = sin(p.x * 1.18 + sin(p.y * 0.81 - time * 0.31) * 1.35);
    float foldB = sin(p.y * 1.07 - sin(p.x * 0.74 + time * 0.27) * 1.18);
    float foldC = sin(dot(p, vec2(0.58, -0.76)) + sin(p.x + p.y) * 0.72 + time * 0.16);
    float ridge = abs(foldA + foldB * 0.78 + foldC * 0.48);
    float focus = 1.0 - smoothstep(0.24, 1.55, ridge);
    float breakup = 0.42 + 0.58 * noise21(p * 0.62 + time * vec2(0.035, -0.027));
    return focus * focus * breakup;
  }

  void main() {
    if (uDebugUv > 0.5) { gl_FragColor = vec4(vUv, 0.0, 1.0); return; }
    float t = uTime * uMotion;
    float deepMix = smoothstep(0.46, 0.94, uTheme);
    float midMix = smoothstep(0.08, 0.62, uTheme) * (1.0 - deepMix);
    float surfaceHorizon = mix(0.79, 0.92, deepMix) + uPortrait * 0.025;
    float depth = clamp((surfaceHorizon - vUv.y) / max(surfaceHorizon, 0.001), 0.0, 1.0);
    vec2 centered = vec2((vUv.x - 0.5) * uAspect, vUv.y - surfaceHorizon);
    vec2 normalField = waveNormal(centered * vec2(2.6, 3.8), t);

    vec3 shallowTop = vec3(0.69, 0.82, 0.94);
    vec3 shallowBottom = vec3(0.31, 0.48, 0.67);
    vec3 midTop = vec3(0.56, 0.75, 0.88);
    vec3 midBottom = vec3(0.14, 0.35, 0.56);
    vec3 deepTop = vec3(0.012, 0.105, 0.27);
    vec3 deepBottom = vec3(0.001, 0.007, 0.032);
    vec3 shallow = mix(shallowTop, shallowBottom, pow(depth, 0.78));
    vec3 middle = mix(midTop, midBottom, pow(depth, 0.72));
    vec3 basin = mix(deepTop, deepBottom, pow(depth, 0.62));
    vec3 color = mix(shallow, middle, midMix);
    color = mix(color, basin, deepMix);
    float broadIllumination = noise21(vec2(vUv.x * 3.8 + t * 0.018, depth * 4.6 - t * 0.014));
    color += mix(vec3(0.06, 0.08, 0.10), vec3(0.018, 0.045, 0.09), deepMix)
      * (broadIllumination - 0.48);

    // Perspective floor projection: near cells grow toward the viewer, while
    // two moving folds create focused, non-sliding caustic illumination.
    float perspective = 0.34 + depth * 1.9;
    vec2 floorPoint = vec2(centered.x / perspective, 1.0 / perspective) * vec2(39.0, 24.0);
    float fineCaustic = causticNetwork(floorPoint, t * 0.78);
    float broadCaustic = causticNetwork(floorPoint * 0.53 + 5.1, -t * 0.51);
    float focusVariation = 0.3 + noise21(floorPoint * 0.14 + t * vec2(0.026, -0.019)) * 0.7;
    float caustic = (fineCaustic * 0.66 + broadCaustic * 0.52) * focusVariation;
    float shallowFloor = smoothstep(0.08, 0.94, depth);
    float deepFloor = smoothstep(0.58, 1.0, depth);
    float floorMask = mix(shallowFloor, deepFloor, deepMix);
    float basinFocus = exp(-pow((vUv.x - 0.52) * 2.15, 2.0) - pow((depth - 0.82) * 3.8, 2.0));
    floorMask *= mix(1.0, 0.18 + basinFocus * 1.18, deepMix);
    color += mix(vec3(0.70, 0.86, 1.0), vec3(0.24, 0.58, 1.0), deepMix)
      * (sqrt(max(caustic, 0.0)) * 0.42 + caustic * 0.58) * floorMask * mix(0.92, 0.78, deepMix);
    color *= 1.0 - (1.0 - caustic) * floorMask * mix(0.29, 0.34, deepMix);

    // Volumetric shafts widen with depth and attenuate through the column.
    float shaft = 0.0;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float origin = 0.18 + fi * 0.22 + sin(t * (0.11 + fi * 0.013) + fi * 2.1) * 0.035;
      float center = origin + (depth - 0.2) * (0.055 + fi * 0.012)
        + sin(depth * (4.2 + fi * 0.45) + t * 0.12 + fi) * 0.018;
      float width = 0.009 + depth * (0.018 + fi * 0.0035);
      shaft += pow(max(0.0, 1.0 - abs(vUv.x - center) / width), 2.4)
        * exp(-depth * mix(2.2, 0.72, deepMix));
    }
    float volumeNoise = noise21(vec2(vUv.x * 7.0 + t * 0.035, depth * 9.0 - t * 0.028));
    color += mix(vec3(0.74, 0.88, 1.0), vec3(0.24, 0.58, 0.92), deepMix)
      * shaft * (0.05 + volumeNoise * 0.045) * mix(0.42, 0.62, deepMix);

    // Silvery underside of the free surface, with genuine perspective waves.
    float surfaceWave = sin(centered.x * 22.0 + normalField.x * 1.7 - t * 0.55)
      + sin(centered.x * 41.0 - normalField.y * 1.3 + t * 0.39) * 0.45;
    float displacedHorizon = surfaceHorizon + surfaceWave * mix(0.008, 0.004, deepMix);
    float surfaceMask = smoothstep(displacedHorizon - 0.045, displacedHorizon + 0.018, vUv.y);
    float grazing = pow(clamp(0.48 + normalField.x * 0.22 + normalField.y * 0.18, 0.0, 1.0), 5.0);
    vec2 surfacePoint = vec2(centered.x * 19.0, centered.y * 58.0)
      + normalField * vec2(0.72, 0.38);
    float crossingWaves = sin(surfacePoint.x * 0.46 + sin(surfacePoint.y * 0.17 - t * 0.18) * 1.8)
      + cos(surfacePoint.y * 0.31 - t * 0.24 + sin(surfacePoint.x * 0.15) * 1.35) * 0.68;
    float surfaceGlint = pow(1.0 - smoothstep(0.04, 0.72, abs(crossingWaves)), 2.8);
    surfaceGlint *= 0.34 + 0.66 * noise21(surfacePoint * 0.11 - t * 0.02);
    vec3 surfaceColor = mix(
      mix(vec3(0.38, 0.59, 0.79), vec3(0.025, 0.16, 0.38), deepMix),
      vec3(0.96, 0.99, 1.0),
      clamp(grazing + surfaceGlint * 0.72, 0.0, 1.0)
    );
    color = mix(color, surfaceColor, surfaceMask * mix(0.88, 0.68, deepMix));
    color += vec3(0.88, 0.96, 1.0) * surfaceGlint * surfaceMask * 0.28;

    // Beer-Lambert-style blue absorption and fine particulate depth cue.
    color *= exp(-vec3(0.04, 0.018, 0.006) * depth * mix(0.8, 4.8, deepMix));
    float particulate = noise21(vUv * vec2(420.0, 240.0) + t * vec2(0.7, -0.45));
    color += vec3(0.62, 0.82, 1.0) * smoothstep(0.992, 1.0, particulate)
      * depth * mix(0.014, 0.038, deepMix);

    // The authored master is a radiance field, not a page background. Two
    // independently warped reads keep its reflection hierarchy while the live
    // wave field owns motion, refraction, depth, and interaction response.
    vec2 masterDriftA = normalField * mix(0.023, 0.013, deepMix)
      + vec2(sin(t * 0.31), cos(t * 0.27)) * mix(0.0085, 0.005, deepMix);
    vec2 masterDriftB = waveNormal(centered.yx * vec2(3.4, 2.1) + 4.7, -t * 0.73)
      * mix(0.016, 0.009, deepMix)
      + vec2(cos(t * 0.23), -sin(t * 0.29)) * mix(0.006, 0.0035, deepMix);
    vec3 masterA = sampleOpticalDetail(vUv + masterDriftA);
    vec3 masterB = sampleOpticalDetail(vUv + masterDriftB);
    float masterBlend = 0.5 + 0.5 * sin(t * 0.41 + normalField.x * 0.72);
    vec3 opticalMaster = mix(masterA, masterB, masterBlend);
    float opticalLuma = dot(opticalMaster, vec3(0.2126, 0.7152, 0.0722));
    float livingFocus = mix(1.02, 0.94, deepMix)
      + caustic * floorMask * mix(0.34, 0.42, deepMix)
      + surfaceGlint * surfaceMask * 0.24;
    opticalMaster *= livingFocus;
    opticalMaster += mix(vec3(0.018, 0.035, 0.065), vec3(0.0, 0.012, 0.045), deepMix)
      * (opticalLuma - 0.48);
    float masterWeight = mix(0.93, 0.94, deepMix);
    color = mix(color, opticalMaster, masterWeight);

    // A restrained high-pass recovery restores subpixel caustic filaments after
    // the warped radiance blend. It never supplies motion on its own.
    vec2 opticalFlow = normalField * 0.0035 + vec2(sin(t * 0.17), cos(t * 0.13)) * 0.0012;
    vec2 opticalTexel = mix(vec2(1.0 / 1672.0, 1.0 / 941.0), vec2(1.0 / 390.0, 1.0 / 844.0), uPortrait) * 6.0;
    vec2 detailUv = vUv + opticalFlow;
    vec3 opticalCenter = sampleOpticalDetail(detailUv);
    vec3 opticalLow = (
      sampleOpticalDetail(detailUv + vec2(opticalTexel.x, 0.0))
      + sampleOpticalDetail(detailUv - vec2(opticalTexel.x, 0.0))
      + sampleOpticalDetail(detailUv + vec2(0.0, opticalTexel.y))
      + sampleOpticalDetail(detailUv - vec2(0.0, opticalTexel.y))
    ) * 0.25;
    vec3 opticalHigh = opticalCenter - opticalLow;
    float opticalLuminance = dot(opticalHigh, vec3(0.2126, 0.7152, 0.0722));
    float detailFocus = mix(1.0, 0.12 + basinFocus * 1.45, deepMix);
    float brightDetail = clamp(opticalLuminance * mix(0.62, 0.9, deepMix), 0.0, 0.045) * detailFocus;
    float darkDetail = clamp(-opticalLuminance * 0.34, 0.0, 0.018);
    color += mix(vec3(0.66, 0.84, 1.0), vec3(0.18, 0.52, 1.0), deepMix) * brightDetail;
    color *= 1.0 - darkDetail;
    color += opticalHigh * mix(0.012, 0.009, deepMix);
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
      sin(vWorldPosition.z * 8.5 + sin(vWorldPosition.x * 3.2) + uTime * 0.10),
      sin(vWorldPosition.x * 7.2 - sin(vWorldPosition.z * 2.8) - uTime * 0.08)
    ) * (0.0034 + opticalThickness * 0.0028);
    vec2 refractionDirection = normalize(vViewNormal.xy + vec2(0.0001));
    vec2 refractedUv = clamp(
      vScreenUv + vViewNormal.xy * eta * opticalThickness * 0.34 + internalWarp,
      vec2(0.002), vec2(0.998)
    );
    float samplingRadius = 0.00018 + internalRough * 0.0032 + shoulder * 0.00075;
    vec3 environment = sampleEnvironment(refractedUv, refractionDirection, samplingRadius);
    /* A small wavelength split gives the thick crystal its prismatic contour
       without blurring away the water visible through the broad front faces. */
    vec2 dispersion = refractionDirection * (0.00045 + opticalThickness * 0.0012);
    environment.r = texture2D(uEnvironment, clamp(refractedUv + dispersion, 0.002, 0.998)).r;
    environment.b = texture2D(uEnvironment, clamp(refractedUv - dispersion, 0.002, 0.998)).b;
    vec3 directEnvironment = texture2D(uEnvironment, vScreenUv).rgb;
    /* Screen-space optical boundary: the rounded mesh supplies the broad
       convex shoulder; this depth ring preserves a crisp nested glass edge at
       any responsive scale, including counters and narrow mobile strokes. */
    vec2 wideStep = vec2(0.0042, 0.0064);
    vec2 tightStep = wideStep * 0.46;
    float wideBoundary = 0.0;
    wideBoundary = max(wideBoundary, step(0.985, texture2D(uFrontDepth, vScreenUv + vec2(wideStep.x, 0.0)).r));
    wideBoundary = max(wideBoundary, step(0.985, texture2D(uFrontDepth, vScreenUv - vec2(wideStep.x, 0.0)).r));
    wideBoundary = max(wideBoundary, step(0.985, texture2D(uFrontDepth, vScreenUv + vec2(0.0, wideStep.y)).r));
    wideBoundary = max(wideBoundary, step(0.985, texture2D(uFrontDepth, vScreenUv - vec2(0.0, wideStep.y)).r));
    float tightBoundary = 0.0;
    tightBoundary = max(tightBoundary, step(0.985, texture2D(uFrontDepth, vScreenUv + vec2(tightStep.x, 0.0)).r));
    tightBoundary = max(tightBoundary, step(0.985, texture2D(uFrontDepth, vScreenUv - vec2(tightStep.x, 0.0)).r));
    tightBoundary = max(tightBoundary, step(0.985, texture2D(uFrontDepth, vScreenUv + vec2(0.0, tightStep.y)).r));
    tightBoundary = max(tightBoundary, step(0.985, texture2D(uFrontDepth, vScreenUv - vec2(0.0, tightStep.y)).r));
    float brightBoundary = max(wideBoundary - tightBoundary, 0.0);

    /* pale-cerulean attenuation through the letterform depth */
    vec3 safeAttenuation = max(uAttenuationColor, vec3(0.05));
    vec3 absorption = -log(safeAttenuation) / max(uAbsorptionDistance, 0.01);
    vec3 transmittance = exp(-absorption * opticalThickness * (0.12 + shoulder * 0.48));
    /* Broad faces transmit the live scene almost unchanged. Convex shoulders
       carry the bend, attenuation and internal reflection. */
    vec3 body = mix(directEnvironment, environment, 0.82) * transmittance
      + uAttenuationColor * (1.0 - transmittance) * 0.018;
    body += (environment - directEnvironment) * (0.22 + shoulder * 0.72);
    float innerFoldA = pow(0.5 + 0.5 * sin(
      vWorldPosition.x * 8.6 + sin(vWorldPosition.z * 6.2) * 1.5 - uTime * 0.11
    ), 10.0);
    float innerFoldB = pow(0.5 + 0.5 * sin(
      vWorldPosition.z * 10.4 - sin(vWorldPosition.x * 5.3) * 1.25 + uTime * 0.09
    ), 12.0);
    float internalFire = max(innerFoldA, innerFoldB) * (0.24 + opticalThickness * 1.6);
    body += vec3(0.34, 0.68, 1.0) * internalFire * 0.045;
    body += vec3(0.90, 0.98, 1.0) * innerFoldA * innerFoldB * 0.09;
    /* Clear faces; dense blue internal reflection on the convex shoulder. */
    body *= mix(1.0, 0.72, shoulder * shoulder);
    /* embedded micro-bubbles catch a faint internal sparkle */
    body += vec3(0.86, 0.95, 0.99) * bubbleMask * transmittance * 0.055;

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
    float grazing = smoothstep(0.018, 0.56, shoulder);
    vec2 reflectedUv = clamp(vScreenUv - vViewNormal.xy * (0.016 + opticalThickness * 0.03), 0.002, 0.998);
    vec3 reflectedEnvironment = texture2D(uEnvironment, reflectedUv).rgb;
    vec3 edgeWater = mix(
      reflectedEnvironment * vec3(0.38, 0.62, 0.96),
      vec3(0.006, 0.055, 0.25),
      0.70 + shoulder * 0.12
    );
    body = mix(body, edgeWater, grazing * 0.93);
    body = mix(body, vec3(0.006, 0.045, 0.23), tightBoundary * 0.78);

    /* caustic fire concentrating through the letterforms */
    float causticFold = pow(0.5 + 0.5 * sin(vWorldPosition.x * 4.2 + vWorldPosition.z * 5.4 - uTime * 0.16), 7.0)
      * (0.3 + shoulder * 0.7);

    float glassRim = smoothstep(0.055, 0.76, shoulder);
    float convexBand = smoothstep(0.035, 0.24, shoulder)
      * (1.0 - smoothstep(0.62, 0.96, shoulder));
    float edgeSpark = pow(0.5 + 0.5 * sin(
      vWorldPosition.x * 11.0 - vWorldPosition.y * 7.0 + vWorldPosition.z * 9.0
    ), 12.0) * smoothstep(0.12, 0.9, shoulder);
    vec3 reflected = vec3(0.20, 0.54, 1.0) * fresnel * 1.55;
    reflected += vec3(0.92, 0.985, 1.0) * glassRim * (0.075 + keySpec * 0.44);
    reflected += vec3(0.74, 0.91, 1.0) * convexBand * 0.15;
    reflected += vec3(0.96, 0.995, 1.0) * edgeSpark * 0.27;
    reflected += vec3(0.92, 0.985, 1.0) * brightBoundary * 0.31;
    reflected += uKeyColor * keySpec * uKeyIntensity * 0.068;
    reflected += uFillColor * fillSpec * uFillIntensity * 0.034;
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
  uniform float uTheme;
  uniform vec2 uPointer;
  uniform vec2 uPointerVelocity;
  uniform float uPointerEnergy;
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
      sin(vUv.y * 8.2 + uTime * 0.42) + sin(vUv.x * 3.7 - uTime * 0.21) * 0.45,
      cos(vUv.x * 7.8 - uTime * 0.36) + cos(vUv.y * 4.9 + uTime * 0.18) * 0.42
    ) * 0.0072 * (0.45 + upperIdentity * 0.55);
    vec2 idleDelta = (vUv - vec2(0.18, 0.12)) * vec2(1.72, 1.0);
    float idleRadius = length(idleDelta);
    float idleRipple = sin(idleRadius * 58.0 - uTime * 1.55)
      * exp(-idleRadius * 7.5) * 0.0042;
    slowSwell += normalize(idleDelta + vec2(0.0001)) * idleRipple;
    vec2 pointerDelta = (vUv - uPointer) * vec2(1.72, 1.0);
    float pointerFocus = exp(-dot(pointerDelta, pointerDelta) * 34.0) * uPointerEnergy;
    float pointerSpeed = min(length(uPointerVelocity), 1.0);
    vec2 travelDirection = normalize(uPointerVelocity + vec2(0.00001));
    float behindPointer = max(0.0, -dot(pointerDelta, travelDirection));
    float acrossPointer = abs(pointerDelta.x * travelDirection.y - pointerDelta.y * travelDirection.x);
    float pointerWake = exp(-acrossPointer * acrossPointer * 46.0)
      * exp(-behindPointer * 5.8)
      * step(dot(pointerDelta, travelDirection), 0.04)
      * pointerSpeed * uPointerEnergy;
    vec2 pointerNormal = normalize(pointerDelta + vec2(0.00001)) * pointerFocus * 0.0175;
    pointerNormal += vec2(-travelDirection.y, travelDirection.x)
      * sin(behindPointer * 62.0 - uTime * 4.4) * pointerWake * 0.0115;
    vec2 surfaceVector = slope * regionalStrength + slowSwell + pointerNormal;
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
    float wakeRidge = 0.5 + 0.5 * sin(behindPointer * 62.0 - uTime * 4.4);
    scene += vec3(0.72, 0.88, 1.0) * pointerFocus * (0.18 + glyphThickness * 0.08);
    scene += vec3(0.70, 0.88, 1.0) * pointerWake * wakeRidge * 0.15;
    scene *= 1.0 - pointerWake * (1.0 - wakeRidge) * 0.045;
    float simulatedWake = smoothstep(0.0015, 0.018, length(slope))
      * smoothstep(0.0008, 0.012, abs(h));
    scene += vec3(0.70, 0.87, 0.98) * simulatedWake * 0.055;

    /* Section-aware absorption: pearl shallows stay luminous; the basin keeps
       its dark blue distance instead of being mixed back toward pale gray. */
    float finalDeepMix = smoothstep(0.46, 0.94, uTheme);
    vec3 waterAbsorption = mix(
      vec3(0.035, 0.018, 0.008),
      vec3(0.19, 0.075, 0.018),
      finalDeepMix
    ) * depthTravel * uDepthAttenuation;
    scene *= exp(-waterAbsorption);
    vec3 distanceFog = mix(vec3(0.72, 0.86, 0.92), vec3(0.018, 0.12, 0.25), finalDeepMix);
    scene = mix(
      scene,
      distanceFog,
      depthTravel * uDepthAttenuation * mix(0.16, 0.075, finalDeepMix)
    );

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
