"use client";

import {
  BackSide,
  Color,
  DepthTexture,
  DirectionalLight,
  DoubleSide,
  Euler,
  FrontSide,
  HalfFloatType,
  LinearFilter,
  LinearSRGBColorSpace,
  Mesh,
  MeshPhysicalMaterial,
  NoToneMapping,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  RectAreaLight,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
  UnsignedIntType,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Texture,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { LiquidInteractionEvent, LiquidPhysics } from "@/lib/portfolio/liquid-interaction";
import { installGlyphDebug, type GlyphDebugSnapshot } from "../../debug/glyphDebug";
import { accumulateFixedSteps } from "../../physics/fixedStep";
import {
  createGlyphBodies,
  projectGlyph,
  projectGlyphRestCenter,
  stepGlyphBodies,
  type GlyphBody,
  type GlyphInteraction,
} from "../../physics/glyphRigidBodies";
import { clientToWaterUv } from "../../physics/waterCoordinates";
import type { KineticQuality } from "../quality";
import {
  HERO_GLB_URL,
  HERO_MANIFEST_URL,
  UNDERWATER_DEBUG,
  WATER_PLATE_URLS,
} from "./config";
import { validateHeroManifest, type HeroGlyphManifestEntry } from "./heroManifest";
import {
  BACKDROP_FRAGMENT,
  BACKDROP_VERTEX,
  DEPTH_FRAGMENT,
  FINAL_COMPOSITE_FRAGMENT,
  FULLSCREEN_VERTEX,
  GLYPH_FRAGMENT,
  GLYPH_VERTEX,
  HEIGHTFIELD_FRAGMENT,
} from "./shaders";

type MutableRef<T> = { current: T };

export type HeightfieldSplat = {
  position: [number, number];
  radius: number;
  impulse: number;
  direction?: [number, number];
};

type WaterInjection = HeightfieldSplat & {
  start: [number, number];
  end: [number, number];
  wake: number;
};

declare global {
  interface Window {
    __underwaterDebug?: {
      wake: (start: [number, number], end: [number, number], durationMs?: number) => void;
      press: (point: [number, number], incoming?: [number, number]) => void;
      metrics: () => string | undefined;
    };
  }
}

export type HeroGlyphRuntime = {
  manifest: HeroGlyphManifestEntry;
  object: Mesh<BufferGeometry, Material>;
};

type StartOptions = {
  canvas: HTMLCanvasElement;
  getPhysics: () => LiquidPhysics;
  reducedMotionRef: MutableRef<boolean>;
  staticModeRef: MutableRef<boolean>;
  quality: KineticQuality;
  renderHeroGlyphs: boolean;
  onReady: () => void;
  onFailure: (error: unknown) => void;
  onRecover: () => void;
};

type WaterSection = "hero" | "projects" | "about" | "contact" | "case";

const WATER_SECTION_THEME: Record<WaterSection, number> = {
  hero: 0,
  projects: 0.08,
  about: 0.56,
  contact: 1,
  case: 0.92,
};

function currentWaterSection(): WaterSection {
  const value = document.documentElement.dataset.waterSection;
  return value === "projects" || value === "about" || value === "contact" || value === "case"
    ? value
    : "hero";
}

async function loadOpticalMicrostructure() {
  const loader = new TextureLoader();
  const textures = await Promise.all([
    loader.loadAsync(WATER_PLATE_URLS.shallowLandscape),
    loader.loadAsync(WATER_PLATE_URLS.shallowPortrait),
    loader.loadAsync(WATER_PLATE_URLS.midDepth),
    loader.loadAsync(WATER_PLATE_URLS.deepBasin),
  ]);
  for (const texture of textures) {
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
  }
  return textures;
}

const GLYPH_LAYER = 1;
const MAX_SPLATS = 8;

function createRenderTarget(width = 1, height = 1, withDepth = false) {
  const target = new WebGLRenderTarget(width, height, {
    type: HalfFloatType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: true,
  });
  target.texture.colorSpace = LinearSRGBColorSpace;
  if (withDepth) {
    target.depthTexture = new DepthTexture(width, height, UnsignedIntType);
  }
  return target;
}

function disposeObject(root: Object3D) {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    geometries.add(child.geometry);
    const source = Array.isArray(child.material) ? child.material : [child.material];
    source.forEach((material) => materials.add(material));
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

function makePhysicalGlyphMaterial() {
  return new MeshPhysicalMaterial({
    color: new Color(0xf7fbfc),
    metalness: 0,
    roughness: UNDERWATER_DEBUG.roughness,
    transmission: 0.985,
    thickness: 0.34,
    ior: UNDERWATER_DEBUG.ior,
    attenuationColor: new Color(UNDERWATER_DEBUG.absorptionColor),
    attenuationDistance: UNDERWATER_DEBUG.absorptionDistance,
    specularIntensity: 0.62,
    specularColor: new Color(0xf6fbff),
    clearcoat: 0.12,
    clearcoatRoughness: 0.16,
    sheen: 0,
    side: FrontSide,
    transparent: false,
    depthWrite: true,
  });
}

function makeThicknessGlyphMaterial(
  environment: Texture,
  frontDepth: Texture,
  backDepth: Texture,
) {
  return new ShaderMaterial({
    vertexShader: GLYPH_VERTEX,
    fragmentShader: GLYPH_FRAGMENT,
    uniforms: {
      uEnvironment: { value: environment },
      uFrontDepth: { value: frontDepth },
      uBackDepth: { value: backDepth },
      uIor: { value: UNDERWATER_DEBUG.ior },
      uRoughness: { value: UNDERWATER_DEBUG.roughness },
      uAttenuationColor: { value: new Color(UNDERWATER_DEBUG.absorptionColor) },
      uAbsorptionDistance: { value: UNDERWATER_DEBUG.absorptionDistance },
      uTime: { value: 0 },
      uCameraNear: { value: 0.1 },
      uCameraFar: { value: 30 },
      uCameraPosition: { value: new Vector3() },
      uKeyPosition: { value: new Vector3(-2.2, 2.8, -3.2) },
      uKeyColor: { value: new Color(0xf5fbff) },
      uKeyIntensity: { value: UNDERWATER_DEBUG.keyIntensity },
      uFillPosition: { value: new Vector3(2.5, 1.8, 2.4) },
      uFillColor: { value: new Color(0xc9dce7) },
      uFillIntensity: { value: UNDERWATER_DEBUG.fillIntensity },
      uRefractionTaps: { value: 5 },
      uCausticStrength: { value: UNDERWATER_DEBUG.causticStrength },
    },
    side: FrontSide,
    depthWrite: true,
    depthTest: true,
  });
}

function applyManifestTransform(object: Object3D, glyph: HeroGlyphManifestEntry) {
  object.position.fromArray(glyph.rest_transform.translation);
  // Keep the manifest as the source of identity and local transforms, then
  // tighten the two authored lines into one optical title block.
  object.position.z += glyph.line_index === 0 ? 0.28 : -0.16;
  object.quaternion.fromArray(glyph.rest_transform.rotation_xyzw);
  object.scale.fromArray(glyph.rest_transform.scale);
  object.userData.glyphIndex = glyph.glyph_index;
  object.userData.glyphCharacter = glyph.character;
  object.userData.lineIndex = glyph.line_index;
  object.userData.physicsIdentity = glyph.object_node_name;
  object.userData.pivot = glyph.pivot.local;
  object.userData.localBounds = glyph.local_bounding_box;
  object.userData.sharedGeometry = glyph.shared_geometry_identifier;
}

async function loadGlyphs(scene: Scene, material: Material, glbUrl: string) {
  const [manifestResponse, gltf] = await Promise.all([
    fetch(HERO_MANIFEST_URL, { cache: "force-cache" }),
    new GLTFLoader().loadAsync(glbUrl),
  ]);
  if (!manifestResponse.ok) throw new Error(`Hero manifest failed: ${manifestResponse.status}`);
  const manifest = validateHeroManifest(await manifestResponse.json());
  const glyphs: HeroGlyphRuntime[] = [];
  const glyphGeometries = new Map<string, BufferGeometry>();

  for (const glyph of manifest.glyphs) {
    const source = gltf.scene.getObjectByName(glyph.object_node_name);
    if (!(source instanceof Mesh)) {
      disposeObject(gltf.scene);
      throw new Error(`GLB node missing: ${glyph.object_node_name}`);
    }
    // Use the authored inflated Inter Tight mesh. Rebuilding it with a generic
    // runtime font loses the rounded outline, convex face, and deep shoulder.
    const geometryKey = glyph.shared_geometry_identifier;
    let glyphGeometry = glyphGeometries.get(geometryKey);
    if (!glyphGeometry) {
      const authoredGeometry = source.geometry.clone() as BufferGeometry;
      authoredGeometry.computeVertexNormals();
      glyphGeometries.set(geometryKey, authoredGeometry);
      glyphGeometry = authoredGeometry;
    }
    const object = new Mesh(glyphGeometry, material);
    object.name = glyph.object_node_name;
    applyManifestTransform(object, glyph);
    object.layers.set(GLYPH_LAYER);
    object.castShadow = true;
    object.receiveShadow = true;
    scene.add(object);
    glyphs.push({ manifest: glyph, object });
  }

  // The runtime meshes own cloned geometry; the loader scene is no longer used.
  disposeObject(gltf.scene);
  return glyphs;
}

function configureCamera(camera: PerspectiveCamera, width: number, height: number, debug = false) {
  const aspect = Math.max(width / Math.max(height, 1), 0.2);
  const verticalFov = camera.fov * Math.PI / 180;
  const distanceForWidth = 2.44 / (Math.tan(verticalFov * 0.5) * aspect);
  // The reference composition lets the second line span roughly 84% of a
  // 16:9 viewport. Keep that framing in camera space so the live GLB and the
  // DOM fallback occupy the same visual volume instead of crossfading between
  // two differently scaled titles.
  const wideDistance = aspect > 1.25 ? 3.85 : aspect > 0.82 ? 4.8 : 5.6;
  const distance = Math.max(wideDistance, distanceForWidth * (aspect < 0.7 ? 0.96 : 0.88));
  const targetZ = aspect < 0.7 ? 0.24 : 0.08;
  camera.aspect = aspect;
  camera.up.set(0, 0, -1);
  if (debug) {
    camera.position.set(2.7, 5.7, targetZ - 0.2);
  } else {
    camera.position.set(0.16, distance, targetZ + 0.08);
  }
  camera.lookAt(0, 0, targetZ);
  camera.updateProjectionMatrix();
}

/* Rest state captured after configureCamera so per-frame pointer parallax
   and the breathing bob can be layered without drifting the framing. */
function captureCameraRest(camera: PerspectiveCamera, out: { position: Vector3; quaternion: Quaternion }) {
  out.position.copy(camera.position);
  out.quaternion.copy(camera.quaternion);
}

function applyCameraLife(
  camera: PerspectiveCamera,
  rest: { position: Vector3; quaternion: Quaternion },
  pointerX: number,
  pointerY: number,
  time: number,
  reducedMotion: boolean,
) {
  const maxTilt = 1.5 * Math.PI / 180; // ≤1.5° pointer parallax
  const breathe = reducedMotion ? 0 : Math.sin(time * (Math.PI * 2 / 6)) * 0.011;
  const drift = reducedMotion ? 0 : Math.sin(time * (Math.PI * 2 / 11)) * 0.006;
  const yaw = pointerX * maxTilt;
  const pitch = -pointerY * maxTilt * 0.7 + breathe * 0.4;
  camera.position.set(
    rest.position.x + pointerX * 0.06 + drift,
    rest.position.y,
    rest.position.z + breathe,
  );
  const euler = new Euler(pitch, yaw, 0, "YXZ");
  camera.quaternion.copy(rest.quaternion).multiply(new Quaternion().setFromEuler(euler));
}

function percentile95(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
}

/**
 * Production render graph
 * -----------------------
 * 1. Render the pale submerged studio into `environmentTarget`.
 * 2. Render GLB glyph back depth, then front depth, using the same camera.
 * 3. Shade each real glyph mesh from the environment, front/back thickness,
 *    and mesh normals, then render the complete volume into `sceneTarget`.
 * 4. Update the low-resolution GPU surface heightfield.
 * 5. Refract the complete scene color/depth through that surface, apply the
 *    compatible caustic field and depth attenuation, then run one ACES/sRGB
 *    output pass. No CSS layer adjusts exposure after this point.
 */
export function startUnderwaterHeroRenderer({
  canvas,
  getPhysics,
  reducedMotionRef,
  staticModeRef,
  quality,
  renderHeroGlyphs,
  onReady,
  onFailure,
  onRecover,
}: StartOptions) {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: quality.tier === "high",
    alpha: false,
    powerPreference: "high-performance",
    premultipliedAlpha: false,
  });
  if (!renderer.capabilities.isWebGL2) {
    renderer.dispose();
    throw new Error("WebGL2 unavailable");
  }
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.info.autoReset = false;
  renderer.shadowMap.enabled = quality.tier !== "low";
  renderer.setClearColor(0xdceef4, 1);
  canvas.dataset.renderer = "three-webgl2-underwater";
  canvas.dataset.renderGraph = "environment>glyph-depth>glyph-transmission>surface>underwater-filmic";
  canvas.dataset.toneMapper = "underwater shallow shoulder";

  const scene = new Scene();
  scene.background = new Color(0xdceef4);
  const camera = new PerspectiveCamera(42, 1, 0.1, 30);
  camera.layers.enable(GLYPH_LAYER);
  const debugCamera = process.env.NODE_ENV !== "production"
    && new URLSearchParams(window.location.search).get("heroCamera") === "depth";
  const debugSearch = new URLSearchParams(window.location.search);
  const exposureParam = debugSearch.get("heroExposure");
  const requestedExposure = process.env.NODE_ENV !== "production"
    && exposureParam !== null
    ? Number(exposureParam)
    : Number.NaN;
  const exposure = Number.isFinite(requestedExposure)
    ? Math.min(1.3, Math.max(0.72, requestedExposure))
    : UNDERWATER_DEBUG.exposure;
  canvas.dataset.exposure = String(exposure);
  const glbUrl = process.env.NODE_ENV !== "production" && debugSearch.get("heroGlb") === "missing"
    ? "/assets/hero/missing-glyphs.glb"
    : HERO_GLB_URL;

  const backdropMaterial = new ShaderMaterial({
    vertexShader: BACKDROP_VERTEX,
    fragmentShader: BACKDROP_FRAGMENT,
    uniforms: {
      uOpticalShallowLandscape: { value: null },
      uOpticalShallowPortrait: { value: null },
      uOpticalMidDepth: { value: null },
      uOpticalDeepBasin: { value: null },
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uPortrait: { value: 0 },
      uTheme: { value: WATER_SECTION_THEME[currentWaterSection()] },
      uMotion: { value: 1 },
      uDebugUv: { value: process.env.NODE_ENV !== "production" && debugSearch.get("heroEnvironment") === "uv" ? 1 : 0 },
    },
    side: DoubleSide,
    depthTest: false,
    depthWrite: false,
  });
  const backdrop = new Mesh(new PlaneGeometry(2, 2, 1, 1), backdropMaterial);
  backdrop.renderOrder = -100;
  scene.add(backdrop);

  const key = new RectAreaLight(0xf5fbff, UNDERWATER_DEBUG.keyIntensity, 4.8, 2.6);
  key.position.set(-2.2, 2.8, -3.2);
  key.lookAt(new Vector3(0, 0, 0));
  scene.add(key);
  const fill = new RectAreaLight(0xc9dce7, UNDERWATER_DEBUG.fillIntensity, 5.5, 4.0);
  fill.position.set(2.5, 1.8, 2.4);
  fill.lookAt(new Vector3(0, 0, 0));
  scene.add(fill);
  const rim = new DirectionalLight(0xeaf6fb, UNDERWATER_DEBUG.environmentIntensity);
  rim.position.set(1.2, 3.5, -4.0);
  rim.castShadow = quality.tier !== "low";
  rim.shadow.mapSize.set(quality.tier === "high" ? 1024 : 512, quality.tier === "high" ? 1024 : 512);
  rim.shadow.camera.near = 0.1;
  rim.shadow.camera.far = 12;
  scene.add(rim);

  const sceneTarget = createRenderTarget(1, 1, true);
  const environmentTarget = createRenderTarget(1, 1, true);
  const frontDepthTarget = createRenderTarget();
  const backDepthTarget = createRenderTarget();
  const usePhysicalMaterial = process.env.NODE_ENV !== "production"
    && new URLSearchParams(window.location.search).get("glyphMaterial") === "physical";
  const glyphMaterial = usePhysicalMaterial
    ? makePhysicalGlyphMaterial()
    : makeThicknessGlyphMaterial(
        environmentTarget.texture,
        frontDepthTarget.texture,
        backDepthTarget.texture,
      );
  if (glyphMaterial instanceof ShaderMaterial) {
    glyphMaterial.uniforms.uKeyPosition.value.copy(key.position);
    glyphMaterial.uniforms.uKeyColor.value.copy(key.color);
    glyphMaterial.uniforms.uKeyIntensity.value = key.intensity;
    glyphMaterial.uniforms.uFillPosition.value.copy(fill.position);
    glyphMaterial.uniforms.uFillColor.value.copy(fill.color);
    glyphMaterial.uniforms.uFillIntensity.value = fill.intensity;
    glyphMaterial.uniforms.uRefractionTaps.value = quality.tier === "high" ? 5 : quality.tier === "balanced" ? 3 : 1;
  }
  canvas.dataset.glyphMaterial = usePhysicalMaterial ? "physical-baseline" : "thickness-refraction";
  const tierSimulationWidth = quality.tier === "high" ? 256 : quality.tier === "balanced" ? 192 : 128;
  let simulationWidth = Math.min(tierSimulationWidth, window.innerWidth < 640 ? 128 : window.innerWidth < 1200 ? 192 : 256);
  let simulationHeight = Math.max(72, Math.round(simulationWidth * 9 / 16));
  const makeHeightTarget = () => new WebGLRenderTarget(simulationWidth, simulationHeight, {
    type: HalfFloatType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: false,
  });
  let heightRead = makeHeightTarget();
  let heightWrite = makeHeightTarget();
  heightRead.texture.colorSpace = LinearSRGBColorSpace;
  heightWrite.texture.colorSpace = LinearSRGBColorSpace;

  const fullscreenGeometry = new PlaneGeometry(2, 2);
  const fullscreenCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const heightMaterial = new ShaderMaterial({
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: HEIGHTFIELD_FRAGMENT,
    uniforms: {
      uPrevious: { value: heightRead.texture },
      uTexel: { value: new Vector2(1 / simulationWidth, 1 / simulationHeight) },
      uDt: { value: 1 / 120 },
      uTime: { value: 0 },
      uAspect: { value: 16 / 9 },
      uAmbient: { value: reducedMotionRef.current ? 0 : 0.013 },
      uSplats: { value: Array.from({ length: MAX_SPLATS }, () => new Vector4()) },
      uSegments: { value: Array.from({ length: MAX_SPLATS }, () => new Vector4()) },
      uDirections: { value: Array.from({ length: MAX_SPLATS }, () => new Vector4()) },
      uSplatCount: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
  });
  const heightScene = new Scene();
  heightScene.add(new Mesh(fullscreenGeometry, heightMaterial));

  const finalMaterial = new ShaderMaterial({
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: FINAL_COMPOSITE_FRAGMENT,
    uniforms: {
      uScene: { value: sceneTarget.texture },
      uSceneDepth: { value: sceneTarget.depthTexture },
      uFrontDepth: { value: frontDepthTarget.texture },
      uBackDepth: { value: backDepthTarget.texture },
      uHeightfield: { value: heightRead.texture },
      uHeightTexel: { value: new Vector2(1 / simulationWidth, 1 / simulationHeight) },
      uExposure: { value: exposure },
      uSurfaceDistortion: { value: UNDERWATER_DEBUG.surfaceDistortion },
      uCausticStrength: { value: UNDERWATER_DEBUG.causticStrength },
      uDepthAttenuation: { value: UNDERWATER_DEBUG.depthAttenuation },
      uCameraNear: { value: camera.near },
      uCameraFar: { value: camera.far },
      uTime: { value: 0 },
      uTheme: { value: WATER_SECTION_THEME[currentWaterSection()] },
      uPointer: { value: new Vector2(0.62, 0.46) },
      uPointerVelocity: { value: new Vector2() },
      uPointerEnergy: { value: 0 },
      uQualityTier: { value: quality.tier === "high" ? 2 : quality.tier === "balanced" ? 1 : 0 },
      uDebugView: { value: process.env.NODE_ENV !== "production" && debugSearch.get("heroEnvironment") === "raw" ? 5 : 0 },
    },
    depthTest: false,
    depthWrite: false,
  });
  const finalScene = new Scene();
  finalScene.add(new Mesh(fullscreenGeometry, finalMaterial));

  renderer.setRenderTarget(heightRead);
  renderer.setClearColor(0x000000, 1);
  renderer.clear(true, false, false);
  renderer.setRenderTarget(heightWrite);
  renderer.clear(true, false, false);
  renderer.setRenderTarget(null);

  const depthMaterial = new ShaderMaterial({
    vertexShader: /* glsl */ `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: DEPTH_FRAGMENT,
    side: FrontSide,
  });

  let disposed = false;
  let ready = false;
  let running = true;
  let heroVisible = true;
  let animationFrame = 0;
  let resizeFrame = 0;
  let lastFrameAt = performance.now();
  const startedAt = lastFrameAt;
  let glyphs: HeroGlyphRuntime[] = [];
  let bodies: GlyphBody[] = [];
  let opticalMicrostructure: Texture[] = [];
  let lastInteractionId = 0;
  const pendingWater: WaterInjection[] = [];
  const activeGlyphInteractions: GlyphInteraction[] = [];
  // Controlled camera state: fixed primary framing, ≤1.5° pointer parallax,
  // and a slow breathing bob. Nothing that compromises the typography.
  let cameraPointerX = 0;
  let cameraPointerY = 0;
  let cameraPointerXT = 0;
  let cameraPointerYT = 0;
  let cameraTime = 0;
  const cameraRest = { position: new Vector3(), quaternion: new Quaternion() };
  let cameraRestValid = false;
  let fixedAccumulator = 0;
  let feedbackFrame = 0;
  let glyphDebug: ReturnType<typeof installGlyphDebug> = null;
  let freezeWater = false;
  let freezeGlyphs = false;
  let runtimeScale = quality.renderScale;
  let frameCount = 0;
  let waterTheme = WATER_SECTION_THEME[currentWaterSection()];
  const frameSamples: number[] = [];
  const workSamples: number[] = [];
  const heroElement = document.querySelector<HTMLElement>(".hero-shell");

  const applySplat = (splat: HeightfieldSplat) => {
    pendingWater.push({
      ...splat,
      start: splat.position,
      end: splat.position,
      wake: 0,
    });
    if (pendingWater.length > MAX_SPLATS) pendingWater.shift();
  };
  (canvas as HTMLCanvasElement & { heroHeightfield?: { splat: (value: HeightfieldSplat) => void } })
    .heroHeightfield = { splat: applySplat };

  const resize = () => {
    if (disposed) return;
    const width = Math.max(1, canvas.parentElement?.clientWidth ?? window.innerWidth);
    const height = Math.max(1, canvas.parentElement?.clientHeight ?? window.innerHeight);
    const dpr = Math.min(quality.dpr, quality.maxDpr, 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    backdropMaterial.uniforms.uAspect.value = width / Math.max(height, 1);
    backdropMaterial.uniforms.uPortrait.value = width / Math.max(height, 1) < 0.76 ? 1 : 0;
    const renderWidth = Math.max(1, Math.floor(width * dpr * runtimeScale));
    const renderHeight = Math.max(1, Math.floor(height * dpr * runtimeScale));
    sceneTarget.setSize(renderWidth, renderHeight);
    environmentTarget.setSize(renderWidth, renderHeight);
    frontDepthTarget.setSize(renderWidth, renderHeight);
    backDepthTarget.setSize(renderWidth, renderHeight);
    configureCamera(camera, width, height, debugCamera);
    const portrait = width / Math.max(height, 1) < 0.7;
    bodies.forEach((body) => {
      body.glyph.object.scale.fromArray(body.glyph.manifest.rest_transform.scale);
      const portraitLineScale = body.glyph.manifest.line_index === 0 ? 1.75 : 1.0;
      const portraitLinePositionScale = body.glyph.manifest.line_index === 0 ? 1.55 : 0.90;
      body.restPosition.x = body.glyph.manifest.rest_transform.translation[0]
        * (portrait ? portraitLinePositionScale : 1);
      body.restPosition.z = body.glyph.manifest.rest_transform.translation[2]
        + (body.glyph.manifest.line_index === 0 ? 0.28 : -0.16)
        + (portrait ? (body.glyph.manifest.line_index === 0 ? -0.60 : 0.36) : 0);
      if (portrait) {
        body.glyph.object.scale.z *= body.glyph.manifest.line_index === 0 ? 2.0 : 1.95;
        body.glyph.object.scale.x *= body.glyph.manifest.line_index === 0 ? portraitLineScale : 1.18;
      }
      body.position.set(0, 0, 0);
      body.velocity.set(0, 0, 0);
      body.orientation.set(0, 0, 0);
      body.angularVelocity.set(0, 0, 0);
      body.glyph.object.position.copy(body.restPosition);
      body.glyph.object.quaternion.copy(body.restQuaternion);
      body.projectedHalfSize.set(0, 0);
      body.restScreenCenter.set(Number.NaN, Number.NaN);
    });
    if (glyphMaterial instanceof ShaderMaterial) {
      glyphMaterial.uniforms.uCameraNear.value = camera.near;
      glyphMaterial.uniforms.uCameraFar.value = camera.far;
      glyphMaterial.uniforms.uCameraPosition.value.copy(camera.position);
    }
    const nextSimulationWidth = Math.min(tierSimulationWidth, width < 640 ? 128 : width < 1200 ? 192 : 256);
    const nextSimulationHeight = Math.max(72, Math.round(nextSimulationWidth * height / Math.max(width, 1)));
    if (nextSimulationWidth !== simulationWidth || nextSimulationHeight !== simulationHeight) {
      simulationWidth = nextSimulationWidth;
      simulationHeight = nextSimulationHeight;
      heightRead.setSize(simulationWidth, simulationHeight);
      heightWrite.setSize(simulationWidth, simulationHeight);
      renderer.setRenderTarget(heightRead);
      renderer.setClearColor(0x000000, 1);
      renderer.clear(true, false, false);
      renderer.setRenderTarget(heightWrite);
      renderer.clear(true, false, false);
      renderer.setRenderTarget(null);
      heightMaterial.uniforms.uTexel.value.set(1 / simulationWidth, 1 / simulationHeight);
      finalMaterial.uniforms.uHeightTexel.value.set(1 / simulationWidth, 1 / simulationHeight);
    }
    heightMaterial.uniforms.uAspect.value = width / Math.max(height, 1);
    captureCameraRest(camera, cameraRest);
    cameraRestValid = true;
    canvas.dataset.renderSize = `${renderWidth}x${renderHeight}`;
    canvas.dataset.simulationSize = `${simulationWidth}x${simulationHeight}`;
    canvas.dataset.simulationStep = "0.008333";
    canvas.dataset.opticalTier = quality.tier;
    canvas.dataset.refractionTaps = String(quality.tier === "high" ? 5 : quality.tier === "balanced" ? 3 : 1);
    canvas.dataset.glyphCount = String(glyphs.length);
  };

  const renderDepth = (target: WebGLRenderTarget, side: typeof FrontSide | typeof BackSide) => {
    renderer.setRenderTarget(target);
    renderer.setClearColor(0xffffff, 1);
    renderer.clear(true, true, true);
    const previousMask = camera.layers.mask;
    camera.layers.set(GLYPH_LAYER);
    depthMaterial.side = side;
    scene.overrideMaterial = depthMaterial;
    renderer.render(scene, camera);
    scene.overrideMaterial = null;
    camera.layers.mask = previousMask;
  };

  const ingestInteraction = (event: LiquidInteractionEvent) => {
    const rect = canvas.getBoundingClientRect();
    const startUv = clientToWaterUv({ x: event.startX, y: event.startY }, rect);
    const endUv = clientToWaterUv({ x: event.endX, y: event.endY }, rect);
    const speed = Math.hypot(event.vx, event.vy);
    const directionLength = Math.max(speed, 1);
    // Pressure moving through dense, calm water — not splashes. Interaction
    // energy held to roughly 40% of the prior impression.
    pendingWater.push({
      position: [endUv.x, endUv.y],
      start: [startUv.x, startUv.y],
      end: [endUv.x, endUv.y],
      radius: event.radius / Math.max(rect.height, 1),
      impulse: event.kind === "press" ? -event.strength * 0.72 : event.strength * 0.22,
      direction: [event.vx / directionLength, -event.vy / directionLength],
      wake: event.kind === "wake" ? event.strength * 0.72 : event.strength * 0.09,
    });
    activeGlyphInteractions.push({
      kind: event.kind,
      start: [event.startX - rect.left, event.startY - rect.top],
      end: [event.endX - rect.left, event.endY - rect.top],
      direction: speed > 8 ? [event.vx / directionLength, event.vy / directionLength] : [0, -1],
      strength: event.kind === "press" ? event.strength * 4.4 : event.strength * 7.2,
      radius: event.kind === "press" ? Math.max(84, event.radius) : Math.max(34, event.radius),
      time: event.time,
    });
    if (pendingWater.length > MAX_SPLATS) pendingWater.splice(0, pendingWater.length - MAX_SPLATS);
  };

  const ingestPhysics = () => {
    const physics = getPhysics();
    // Feed the controlled camera's parallax target from the live pointer.
    if (physics.pointer.active) {
      cameraPointerXT = (physics.pointer.x / Math.max(window.innerWidth, 1) - 0.5) * 2;
      cameraPointerYT = (physics.pointer.y / Math.max(window.innerHeight, 1) - 0.5) * 2;
    } else {
      cameraPointerXT *= 0.985;
      cameraPointerYT *= 0.985;
    }
    for (const event of physics.interactions) {
      if (event.id <= lastInteractionId) continue;
      lastInteractionId = event.id;
      ingestInteraction(event);
    }
  };

  if (process.env.NODE_ENV !== "production") {
    window.__underwaterDebug = {
      wake: (start, end, durationMs = 180) => {
        const rect = canvas.getBoundingClientRect();
        const seconds = Math.max(durationMs / 1000, 1 / 240);
        ingestInteraction({
          id: -1,
          kind: "wake",
          startX: rect.left + start[0],
          startY: rect.top + start[1],
          endX: rect.left + end[0],
          endY: rect.top + end[1],
          vx: (end[0] - start[0]) / seconds,
          vy: (end[1] - start[1]) / seconds,
          strength: Math.min(1, 0.1 + Math.hypot(end[0] - start[0], end[1] - start[1]) / seconds / 1450),
          radius: 28,
          time: performance.now() / 1000,
          pointerType: "debug",
        });
      },
      press: (point, incoming = [0, -1]) => {
        const rect = canvas.getBoundingClientRect();
        ingestInteraction({
          id: -1,
          kind: "press",
          startX: rect.left + point[0],
          startY: rect.top + point[1],
          endX: rect.left + point[0],
          endY: rect.top + point[1],
          vx: incoming[0],
          vy: incoming[1],
          strength: 0.82,
          radius: 38,
          time: performance.now() / 1000,
          pointerType: "debug",
        });
      },
      metrics: () => canvas.dataset.glyphMotion,
    };
  }

  const updateHeightfield = (time: number) => {
    const vectors = heightMaterial.uniforms.uSplats.value as Vector4[];
    const segments = heightMaterial.uniforms.uSegments.value as Vector4[];
    const directions = heightMaterial.uniforms.uDirections.value as Vector4[];
    const injectionCount = Math.min(pendingWater.length, MAX_SPLATS);
    for (let index = 0; index < injectionCount; index += 1) {
      const splat = pendingWater[index];
      vectors[index].set(splat.position[0], splat.position[1], splat.radius, splat.impulse);
      segments[index].set(splat.start[0], splat.start[1], splat.end[0], splat.end[1]);
      directions[index].set(splat.direction?.[0] ?? 0, splat.direction?.[1] ?? 0, splat.wake, 0);
    }
    heightMaterial.uniforms.uSplatCount.value = injectionCount;
    heightMaterial.uniforms.uTime.value = time;
    heightMaterial.uniforms.uAmbient.value = reducedMotionRef.current ? 0 : 0.055;
    heightMaterial.uniforms.uPrevious.value = heightRead.texture;
    renderer.setRenderTarget(heightWrite);
    renderer.render(heightScene, fullscreenCamera);
    const previous = heightRead;
    heightRead = heightWrite;
    heightWrite = previous;
    finalMaterial.uniforms.uHeightfield.value = heightRead.texture;
    pendingWater.length = 0;
  };

  const injectGlyphFeedback = (viewport: readonly [number, number]) => {
    feedbackFrame += 1;
    if (feedbackFrame % 2 !== 0) return;
    for (const body of bodies) {
      const speed = Math.hypot(body.velocity.x, body.velocity.z);
      const angularSpeed = body.angularVelocity.length();
      if (speed < 0.004 && angularSpeed < 0.025) continue;
      const screen = projectGlyph(body, camera, viewport);
      const x = screen.center.x / Math.max(viewport[0], 1);
      const y = 1 - screen.center.y / Math.max(viewport[1], 1);
      const directionLength = Math.max(speed, 0.001);
      pendingWater.push({
        position: [x, y],
        start: [x - body.velocity.x / directionLength * 0.008, y + body.velocity.z / directionLength * 0.008],
        end: [x, y],
        radius: Math.min(0.045, Math.max(0.012, Math.max(screen.halfSize.x / viewport[0], screen.halfSize.y / viewport[1]) * 0.46)),
        impulse: -Math.min(0.015, speed * 0.075 + angularSpeed * 0.003),
        direction: [body.velocity.x / directionLength, -body.velocity.z / directionLength],
        wake: Math.min(0.012, speed * 0.045 + angularSpeed * 0.002),
      });
      if (pendingWater.length >= MAX_SPLATS) break;
    }
  };

  const render = (now: number) => {
    if (disposed) return;
    const shouldRun = running && !document.hidden && !staticModeRef.current;
    if (!shouldRun) return;
    if (!heroVisible && now - lastFrameAt < 1000 / 30) {
      animationFrame = requestAnimationFrame(render);
      return;
    }
    const workStartedAt = performance.now();
    renderer.info.reset();
    const delta = Math.min(100, now - lastFrameAt);
    lastFrameAt = now;
    const time = (now - startedAt) / 1000;
    const absoluteTime = now / 1000;
    cameraTime = time;
    const staticFrame = reducedMotionRef.current;
    const waterSection = currentWaterSection();
    const waterThemeTarget = WATER_SECTION_THEME[waterSection];
    waterTheme += (waterThemeTarget - waterTheme) * (staticFrame ? 1 : 0.045);
    backdropMaterial.uniforms.uTheme.value = waterTheme;
    finalMaterial.uniforms.uTheme.value = waterTheme;
    canvas.dataset.waterSection = waterSection;
    backdropMaterial.uniforms.uTime.value = staticFrame ? 0.8 : time;
    backdropMaterial.uniforms.uMotion.value = staticFrame ? 0 : 1;
    if (glyphMaterial instanceof ShaderMaterial) glyphMaterial.uniforms.uTime.value = time;
    finalMaterial.uniforms.uTime.value = staticFrame ? 0.8 : time;
    // Controlled camera: ≤1.5° pointer parallax + a slow breathing bob.
    cameraPointerX += (cameraPointerXT - cameraPointerX) * 0.045;
    cameraPointerY += (cameraPointerYT - cameraPointerY) * 0.045;
    if (cameraRestValid) {
      applyCameraLife(camera, cameraRest, cameraPointerX, cameraPointerY, cameraTime, staticFrame);
      camera.updateMatrixWorld(true);
    }
    const rect = canvas.getBoundingClientRect();
    ingestPhysics();
    const pointerState = getPhysics().pointer;
    finalMaterial.uniforms.uPointer.value.set(
      Math.min(1, Math.max(0, (pointerState.x - rect.left) / Math.max(rect.width, 1))),
      1 - Math.min(1, Math.max(0, (pointerState.y - rect.top) / Math.max(rect.height, 1))),
    );
    finalMaterial.uniforms.uPointerVelocity.value.set(
      Math.max(-1, Math.min(1, pointerState.vx / Math.max(rect.width, 1) * 8)),
      Math.max(-1, Math.min(1, -pointerState.vy / Math.max(rect.height, 1) * 8)),
    );
    finalMaterial.uniforms.uPointerEnergy.value = pointerState.active
      ? Math.min(1.35, 0.62 + pointerState.energy * 0.9 + pointerState.speed * 0.16)
      : 0;
    for (let index = activeGlyphInteractions.length - 1; index >= 0; index -= 1) {
      if (absoluteTime - activeGlyphInteractions[index].time > 3.4) activeGlyphInteractions.splice(index, 1);
    }
    const fixed = accumulateFixedSteps(fixedAccumulator, delta / 1000, 1 / 120, 4);
    fixedAccumulator = fixed.accumulator;
    const viewport = [Math.max(rect.width, 1), Math.max(rect.height, 1)] as const;
    for (let step = 0; step < fixed.steps; step += 1) {
      if (!freezeWater) updateHeightfield(time + step / 120);
      if (bodies.length > 0 && !freezeGlyphs) {
        stepGlyphBodies(
          bodies,
          camera,
          viewport,
          activeGlyphInteractions,
          1 / 120,
          absoluteTime,
          reducedMotionRef.current,
        );
        injectGlyphFeedback(viewport);
      }
    }
    glyphDebug?.tick(now);
    const liveGlyphsVisible = heroVisible;
    for (const glyph of glyphs) glyph.object.visible = liveGlyphsVisible;
    const previousMask = camera.layers.mask;
    camera.layers.set(0);
    renderer.setRenderTarget(environmentTarget);
    renderer.setClearColor(0xdceef4, 1);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    camera.layers.mask = previousMask;
    renderDepth(backDepthTarget, BackSide);
    renderDepth(frontDepthTarget, FrontSide);
    renderer.setRenderTarget(sceneTarget);
    renderer.setClearColor(0xdceef4, 1);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(finalScene, fullscreenCamera);
    canvas.dataset.drawCalls = String(renderer.info.render.calls);
    canvas.dataset.triangles = String(renderer.info.render.triangles);
    canvas.dataset.textureMemoryEstimateMb = (
      (sceneTarget.width * sceneTarget.height * 8 * 4
        + simulationWidth * simulationHeight * 8 * 2) / (1024 * 1024)
    ).toFixed(1);
    workSamples.push(performance.now() - workStartedAt);
    frameCount += 1;
    if (frameCount % 30 === 0) canvas.dataset.frameCount = String(frameCount);
    if (frameCount % 6 === 0 && bodies.length > 0) {
      canvas.dataset.glyphMotion = JSON.stringify(bodies.map((body) => {
        const current = projectGlyph(body, camera, viewport);
        const restCenter = projectGlyphRestCenter(body, camera, viewport);
        return {
          i: body.glyph.manifest.glyph_index,
          c: body.glyph.manifest.character,
          dx: Number((current.center.x - restCenter.x).toFixed(2)),
          dy: Number((current.center.y - restCenter.y).toFixed(2)),
          depth: Number(body.position.y.toFixed(4)),
          rotation: Number((Math.max(
            Math.abs(body.orientation.x),
            Math.abs(body.orientation.y),
            Math.abs(body.orientation.z),
          ) * 180 / Math.PI).toFixed(2)),
          peakPx: Number(body.peakPixels.toFixed(2)),
          peakDeg: Number(body.peakDegrees.toFixed(2)),
          speed: Number(body.velocity.length().toFixed(4)),
          nearest: Number.isFinite(body.nearestInteraction) ? Number(body.nearestInteraction.toFixed(1)) : -1,
        };
      }));
    }

    if (!ready) {
      ready = true;
      canvas.dataset.glyphCount = String(glyphs.length);
      onReady();
    }
    if (delta > 0 && frameSamples.length < 240) frameSamples.push(delta);
    if (frameSamples.length === 240) {
      const p95 = percentile95(frameSamples);
      const average = frameSamples.reduce((sum, value) => sum + value, 0) / frameSamples.length;
      canvas.dataset.frameMsP95 = p95.toFixed(2);
      canvas.dataset.fps = (1000 / average).toFixed(1);
      canvas.dataset.workMsP95 = percentile95(workSamples).toFixed(2);
      workSamples.length = 0;
      frameSamples.length = 0;
      if (p95 > 17.3 && runtimeScale > 0.8) {
        runtimeScale = Math.max(0.8, runtimeScale - 0.1);
        canvas.dataset.adaptiveScale = runtimeScale.toFixed(2);
        resize();
      }
    }
    animationFrame = requestAnimationFrame(render);
  };

  const resume = () => {
    if (disposed || !running || document.hidden) return;
    cancelAnimationFrame(animationFrame);
    lastFrameAt = performance.now();
    animationFrame = requestAnimationFrame(render);
  };
  const onVisibilityChange = () => {
    if (document.hidden) cancelAnimationFrame(animationFrame);
    else resume();
  };
  const onContextLost = (event: Event) => {
    event.preventDefault();
    running = false;
    cancelAnimationFrame(animationFrame);
  };
  const onContextRestored = () => {
    if (!disposed) onRecover();
  };
  const resizeObserver = new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resize();
      resume();
    });
  });
  resizeObserver.observe(canvas.parentElement ?? canvas);
  const intersectionObserver = heroElement && "IntersectionObserver" in window
    ? new IntersectionObserver(([entry]) => {
        heroVisible = Boolean(entry?.isIntersecting);
        resume();
      }, { rootMargin: "180px 0px" })
    : null;
  if (heroElement) intersectionObserver?.observe(heroElement);
  document.addEventListener("visibilitychange", onVisibilityChange);
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);

  void Promise.all([
    loadOpticalMicrostructure(),
    renderHeroGlyphs ? loadGlyphs(scene, glyphMaterial, glbUrl) : Promise.resolve([]),
  ])
    .then(([loadedOptics, loadedGlyphs]) => {
      if (disposed) {
        loadedOptics.forEach((texture) => texture.dispose());
        const geometries = new Set(loadedGlyphs.map(({ object }) => object.geometry));
        loadedGlyphs.forEach(({ object }) => scene.remove(object));
        geometries.forEach((geometry) => geometry.dispose());
        return;
      }
      opticalMicrostructure = loadedOptics;
      backdropMaterial.uniforms.uOpticalShallowLandscape.value = opticalMicrostructure[0];
      backdropMaterial.uniforms.uOpticalShallowPortrait.value = opticalMicrostructure[1];
      backdropMaterial.uniforms.uOpticalMidDepth.value = opticalMicrostructure[2];
      backdropMaterial.uniforms.uOpticalDeepBasin.value = opticalMicrostructure[3];
  canvas.dataset.opticalSource = "authored-radiance-live-volume-v4";
      canvas.dataset.opticalMicrostructure = "authored-high-pass-v2";
      glyphs = loadedGlyphs;
      bodies = createGlyphBodies(glyphs);
      glyphDebug = installGlyphDebug({
        readSnapshots: () => {
          const rect = canvas.getBoundingClientRect();
          const viewport = [Math.max(rect.width, 1), Math.max(rect.height, 1)] as const;
          return bodies.map((body): GlyphDebugSnapshot => {
            const screen = projectGlyph(body, camera, viewport);
            const restCenter = projectGlyphRestCenter(body, camera, viewport);
            return {
              index: body.glyph.manifest.glyph_index,
              identity: `${body.glyph.manifest.character}:${body.glyph.manifest.object_node_name}`,
              restCenter: [restCenter.x, restCenter.y],
              currentCenter: [screen.center.x, screen.center.y],
              bounds: {
                left: screen.center.x - screen.halfSize.x,
                top: screen.center.y - screen.halfSize.y,
                right: screen.center.x + screen.halfSize.x,
                bottom: screen.center.y + screen.halfSize.y,
              },
              displacement: [screen.center.x - restCenter.x, screen.center.y - restCenter.y],
              velocity: [body.velocity.x, body.velocity.z],
              orientation: [body.orientation.x, body.orientation.y, body.orientation.z],
              angularVelocity: [body.angularVelocity.x, body.angularVelocity.y, body.angularVelocity.z],
              currentForce: [body.currentForce.x, body.currentForce.y, body.currentForce.z],
              currentTorque: [body.currentTorque.x, body.currentTorque.y, body.currentTorque.z],
              nearestInteractionDistance: Number.isFinite(body.nearestInteraction) ? body.nearestInteraction : -1,
              peakDisplacement: body.peakPixels,
              peakRotationDegrees: body.peakDegrees,
              settlingTime: body.lastActiveAt > 0
                && body.velocity.length() < 0.004
                && body.angularVelocity.length() < 0.02
                ? Math.max(0, performance.now() / 1000 - body.lastActiveAt)
                : 0,
              latestImpact: null,
            };
          });
        },
        applyImpulse: (request) => {
          const first = bodies[request.kind === "glyph" ? request.glyphIndex : request.firstGlyphIndex];
          const second = request.kind === "between" ? bodies[request.secondGlyphIndex] : null;
          if (!first) return;
          const rect = canvas.getBoundingClientRect();
          const viewport = [Math.max(rect.width, 1), Math.max(rect.height, 1)] as const;
          const firstScreen = projectGlyph(first, camera, viewport);
          const secondScreen = second ? projectGlyph(second, camera, viewport) : null;
          let x = secondScreen ? (firstScreen.center.x + secondScreen.center.x) * 0.5 : firstScreen.center.x;
          const y = secondScreen ? (firstScreen.center.y + secondScreen.center.y) * 0.5 : firstScreen.center.y;
          if (request.kind === "glyph" && request.anchor !== "center") {
            x += (request.anchor === "left-edge" ? -1 : 1) * firstScreen.halfSize.x * 0.82;
          }
          const nowSeconds = performance.now() / 1000;
          activeGlyphInteractions.push({
            kind: "press",
            start: [x, y],
            end: [x, y],
            direction: [0, -1],
            strength: request.strength,
            radius: 42,
            time: nowSeconds,
          });
          applySplat({
            position: [x / viewport[0], 1 - y / viewport[1]],
            radius: 42 / viewport[1],
            impulse: -request.strength * 0.42,
          });
        },
        setFreezeWater: (frozen) => { freezeWater = frozen; },
        setFreezeGlyphs: (frozen) => { freezeGlyphs = frozen; },
        setView: (view) => {
          finalMaterial.uniforms.uDebugView.value = {
            scene: 0,
            solver: 1,
            "front-depth": 2,
            "back-depth": 3,
            thickness: 4,
          }[view];
        },
        reset: () => {
          activeGlyphInteractions.length = 0;
          pendingWater.length = 0;
          for (const body of bodies) {
            body.position.set(0, 0, 0);
            body.velocity.set(0, 0, 0);
            body.orientation.set(0, 0, 0);
            body.angularVelocity.set(0, 0, 0);
            body.glyph.object.position.copy(body.restPosition);
            body.glyph.object.quaternion.copy(body.restQuaternion);
            body.peakPixels = 0;
            body.peakDegrees = 0;
          }
          renderer.setRenderTarget(heightRead);
          renderer.setClearColor(0x000000, 1);
          renderer.clear(true, false, false);
          renderer.setRenderTarget(heightWrite);
          renderer.clear(true, false, false);
          renderer.setRenderTarget(null);
          finalMaterial.uniforms.uDebugView.value = 0;
        },
      });
      resize();
      resume();
    })
    .catch((error) => {
      if (!disposed) {
        running = false;
        cancelAnimationFrame(animationFrame);
        onFailure(error);
      }
    });

  resize();

  return () => {
    disposed = true;
    running = false;
    cancelAnimationFrame(animationFrame);
    cancelAnimationFrame(resizeFrame);
    resizeObserver.disconnect();
    intersectionObserver?.disconnect();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    canvas.removeEventListener("webglcontextrestored", onContextRestored);
    delete (canvas as HTMLCanvasElement & { heroHeightfield?: unknown }).heroHeightfield;
    if (window.__underwaterDebug) delete window.__underwaterDebug;
    glyphDebug?.remove();
    const glyphGeometries = new Set(glyphs.map(({ object }) => object.geometry));
    glyphs.forEach(({ object }) => scene.remove(object));
    glyphGeometries.forEach((geometry) => geometry.dispose());
    glyphMaterial.dispose();
    opticalMicrostructure.forEach((texture) => texture.dispose());
    disposeObject(scene);
    sceneTarget.dispose();
    environmentTarget.dispose();
    frontDepthTarget.dispose();
    backDepthTarget.dispose();
    heightRead.dispose();
    heightWrite.dispose();
    fullscreenGeometry.dispose();
    heightMaterial.dispose();
    finalMaterial.dispose();
    depthMaterial.dispose();
    renderer.renderLists.dispose();
    renderer.dispose();
  };
}
