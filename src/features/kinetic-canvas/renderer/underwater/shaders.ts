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
  // direction.xy = unit travel; z = wake OR ring radius; w = eccentricity
  // (0..1 anisotropic) or < -0.5 for annular ring mode (z = ring radius).
  uniform vec4 uDirections[8];
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
    // Liquid propagation: wakes travel, then settle — not membrane stretch.
    velocity += laplacian * 30.0 * uDt;
    velocity -= height * 3.6 * uDt;
    velocity *= exp(-1.95 * uDt);
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
      vec2 fromEnd = (vUv - splat.xy) * vec2(uAspect, 1.0);
      float eccentricity = direction.w;

      if (eccentricity < -0.5) {
        // Soft annular plunk — thicker crest so clicks read as water, not plastic.
        float radial = length(fromEnd);
        float ringRadius = max(direction.z, 0.0);
        float thickness = max(splat.z * 1.35, 0.004);
        float ring = exp(-pow((radial - ringRadius) / thickness, 2.0));
        velocity += ring * splat.w * uDt * 18.0;
        continue;
      }

      float distanceToWake = segmentDistance(vUv, segment.xy, segment.zw);
      vec2 directionUv = normalize(direction.xy * vec2(uAspect, 1.0) + vec2(0.00001));
      float along = dot(fromEnd, directionUv);
      float across = dot(fromEnd, vec2(-directionUv.y, directionUv.x));
      // Soft liquid pressure: round dimple when slow, mild elongation when fast.
      float ecc = clamp(eccentricity, 0.0, 1.0) * 0.7;
      float major = max(splat.z * (1.0 + ecc * 1.6), 0.0025);
      float minor = max(splat.z * (1.0 - ecc * 0.35), 0.002);
      float anisotropic = exp(-(along * along) / (major * major) - (across * across) / (minor * minor));
      float bow = exp(-pow(max(along, 0.0) / max(splat.z * 0.75, 0.001), 2.0))
        * exp(-pow(across / max(minor * 0.85, 0.001), 2.0))
        * ecc;
      float wake = exp(-pow(distanceToWake / max(splat.z * 1.08, 0.0025), 2.0));
      float pressure = anisotropic;
      velocity += (
        pressure * splat.w
        + bow * abs(splat.w) * 0.42
        + wake * direction.z * (0.38 - along * 1.15)
      ) * uDt * 14.0;
    }
    height = clamp(height + velocity * uDt, -0.22, 0.22);
    // Clear residual scars without killing live motion.
    height *= exp(-1.35 * uDt);
    gl_FragColor = vec4(height, velocity, 0.0, 1.0);
  }
`;

export const BACKDROP_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vWorld = vec3(position.xy, 0.0);
    // Same NDC convention as FULLSCREEN_VERTEX — paired with the ortho camera.
    gl_Position = vec4(position.xy, 0.0, 1.0);
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
  uniform float uCalm;
  uniform float uPlate;
  uniform float uQualityTier;
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

  /* The authored plates form one continuous radiance family. uPlate is a
     continuous 0=shallow → 1=mid → 2=basin coordinate so a scroll-driven
     descent crossfades between plates instead of popping at thresholds.
     Texture reads double only inside the narrow transition windows. */
  vec3 shallowOptical(vec2 screenUv) {
    if (uPortrait > 0.5) {
      return texture2D(uOpticalShallowPortrait, clamp(coverUv(screenUv, 390.0 / 844.0), 0.003, 0.997)).rgb;
    }
    return texture2D(uOpticalShallowLandscape, clamp(coverUv(screenUv, 1672.0 / 941.0), 0.003, 0.997)).rgb;
  }

  vec3 midOptical(vec2 screenUv) {
    return texture2D(uOpticalMidDepth, clamp(coverUv(screenUv, 1672.0 / 941.0), 0.003, 0.997)).rgb;
  }

  vec3 deepOptical(vec2 screenUv) {
    return texture2D(uOpticalDeepBasin, clamp(coverUv(screenUv, 1672.0 / 941.0), 0.003, 0.997)).rgb;
  }

  vec3 sampleOpticalDetail(vec2 screenUv) {
    float plate = clamp(uPlate, 0.0, 2.0);
    if (plate < 0.5) {
      vec3 shallow = shallowOptical(screenUv);
      if (plate <= 0.001) return shallow;
      return mix(shallow, midOptical(screenUv), plate * 2.0);
    }
    if (plate < 1.5) {
      vec3 mid = midOptical(screenUv);
      if (plate <= 1.001) return mid;
      return mix(mid, deepOptical(screenUv), (plate - 1.0) * 2.0);
    }
    return deepOptical(screenUv);
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

  /* Two allocation-free particle fields occupy the deep water. Grid cells
     provide stable identities, while the small lateral drift and twinkle keep
     the field from reading as a repeated texture or a JS particle system. */
  float marineSnowLayer(vec2 uv, float scale, float speed, float seed) {
    vec2 drifted = uv;
    drifted.x += sin((uv.y + seed) * 7.0 + uTime * 0.13) * 0.018;
    drifted.y += uTime * speed * uMotion;
    vec2 grid = drifted * vec2(scale, scale * 0.72);
    vec2 cell = floor(grid);
    vec2 local = fract(grid) - 0.5;
    vec2 jitter = hash22(cell + vec2(seed)) * 0.64 - 0.32;
    float distanceToFlake = length((local - jitter) * vec2(1.0, 1.24));
    float flake = 1.0 - smoothstep(0.0, 0.078, distanceToFlake);
    float twinkle = 0.5 + 0.5 * sin(uTime * (0.28 + seed * 0.04) + hash21(cell + vec2(seed)) * 6.283);
    return flake * mix(0.42, 1.0, twinkle);
  }

  void main() {
    if (uDebugUv > 0.5) { gl_FragColor = vec4(vUv, 0.0, 1.0); return; }
    float t = uTime * uMotion;
    float deepMix = smoothstep(0.46, 0.94, uTheme);
    float midMix = smoothstep(0.08, 0.62, uTheme) * (1.0 - deepMix);
    float surfaceHorizon = mix(0.79, 0.92, deepMix) + uPortrait * 0.025;
    float depth = clamp((surfaceHorizon - vUv.y) / max(surfaceHorizon, 0.001), 0.0, 1.0);
    vec2 centered = vec2((vUv.x - 0.5) * uAspect, vUv.y - surfaceHorizon);
    // The About pocket is a quieter region of the same water: the ambient
    // wave field softens locally instead of the theme changing.
    float waveEnergy = mix(1.0, 0.42, uCalm);
    vec2 normalField = waveNormal(centered * vec2(2.6, 3.8), t) * waveEnergy;

    vec3 shallowTop = vec3(0.69, 0.82, 0.94);
    vec3 shallowBottom = vec3(0.31, 0.48, 0.67);
    vec3 midTop = vec3(0.56, 0.75, 0.88);
    vec3 midBottom = vec3(0.14, 0.35, 0.56);
    vec3 deepTop = vec3(0.010, 0.086, 0.238);
    vec3 deepBottom = vec3(0.0005, 0.005, 0.024);
    vec3 shallow = mix(shallowTop, shallowBottom, pow(depth, 0.78));
    vec3 middle = mix(midTop, midBottom, pow(depth, 0.72));
    vec3 basin = mix(deepTop, deepBottom, pow(depth, 0.62));
    vec3 color = mix(shallow, middle, midMix);
    color = mix(color, basin, deepMix);
    float broadIllumination = noise21(vec2(vUv.x * 3.8 + t * 0.018, depth * 4.6 - t * 0.014));
    color += mix(vec3(0.06, 0.08, 0.10), vec3(0.018, 0.045, 0.09), deepMix)
      * (broadIllumination - 0.48);

    // A soft contrast pocket keeps the crystal title legible in the
    // bright surface -  a few percent luminance drop, not a vignette plate.
    float titleContrastPocket = exp(
      -pow((vUv.x - 0.5) * 2.05, 2.0)
      -pow((vUv.y - 0.48) * 2.55, 2.0)
    );
    color *= 1.0 - titleContrastPocket * (1.0 - deepMix) * 0.16;

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
    /* The light pools where the glass slab rests on the floor. */
    float basinFocus = exp(-pow((vUv.x - 0.36) * 2.05, 2.0) - pow((depth - 0.80) * 3.6, 2.0));
    floorMask *= mix(1.0, 0.18 + basinFocus * 1.55, deepMix);
    color += mix(vec3(0.70, 0.86, 1.0), vec3(0.24, 0.58, 1.0), deepMix)
      * (sqrt(max(caustic, 0.0)) * 0.42 + caustic * 0.58) * floorMask * mix(0.92, 0.78, deepMix);
    color *= 1.0 - (1.0 - caustic) * floorMask * mix(0.29, 0.34, deepMix);

    // Volumetric god rays — quality-gated soft shafts.
    // high: 4 shafts · balanced: 2 · low: one cheap shaft · static freeze still paints one.
    // About calm pocket softens and brightens mid-depth shafts (reading light).
    float shaftCount = mix(1.0, mix(2.0, 4.0, step(1.5, uQualityTier)), step(1.0, uQualityTier));
    float shaftStrength = mix(0.42, 1.0, step(1.0, uQualityTier));
    float shaft = 0.0;
    for (int i = 0; i < 4; i++) {
      if (float(i) >= shaftCount) break;
      float fi = float(i);
      float origin = 0.18 + fi * 0.22 + sin(t * (0.11 + fi * 0.013) + fi * 2.1) * 0.035;
      float center = origin + (depth - 0.2) * (0.055 + fi * 0.012)
        + sin(depth * (4.2 + fi * 0.45) + t * 0.12 + fi) * 0.018;
      float width = mix(0.014 + depth * (0.022 + fi * 0.004), 0.006 + depth * 0.01, deepMix);
      // Calm pocket: wider, softer shafts — quiet reading light, never a fog bar.
      width = mix(width, width * (1.45 + uCalm * 0.4), uCalm * (1.0 - deepMix * 0.7));
      shaft += pow(max(0.0, 1.0 - abs(vUv.x - center) / max(width, 0.001)), mix(2.4, 2.9, deepMix))
        * exp(-depth * mix(2.2, 0.85, deepMix)) * mix(1.0, 0.55, deepMix);
    }
    float volumeNoise = noise21(vec2(vUv.x * 7.0 + t * 0.035, depth * 9.0 - t * 0.028));
    // Calm mid-column (About): soften shaft presence instead of lifting it into a wash.
    float calmRayBoost = mix(1.0, 0.72, uCalm * (1.0 - deepMix * 0.45));
    float midCalmShaft = uCalm * (1.0 - deepMix) * 0.35;
    color += mix(vec3(0.74, 0.88, 1.0), vec3(0.3, 0.62, 0.98), deepMix)
      * shaft * (0.045 + volumeNoise * 0.04)
      * (mix(0.48, 1.15, deepMix) + midCalmShaft)
      * shaftStrength * calmRayBoost;

    // Marine snow / particulate — deeper column only.
    // balanced: far layer · high: far + near · low/static: skip (budget).
    float snowDepth = smoothstep(0.34, 0.92, uTheme) * (0.18 + depth * 0.82);
    float snowTier = step(1.0, uQualityTier); // balanced+
    float farSnow = marineSnowLayer(vUv * vec2(1.0, 1.18), 52.0, 0.020, 1.7);
    float nearSnow = marineSnowLayer(vUv * vec2(1.0, 1.12), 92.0, 0.034, 4.3);
    float snow = (farSnow * 0.34 + nearSnow * 0.22 * step(1.5, uQualityTier)) * snowTier;
    // Abyss arrival (≥ ~0.74): denser marine snow toward the floor.
    float abyssMix = smoothstep(0.70, 0.92, uTheme);
    snow *= 1.0 + abyssMix * 0.55;
    color += mix(vec3(0.62, 0.79, 0.98), vec3(0.78, 0.90, 1.0), deepMix)
      * snow * snowDepth * 0.24;

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

    // Bioluminescent abyss accents — restrained electric-blue particulate + rim
    // once world depth crosses contact approach (~0.74). Never cyberpunk neon.
    float biolum = abyssMix * step(1.0, uQualityTier);
    float bioSpark = smoothstep(0.986, 1.0, noise21(vUv * vec2(310.0, 190.0) + t * vec2(0.22, -0.31)));
    float bioRim = pow(max(0.0, 1.0 - abs(vUv.x - 0.5) * 1.45), 2.6)
      * smoothstep(0.12, 0.72, depth) * (0.55 + 0.45 * volumeNoise);
    color += vec3(0.14, 0.48, 0.96) * bioSpark * biolum * (0.045 + depth * 0.07);
    color += vec3(0.1, 0.34, 0.78) * bioRim * biolum * 0.06;
    color += vec3(0.18, 0.58, 1.0) * snow * abyssMix * snowTier * 0.1;

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
    // The basin reads as deep navy, not slate: pull the authored plate down
    // into blue darkness as the floor approaches.
    color *= mix(vec3(1.0), vec3(0.40, 0.56, 0.92), deepMix * 0.58);

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
  /* 0 = fully present glass, 1 = dissolved into the water behind. Drives the
     hero→projects descent: the name rises, thins, and becomes water again. */
  uniform float uExitFade;
  /* 0..1 interaction energy on the active letter (hover/hold/release). */
  uniform float uLetterEnergy;

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

  /* Deterministic procedural noise for internal glyph volume effects.
     All functions are pure and stable under GPU precision. */
  float hash21g(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }
  float hash31g(vec3 p) {
    p = fract(p * vec3(234.34, 435.345, 312.67));
    p += dot(p, p.yzx + 34.23);
    return fract((p.x + p.y) * p.z);
  }
  float vnoiseg(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21g(i), hash21g(i + vec2(1, 0)), u.x),
               mix(hash21g(i + vec2(0, 1)), hash21g(i + vec2(1, 1)), u.x), u.y);
  }
  float vnoise3(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash31g(i), hash31g(i + vec3(1,0,0)), u.x),
          mix(hash31g(i + vec3(0,1,0)), hash31g(i + vec3(1,1,0)), u.x), u.y),
      mix(mix(hash31g(i + vec3(0,0,1)), hash31g(i + vec3(1,0,1)), u.x),
          mix(hash31g(i + vec3(0,1,1)), hash31g(i + vec3(1,1,1)), u.x), u.y),
      u.z);
  }

  void main() {
    float frontDepth = linearViewDepth(texture2D(uFrontDepth, vScreenUv).r);
    float backDepth = linearViewDepth(texture2D(uBackDepth, vScreenUv).r);
    float geometricThickness = clamp(backDepth - frontDepth, 0.008, 0.60);
    float shoulder = 1.0 - abs(vViewNormal.z);
    float opticalThickness = geometricThickness * (1.0 + shoulder * 1.65) + shoulder * 0.05;
    float eta = (uIor - 1.0) / uIor;

    /* --- 1. Restrained internal micro-bubble field (Canvas UI glass) --- */
    float microBubble = vnoiseg(vWorldPosition.xz * 38.0 + vWorldPosition.yy * 24.0);
    float microBubbleMask = smoothstep(0.84, 0.98, microBubble);
    float internalRough = uRoughness + microBubbleMask * 0.035;

    /* --- 2. Sparse larger bubbles with dark center and bright rim --- */
    float largeBubbleField = vnoise3(vWorldPosition * 14.0 + vec3(uTime * 0.02, 0.0, -uTime * 0.015));
    float largeBubbleMask = smoothstep(0.91, 0.97, largeBubbleField);
    /* The bright edge simulates a convex meniscus catching light. */
    float largeBubbleRim = smoothstep(0.88, 0.91, largeBubbleField) * (1.0 - largeBubbleMask);
    /* Gate both bubble types by optical thickness so they occupy the volume. */
    float volumeGate = smoothstep(0.05, 0.20, opticalThickness);

    /* --- 3. Elongated anisotropic internal streaks --- */
    /* Two crossing sets of stretched folds create visible refraction lanes
       inside the thick glass without producing uniform noise. */
    float streakA = pow(0.5 + 0.5 * sin(
      vWorldPosition.x * 6.8 + vWorldPosition.z * 2.1
      + sin(vWorldPosition.y * 4.5) * 1.8 - uTime * 0.07
    ), 14.0);
    float streakB = pow(0.5 + 0.5 * sin(
      vWorldPosition.z * 7.4 - vWorldPosition.x * 1.6
      + sin(vWorldPosition.y * 3.8) * 1.5 + uTime * 0.055
    ), 16.0);
    float streakField = max(streakA, streakB) * volumeGate;

    vec2 internalWarp = vec2(
      sin(vWorldPosition.z * 8.5 + sin(vWorldPosition.x * 3.2) + uTime * 0.10),
      sin(vWorldPosition.x * 7.2 - sin(vWorldPosition.z * 2.8) - uTime * 0.08)
    ) * (0.0018 + opticalThickness * 0.0016);
    vec2 refractionDirection = normalize(vViewNormal.xy + vec2(0.0001));
    vec2 refractedUv = clamp(
      vScreenUv + vViewNormal.xy * eta * opticalThickness * 0.28 + internalWarp,
      vec2(0.002), vec2(0.998)
    );
    float samplingRadius = 0.00008 + internalRough * 0.0012 + shoulder * 0.00032;
    vec3 environment = sampleEnvironment(refractedUv, refractionDirection, samplingRadius);

    /* --- 4. Thin spectral edge split (grazing only) --- */
    float dispersionScale = (0.00035 + opticalThickness * 0.0009 + shoulder * 0.0012)
      * smoothstep(0.22, 0.78, shoulder);
    vec2 dispersion = refractionDirection * dispersionScale;
    environment.r = texture2D(uEnvironment, clamp(refractedUv + dispersion, 0.002, 0.998)).r;
    environment.b = texture2D(uEnvironment, clamp(refractedUv - dispersion, 0.002, 0.998)).b;
    vec3 directEnvironment = texture2D(uEnvironment, vScreenUv).rgb;

    /* Screen-space optical boundary ring - soft falloff avoids stair-stepped silhouettes. */
    vec2 wideStep = vec2(0.0034, 0.0052);
    vec2 tightStep = wideStep * 0.48;
    float wideBoundary = 0.0;
    wideBoundary = max(wideBoundary, smoothstep(0.992, 0.9995, texture2D(uFrontDepth, vScreenUv + vec2(wideStep.x, 0.0)).r));
    wideBoundary = max(wideBoundary, smoothstep(0.992, 0.9995, texture2D(uFrontDepth, vScreenUv - vec2(wideStep.x, 0.0)).r));
    wideBoundary = max(wideBoundary, smoothstep(0.992, 0.9995, texture2D(uFrontDepth, vScreenUv + vec2(0.0, wideStep.y)).r));
    wideBoundary = max(wideBoundary, smoothstep(0.992, 0.9995, texture2D(uFrontDepth, vScreenUv - vec2(0.0, wideStep.y)).r));
    float tightBoundary = 0.0;
    tightBoundary = max(tightBoundary, smoothstep(0.992, 0.9995, texture2D(uFrontDepth, vScreenUv + vec2(tightStep.x, 0.0)).r));
    tightBoundary = max(tightBoundary, smoothstep(0.992, 0.9995, texture2D(uFrontDepth, vScreenUv - vec2(tightStep.x, 0.0)).r));
    tightBoundary = max(tightBoundary, smoothstep(0.992, 0.9995, texture2D(uFrontDepth, vScreenUv + vec2(0.0, tightStep.y)).r));
    tightBoundary = max(tightBoundary, smoothstep(0.992, 0.9995, texture2D(uFrontDepth, vScreenUv - vec2(0.0, tightStep.y)).r));
    float brightBoundary = max(wideBoundary - tightBoundary, 0.0);

    /* --- 5. Selective cerulean absorption (shoulders, not milky faces) --- */
    vec3 safeAttenuation = max(uAttenuationColor, vec3(0.05));
    vec3 absorption = -log(safeAttenuation) / max(uAbsorptionDistance, 0.01);
    vec3 transmittance = exp(-absorption * opticalThickness * (0.08 + shoulder * 0.72));

    /* Clean white core on broad faces; cerulean only on convex shoulders. */
    float faceClarity = 1.0 - shoulder * shoulder;
    vec3 body = mix(directEnvironment, environment, 0.72 + faceClarity * 0.18) * transmittance
      + uAttenuationColor * (1.0 - transmittance) * (0.012 + shoulder * 0.028);
    body += (environment - directEnvironment) * (0.14 + shoulder * 0.82);
    body = mix(body, vec3(0.97, 0.99, 1.0), faceClarity * 0.08 * transmittance);

    /* Internal caustic fire -  concentrates under active letters */
    float letterGate = 0.55 + uLetterEnergy * 0.85;
    float innerFoldA = pow(0.5 + 0.5 * sin(
      vWorldPosition.x * 8.6 + sin(vWorldPosition.z * 6.2) * 1.5 - uTime * 0.11
    ), 10.0);
    float innerFoldB = pow(0.5 + 0.5 * sin(
      vWorldPosition.z * 10.4 - sin(vWorldPosition.x * 5.3) * 1.25 + uTime * 0.09
    ), 12.0);
    float internalFire = max(innerFoldA, innerFoldB) * (0.28 + opticalThickness * 2.0) * letterGate;
    body += vec3(0.34, 0.68, 1.0) * internalFire * 0.055;
    body += vec3(0.92, 0.98, 1.0) * innerFoldA * innerFoldB * 0.10 * letterGate;

    /* Anisotropic streaks: elongated refraction lanes inside the volume */
    body += vec3(0.38, 0.72, 1.0) * streakField * 0.055 * opticalThickness;
    body += vec3(0.88, 0.96, 1.0) * streakA * streakB * 0.08 * volumeGate;

    /* Clear faces; dense blue internal reflection on the convex shoulder. */
    body *= mix(1.0, 0.78, shoulder * shoulder);

    /* Embedded micro-bubbles: restrained sparkle */
    body += vec3(0.88, 0.96, 1.0) * microBubbleMask * transmittance * 0.028 * volumeGate;
    /* Larger bubbles: dark center with bright meniscus rim */
    body -= vec3(0.04, 0.06, 0.08) * largeBubbleMask * volumeGate * 0.22;
    body += vec3(0.82, 0.94, 1.0) * largeBubbleRim * volumeGate * 0.055;

    /* --- 6. Fresnel rim boost: near-white edge catch against bright water --- */
    vec3 viewDirection = normalize(uCameraPosition - vWorldPosition);
    float fresnelBase = pow((uIor - 1.0) / (uIor + 1.0), 2.0);
    float fresnel = fresnelBase + (1.0 - fresnelBase)
      * pow(1.0 - clamp(dot(vWorldNormal, viewDirection), 0.0, 1.0), 3.6);
    float rimBoost = pow(1.0 - clamp(dot(vWorldNormal, viewDirection), 0.0, 1.0), 2.4);

    /* --- 7. White key rims: tighter lobes, stronger contribution --- */
    vec3 keyDirection = normalize(uKeyPosition - vWorldPosition);
    vec3 fillDirection = normalize(uFillPosition - vWorldPosition);
    vec3 keyHalf = normalize(keyDirection + viewDirection);
    vec3 fillHalf = normalize(fillDirection + viewDirection);
    /* Primary key specular: sharper grazing lobes for crystalline rims */
    float keySpec = pow(max(dot(vWorldNormal, keyHalf), 0.0), mix(140.0, 320.0, 1.0 - uRoughness));
    /* Secondary sun-glint: narrower lobe for concentrated bright spots */
    float sunGlint = pow(max(dot(vWorldNormal, keyHalf), 0.0), 640.0);
    float fillSpec = pow(max(dot(vWorldNormal, fillHalf), 0.0), 48.0);
    float lowerBounce = max(dot(vWorldNormal, normalize(vec3(0.1, -0.5, 0.3))), 0.0);

    /* Edge/internal reflection: saturated cerulean at grazing angles,
       never muddy or gray. Shortened absorption pushes color inward. */
    float grazing = smoothstep(0.018, 0.52, shoulder);
    vec2 reflectedUv = clamp(vScreenUv - vViewNormal.xy * (0.018 + opticalThickness * 0.035), 0.002, 0.998);
    vec3 reflectedEnvironment = texture2D(uEnvironment, reflectedUv).rgb;
    vec3 edgeWaterCore = vec3(0.16, 0.52, 0.82);
    vec3 edgeWater = mix(
      reflectedEnvironment * vec3(0.38, 0.62, 0.96),
      edgeWaterCore,
      0.42 + shoulder * 0.14
    );
    body = mix(body, edgeWater, grazing * 0.76);
    /* Boundary crease darkening for silhouette separation vs bright water */
    body = mix(body, vec3(0.028, 0.14, 0.32), tightBoundary * 0.28);
    body = mix(body, vec3(0.04, 0.18, 0.38), brightBoundary * 0.1);

    /* Caustic fire concentrating through the letterforms */
    float causticFold = pow(0.5 + 0.5 * sin(vWorldPosition.x * 4.2 + vWorldPosition.z * 5.4 - uTime * 0.16), 7.0)
      * (0.3 + shoulder * 0.7);

    float glassRim = smoothstep(0.045, 0.72, shoulder);
    float convexBand = smoothstep(0.030, 0.22, shoulder)
      * (1.0 - smoothstep(0.58, 0.94, shoulder));
    float edgeSpark = pow(0.5 + 0.5 * sin(
      vWorldPosition.x * 11.0 - vWorldPosition.y * 7.0 + vWorldPosition.z * 9.0
    ), 12.0) * smoothstep(0.12, 0.9, shoulder);

    /* Reflected light: pushed toward nearly white on rims */
    vec3 reflected = vec3(0.34, 0.66, 1.0) * fresnel * 1.68;
    reflected += vec3(0.98, 0.995, 1.0) * rimBoost * 0.22;
    reflected += vec3(0.98, 0.995, 1.0) * glassRim * (0.18 + keySpec * 0.82);
    reflected += vec3(0.97, 0.995, 1.0) * sunGlint * 0.42;
    reflected += vec3(0.76, 0.92, 1.0) * convexBand * 0.16;
    reflected += vec3(0.97, 0.995, 1.0) * edgeSpark * 0.30;
    reflected += vec3(0.96, 0.99, 1.0) * brightBoundary * 0.16;
    reflected += uKeyColor * keySpec * uKeyIntensity * 0.11;
    reflected += uFillColor * fillSpec * uFillIntensity * 0.038;
    reflected += vec3(0.55, 0.70, 0.78) * lowerBounce * 0.05;
    reflected += vec3(0.80, 0.92, 0.96) * causticFold * uCausticStrength * (0.32 + uLetterEnergy * 0.28);
    vec3 glyphColor = max(body + reflected, vec3(0.0));

    /* Descent fade: the letter dissolves into the exact water refracted
       behind it -  an optical exit, never an opacity pop. */
    if (uExitFade > 0.001) {
      vec3 behind = texture2D(uEnvironment, vScreenUv).rgb;
      glyphColor = mix(glyphColor, behind, smoothstep(0.0, 1.0, uExitFade));
    }
    gl_FragColor = vec4(glyphColor, 1.0);
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
  uniform float uCalm;
  /* 1 = letters fully present, 0 = dissolved. Their caustic imprint and
     contact shadow leave with them -  no ghosts beneath the water. */
  uniform float uGlyphPresence;
  uniform vec2 uPointer;
  uniform vec2 uPointerVelocity;
  uniform float uPointerEnergy;
  /* xy = shockwave center (uv), z = age seconds, w = strength (fades in JS). */
  uniform vec4 uShockwave;
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
    /* Reading pockets: lower third of the frame (where index/hero copy sits)
       suppresses broad cloudy refraction while open upper water keeps caustics. */
    float copyBand = 1.0 - smoothstep(0.18, 0.52, vUv.y);
    float copyCalm = mix(1.0, 0.38, copyBand * 0.92);
    float pocketCalm = mix(1.0, 0.48, uCalm);
    float regionalStrength = (0.38 + upperIdentity * 0.78) * copyCalm * pocketCalm;
    vec2 slowSwell = vec2(
      sin(vUv.y * 8.2 + uTime * 0.42) + sin(vUv.x * 3.7 - uTime * 0.21) * 0.45,
      cos(vUv.x * 7.8 - uTime * 0.36) + cos(vUv.y * 4.9 + uTime * 0.18) * 0.42
    ) * 0.0054 * (0.32 + upperIdentity * 0.68) * pocketCalm * mix(1.0, 0.42, copyBand);
    vec2 idleDelta = (vUv - vec2(0.18, 0.12)) * vec2(1.72, 1.0);
    float idleRadius = length(idleDelta);
    float idleRipple = sin(idleRadius * 58.0 - uTime * 1.55)
      * exp(-idleRadius * 7.5) * 0.0042;
    slowSwell += normalize(idleDelta + vec2(0.0001)) * idleRipple;
    /* Soft liquid pressure under the fingertip — broad dimple + current push.
       Heightfield owns lasting wakes; this is the live surface response. */
    vec2 pointerDelta = (vUv - uPointer) * vec2(1.72, 1.0);
    float pointerRadius = length(pointerDelta);
    float softDome = exp(-pointerRadius * pointerRadius * 2.6) * uPointerEnergy;
    vec2 pointerNormal = normalize(pointerDelta + vec2(0.00001)) * softDome * 0.0036;
    // Traveling swell biased along pointer velocity — water being pushed aside.
    vec2 flow = uPointerVelocity;
    float flowLen = length(flow);
    vec2 flowDir = flow / max(flowLen, 0.0001);
    float alongFlow = dot(pointerDelta, flowDir);
    float acrossFlow = dot(pointerDelta, vec2(-flowDir.y, flowDir.x));
    float pushEnvelope = exp(-(alongFlow * alongFlow) * 1.8 - (acrossFlow * acrossFlow) * 4.2)
      * smoothstep(0.02, 0.18, flowLen) * uPointerEnergy;
    vec2 flowNormal = flowDir * pushEnvelope * 0.0042
      + vec2(-flowDir.y, flowDir.x) * acrossFlow * pushEnvelope * 0.0018;

    float energyGate = clamp(uPointerEnergy, 0.0, 1.0);
    float qualityGate = mix(0.35, 1.0, step(1.5, float(uQualityTier)));
    // Soft radial ripple (low frequency = liquid, not plastic wrinkle).
    float waterRipple = 0.0;
    if (energyGate > 0.04 && qualityGate > 0.4) {
      waterRipple = sin(pointerRadius * 22.0 - uTime * 2.8)
        * exp(-pointerRadius * 3.6)
        * energyGate * qualityGate * 0.0020;
    }
    vec2 rippleNormal = normalize(pointerDelta + vec2(0.00001)) * waterRipple;

    vec2 surfaceVector = slope * regionalStrength + slowSwell + pointerNormal + flowNormal + rippleNormal;

    /* Click shockwave — thicker, softer ring so plunks feel wet, not plastic. */
    float shockRing = 0.0;
    float shockFade = 0.0;
    float shockOuter = 0.0;
    float shockGate = mix(0.85, 1.0, step(0.5, float(uQualityTier)));
    if (uShockwave.w > 0.01 && uShockwave.z < 1.25) {
      vec2 shockDelta = (vUv - uShockwave.xy) * vec2(1.72, 1.0);
      float shockRadius = length(shockDelta);
      float waveFront = 0.028 + uShockwave.z * 0.52;
      shockRing = exp(-pow((shockRadius - waveFront) * 16.0, 2.0));
      shockOuter = exp(-pow((shockRadius - waveFront - 0.042) * 14.0, 2.0));
      shockFade = exp(-uShockwave.z * 1.55) * uShockwave.w;
      surfaceVector += normalize(shockDelta + vec2(0.00001)) * shockRing * shockFade * 0.0095 * shockGate;
    }

    /* Protect glyph silhouettes: water still displaces around letters, but the
       multi-tap scene sample must not smear their outlines into ghost trails. */
    float glyphHere = step(frontDepth, 0.9995) * uGlyphPresence;
    /* Soft protect: keep letter faces sharp; let water still bend around edges. */
    float glyphProtect = 1.0 - glyphHere * 0.88;
    vec2 refraction = surfaceVector * uSurfaceDistortion * (0.55 + depthTravel * 0.55) * glyphProtect;
    vec2 refractionDirection = normalize(surfaceVector + vec2(0.00001));
    float sampleRadius = (0.00028 + length(surfaceVector) * 0.12) * glyphProtect;
    vec3 scene = glyphHere > 0.5
      ? texture2D(uScene, clamp(vUv + refraction * 0.18, 0.002, 0.998)).rgb
      : sampleScene(
          clamp(vUv + refraction, 0.002, 0.998),
          refractionDirection,
          sampleRadius
        );

    /* crisp contact shadow anchoring the glyphs to the sand */
    vec2 shadowDirection = vec2(-0.005, 0.0075) * (0.72 + depthTravel * 0.4);
    float projectedShadow = 0.0;
    projectedShadow += step(texture2D(uFrontDepth, clamp(vUv + shadowDirection, 0.002, 0.998)).r, 0.9995);
    projectedShadow += step(texture2D(uFrontDepth, clamp(vUv + shadowDirection * 1.8, 0.002, 0.998)).r, 0.9995);
    projectedShadow += step(texture2D(uFrontDepth, clamp(vUv + shadowDirection * 2.7, 0.002, 0.998)).r, 0.9995);
    projectedShadow = projectedShadow / 3.0 * (1.0 - glyphHere) * uGlyphPresence;
    scene *= 1.0 - projectedShadow * (0.16 + depthTravel * 0.08);

    // The same surface normal that refracts the complete scene drives the
    // restrained caustic modulation. Glyph thickness gates its interior reach.
    // Anti-washout: gate additive lighting by slope magnitude so the water
    // stays structured instead of becoming a white fog under hard wakes.
    float slopeIntensity = length(surfaceVector);
    float washoutGate = 1.0 - smoothstep(0.014, 0.055, slopeIntensity);
    float compression = smoothstep(0.003, 0.028, abs(dot(surfaceVector, normalize(vec2(0.72, 0.38)))));
    float focus = 1.0 - smoothstep(0.008, 0.11, slopeIntensity);
    float caustic = (focus * focus * 0.35 + compression * 0.65) * uCausticStrength
      * (0.20 + depthTravel * 0.34) * (0.45 + upperIdentity * 0.55)
      * washoutGate
      * mix(1.0, 0.55, copyBand);
    scene += vec3(0.72, 0.88, 0.92) * caustic * (1.0 + glyphThickness * 0.85 * uGlyphPresence);
    float simulatedWake = smoothstep(0.002, 0.015, length(slope))
      * smoothstep(0.001, 0.01, abs(h));
    scene += vec3(0.70, 0.87, 0.98) * simulatedWake * 0.035 * washoutGate;
    /* Glints near the live fingertip + soft dome catch-light. */
    float crestSpeed = length(uPointerVelocity);
    float nearPointer = exp(-pointerRadius * pointerRadius * 4.5);
    float fastCrest = smoothstep(0.08, 0.42, crestSpeed) * energyGate * qualityGate * nearPointer;
    scene += vec3(0.92, 0.98, 1.0) * pow(max(0.0, simulatedWake), 2.2) * fastCrest * 0.065;
    scene += vec3(0.86, 0.95, 1.0) * softDome * 0.032;
    /* Soft shockwave caustics — no hard plastic filament. */
    scene += vec3(0.78, 0.94, 1.0) * shockRing * shockFade * 0.48 * shockGate;
    scene += vec3(0.92, 0.98, 1.0) * shockOuter * shockFade * 0.22 * shockGate;
    float shockCrest = pow(shockRing, 1.25) * shockFade * shockGate;
    scene += vec3(0.94, 0.99, 1.0) * shockCrest * 0.12;
    float shockHeightCue = shockRing * shockFade * 0.06 * shockGate;
    scene *= 1.0 - shockHeightCue;
    scene += vec3(0.9, 0.97, 1.0) * shockOuter * shockFade * 0.1;

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

    /* Ocean-floor falloff: the basin darkens toward its edges so the glowing
       glass slab owns the light pool, exactly like the approved endpoint. */
    float basinVignette = smoothstep(0.32, 1.02, length((vUv - vec2(0.5, 0.44)) * vec2(1.18, 0.96)));
    scene *= 1.0 - basinVignette * finalDeepMix * 0.55;

    /* surface sheen + sun glitter near the top of the frame */
    vec3 normal = normalize(vec3(-surfaceVector * 13.0, 1.0));
    float fresnel = pow(1.0 - max(normal.z, 0.0), 5.0);
    float surfaceSheet = smoothstep(0.70, 0.98, vUv.y);
    float glitterBand = pow(0.5 + 0.5 * sin(vUv.x * 14.0 + vUv.y * 5.0 - uTime * 0.22), 9.0) * surfaceSheet;
    scene += vec3(0.80, 0.92, 0.96) * fresnel * (0.03 + surfaceSheet * 0.14);
    scene += vec3(0.9, 0.97, 1.0) * glitterBand * 0.05;

    /* Wave light: the same sun that strikes the caustics catches live wave
       crests while troughs settle into shade. Physically placed on the
       simulated water itself -  this is what makes a wake read as moving
       water rather than a screen-blended glow.
       Anti-washout: crest specular is gated by washoutGate so strong
       disturbances produce structured highlights, not a milky smear. */
    float waveLightDepth = mix(1.0, 0.38, smoothstep(0.46, 0.94, uTheme));
    vec3 waveLightNormal = normalize(vec3(-surfaceVector.x * 30.0, -surfaceVector.y * 30.0, 1.0));
    vec3 waveSun = normalize(vec3(-0.30, 0.46, 0.84));
    float crestSpecular = pow(max(dot(waveLightNormal, waveSun), 0.0), 18.0);
    float crestGate = smoothstep(0.0022, 0.016, length(slope));
    scene += vec3(0.84, 0.94, 1.0) * crestSpecular * crestGate * 0.055 * waveLightDepth * (0.3 + washoutGate * 0.7);
    // Mild height shading only — strong trough darkening read as plastic creases.
    scene += vec3(0.10, 0.17, 0.24) * h * 0.045 * waveLightDepth;

    gl_FragColor = vec4(linearToSrgb(underwaterToneMap(scene * uExposure)), 1.0);
  }
`;
