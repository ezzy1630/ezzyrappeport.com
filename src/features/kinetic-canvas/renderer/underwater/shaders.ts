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

export const BACKDROP_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vWorld;
  uniform float uTime;
  uniform float uCausticStrength;
  uniform float uDepthAttenuation;
  uniform float uAspect;
  uniform float uDebugUv;

  float causticField(vec2 p, float time) {
    float foldA = sin(p.x * 4.4 + sin(p.y * 2.2 + time * 0.13) * 1.25);
    float foldB = sin(p.y * 4.9 - p.x * 1.65 - time * 0.10);
    float ridge = 1.0 - smoothstep(0.05, 0.48, abs((foldA + foldB) * 0.5));
    return ridge * ridge * ridge;
  }

  void main() {
    vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
    vec3 lowerPearl = vec3(0.19, 0.30, 0.38);
    vec3 upperWater = vec3(0.47, 0.66, 0.76);
    vec3 depthSlate = vec3(0.018, 0.065, 0.12);
    vec3 color = mix(lowerPearl, upperWater, smoothstep(0.18, 0.98, uv.y) * 0.90);
    vec3 calmVolume = color;

    vec2 keyDelta = (uv - vec2(0.10, 0.82)) * vec2(1.0, 1.45);
    float keyVolume = exp(-dot(keyDelta, keyDelta) * 4.0);
    color += vec3(0.25, 0.29, 0.30) * keyVolume;

    vec2 pocketDelta = (uv - vec2(0.72, 0.57)) * vec2(0.92, 1.25);
    float depthPocket = exp(-dot(pocketDelta, pocketDelta) * 5.0);
    color = mix(color, depthSlate, depthPocket * 0.88);

    vec2 leftPocketDelta = (uv - vec2(0.24, 0.47)) * vec2(1.35, 1.55);
    float leftPocket = exp(-dot(leftPocketDelta, leftPocketDelta) * 6.2);
    color = mix(color, vec3(0.065, 0.17, 0.26), leftPocket * 0.64);

    float titleDepthShelf = exp(-pow((uv.y - 0.46) / 0.16, 2.0));
    float shelfShape = 0.34 + 0.66 * smoothstep(-0.55, 0.75, sin(uv.x * 5.0 - 0.8));
    color = mix(color, vec3(0.055, 0.145, 0.225), titleDepthShelf * shelfShape * 0.34);

    float longBand = exp(-pow((uv.x + uv.y * 0.24 - 0.52) / 0.065, 2.0));
    float darkBand = exp(-pow((uv.x - uv.y * 0.18 - 0.70) / 0.12, 2.0));
    color += vec3(0.24, 0.32, 0.36) * longBand * 0.64;
    color = mix(color, vec3(0.035, 0.105, 0.18), darkBand * 0.56);

    float horizon = exp(-pow((uv.y - 0.18) / 0.042, 2.0));
    color += vec3(0.15, 0.21, 0.24) * horizon;
    color *= 1.0 - smoothstep(0.0, 0.30, uv.y) * 0.09;

    float surfaceY = 0.90
      + sin(uv.x * 7.0 + uTime * 0.12) * 0.025
      + sin(uv.x * 15.0 - uTime * 0.08) * 0.009;
    float surfaceBoundary = exp(-pow((uv.y - surfaceY) / 0.020, 2.0));
    float surfaceTrough = exp(-pow((uv.y - surfaceY - 0.026) / 0.026, 2.0));
    float upperFoldWindow = smoothstep(0.58, 0.92, uv.y);
    float upperFolds = pow(0.5 + 0.5 * sin(
      uv.x * 18.0 + sin(uv.y * 11.0 + uTime * 0.10) * 2.2
    ), 8.0) * upperFoldWindow;
    color = mix(color, vec3(0.045, 0.14, 0.235), surfaceTrough * 0.28);
    color += vec3(0.48, 0.66, 0.74) * surfaceBoundary * 0.30;
    float foldEnvelope = 0.32 + 0.68 * exp(-pow((uv.x - 0.62) / 0.38, 2.0));
    color += vec3(0.36, 0.51, 0.60) * upperFolds * foldEnvelope * 0.14;

    float caustic = causticField((uv - 0.5) * vec2(3.5, 2.15), uTime);
    float causticWindow = smoothstep(0.14, 0.42, uv.y) * (1.0 - smoothstep(0.78, 0.96, uv.y));
    color *= 1.0 - (1.0 - caustic) * causticWindow * 0.08;
    color += vec3(0.64, 0.75, 0.80) * caustic * uCausticStrength * causticWindow * 1.55;
    color = mix(color, depthSlate, smoothstep(-1.0, 1.0, vWorld.y) * uDepthAttenuation * 0.12);
    float portraitCalm = 1.0 - smoothstep(0.62, 0.92, uAspect);
    float lowerCalm = (1.0 - smoothstep(0.30, 0.58, uv.y)) * portraitCalm;
    color = mix(color, calmVolume, max(lowerCalm, portraitCalm * 0.78));
    if (uDebugUv > 0.5) color = vec3(uv, 0.0);
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

  void main() {
    float frontDepth = linearViewDepth(texture2D(uFrontDepth, vScreenUv).r);
    float backDepth = linearViewDepth(texture2D(uBackDepth, vScreenUv).r);
    float geometricThickness = clamp(backDepth - frontDepth, 0.008, 0.52);
    float shoulder = 1.0 - abs(vViewNormal.z);
    float opticalThickness = geometricThickness * (1.0 + shoulder * 1.85) + shoulder * 0.028;
    float eta = (uIor - 1.0) / uIor;
    vec2 internalWarp = vec2(
      sin(vWorldPosition.z * 8.0 + uTime * 0.18),
      sin(vWorldPosition.x * 7.0 - uTime * 0.14)
    ) * 0.00045;
    vec2 refractionDirection = normalize(vViewNormal.xy + vec2(0.0001));
    vec2 refractedUv = clamp(
      vScreenUv + vViewNormal.xy * eta * opticalThickness * 0.098 + internalWarp,
      vec2(0.002),
      vec2(0.998)
    );
    float samplingRadius = 0.0008 + uRoughness * 0.017 + shoulder * 0.0018;
    vec3 environment = sampleEnvironment(refractedUv, refractionDirection, samplingRadius);
    vec3 directEnvironment = texture2D(uEnvironment, vScreenUv).rgb;

    vec3 safeAttenuation = max(uAttenuationColor, vec3(0.02));
    vec3 absorption = -log(safeAttenuation) / max(uAbsorptionDistance, 0.01);
    vec3 transmittance = exp(-absorption * opticalThickness);
    vec3 body = environment * transmittance
      + uAttenuationColor * (1.0 - transmittance) * 0.12;
    body += (environment - directEnvironment) * (0.92 + shoulder * 0.38);
    body *= mix(0.87, 0.97, shoulder);

    float transmittedFold = pow(0.5 + 0.5 * sin(vWorldPosition.x * 7.4 + vWorldPosition.z * 5.1 - uTime * 0.19), 9.0);
    float transmittedGroove = pow(0.5 + 0.5 * sin(vWorldPosition.x * 5.0 - vWorldPosition.z * 7.2 + uTime * 0.13), 11.0);
    body += vec3(0.54, 0.69, 0.78) * transmittedFold * (0.045 + geometricThickness * 0.08);
    body *= 1.0 - transmittedGroove * (0.025 + shoulder * 0.045);

    vec3 viewDirection = normalize(uCameraPosition - vWorldPosition);
    float fresnelBase = pow((uIor - 1.0) / (uIor + 1.0), 2.0);
    float fresnel = fresnelBase + (1.0 - fresnelBase)
      * pow(1.0 - clamp(dot(vWorldNormal, viewDirection), 0.0, 1.0), 5.0);
    vec3 keyDirection = normalize(uKeyPosition - vWorldPosition);
    vec3 fillDirection = normalize(uFillPosition - vWorldPosition);
    vec3 keyHalf = normalize(keyDirection + viewDirection);
    vec3 fillHalf = normalize(fillDirection + viewDirection);
    float broadHighlight = pow(max(dot(vWorldNormal, keyHalf), 0.0), mix(7.0, 18.0, 1.0 - uRoughness));
    float softFill = pow(max(dot(vWorldNormal, fillHalf), 0.0), 18.0);
    float lowerBounce = max(dot(vWorldNormal, normalize(vec3(0.1, -0.45, 0.35))), 0.0);
    float directionalSide = 0.35 + 0.65 * smoothstep(-0.35, 0.65, dot(vWorldNormal, normalize(vec3(-0.65, 0.25, 0.7))));
    float internalReflection = smoothstep(0.42, 0.94, shoulder) * directionalSide;
    vec2 reflectedUv = clamp(vScreenUv - vViewNormal.xy * (0.018 + opticalThickness * 0.025), 0.002, 0.998);
    vec3 reflectedEnvironment = texture2D(uEnvironment, reflectedUv).rgb;
    vec3 denseSidewall = mix(reflectedEnvironment * 0.42, vec3(0.055, 0.115, 0.18), 0.68);
    body = mix(body, denseSidewall, internalReflection * 0.76);

    float surfaceBand = pow(0.5 + 0.5 * sin(vWorldPosition.x * 5.1 - vWorldPosition.z * 3.2 + uTime * 0.34), 5.0)
      * smoothstep(0.20, 0.82, shoulder);
    float causticFold = pow(0.5 + 0.5 * sin(vWorldPosition.x * 4.0 + vWorldPosition.z * 5.3 - uTime * 0.22), 7.0)
      * (0.35 + shoulder * 0.65);
    vec3 reflected = vec3(0.60, 0.73, 0.80) * fresnel * 0.32;
    reflected += uKeyColor * broadHighlight * uKeyIntensity * 0.13;
    reflected += uFillColor * softFill * uFillIntensity * 0.035;
    reflected += vec3(0.20, 0.29, 0.34) * lowerBounce * 0.035;
    reflected += vec3(0.66, 0.79, 0.86) * surfaceBand * 0.11;
    reflected += vec3(0.72, 0.82, 0.86) * causticFold * uCausticStrength * 0.40;
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
    // Preserve the studio's blue-gray depth instead of lifting it into the
    // pale ACES midrange. The shallow shoulder only rolls the brightest folds.
    vec3 shouldered = value / (vec3(1.0) + value * 0.12);
    return clamp((shouldered - 0.16) * 1.055 + 0.16, 0.0, 1.0);
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
    float copyCalm = 1.0 - exp(-pow((vUv.y - 0.37) / 0.15, 2.0)) * 0.36;
    float regionalStrength = (0.54 + upperIdentity * 0.82) * copyCalm;
    vec2 slowSwell = vec2(
      sin(vUv.y * 5.2 + uTime * 0.13),
      cos(vUv.x * 5.8 - uTime * 0.11)
    ) * 0.00055 * (0.35 + upperIdentity * 0.65);
    vec2 surfaceVector = slope * regionalStrength + slowSwell;
    vec2 refraction = surfaceVector * uSurfaceDistortion * (0.72 + depthTravel * 0.72);
    vec2 refractionDirection = normalize(surfaceVector + vec2(0.00001));
    vec3 scene = sampleScene(
      clamp(vUv + refraction, 0.002, 0.998),
      refractionDirection,
      0.0007 + length(surfaceVector) * 0.35
    );

    float glyphHere = step(frontDepth, 0.9995);
    vec2 shadowDirection = vec2(-0.0065, 0.0085) * (0.72 + depthTravel * 0.45);
    float projectedShadow = 0.0;
    projectedShadow += step(texture2D(uFrontDepth, clamp(vUv + shadowDirection, 0.002, 0.998)).r, 0.9995);
    projectedShadow += step(texture2D(uFrontDepth, clamp(vUv + shadowDirection * 1.8, 0.002, 0.998)).r, 0.9995);
    projectedShadow += step(texture2D(uFrontDepth, clamp(vUv + shadowDirection * 2.7, 0.002, 0.998)).r, 0.9995);
    projectedShadow = projectedShadow / 3.0 * (1.0 - glyphHere);
    scene *= 1.0 - projectedShadow * (0.055 + depthTravel * 0.035);

    // The same surface normal that refracts the complete scene drives the
    // restrained caustic modulation. Glyph thickness gates its interior reach.
    float compression = smoothstep(0.003, 0.028, abs(dot(surfaceVector, normalize(vec2(0.72, 0.38)))));
    float focus = 1.0 - smoothstep(0.008, 0.11, length(surfaceVector));
    float caustic = (focus * focus * 0.35 + compression * 0.65) * uCausticStrength
      * (0.22 + depthTravel * 0.38) * (0.45 + upperIdentity * 0.55);
    scene += vec3(0.66, 0.78, 0.84) * caustic * (1.0 + glyphThickness * 0.85);

    vec3 waterAbsorption = vec3(0.055, 0.025, 0.012) * depthTravel * uDepthAttenuation;
    scene *= exp(-waterAbsorption);
    scene = mix(scene, vec3(0.64, 0.76, 0.82), depthTravel * uDepthAttenuation * 0.24);

    vec3 normal = normalize(vec3(-surfaceVector * 13.0, 1.0));
    float fresnel = pow(1.0 - max(normal.z, 0.0), 5.0);
    float surfaceSheet = smoothstep(0.68, 0.98, vUv.y);
    float movingBand = pow(0.5 + 0.5 * sin(vUv.x * 8.2 + vUv.y * 4.4 - uTime * 0.18), 8.0) * surfaceSheet;
    float ceilingRegion = smoothstep(0.70, 0.94, vUv.y);
    float ceilingPhase = sin(vUv.x * 18.0 + sin(vUv.y * 7.0 + uTime * 0.11) * 1.8)
      + sin(vUv.x * 9.0 - vUv.y * 11.0 - uTime * 0.07);
    float ceilingFold = pow(1.0 - smoothstep(0.04, 0.58, abs(ceilingPhase * 0.5)), 2.0) * ceilingRegion;
    float ceilingBoundary = exp(-pow((vUv.y - 0.745) / 0.032, 2.0));
    float boundaryFold = pow(0.5 + 0.5 * sin(vUv.x * 15.0 + sin(vUv.x * 5.0 - uTime * 0.10) * 1.8), 7.0)
      * ceilingBoundary;
    float betweenLines = exp(-pow((vUv.y - 0.655) / 0.038, 2.0));
    float betweenFold = pow(0.5 + 0.5 * sin(vUv.x * 11.5 - uTime * 0.14), 8.0)
      * betweenLines * (0.35 + compression * 0.65);
    scene += vec3(0.64, 0.77, 0.84) * fresnel * (0.035 + surfaceSheet * 0.16);
    scene += vec3(0.52, 0.68, 0.77) * compression * (0.018 + upperIdentity * 0.045);
    scene += vec3(0.70, 0.82, 0.87) * movingBand * 0.04;
    scene = mix(scene, vec3(0.12, 0.27, 0.40), (1.0 - ceilingFold) * ceilingRegion * 0.25);
    scene += vec3(0.68, 0.80, 0.86) * ceilingFold * 0.31;
    scene += vec3(0.72, 0.84, 0.89) * boundaryFold * 0.34;
    scene += vec3(0.58, 0.73, 0.81) * betweenFold * 0.14;
    scene *= 1.0 - (1.0 - ceilingFold) * ceilingRegion * 0.17;
    scene += vec3(0.035, 0.055, 0.068) * h * 0.11;

    gl_FragColor = vec4(linearToSrgb(underwaterToneMap(scene * uExposure)), 1.0);
  }
`;
