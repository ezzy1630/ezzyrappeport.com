"use client";

import {
  BackSide,
  Color,
  DepthTexture,
  DirectionalLight,
  DoubleSide,
  FrontSide,
  Group,
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
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { subscribeFrameClock, unsubscribeFrameClock } from "@/lib/portfolio/frame-clock";
import { getDeviceTilt } from "@/lib/portfolio/device-tilt";
import { scrollWakeStrength } from "@/lib/portfolio/liquid-interaction";
import type {
  LiquidInteractionEvent,
  LiquidPhysics,
  LiquidRippleState,
} from "@/lib/portfolio/liquid-interaction";
import { installGlyphDebug, type GlyphDebugSnapshot } from "../../debug/glyphDebug";
import { accumulateFixedSteps } from "../../physics/fixedStep";
import {
  createGlyphBodies,
  glyphHoverStrength,
  nearestGlyphIndex,
  projectGlyph,
  projectGlyphRestCenter,
  stepGlyphBodies,
  type GlyphStepControl,
  type GlyphBody,
  type GlyphInteraction,
} from "../../physics/glyphRigidBodies";
import {
  createGlyphInteractionState,
  scheduleGlyphReleaseDroplets,
  settleCancelledGlyph,
  transitionGlyphInteraction,
  type GlyphInteractionEvent,
} from "../../interaction/glyphInteractionState";
import { clientToWaterUv } from "../../physics/waterCoordinates";
import type { KineticQuality } from "../quality";
import {
  HERO_GLB_URL,
  HERO_MANIFEST_URL,
  UNDERWATER_DEBUG,
  MAX_DESKTOP_RENDER_DPR,
  WATER_PLATE_URLS,
  exposureForDepth,
} from "./config";
import {
  CAMERA_RIG,
  breachExposureBoost,
  captureCameraRestPose,
  applyCameraRig,
  introDurationForVisit,
  introProgressAt,
  staggeredGlyphExit,
  type CameraRestPose,
} from "./cameraRig";
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
  /** 0..1 anisotropic elongation; < -0.5 = annular ring (wake holds ring radius). */
  eccentricity?: number;
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
      shockwave: (point: [number, number], strength?: number) => void;
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

function smoothstep01(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

/**
 * Continuous authored-plate coordinate for the backdrop: 0 = shallow plate,
 * 1 = mid-depth plate, 2 = deep-basin plate. Crossfade windows sit around
 * depth 0.26 and 0.74 so a scroll-driven descent never pops textures.
 */
function plateForDepth(depth: number) {
  if (depth < 0.18) return 0;
  if (depth < 0.34) return (depth - 0.18) / 0.16;
  if (depth < 0.66) return 1;
  if (depth < 0.82) return 1 + (depth - 0.66) / 0.16;
  return 2;
}

/** Hero glyphs become a memory during early descent -  not a watermark
    behind projects. Exit starts near the surface and completes by the
    shallow projects band (~depth 0.08). */
const GLYPH_EXIT_START_DEPTH = 0.018;
const GLYPH_EXIT_SPAN = 0.062;

function glyphExitForDepth(depth: number) {
  return smoothstep01((depth - GLYPH_EXIT_START_DEPTH) / GLYPH_EXIT_SPAN);
}

/** Optical dissolve leads the rise: letters thin into water early. */
function glyphFadeForExit(exit: number) {
  return smoothstep01(exit / 0.62);
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
const MAX_SCHEDULED_WATER_EVENTS = 48;
const FIRST_LOAD_BREACH_KEY = "dive-upgrade.hero-breach.v1";

type ScheduledWaterEvent = Readonly<{
  dueAt: number;
  position: [number, number];
  radius: number;
  impulse: number;
  direction?: [number, number];
  wake?: number;
  eccentricity?: number;
}>;

function createRenderTarget(width = 1, height = 1, withDepth = false, samples = 0) {
  const target = new WebGLRenderTarget(width, height, {
    type: HalfFloatType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: true,
    samples: samples > 0 ? samples : undefined,
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
      uExitFade: { value: 0 },
      uLetterEnergy: { value: 0 },
    },
    side: FrontSide,
    depthWrite: true,
    depthTest: true,
  });
}

function applyManifestTransform(
  object: Object3D,
  glyph: HeroGlyphManifestEntry,
  renderScale?: readonly [number, number, number],
) {
  object.position.fromArray(glyph.rest_transform.translation);
  // Keep the manifest as the source of identity and local transforms, then
  // tighten the two authored lines into one optical title block.
  object.position.z += glyph.line_index === 0 ? 0.28 : -0.16;
  object.quaternion.fromArray(glyph.rest_transform.rotation_xyzw);
  // Meshopt/KHR_mesh_quantization rebakes node scales. Prefer the loaded GLB
  // node scale for rendering so quantized local geometry stays world-correct.
  // Physics keeps using manifest.scale × manifest.local_bounding_box.
  const scale = renderScale ?? glyph.rest_transform.scale;
  object.scale.fromArray(scale);
  object.userData.glyphIndex = glyph.glyph_index;
  object.userData.glyphCharacter = glyph.character;
  object.userData.lineIndex = glyph.line_index;
  object.userData.physicsIdentity = glyph.object_node_name;
  object.userData.pivot = glyph.pivot.local;
  object.userData.localBounds = glyph.local_bounding_box;
  object.userData.sharedGeometry = glyph.shared_geometry_identifier;
  object.userData.renderScale = [scale[0], scale[1], scale[2]] as [number, number, number];
}

async function loadGlyphs(parent: Object3D, material: Material, glbUrl: string) {
  const loader = new GLTFLoader();
  await MeshoptDecoder.ready;
  loader.setMeshoptDecoder(MeshoptDecoder);
  const [manifestResponse, gltf] = await Promise.all([
    fetch(HERO_MANIFEST_URL, { cache: "force-cache" }),
    loader.loadAsync(glbUrl),
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
      // Quantized meshopt positions + computeVertexNormals() zeros many normals.
      // Keep authored NORMAL when present.
      if (!authoredGeometry.getAttribute("normal")) {
        authoredGeometry.computeVertexNormals();
      }
      glyphGeometries.set(geometryKey, authoredGeometry);
      glyphGeometry = authoredGeometry;
    }
    const object = new Mesh(glyphGeometry, material);
    object.name = glyph.object_node_name;
    const renderScale: [number, number, number] = [
      source.scale.x,
      source.scale.y,
      source.scale.z,
    ];
    applyManifestTransform(object, glyph, renderScale);
    object.layers.set(GLYPH_LAYER);
    // Thickness ShaderMaterial ignores scene lights/shadows; physical debug enables them below.
    object.castShadow = false;
    object.receiveShadow = false;
    parent.add(object);
    glyphs.push({ manifest: glyph, object });
  }

  // The runtime meshes own cloned geometry; the loader scene is no longer used.
  disposeObject(gltf.scene);
  return glyphs;
}

function configureCamera(camera: PerspectiveCamera, width: number, height: number, debug = false) {
  const aspect = Math.max(width / Math.max(height, 1), 0.2);
  const verticalFov = CAMERA_RIG.baseFov * Math.PI / 180;
  const distanceForWidth = 2.44 / (Math.tan(verticalFov * 0.5) * aspect);
  // The reference composition lets the second line span roughly 84% of a
  // 16:9 viewport. Keep that framing in camera space so the live GLB and the
  // DOM fallback occupy the same visual volume instead of crossfading between
  // two differently scaled titles.
  const wideDistance = aspect > 1.25 ? 3.85 : aspect > 0.82 ? 4.8 : 5.6;
  const distance = Math.max(wideDistance, distanceForWidth * (aspect < 0.7 ? 0.96 : 0.88));
  const targetZ = aspect < 0.7 ? 0.24 : 0.08;
  camera.fov = CAMERA_RIG.baseFov;
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

function percentile(values: number[], fraction: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

const FRAME_BUDGET_MS = 14.5;
const ADAPTIVE_SLOW_WINDOWS = 2;
const MIN_RUNTIME_SCALE = 0.68;

/**
 * Production render graph
 * -----------------------
 * 1. Render the authored optical backdrop into `environmentTarget` once
 *    per presented frame via an ortho NDC pass (not the perspective hero camera).
 * 2. Render GLB glyph back depth, then front depth, using the same camera.
 * 3. Paint the optical plate into `sceneTarget`, clear depth only, then shade
 *    glyphs (thickness refraction) without wiping the plate color.
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
    // MSAA on the canvas path plus multisampled scene targets below.
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
  // Shadow maps stay off for the production thickness path; physical debug opts in later.
  renderer.shadowMap.enabled = false;
  renderer.setClearColor(0xdceef4, 1);
  canvas.dataset.renderer = "three-webgl2-underwater";
  canvas.dataset.renderGraph = "environment>copy>glyph-depth>glyph-transmission>surface>underwater-filmic";
  canvas.dataset.toneMapper = "underwater shallow shoulder";

  const scene = new Scene();
  // Backdrop lives in `backdropScene`. A Color background here would force-clear
  // sceneTarget on the glyph pass and wipe the optical plate (even with autoClear off).
  scene.background = null;
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
      uTheme: { value: 0 },
      uCalm: { value: 0 },
      uPlate: { value: 0 },
      uQualityTier: { value: quality.tier === "high" ? 2 : quality.tier === "balanced" ? 1 : 0 },
      uMotion: { value: 1 },
      uDebugUv: { value: process.env.NODE_ENV !== "production" && debugSearch.get("heroEnvironment") === "uv" ? 1 : 0 },
    },
    side: DoubleSide,
    depthTest: false,
    depthWrite: false,
  });
  // NDC fullscreen plate — must use the ortho camera, never the perspective
  // hero camera (frustum culling + matrix path would drop or wash the optical field).
  const backdrop = new Mesh(new PlaneGeometry(2, 2, 1, 1), backdropMaterial);
  backdrop.frustumCulled = false;
  backdrop.renderOrder = -100;
  const backdropScene = new Scene();
  backdropScene.add(backdrop);

  const keyPosition = new Vector3(-2.2, 2.8, -3.2);
  const fillPosition = new Vector3(2.5, 1.8, 2.4);

  // No MSAA on these targets: HalfFloat + depthTexture multisample resolve
  // produces black speck artifacts on the glass glyphs. Sharpness comes from
  // higher DPR + adaptive scale instead.
  const sceneTarget = createRenderTarget(1, 1, true, 0);
  const environmentTarget = createRenderTarget(1, 1, true, 0);
  const frontDepthTarget = createRenderTarget();
  const backDepthTarget = createRenderTarget();
  const usePhysicalMaterial = process.env.NODE_ENV !== "production"
    && new URLSearchParams(window.location.search).get("glyphMaterial") === "physical";
  if (usePhysicalMaterial) {
    const key = new RectAreaLight(0xf5fbff, UNDERWATER_DEBUG.keyIntensity, 4.8, 2.6);
    key.position.copy(keyPosition);
    key.lookAt(new Vector3(0, 0, 0));
    scene.add(key);
    const fill = new RectAreaLight(0xc9dce7, UNDERWATER_DEBUG.fillIntensity, 5.5, 4.0);
    fill.position.copy(fillPosition);
    fill.lookAt(new Vector3(0, 0, 0));
    scene.add(fill);
    const rim = new DirectionalLight(0xeaf6fb, UNDERWATER_DEBUG.environmentIntensity);
    rim.position.set(1.2, 3.5, -4.0);
    rim.castShadow = quality.tier !== "low";
    rim.shadow.mapSize.set(quality.tier === "high" ? 1024 : 512, quality.tier === "high" ? 1024 : 512);
    rim.shadow.camera.near = 0.1;
    rim.shadow.camera.far = 12;
    scene.add(rim);
    renderer.shadowMap.enabled = quality.tier !== "low";
  }
  const glyphMaterial = usePhysicalMaterial
    ? makePhysicalGlyphMaterial()
    : makeThicknessGlyphMaterial(
        environmentTarget.texture,
        frontDepthTarget.texture,
        backDepthTarget.texture,
      );
  if (glyphMaterial instanceof ShaderMaterial) {
    glyphMaterial.uniforms.uKeyPosition.value.copy(keyPosition);
    glyphMaterial.uniforms.uKeyColor.value.set(0xf5fbff);
    glyphMaterial.uniforms.uKeyIntensity.value = UNDERWATER_DEBUG.keyIntensity;
    glyphMaterial.uniforms.uFillPosition.value.copy(fillPosition);
    glyphMaterial.uniforms.uFillColor.value.set(0xc9dce7);
    glyphMaterial.uniforms.uFillIntensity.value = UNDERWATER_DEBUG.fillIntensity;
    glyphMaterial.uniforms.uRefractionTaps.value = quality.tier === "high" ? 3 : quality.tier === "balanced" ? 2 : 1;
  }
  canvas.dataset.glyphMaterial = usePhysicalMaterial ? "physical-baseline" : "thickness-refraction";
  const tierSimulationWidth = quality.simWidth > 0
    ? quality.simWidth
    : quality.tier === "high"
      ? 256
      : quality.tier === "balanced"
        ? 192
        : 112;
  // Phone CSS widths stay on the low-tier grid; never inflate past the profile.
  let simulationWidth = Math.min(
    tierSimulationWidth,
    window.innerWidth < 640 ? Math.max(96, Math.min(112, tierSimulationWidth)) : window.innerWidth < 1200 ? 192 : 256,
  );
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
      uTheme: { value: 0 },
      uCalm: { value: 0 },
      uGlyphPresence: { value: 1 },
      uPointer: { value: new Vector2(0.62, 0.46) },
      uPointerVelocity: { value: new Vector2() },
      uPointerEnergy: { value: 0 },
      uShockwave: { value: new Vector4(0.5, 0.5, 99, 0) },
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
  const renderClockId = `underwater-hero:${Math.random().toString(36).slice(2, 9)}`;
  let clockSubscribed = false;
  let resizeFrame = 0;
  let lastFrameAt = performance.now();
  const startedAt = lastFrameAt;
  let glyphs: HeroGlyphRuntime[] = [];
  let bodies: GlyphBody[] = [];
  let opticalMicrostructure: Texture[] = [];
  let lastInteractionId = 0;
  const pendingWater: WaterInjection[] = [];
  const activeGlyphInteractions: GlyphInteraction[] = [];
  // Authored camera rig: intro dolly + depth tip + secondary pointer parallax.
  let cameraPointerX = 0;
  let cameraPointerY = 0;
  let cameraPointerXT = 0;
  let cameraPointerYT = 0;
  // Soft-lagged fingertip for the visual pressure dome — water inertia, not
  // a plastic film locked to the OS cursor.
  let waterPointerU = 0.62;
  let waterPointerV = 0.46;
  let waterPointerEnergy = 0;
  let waterPointerVx = 0;
  let waterPointerVy = 0;
  let cameraTime = 0;
  const cameraRest: CameraRestPose = {
    position: new Vector3(),
    quaternion: new Quaternion(),
    fov: CAMERA_RIG.baseFov,
  };
  let cameraRestValid = false;
  let shortenedEntrance = false;
  let introDuration: number = CAMERA_RIG.introDurationFirst;
  let fixedAccumulator = 0;
  let feedbackFrame = 0;
  let glyphDebug: ReturnType<typeof installGlyphDebug> = null;
  let freezeWater = false;
  let freezeGlyphs = false;
  const scheduledWater: ScheduledWaterEvent[] = [];
  const seenRipples = new WeakSet<LiquidRippleState>();
  let interactionTransition = createGlyphInteractionState(!reducedMotionRef.current && !staticModeRef.current);
  let lastHoldChurnAt = Number.NEGATIVE_INFINITY;
  let lastPresentedAt = 0;
  let lastOffHero = false;
  let lastScrollWakeAt = Number.NEGATIVE_INFINITY;
  let scrollChop = 0;
  /** Active composite shockwave: center uv + birth time + strength. */
  let shockwaveCenter: [number, number] = [0.5, 0.5];
  let shockwaveBornAt = Number.NEGATIVE_INFINITY;
  let shockwaveStrength = 0;
  const pointerPoint: [number, number] = [0, 0];
  const holdPoint: [number, number] = [0, 0];
  // Cached canvas CSS box — invalidate on resize / scroll / visualViewport, never in rAF.
  const canvasRect = { left: 0, top: 0, width: 1, height: 1, right: 1, bottom: 1 };
  const refreshCanvasRect = () => {
    const measured = canvas.getBoundingClientRect();
    canvasRect.left = measured.left;
    canvasRect.top = measured.top;
    canvasRect.width = Math.max(measured.width, 1);
    canvasRect.height = Math.max(measured.height, 1);
    canvasRect.right = measured.right;
    canvasRect.bottom = measured.bottom;
  };
  // Probe metrics: development, ?heroMetrics=1, or automated browsers (puppeteer sets webdriver).
  const heroMetricsEnabled = process.env.NODE_ENV !== "production"
    || debugSearch.get("heroMetrics") === "1"
    || (typeof navigator !== "undefined" && navigator.webdriver === true);
  let offHeroSimDebt = 0;
  const OFF_HERO_MAX_CATCHUP_STEPS = 3;
  const stepControl: GlyphStepControl = {
    ambientScale: 1,
    hoverGlyphIndex: -1,
    hoverStrength: 0,
    hoverPoint: pointerPoint,
    holdGlyphIndex: -1,
    holdPoint,
    holdAge: 0,
    entranceStart: Number.POSITIVE_INFINITY,
    entranceDepth: -0.055,
    entranceStagger: 0.032,
  };
  let entranceStart = Number.POSITIVE_INFINITY;
  let runtimeScale = quality.renderScale;
  let slowFrameWindows = 0;
  let adaptiveDowngrades = 0;
  let frameCount = 0;
  // The one world: continuous depth/calm sampled from the shared physics
  // state and exponentially smoothed per frame for a lag-free but weighty
  // descent. Glyph exit rides the same curve.
  let worldDepth = 0;
  let worldCalm = 0;
  let glyphExit = 0;
  const frameSamples: number[] = [];
  const workSamples: number[] = [];
  let frameStallWorst = 0;
  const glyphGroup = new Group();
  glyphGroup.name = "hero-glyph-volume";
  scene.add(glyphGroup);

  const applySplat = (splat: HeightfieldSplat) => {
    pendingWater.push({
      ...splat,
      start: splat.position,
      end: splat.position,
      wake: 0,
    });
    if (pendingWater.length > MAX_SPLATS) pendingWater.shift();
  };

  const scheduleWater = (event: ScheduledWaterEvent) => {
    scheduledWater.push(event);
    scheduledWater.sort((first, second) => first.dueAt - second.dueAt);
    if (scheduledWater.length > MAX_SCHEDULED_WATER_EVENTS) scheduledWater.shift();
  };

  const flushScheduledWater = (now: number) => {
    while (scheduledWater.length > 0 && scheduledWater[0].dueAt <= now) {
      const event = scheduledWater.shift();
      if (!event) break;
      pendingWater.push({
        position: event.position,
        start: event.position,
        end: event.position,
        radius: event.radius,
        impulse: event.impulse,
        direction: event.direction,
        wake: event.wake ?? 0,
        eccentricity: event.eccentricity,
      });
    }
    if (pendingWater.length > MAX_SPLATS) pendingWater.splice(0, pendingWater.length - MAX_SPLATS);
  };

  const bodyForIndex = (glyphIndex: number) => bodies.find(
    (body) => body.glyph.manifest.glyph_index === glyphIndex,
  );

  const previousBodyCursor = document.body.style.cursor;
  const setBodyCursor = (cursor: "pointer" | null) => {
    if (cursor === null) {
      if (previousBodyCursor) document.body.style.cursor = previousBodyCursor;
      else document.body.style.removeProperty("cursor");
      return;
    }
    document.body.style.cursor = cursor;
  };

  const syncInteractionDataset = () => {
    canvas.dataset.glyphInteraction = interactionTransition.state.kind;
    // Native cursor only -  never grab/grabbing. Hold is a press into water,
    // not a drag gesture.
    if (interactionTransition.state.kind === "hovering") setBodyCursor("pointer");
    else setBodyCursor(null);
  };

  const beginRelease = (glyphIndex: number, now: number) => {
    const body = bodyForIndex(glyphIndex);
    if (!body) return;
    if (heroMetricsEnabled) canvas.dataset.lastReleaseAt = now.toFixed(3);
    const viewport = [canvasRect.width, canvasRect.height] as const;
    const screen = projectGlyph(body, camera, viewport);
    const x = screen.center.x;
    const y = screen.center.y;
    const uv: [number, number] = [x / viewport[0], 1 - y / viewport[1]];
    const pointer = getPhysics().pointer;
    const speed = Math.hypot(pointer.vx, pointer.vy);
    const inherit = speed > 12
      ? [pointer.vx / speed, pointer.vy / speed] as const
      : [0, -1] as const;
    // Release inherits pointer velocity into the letter fling.
    body.velocity.x += inherit[0] * Math.min(0.55, speed / 900);
    body.velocity.z += inherit[1] * Math.min(0.55, speed / 900);
    body.velocity.y += 0.12 + Math.min(0.22, speed / 1400);
    activeGlyphInteractions.push({
      kind: "release",
      start: [x, y],
      end: [x, y],
      direction: [inherit[0], inherit[1]],
      strength: 0.96 + Math.min(0.35, speed / 1200),
      radius: Math.max(58, Math.min(112, Math.hypot(screen.halfSize.x, screen.halfSize.y) * 1.35)),
      time: now,
    });
    applySplat({
      position: uv,
      radius: Math.min(0.18, Math.max(0.06, Math.hypot(screen.halfSize.x, screen.halfSize.y) / viewport[1] * 2.0)),
      impulse: -0.078,
      direction: [inherit[0], -inherit[1]],
    });
    pendingWater.push({
      position: uv,
      start: uv,
      end: [uv[0] + inherit[0] * 0.04, uv[1] - inherit[1] * 0.04],
      radius: 0.09,
      impulse: -0.04,
      direction: [inherit[0], -inherit[1]],
      wake: 0.085,
    });
    const droplets = scheduleGlyphReleaseDroplets(now);
    for (let index = 0; index < droplets.length; index += 1) {
      const droplet = droplets[index];
      const { offsetX, offsetY } = droplet;
      scheduleWater({
        dueAt: droplet.dueAt,
        position: [
          Math.max(0.02, Math.min(0.98, uv[0] + offsetX * screen.halfSize.x / viewport[0])),
          Math.max(0.02, Math.min(0.98, uv[1] - offsetY * screen.halfSize.y / viewport[1])),
        ],
        radius: 0.014 + (index % 2) * 0.004,
        impulse: -0.025 + (index % 2) * 0.006,
        wake: 0.012,
      });
    }
  };

  const dispatchGlyphInteraction = (event: GlyphInteractionEvent) => {
    interactionTransition = transitionGlyphInteraction(interactionTransition, event);
    syncInteractionDataset();
  };

  const isForegroundTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest(
      "a,button,input,textarea,select,option,[contenteditable=\"true\"],[role=\"button\"]",
    ));
  };

  const pointerCanOwnGlyph = (event: PointerEvent) => !reducedMotionRef.current
    && !staticModeRef.current
    && renderHeroGlyphs
    && !document.hidden
    && (event.button === 0 || event.type === "pointermove" || event.pointerType === "touch")
    && !isForegroundTarget(event.target);

  const updateGlyphHover = (physics: LiquidPhysics, rect: { left: number; top: number }) => {
    pointerPoint[0] = physics.pointer.x - rect.left;
    pointerPoint[1] = physics.pointer.y - rect.top;
    const eligible = physics.pointer.present
      && physics.pointer.pointerType !== "touch"
      && !reducedMotionRef.current
      && !staticModeRef.current;
    const glyphIndex = eligible ? nearestGlyphIndex(bodies, pointerPoint) : -1;
    if (interactionTransition.state.kind !== "holding" && interactionTransition.state.kind !== "releasing") {
      const nextGlyph = glyphIndex >= 0 ? glyphIndex : null;
      const currentGlyph = interactionTransition.state.kind === "hovering"
        ? interactionTransition.state.glyphIndex
        : null;
      if (nextGlyph !== currentGlyph) dispatchGlyphInteraction({ type: "hover", glyphIndex: nextGlyph });
    }
    if (interactionTransition.state.kind === "holding") {
      holdPoint[0] = pointerPoint[0];
      holdPoint[1] = pointerPoint[1];
      stepControl.holdAge = Math.max(0, physics.time - interactionTransition.state.startedAt);
    }
    stepControl.hoverGlyphIndex = interactionTransition.state.kind === "hovering"
      ? interactionTransition.state.glyphIndex
      : -1;
    const hoveredBody = stepControl.hoverGlyphIndex >= 0 ? bodyForIndex(stepControl.hoverGlyphIndex) : null;
    stepControl.hoverStrength = hoveredBody ? glyphHoverStrength(hoveredBody, pointerPoint) : 0;
    stepControl.holdGlyphIndex = interactionTransition.state.kind === "holding"
      ? interactionTransition.state.glyphIndex
      : -1;
    stepControl.ambientScale = 1 - Math.min(0.42, Math.abs(physics.scroll.velocity) * 0.25);
    syncInteractionDataset();
  };

  const onGlyphPointerDown = (event: PointerEvent) => {
    if (!pointerCanOwnGlyph(event) || bodies.length === 0) return;
    pointerPoint[0] = event.clientX - canvasRect.left;
    pointerPoint[1] = event.clientY - canvasRect.top;
    const glyphIndex = nearestGlyphIndex(bodies, pointerPoint);
    if (glyphIndex < 0) return;
    // Press into water -  not a browser drag. Kill default drag ghost / text select.
    event.preventDefault();
    holdPoint[0] = pointerPoint[0];
    holdPoint[1] = pointerPoint[1];
    dispatchGlyphInteraction({
      type: "pointer-down",
      glyphIndex,
      pointerId: event.pointerId,
      pressPoint: holdPoint,
      now: performance.now() / 1000,
    });
  };

  const onCanvasDragStart = (event: DragEvent) => {
    event.preventDefault();
  };

  const onGlyphPointerMove = (event: PointerEvent) => {
    if (!pointerCanOwnGlyph(event) || bodies.length === 0) return;
    const state = interactionTransition.state;
    if (state.kind !== "holding" || state.pointerId !== event.pointerId) return;
    holdPoint[0] = event.clientX - canvasRect.left;
    holdPoint[1] = event.clientY - canvasRect.top;
  };

  const cancelGlyphPointer = (
    pointerId: number,
    reason: "pointer-cancel" | "lost-capture" | "blur" | "hidden" | "teardown",
  ) => {
    const state = interactionTransition.state;
    if (state.kind !== "holding" || state.pointerId !== pointerId) return;
    dispatchGlyphInteraction({ type: "cancel", pointerId, now: performance.now() / 1000, reason });
    interactionTransition = settleCancelledGlyph(interactionTransition, -1);
    stepControl.holdGlyphIndex = -1;
    syncInteractionDataset();
  };

  const onGlyphPointerUp = (event: PointerEvent) => {
    const state = interactionTransition.state;
    if (state.kind !== "holding" || state.pointerId !== event.pointerId) return;
    const now = performance.now() / 1000;
    interactionTransition = transitionGlyphInteraction(interactionTransition, {
      type: "pointer-up",
      pointerId: event.pointerId,
      now,
    });
    if (interactionTransition.state.kind === "releasing") beginRelease(state.glyphIndex, now);
    syncInteractionDataset();
  };

  const onGlyphPointerCancel = (event: PointerEvent) => {
    cancelGlyphPointer(event.pointerId, "pointer-cancel");
  };

  const onGlyphLostCapture = (event: Event) => {
    const pointerId = (event as PointerEvent).pointerId;
    cancelGlyphPointer(pointerId, "lost-capture");
  };

  const onGlyphBlur = () => {
    const state = interactionTransition.state;
    if (state.kind === "holding") cancelGlyphPointer(state.pointerId, "blur");
  };

  // passive:false so glyph presses can cancel the browser drag affordance.
  window.addEventListener("pointerdown", onGlyphPointerDown, { capture: true, passive: false });
  window.addEventListener("pointermove", onGlyphPointerMove, { capture: true, passive: true });
  window.addEventListener("pointerup", onGlyphPointerUp, { capture: true, passive: true });
  window.addEventListener("pointercancel", onGlyphPointerCancel, { capture: true, passive: true });
  window.addEventListener("lostpointercapture", onGlyphLostCapture, { capture: true, passive: true });
  window.addEventListener("blur", onGlyphBlur);
  canvas.addEventListener("dragstart", onCanvasDragStart);
  (canvas as HTMLCanvasElement & { heroHeightfield?: { splat: (value: HeightfieldSplat) => void } })
    .heroHeightfield = { splat: applySplat };

  const resize = () => {
    if (disposed) return;
    refreshCanvasRect();
    const width = Math.max(1, canvas.parentElement?.clientWidth ?? window.innerWidth);
    const height = Math.max(1, canvas.parentElement?.clientHeight ?? window.innerHeight);
    const dpr = Math.min(quality.dpr, quality.maxDpr, MAX_DESKTOP_RENDER_DPR);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    backdropMaterial.uniforms.uAspect.value = width / Math.max(height, 1);
    backdropMaterial.uniforms.uPortrait.value = width / Math.max(height, 1) < 0.76 ? 1 : 0;
    const renderWidth = Math.max(1, Math.floor(width * dpr * runtimeScale));
    const renderHeight = Math.max(1, Math.floor(height * dpr * runtimeScale));
    canvas.dataset.adaptiveScale = runtimeScale.toFixed(2);
    canvas.dataset.adaptiveDowngrades = String(adaptiveDowngrades);
    sceneTarget.setSize(renderWidth, renderHeight);
    environmentTarget.setSize(renderWidth, renderHeight);
    // Half-res glyph depth on non-high (and after adaptive pressure): thickness
    // refraction stays readable; fill-rate drops on large desktop canvases.
    const depthScale = quality.tier === "high" && runtimeScale >= 0.95 ? 1 : 0.5;
    const depthWidth = Math.max(1, Math.floor(renderWidth * depthScale));
    const depthHeight = Math.max(1, Math.floor(renderHeight * depthScale));
    frontDepthTarget.setSize(depthWidth, depthHeight);
    backDepthTarget.setSize(depthWidth, depthHeight);
    canvas.dataset.depthScale = depthScale.toFixed(2);
    configureCamera(camera, width, height, debugCamera);
    const portrait = width / Math.max(height, 1) < 0.7;
    bodies.forEach((body) => {
      const renderScale = (body.glyph.object.userData.renderScale as [number, number, number] | undefined)
        ?? body.glyph.manifest.rest_transform.scale;
      body.glyph.object.scale.fromArray(renderScale);
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
    captureCameraRestPose(camera, cameraRest);
    cameraRestValid = true;
    canvas.dataset.renderSize = `${renderWidth}x${renderHeight}`;
    canvas.dataset.simulationSize = `${simulationWidth}x${simulationHeight}`;
    canvas.dataset.simulationStep = "0.008333";
    canvas.dataset.opticalTier = quality.tier;
    canvas.dataset.refractionTaps = String(quality.tier === "high" ? 3 : quality.tier === "balanced" ? 2 : 1);
    canvas.dataset.glyphCount = String(glyphs.length);
  };

  const renderDepth = (target: WebGLRenderTarget, side: typeof FrontSide | typeof BackSide) => {
    renderer.resetState();
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
    if (reducedMotionRef.current || staticModeRef.current) return;
    const rect = canvasRect;
    const startUv = clientToWaterUv({ x: event.startX, y: event.startY }, rect);
    const endUv = clientToWaterUv({ x: event.endX, y: event.endY }, rect);
    const speed = Math.hypot(event.vx, event.vy);
    const directionLength = Math.max(speed, 1);
    const dirX = event.vx / directionLength;
    const dirY = -event.vy / directionLength;
    const lowTier = quality.tier === "low";
    const nowSeconds = performance.now() / 1000;

    if (event.kind === "shockwave") {
      const strength = event.strength;
      shockwaveCenter = [endUv.x, endUv.y];
      shockwaveBornAt = nowSeconds;
      shockwaveStrength = strength;
      // Center plunk + expanding annular crest (scheduled). Low tier: one ring.
      pendingWater.push({
        position: [endUv.x, endUv.y],
        start: [endUv.x, endUv.y],
        end: [endUv.x, endUv.y],
        radius: Math.max(0.032, event.radius / Math.max(rect.height, 1) * 0.28),
        impulse: -strength * 3.2,
        direction: [0, -1],
        wake: 0,
        eccentricity: 0,
      });
      // Immediate first ring so the +100ms frame already shows a crest.
      // Soft thicker crest — water plunk, not plastic snap.
      const crestBoost = lowTier ? 1.15 : 1;
      pendingWater.push({
        position: [endUv.x, endUv.y],
        start: [endUv.x, endUv.y],
        end: [endUv.x, endUv.y],
        radius: lowTier ? 0.028 : 0.024,
        impulse: -strength * 1.35 * crestBoost,
        wake: 0.05,
        eccentricity: -1,
      });
      pendingWater.push({
        position: [endUv.x, endUv.y],
        start: [endUv.x, endUv.y],
        end: [endUv.x, endUv.y],
        radius: lowTier ? 0.02 : 0.018,
        impulse: strength * 0.58 * crestBoost,
        wake: 0.07,
        eccentricity: -1,
      });
      const ringSteps = lowTier ? 2 : 6;
      for (let index = 0; index < ringSteps; index += 1) {
        const t = lowTier ? 0.06 + index * 0.09 : 0.06 + index * 0.11;
        const ringR = 0.048 + (lowTier ? 0.1 + index * 0.08 : index * 0.05);
        const decay = Math.exp(-t * 1.7);
        const thickness = 0.026 + index * 0.003;
        scheduleWater({
          dueAt: nowSeconds + t,
          position: [endUv.x, endUv.y],
          radius: thickness,
          impulse: -strength * 1.4 * decay * crestBoost,
          wake: ringR,
          eccentricity: -1,
        });
        if (!lowTier) {
          scheduleWater({
            dueAt: nowSeconds + t + 0.016,
            position: [endUv.x, endUv.y],
            radius: thickness * 1.05,
            impulse: strength * 0.52 * decay,
            wake: ringR + thickness * 1.4,
            eccentricity: -1,
          });
        }
      }
      activeGlyphInteractions.push({
        kind: "shockwave",
        start: [event.startX - rect.left, event.startY - rect.top],
        end: [event.endX - rect.left, event.endY - rect.top],
        direction: [0, 0],
        strength: strength * 5.4,
        radius: Math.max(160, event.radius * 1.5),
        time: event.time,
      });
      if (pendingWater.length > MAX_SPLATS) pendingWater.splice(0, pendingWater.length - MAX_SPLATS);
      return;
    }

    if (event.kind === "suction") {
      // Glyph hold owns its own churn; open-water suction is the fingertip dimple.
      if (interactionTransition.state.kind === "holding") return;
      const depth = Math.min(1, event.strength);
      const radius = Math.max(0.042, event.radius / Math.max(rect.height, 1) * 1.15);
      pendingWater.push({
        position: [endUv.x, endUv.y],
        start: [endUv.x, endUv.y],
        end: [endUv.x, endUv.y],
        radius,
        impulse: -depth * 0.95,
        direction: [0, -1],
        wake: 0,
        eccentricity: 0,
      });
      // Slightly brightened meniscus rim around the depression.
      pendingWater.push({
        position: [endUv.x, endUv.y],
        start: [endUv.x, endUv.y],
        end: [endUv.x, endUv.y],
        radius: 0.012 + depth * 0.008,
        impulse: depth * 0.22,
        wake: radius * 1.05,
        eccentricity: -1,
      });
      if (pendingWater.length > MAX_SPLATS) pendingWater.splice(0, pendingWater.length - MAX_SPLATS);
      return;
    }

    if (event.kind === "release-wave") {
      const strength = event.strength;
      pendingWater.push({
        position: [endUv.x, endUv.y],
        start: [endUv.x, endUv.y],
        end: [endUv.x, endUv.y],
        radius: 0.04,
        impulse: strength * 0.55,
        direction: [0, -1],
        wake: 0,
        eccentricity: 0,
      });
      const steps = lowTier ? 1 : 5;
      for (let index = 0; index < steps; index += 1) {
        const t = index * 0.06;
        scheduleWater({
          dueAt: nowSeconds + t,
          position: [endUv.x, endUv.y],
          radius: 0.014,
          impulse: -strength * 0.28 * Math.exp(-t * 3.2),
          wake: 0.04 + index * 0.028,
          eccentricity: -1,
        });
      }
      if (pendingWater.length > MAX_SPLATS) pendingWater.splice(0, pendingWater.length - MAX_SPLATS);
      return;
    }

    // Pressure moving through dense, calm water -  not splashes. A press is a
    // satisfying droplet dip; a wake is a broad, soft displacement that the
    // solver propagates outward with weight and momentum.
    // Slow motion → round dimple; fast → elongated trough + bow wave.
    // Calm pockets soften wakes, but cursor must still visibly move the water.
    const calmAttenuate = 1 - worldCalm * 0.32;
    const speedFactor = Math.min(1, speed / 420);
    const eccentricity = lowTier || event.kind !== "wake"
      ? 0
      : Math.min(0.7, Math.max(0, (speed - 120) / 1500));
    const pressRadius = event.kind === "press"
      ? Math.max(0.055, event.radius / Math.max(rect.height, 1))
      : (event.radius / Math.max(rect.height, 1)) * (1.12 - speedFactor * 0.2) * (1 + eccentricity * 0.28);
    const travel = Math.hypot(endUv.x - startUv.x, endUv.y - startUv.y);
    const stretch = event.kind === "wake" ? Math.min(0.09, travel + eccentricity * 0.04) : 0;
    const extendedEnd: [number, number] = stretch > 0.001
      ? [
        endUv.x + dirX * stretch * 0.4,
        endUv.y + dirY * stretch * 0.4,
      ]
      : [endUv.x, endUv.y];
    const wakeImpulseScale = event.kind === "wake" ? calmAttenuate : 1;
    pendingWater.push({
      position: extendedEnd,
      start: [startUv.x, startUv.y],
      end: extendedEnd,
      radius: pressRadius,
      impulse: event.kind === "press"
        ? -event.strength * 1.45
        : -(event.strength * (0.34 + speedFactor * 0.42 + eccentricity * 0.28)) * wakeImpulseScale,
      direction: [dirX, dirY],
      wake: event.kind === "wake"
        ? event.strength * (0.42 + speedFactor * 0.32 + eccentricity * 0.24) * wakeImpulseScale
        : event.strength * 0.28,
      eccentricity,
    });
    if (event.kind === "wake" && eccentricity > 0.16 && !lowTier) {
      pendingWater.push({
        position: [
          extendedEnd[0] + dirX * pressRadius * 1.1,
          extendedEnd[1] + dirY * pressRadius * 1.1,
        ],
        start: extendedEnd,
        end: [
          extendedEnd[0] + dirX * pressRadius * 1.1,
          extendedEnd[1] + dirY * pressRadius * 1.1,
        ],
        radius: pressRadius * 0.68,
        impulse: event.strength * (0.18 + eccentricity * 0.22) * wakeImpulseScale,
        direction: [dirX, dirY],
        wake: event.strength * 0.16 * wakeImpulseScale,
        eccentricity: eccentricity * 0.6,
      });
    }
    // Press keeps a soft local dip; expanding ring visuals belong to shockwave.
    if (event.kind === "press") {
      pendingWater.push({
        position: [endUv.x + 0.016, endUv.y - 0.01],
        start: [endUv.x, endUv.y],
        end: [endUv.x + 0.016, endUv.y - 0.01],
        radius: pressRadius * 0.3,
        impulse: -event.strength * 0.35,
        direction: [0.4, -0.9],
        wake: 0.04,
        eccentricity: 0,
      });
    }
    if (event.kind === "wake" || event.kind === "press") {
      activeGlyphInteractions.push({
        kind: event.kind,
        start: [event.startX - rect.left, event.startY - rect.top],
        end: [event.endX - rect.left, event.endY - rect.top],
        direction: speed > 8 ? [event.vx / directionLength, event.vy / directionLength] : [0, -1],
        // Press glyph punch is softer — shockwave owns the click scatter.
        strength: event.kind === "press" ? event.strength * 2.2 : event.strength * 4.2,
        radius: event.kind === "press" ? Math.max(84, event.radius) : Math.max(34, event.radius),
        time: event.time,
      });
    }
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
    const rect = canvasRect;
    for (const ripple of physics.ripples) {
      if (seenRipples.has(ripple)) continue;
      seenRipples.add(ripple);
      const uv = clientToWaterUv({ x: ripple.x, y: ripple.y }, rect);
      applySplat({
        position: [uv.x, uv.y],
        radius: Math.min(0.14, 0.026 + ripple.intensity * 0.065),
        impulse: -Math.min(0.065, ripple.intensity * 0.18),
        direction: [0, -0.2],
      });
    }
    const scrollWake = scrollWakeStrength(physics.scroll.velocity);
    // Soft current along scroll during the hero→projects submersion band.
    const submersionWake = glyphExit > 0.02 && glyphExit < 0.85
      ? 1 + glyphExit * 0.85
      : 1;
    scrollChop += (scrollWake * submersionWake - scrollChop) * 0.12;
    if (scrollWake > 0.001 && performance.now() - lastScrollWakeAt > 90) {
      const direction = physics.scroll.velocity >= 0 ? -1 : 1;
      const wakeScale = scrollWake * submersionWake;
      for (const [x, y] of [[0.2, 0.5], [0.5, 0.48], [0.8, 0.52]] as const) {
        pendingWater.push({
          position: [x, y],
          start: [x, y - direction * 0.08],
          end: [x, y],
          radius: 0.085,
          impulse: -0.012 * wakeScale,
          direction: [0, direction],
          wake: 0.035 * wakeScale,
        });
      }
      lastScrollWakeAt = performance.now();
      if (pendingWater.length > MAX_SPLATS) pendingWater.splice(0, pendingWater.length - MAX_SPLATS);
    }
  };

  if (process.env.NODE_ENV !== "production") {
    window.__underwaterDebug = {
      wake: (start, end, durationMs = 180) => {
        const rect = canvasRect;
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
        const rect = canvasRect;
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
      shockwave: (point, strength = 1) => {
        const rect = canvasRect;
        ingestInteraction({
          id: -1,
          kind: "shockwave",
          startX: rect.left + point[0],
          startY: rect.top + point[1],
          endX: rect.left + point[0],
          endY: rect.top + point[1],
          vx: 0,
          vy: 0,
          strength,
          radius: 120,
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
      directions[index].set(
        splat.direction?.[0] ?? 0,
        splat.direction?.[1] ?? 0,
        splat.wake,
        splat.eccentricity ?? 0,
      );
    }
    heightMaterial.uniforms.uSplatCount.value = injectionCount;
    if (heroMetricsEnabled) {
      canvas.dataset.waterInjectionCount = String(injectionCount);
      canvas.dataset.scrollChop = scrollChop.toFixed(3);
      canvas.dataset.scheduledWater = String(scheduledWater.length);
    }
    heightMaterial.uniforms.uTime.value = time;
    // Calm pockets (About) intentionally still the shared heightfield.
    heightMaterial.uniforms.uAmbient.value = reducedMotionRef.current
      ? 0
      : 0.032 * (1 - worldCalm * 0.9) + scrollChop * 0.012 * (1 - worldCalm * 0.55);
    heightMaterial.uniforms.uPrevious.value = heightRead.texture;
    // Height ping-pong: reset GL state so the write target cannot alias a live
    // sampler from last composite / previous height read.
    renderer.resetState();
    renderer.setRenderTarget(heightWrite);
    renderer.render(heightScene, fullscreenCamera);
    const previous = heightRead;
    heightRead = heightWrite;
    heightWrite = previous;
    finalMaterial.uniforms.uHeightfield.value = heightRead.texture;
    pendingWater.length = 0;
  };

  function stopRenderClock() {
    if (!clockSubscribed) return;
    unsubscribeFrameClock(renderClockId);
    clockSubscribed = false;
  }

  function startRenderClock() {
    if (disposed || clockSubscribed) return;
    clockSubscribed = true;
    subscribeFrameClock(renderClockId, (now) => {
      render(now);
    });
  }

  const injectGlyphFeedback = (viewport: readonly [number, number]) => {
    // Letters leave a soft wake when they move - gated so idle settle stays calm.
    feedbackFrame += 1;
    if (feedbackFrame % 2 !== 0) return;
    for (const body of bodies) {
      const speed = Math.hypot(body.velocity.x, body.velocity.z);
      const angularSpeed = body.angularVelocity.length();
      if (speed < 0.01 && angularSpeed < 0.04) continue;
      const screen = projectGlyph(body, camera, viewport);
      const x = screen.center.x / Math.max(viewport[0], 1);
      const y = 1 - screen.center.y / Math.max(viewport[1], 1);
      const directionLength = Math.max(speed, 0.001);
      pendingWater.push({
        position: [x, y],
        start: [x - body.velocity.x / directionLength * 0.007, y + body.velocity.z / directionLength * 0.007],
        end: [x, y],
        radius: Math.min(0.04, Math.max(0.012, Math.max(screen.halfSize.x / viewport[0], screen.halfSize.y / viewport[1]) * 0.4)),
        impulse: -Math.min(0.012, speed * 0.055 + angularSpeed * 0.002),
        direction: [body.velocity.x / directionLength, -body.velocity.z / directionLength],
        wake: Math.min(0.01, speed * 0.032 + angularSpeed * 0.0014),
      });
      if (pendingWater.length >= MAX_SPLATS) break;
    }
  };

  const render = (now: number) => {
    if (disposed) return;
    const shouldRun = running && !document.hidden && !staticModeRef.current;
    if (!shouldRun) return;
    const workStartedAt = performance.now();
    renderer.info.reset();
    const delta = Math.min(100, now - lastFrameAt);
    const deltaSeconds = Math.max(delta / 1000, 1 / 240);
    lastFrameAt = now;
    const time = (now - startedAt) / 1000;
    const absoluteTime = now / 1000;
    cameraTime = time;
    const staticFrame = reducedMotionRef.current;
    // One continuous world: scroll position is depth. No presets, no
    // section flags -  the same curve drives backdrop theme, plate
    // crossfade, calm pockets, fog, and the hero name's exit. Scrolling
    // upward retraces the exact inverse journey.
    const world = getPhysics().world;
    const depthTarget = world?.depth ?? 0;
    const calmTarget = world?.calm ?? 0;
    const depthEase = staticFrame ? 1 : 1 - Math.exp(-deltaSeconds * 5.2);
    const calmEase = staticFrame ? 1 : 1 - Math.exp(-deltaSeconds * 4.2);
    worldDepth += (depthTarget - worldDepth) * depthEase;
    worldCalm += (calmTarget - worldCalm) * calmEase;
    const glyphExitTarget = renderHeroGlyphs ? glyphExitForDepth(worldDepth) : 1;
    glyphExit += (glyphExitTarget - glyphExit) * (staticFrame ? 1 : 1 - Math.exp(-deltaSeconds * 6.5));
    const offHero = glyphExit >= 0.995;
    // Couple off-hero presentation + simulation to the same cadence. Bank
    // wall-clock time on skipped frames and catch up (bounded) when presenting
    // so wakes keep settling without full-rate GPU sim.
    const targetFps = Math.min(quality.targetFps || 30, 30);
    const minFrameMs = 1000 / Math.max(targetFps, 1);
    const skipPresent = !staticFrame
      && offHero
      && lastPresentedAt > 0
      && now - lastPresentedAt < minFrameMs * 0.9;
    if (offHero !== lastOffHero) {
      lastOffHero = offHero;
      if (glyphMaterial instanceof ShaderMaterial) {
        const heroTaps = quality.tier === "high" ? 3 : quality.tier === "balanced" ? 2 : 1;
        glyphMaterial.uniforms.uRefractionTaps.value = offHero ? Math.min(heroTaps, 1) : heroTaps;
        if (heroMetricsEnabled) {
          canvas.dataset.refractionTaps = String(glyphMaterial.uniforms.uRefractionTaps.value);
        }
      }
      canvas.dataset.offHero = offHero ? "true" : "false";
    }
    backdropMaterial.uniforms.uTheme.value = worldDepth;
    backdropMaterial.uniforms.uCalm.value = worldCalm;
    backdropMaterial.uniforms.uPlate.value = plateForDepth(worldDepth);
    finalMaterial.uniforms.uTheme.value = worldDepth;
    finalMaterial.uniforms.uCalm.value = worldCalm;
    const introProgress = introProgressAt(
      absoluteTime,
      entranceStart,
      introDuration,
      staticFrame,
    );
    const breachAge = Number.isFinite(entranceStart) ? absoluteTime - entranceStart : 99;
    const breachBoost = staticFrame ? 0 : breachExposureBoost(breachAge, shortenedEntrance);
    finalMaterial.uniforms.uExposure.value =
      exposure * exposureForDepth(worldDepth) * (1 + breachBoost);
    const waterSection: WaterSection = world?.moored ? "case" : (world?.section ?? "hero");
    canvas.dataset.waterSection = waterSection;
    if (heroMetricsEnabled) {
      canvas.dataset.worldDepth = worldDepth.toFixed(3);
      canvas.dataset.introProgress = introProgress.toFixed(3);
    }
    backdropMaterial.uniforms.uTime.value = staticFrame ? 0.8 : time;
    backdropMaterial.uniforms.uMotion.value = staticFrame ? 0 : 1;
    if (glyphMaterial instanceof ShaderMaterial) glyphMaterial.uniforms.uTime.value = time;
    finalMaterial.uniforms.uTime.value = staticFrame ? 0.8 : time;
    // Authored camera: intro dolly + depth tip + secondary ≤2° pointer/device tilt.
    cameraPointerX += (cameraPointerXT - cameraPointerX) * 0.045;
    cameraPointerY += (cameraPointerYT - cameraPointerY) * 0.045;
    const deviceTilt = staticFrame ? { x: 0, y: 0, active: false } : getDeviceTilt();
    if (cameraRestValid) {
      applyCameraRig(
        cameraRest,
        {
          introProgress,
          worldDepth,
          pointerX: cameraPointerX,
          pointerY: cameraPointerY,
          tiltX: deviceTilt.active ? deviceTilt.x : 0,
          tiltY: deviceTilt.active ? deviceTilt.y : 0,
          time: cameraTime,
          reducedMotion: staticFrame,
        },
        camera,
        camera,
      );
      camera.updateMatrixWorld(true);
      if (heroMetricsEnabled) {
        canvas.dataset.cameraY = camera.position.y.toFixed(3);
        canvas.dataset.cameraZ = camera.position.z.toFixed(3);
        canvas.dataset.cameraFov = camera.fov.toFixed(2);
        canvas.dataset.deviceTilt = deviceTilt.active
          ? `${deviceTilt.x.toFixed(3)},${deviceTilt.y.toFixed(3)}`
          : "off";
      }
    }
    const rect = canvasRect;
    ingestPhysics();
    if (skipPresent) {
      // Bank sim debt; ingest already queued wakes. Catch up on the next present.
      offHeroSimDebt = Math.min(
        offHeroSimDebt + deltaSeconds,
        OFF_HERO_MAX_CATCHUP_STEPS / 120,
      );
      return;
    }
    updateGlyphHover(getPhysics(), rect);
    const pointerState = getPhysics().pointer;
    const pointerTargetU = Math.min(1, Math.max(0, (pointerState.x - rect.left) / Math.max(rect.width, 1)));
    const pointerTargetV = 1 - Math.min(1, Math.max(0, (pointerState.y - rect.top) / Math.max(rect.height, 1)));
    const pointerEase = 1 - Math.exp(-deltaSeconds * 14);
    const energyEase = 1 - Math.exp(-deltaSeconds * (pointerState.energy > waterPointerEnergy ? 12 : 5.5));
    waterPointerU += (pointerTargetU - waterPointerU) * pointerEase;
    waterPointerV += (pointerTargetV - waterPointerV) * pointerEase;
    const targetEnergy = Math.min(
      1.0,
      pointerState.energy * 1.05 + (pointerState.active ? 0.1 : 0) + pointerState.speed * 0.08,
    );
    waterPointerEnergy += (targetEnergy - waterPointerEnergy) * energyEase;
    if (waterPointerEnergy < 0.001) waterPointerEnergy = 0;
    const targetVx = Math.max(-1, Math.min(1, pointerState.vx / Math.max(rect.width, 1) * 7));
    const targetVy = Math.max(-1, Math.min(1, -pointerState.vy / Math.max(rect.height, 1) * 7));
    waterPointerVx += (targetVx - waterPointerVx) * pointerEase;
    waterPointerVy += (targetVy - waterPointerVy) * pointerEase;
    finalMaterial.uniforms.uPointer.value.set(waterPointerU, waterPointerV);
    finalMaterial.uniforms.uPointerVelocity.value.set(waterPointerVx, waterPointerVy);
    finalMaterial.uniforms.uPointerEnergy.value = waterPointerEnergy;
    const shockAge = absoluteTime - shockwaveBornAt;
    if (shockAge >= 0 && shockAge < 1.05 && shockwaveStrength > 0.01) {
      const fade = Math.exp(-shockAge * 2.4) * shockwaveStrength;
      finalMaterial.uniforms.uShockwave.value.set(
        shockwaveCenter[0],
        shockwaveCenter[1],
        shockAge,
        fade,
      );
    } else {
      finalMaterial.uniforms.uShockwave.value.set(0.5, 0.5, 99, 0);
    }
    for (let index = activeGlyphInteractions.length - 1; index >= 0; index -= 1) {
      if (absoluteTime - activeGlyphInteractions[index].time > 3.4) activeGlyphInteractions.splice(index, 1);
    }
    if (
      interactionTransition.state.kind === "releasing"
      && absoluteTime - interactionTransition.state.releasedAt > 0.9
    ) {
      dispatchGlyphInteraction({
        type: "release-complete",
        releaseId: interactionTransition.state.releaseId,
      });
    }
    const simDelta = offHero ? offHeroSimDebt + deltaSeconds : deltaSeconds;
    offHeroSimDebt = 0;
    const maxSimSteps = offHero ? OFF_HERO_MAX_CATCHUP_STEPS : 3;
    const fixed = accumulateFixedSteps(fixedAccumulator, simDelta, 1 / 120, maxSimSteps);
    fixedAccumulator = fixed.accumulator;
    const viewport = [rect.width, rect.height] as const;
    // The name floats out as the descent begins: letters rise toward the
    // surface with a slight per-glyph stagger, drift up-frame, and dissolve.
    const glyphsPresent = glyphExit < 0.995;
    glyphGroup.visible = glyphsPresent;
    glyphGroup.position.set(0, 0, 0);
    if (glyphMaterial instanceof ShaderMaterial) {
      glyphMaterial.uniforms.uExitFade.value = glyphFadeForExit(glyphExit);
      const letterEnergy =
        interactionTransition.state.kind === "holding" ? 1
          : interactionTransition.state.kind === "hovering" ? 0.78
            : interactionTransition.state.kind === "releasing" ? 0.85
              : 0;
      glyphMaterial.uniforms.uLetterEnergy.value = letterEnergy;
    }
    finalMaterial.uniforms.uGlyphPresence.value = renderHeroGlyphs
      ? 1 - glyphFadeForExit(glyphExit)
      : 0;
    const bodiesLive = glyphsPresent && glyphExit < 0.9;
    const interactionState = interactionTransition.state;
    if (
      interactionState.kind === "holding"
      && absoluteTime - lastHoldChurnAt >= 1 / 5
      && bodies.length > 0
    ) {
      const heldBody = bodyForIndex(interactionState.glyphIndex);
      if (heldBody) {
        const heldScreen = projectGlyph(heldBody, camera, viewport);
        const heldX = heldScreen.center.x / viewport[0];
        const heldY = 1 - heldScreen.center.y / viewport[1];
        pendingWater.push({
          position: [heldX, heldY],
          start: [heldX, heldY + 0.025],
          end: [heldX, heldY],
          radius: 0.032,
          impulse: -0.014,
          direction: [0, -1],
          wake: 0.012,
        });
      }
      lastHoldChurnAt = absoluteTime;
    }
    flushScheduledWater(absoluteTime);
    // Keep heightfield on wall-clock time everywhere so wakes settle. Only
    // glyph rigid-body work is limited once the name has exited.
    const heightSteps = freezeWater ? 0 : fixed.steps;
    const bodySteps = bodies.length > 0 && !freezeGlyphs && bodiesLive
      ? (offHero ? Math.min(fixed.steps, 1) : fixed.steps)
      : 0;
    for (let step = 0; step < Math.max(heightSteps, bodySteps); step += 1) {
      if (step < heightSteps) updateHeightfield(time + step / 120);
      if (step < bodySteps) {
        stepGlyphBodies(
          bodies,
          camera,
          viewport,
          activeGlyphInteractions,
          1 / 120,
          absoluteTime,
          reducedMotionRef.current,
          stepControl,
        );
        if (glyphExit < 0.25) injectGlyphFeedback(viewport);
      }
    }
    // Staggered cinematic exit: each letter rises/fades with a slight delay.
    if (glyphsPresent && bodies.length > 0 && glyphExit > 0.001) {
      for (const body of bodies) {
        const letterExit = staggeredGlyphExit(glyphExit, body.glyph.manifest.glyph_index);
        body.glyph.object.position.y += letterExit * 0.55;
        body.glyph.object.position.z += -letterExit * 3.35;
        body.glyph.object.updateMatrixWorld(true);
      }
    }
    glyphDebug?.tick(now);
    if (offHero) lastPresentedAt = now;
    const previousMask = camera.layers.mask;
    // Optical backdrop is an NDC fullscreen plate — draw it with the ortho
    // camera into environmentTarget (glyph refraction samples this).
    // resetState (not a blanket texture unbind) avoids feedback-loop errors
    // without preventing the plate samplers from rebinding on this draw.
    renderer.resetState();
    renderer.setRenderTarget(environmentTarget);
    renderer.setClearColor(0xdceef4, 1);
    renderer.clear(true, true, true);
    renderer.render(backdropScene, fullscreenCamera);
    // Glyph thickness refraction needs linear depth. Once the name has exited,
    // skip both depth passes through projects/about/contact.
    if (glyphsPresent) {
      camera.layers.mask = previousMask;
      renderDepth(backDepthTarget, BackSide);
      renderDepth(frontDepthTarget, FrontSide);
    }
    // Paint the optical plate into sceneTarget with the same ortho pass, then
    // composite glyphs without clearing color (autoClear would wipe the plate).
    renderer.resetState();
    renderer.setRenderTarget(sceneTarget);
    renderer.setClearColor(0xdceef4, 1);
    renderer.clear(true, true, true);
    renderer.render(backdropScene, fullscreenCamera);
    if (glyphsPresent) {
      const previousAutoClear = renderer.autoClear;
      renderer.autoClear = false;
      renderer.clearDepth();
      camera.layers.set(GLYPH_LAYER);
      renderer.render(scene, camera);
      renderer.autoClear = previousAutoClear;
    }
    camera.layers.mask = previousMask;
    renderer.resetState();
    renderer.setRenderTarget(null);
    renderer.render(finalScene, fullscreenCamera);
    if (heroMetricsEnabled) {
      canvas.dataset.drawCalls = String(renderer.info.render.calls);
      canvas.dataset.triangles = String(renderer.info.render.triangles);
      canvas.dataset.textureMemoryEstimateMb = (
        (sceneTarget.width * sceneTarget.height * 8 * 4
          + simulationWidth * simulationHeight * 8 * 2) / (1024 * 1024)
      ).toFixed(1);
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
    } else {
      frameCount += 1;
    }

    if (!ready) {
      ready = true;
      canvas.dataset.glyphCount = String(glyphs.length);
      onReady();
    }
    // Steady-state metrics only: skip surface-breach entrance frames.
    const metricsOpen = !Number.isFinite(entranceStart)
      || absoluteTime > entranceStart + introDuration + 0.2;
    const workMs = performance.now() - workStartedAt;
    // Ignore tab-stall outliers in the fps window (rAF gaps >> one refresh).
    if (metricsOpen && delta > 0 && frameSamples.length < 240) {
      if (delta <= 34) {
        frameSamples.push(delta);
        workSamples.push(workMs);
      } else {
        frameStallWorst = Math.max(frameStallWorst, delta);
      }
    }
    if (frameSamples.length === 240) {
      const p50 = percentile(frameSamples, 0.5);
      const p95 = percentile(frameSamples, 0.95);
      const average = frameSamples.reduce((sum, value) => sum + value, 0) / frameSamples.length;
      const frameWorst = Math.max(...frameSamples);
      const workP95 = percentile(workSamples, 0.95);
      const workWorst = Math.max(...workSamples);
      if (heroMetricsEnabled) {
        canvas.dataset.frameMsP95 = p95.toFixed(2);
        canvas.dataset.frameMsP50 = p50.toFixed(2);
        canvas.dataset.frameMsWorst = frameWorst.toFixed(2);
        canvas.dataset.frameStallMs = frameStallWorst.toFixed(2);
        canvas.dataset.fps = (1000 / average).toFixed(1);
        canvas.dataset.workMsP95 = workP95.toFixed(2);
        canvas.dataset.workMsWorst = workWorst.toFixed(2);
      }
      workSamples.length = 0;
      frameSamples.length = 0;
      frameStallWorst = 0;
      // Adaptive scale on real GPU/CPU work, not vsync-aligned rAF intervals.
      slowFrameWindows = workP95 > FRAME_BUDGET_MS ? slowFrameWindows + 1 : 0;
      if (slowFrameWindows >= ADAPTIVE_SLOW_WINDOWS && runtimeScale > MIN_RUNTIME_SCALE) {
        runtimeScale = Math.max(MIN_RUNTIME_SCALE, runtimeScale - 0.1);
        slowFrameWindows = 0;
        adaptiveDowngrades += 1;
        canvas.dataset.adaptiveScale = runtimeScale.toFixed(2);
        canvas.dataset.adaptiveDowngrades = String(adaptiveDowngrades);
        resize();
      }
    }
    // Reduced motion renders one complete, fully composed frame -  glyphs,
    // refraction, caustics -  and then stops the loop. No GPU work continues
    // in the background; scroll/resize/motion-toggle wake exactly one frame.
    if (!reducedMotionRef.current) {
      // Stay on the unified frame clock.
    } else {
      canvas.dataset.motionLoop = "stopped";
      stopRenderClock();
    }
  };

  const renderOneStaticFrame = () => {
    if (disposed || !reducedMotionRef.current || document.hidden) return;
    stopRenderClock();
    lastFrameAt = performance.now();
    startRenderClock();
  };

  const resume = () => {
    if (disposed || !running || document.hidden) return;
    stopRenderClock();
    lastFrameAt = performance.now();
    startRenderClock();
  };
  const onVisibilityChange = () => {
    if (document.hidden) {
      stopRenderClock();
      const state = interactionTransition.state;
      if (state.kind === "holding") cancelGlyphPointer(state.pointerId, "hidden");
    }
    else if (reducedMotionRef.current) renderOneStaticFrame();
    else resume();
  };
  const onStaticScroll = () => {
    renderOneStaticFrame();
  };
  const onContextLost = (event: Event) => {
    event.preventDefault();
    running = false;
    stopRenderClock();
    const state = interactionTransition.state;
    if (state.kind === "holding") cancelGlyphPointer(state.pointerId, "teardown");
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
  document.addEventListener("visibilitychange", onVisibilityChange);
  const onViewportMove = () => {
    refreshCanvasRect();
    if (reducedMotionRef.current) onStaticScroll();
  };
  // Invalidate cached canvas geometry on scroll / visualViewport; reduced-motion
  // also wakes exactly one composed frame from the same listener.
  window.addEventListener("scroll", onViewportMove, { passive: true });
  window.visualViewport?.addEventListener("resize", onViewportMove);
  window.visualViewport?.addEventListener("scroll", onViewportMove);
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);
  refreshCanvasRect();

  void Promise.all([
    loadOpticalMicrostructure(),
    renderHeroGlyphs ? loadGlyphs(glyphGroup, glyphMaterial, glbUrl) : Promise.resolve([]),
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
      if (usePhysicalMaterial) {
        for (const glyph of glyphs) {
          glyph.object.castShadow = true;
          glyph.object.receiveShadow = true;
        }
      }
      bodies = createGlyphBodies(glyphs);
      glyphDebug = installGlyphDebug({
        readSnapshots: () => {
          const rect = canvasRect;
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
          const rect = canvasRect;
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
      // Compile every program behind the loading veil so the first visible
      // frame does not pay shader-compile / pipeline spikes.
      try {
        renderer.compile(scene, camera);
        renderer.compile(backdropScene, fullscreenCamera);
        renderer.compile(heightScene, fullscreenCamera);
        renderer.compile(finalScene, fullscreenCamera);
        // One hidden draw of each pass to warm pipeline state.
        const previousVisibility = canvas.style.visibility;
        canvas.style.visibility = "hidden";
        const warmupMask = camera.layers.mask;
        renderer.resetState();
        renderer.setRenderTarget(environmentTarget);
        renderer.setClearColor(0xdceef4, 1);
        renderer.clear(true, true, true);
        renderer.render(backdropScene, fullscreenCamera);
        renderer.resetState();
        renderer.setRenderTarget(sceneTarget);
        renderer.clear(true, true, true);
        renderer.render(backdropScene, fullscreenCamera);
        const warmupAutoClear = renderer.autoClear;
        renderer.autoClear = false;
        renderer.clearDepth();
        camera.layers.set(GLYPH_LAYER);
        renderer.render(scene, camera);
        renderer.autoClear = warmupAutoClear;
        camera.layers.mask = warmupMask;
        renderer.resetState();
        renderer.setRenderTarget(null);
        renderer.render(finalScene, fullscreenCamera);
        canvas.style.visibility = previousVisibility || "";
        canvas.dataset.warmup = "compiled";
      } catch {
        canvas.dataset.warmup = "skipped";
      }
      let runEntrance = false;
      shortenedEntrance = false;
      if (!reducedMotionRef.current && !staticModeRef.current && bodies.length > 0 && renderHeroGlyphs) {
        // Repeat visits get a shorter breach -  never none.
        // Only FIRST_LOAD_BREACH_KEY gates shortening — KineticCanvas writes
        // portfolio.hero-boot.v1 on first paint, so it must not be used here.
        try {
          shortenedEntrance = sessionStorage.getItem(FIRST_LOAD_BREACH_KEY) === "seen";
          sessionStorage.setItem(FIRST_LOAD_BREACH_KEY, "seen");
        } catch {
          shortenedEntrance = false;
        }
        runEntrance = true;
      }
      if (runEntrance) {
        introDuration = introDurationForVisit(shortenedEntrance);
        // Begin once canvas opacity is rising — keep lead short so the dolly
        // is still mid-travel when fluid=ready screenshots land.
        const visibilityLead = shortenedEntrance ? 0.08 : 0.12;
        entranceStart = performance.now() / 1000 + visibilityLead;
        stepControl.entranceStart = entranceStart;
        // Soft buoyant rise from slightly below — staggered 20–40ms.
        stepControl.entranceDepth = shortenedEntrance ? -0.048 : -0.11;
        stepControl.entranceStagger = shortenedEntrance ? 0.02 : 0.034;
        const rect = canvasRect;
        const viewport = [Math.max(rect.width, 1), Math.max(rect.height, 1)] as const;
        for (const body of bodies) {
          body.position.y = stepControl.entranceDepth;
          body.velocity.set(0, 0.01, 0);
          body.glyph.object.position.copy(body.restPosition).add(body.position);
          const screen = projectGlyph(body, camera, viewport);
          const uv: [number, number] = [screen.center.x / viewport[0], 1 - screen.center.y / viewport[1]];
          scheduleWater({
            dueAt: entranceStart + body.glyph.manifest.glyph_index * stepControl.entranceStagger,
            position: uv,
            radius: shortenedEntrance ? 0.022 : 0.03,
            impulse: shortenedEntrance ? -0.01 : -0.016,
            wake: shortenedEntrance ? 0.005 : 0.009,
          });
        }
        canvas.dataset.entrance = shortenedEntrance ? "surface-breach-short" : "surface-breach";
        canvas.dataset.introDuration = introDuration.toFixed(2);
      } else {
        canvas.dataset.entrance = "skipped";
        introDuration = 0;
      }
      resume();
    })
    .catch((error) => {
      if (!disposed) {
        running = false;
        stopRenderClock();
        onFailure(error);
      }
    });

  resize();

  return () => {
    const state = interactionTransition.state;
    if (state.kind === "holding") cancelGlyphPointer(state.pointerId, "teardown");
    disposed = true;
    running = false;
    stopRenderClock();
    cancelAnimationFrame(resizeFrame);
    resizeObserver.disconnect();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("scroll", onViewportMove);
    window.visualViewport?.removeEventListener("resize", onViewportMove);
    window.visualViewport?.removeEventListener("scroll", onViewportMove);
    window.removeEventListener("pointerdown", onGlyphPointerDown, { capture: true });
    window.removeEventListener("pointermove", onGlyphPointerMove, { capture: true });
    window.removeEventListener("pointerup", onGlyphPointerUp, { capture: true });
    window.removeEventListener("pointercancel", onGlyphPointerCancel, { capture: true });
    window.removeEventListener("lostpointercapture", onGlyphLostCapture, { capture: true });
    window.removeEventListener("blur", onGlyphBlur);
    canvas.removeEventListener("dragstart", onCanvasDragStart);
    setBodyCursor(null);
    scheduledWater.length = 0;
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
    disposeObject(backdropScene);
    backdropMaterial.dispose();
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
