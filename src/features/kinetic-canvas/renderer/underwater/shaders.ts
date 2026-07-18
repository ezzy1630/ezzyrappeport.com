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
    vec3 surfacePearl = vec3(0.72, 0.77, 0.765);
    vec3 depthSlate = vec3(0.29, 0.395, 0.425);
    vec3 color = mix(surfacePearl, depthSlate, smoothstep(0.08, 0.96, vUv.y));
    float surfaceRegion = exp(-pow((vUv.y - 0.10) / 0.18, 2.0));
    color += vec3(0.10, 0.105, 0.095) * surfaceRegion;
    float lowerDepth = smoothstep(0.54, 0.96, vUv.y);
    color *= 1.0 - lowerDepth * 0.15;
    float bandA = exp(-pow((vUv.x + vUv.y * 0.30 - 0.40) / 0.105, 2.0));
    float bandB = exp(-pow((vUv.x - vUv.y * 0.18 - 0.70) / 0.16, 2.0));
    color += vec3(0.16, 0.155, 0.135) * bandA * 0.44;
    color += vec3(0.08, 0.11, 0.115) * bandB * 0.32;
    float farSeparation = smoothstep(0.35, 0.92, vUv.y) * smoothstep(0.18, 0.72, abs(vUv.x - 0.5));
    color = mix(color, vec3(0.31, 0.43, 0.47), farSeparation * 0.12);
    float caustic = causticField(vWorld.xz * 0.85, uTime);
    color += vec3(0.72, 0.76, 0.70) * caustic * uCausticStrength * (0.3 + surfaceRegion * 0.7);
    float distanceDepth = smoothstep(-1.0, 1.0, vWorld.y);
    color = mix(color, vec3(0.42, 0.54, 0.57), distanceDepth * uDepthAttenuation);
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

  float linearViewDepth(float depth) {
    float viewZ = (uCameraNear * uCameraFar) / ((uCameraFar - uCameraNear) * depth - uCameraFar);
    return -viewZ;
  }

  void main() {
    float frontDepth = linearViewDepth(texture2D(uFrontDepth, vScreenUv).r);
    float backDepth = linearViewDepth(texture2D(uBackDepth, vScreenUv).r);
    float geometricThickness = clamp(backDepth - frontDepth, 0.012, 0.52);
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

    vec3 viewDirection = normalize(uCameraPosition - vWorldPosition);
    float fresnelBase = pow((uIor - 1.0) / (uIor + 1.0), 2.0);
    float fresnel = fresnelBase + (1.0 - fresnelBase)
      * pow(1.0 - clamp(dot(vWorldNormal, viewDirection), 0.0, 1.0), 5.0);
    vec3 keyDirection = normalize(uKeyPosition - vWorldPosition);
    vec3 fillDirection = normalize(uFillPosition - vWorldPosition);
    vec3 keyHalf = normalize(keyDirection + viewDirection);
    vec3 fillHalf = normalize(fillDirection + viewDirection);
    float broadHighlight = pow(max(dot(vWorldNormal, keyHalf), 0.0), mix(12.0, 30.0, 1.0 - uRoughness));
    float softFill = pow(max(dot(vWorldNormal, fillHalf), 0.0), 8.0);
    float lowerBounce = max(dot(vWorldNormal, normalize(vec3(0.1, -0.45, 0.35))), 0.0);
    float shoulderGlow = smoothstep(0.18, 0.86, shoulder) * (1.0 - smoothstep(0.88, 1.0, shoulder));
    vec3 reflected = vec3(0.70, 0.78, 0.79) * fresnel * 0.34;
    reflected += uKeyColor * broadHighlight * uKeyIntensity * 0.055;
    reflected += uFillColor * softFill * uFillIntensity * 0.025;
    reflected += vec3(0.27, 0.34, 0.32) * lowerBounce * 0.055;
    reflected += vec3(0.42, 0.52, 0.53) * shoulderGlow * 0.035;
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
  uniform vec2 uHeightTexel;
  uniform float uExposure;
  uniform float uSurfaceDistortion;
  uniform float uCausticStrength;
  uniform float uDepthAttenuation;
  uniform float uCameraNear;
  uniform float uCameraFar;
  uniform int uDebugView;

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

  float heightAt(vec2 uv) { return texture2D(uHeightfield, clamp(uv, 0.0, 1.0)).r; }
  float linearViewDepth(float depth) {
    float viewZ = (uCameraNear * uCameraFar) / ((uCameraFar - uCameraNear) * depth - uCameraFar);
    return -viewZ;
  }

  void main() {
    vec2 texel = uHeightTexel;
    float h = heightAt(vUv);
    vec2 slope = vec2(
      heightAt(vUv + vec2(texel.x * 5.0, 0.0)) - heightAt(vUv - vec2(texel.x * 5.0, 0.0)),
      heightAt(vUv + vec2(0.0, texel.y * 5.0)) - heightAt(vUv - vec2(0.0, texel.y * 5.0))
    );
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
    float upperSurface = smoothstep(0.68, 1.0, vUv.y);
    scene += vec3(0.72, 0.82, 0.87) * fresnel * (0.025 + upperSurface * 0.045);
    scene += vec3(0.022, 0.032, 0.038) * h * 0.065;

    gl_FragColor = vec4(linearToSrgb(aces(scene * uExposure)), 1.0);
  }
`;
