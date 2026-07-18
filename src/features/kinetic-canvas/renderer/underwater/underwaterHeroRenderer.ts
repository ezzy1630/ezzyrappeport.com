"use client";

import {
  BackSide,
  Color,
  DepthTexture,
  DirectionalLight,
  DoubleSide,
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
  RectAreaLight,
  Scene,
  ShaderMaterial,
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
import type { LiquidPhysics } from "@/lib/portfolio/liquid-interaction";
import type { KineticQuality } from "../quality";
import { HERO_GLB_URL, HERO_MANIFEST_URL, UNDERWATER_DEBUG } from "./config";
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
  onReady: () => void;
  onFailure: (error: unknown) => void;
  onRecover: () => void;
};

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
    },
    side: FrontSide,
    depthWrite: true,
    depthTest: true,
  });
}

function applyManifestTransform(object: Object3D, glyph: HeroGlyphManifestEntry) {
  object.position.fromArray(glyph.rest_transform.translation);
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

  for (const glyph of manifest.glyphs) {
    const source = gltf.scene.getObjectByName(glyph.object_node_name);
    if (!(source instanceof Mesh)) {
      disposeObject(gltf.scene);
      throw new Error(`GLB node missing: ${glyph.object_node_name}`);
    }
    // One scene object per manifest identity. Repeated letters keep the shared
    // BufferGeometry supplied by the GLB but never share transforms or state.
    const object = new Mesh(source.geometry, material);
    object.name = glyph.object_node_name;
    applyManifestTransform(object, glyph);
    object.layers.set(GLYPH_LAYER);
    object.castShadow = true;
    object.receiveShadow = true;
    scene.add(object);
    glyphs.push({ manifest: glyph, object });
  }

  // GLTFLoader-created node wrappers and placeholder materials are no longer
  // needed. The shared mesh geometry remains owned by the runtime glyphs.
  gltf.scene.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const source = Array.isArray(child.material) ? child.material : [child.material];
    source.forEach((item) => item.dispose());
  });
  return glyphs;
}

function configureCamera(camera: PerspectiveCamera, width: number, height: number, debug = false) {
  const aspect = Math.max(width / Math.max(height, 1), 0.2);
  const verticalFov = camera.fov * Math.PI / 180;
  const distanceForWidth = 2.44 / (Math.tan(verticalFov * 0.5) * aspect);
  const distance = Math.max(6.1, distanceForWidth * 1.04);
  const tallViewportLift = Math.min(0.55, Math.max(0, (height - 760) / 500 * 0.55));
  const targetZ = aspect < 0.7 ? 3.35 : 0.48 + tallViewportLift;
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
  renderer.shadowMap.enabled = quality.tier !== "low";
  renderer.setClearColor(0xdbe7ed, 1);
  canvas.dataset.renderer = "three-webgl2-underwater";
  canvas.dataset.renderGraph = "environment>glyph-depth>glyph-transmission>surface>aces";
  canvas.dataset.toneMapper = "ACES filmic";

  const scene = new Scene();
  scene.background = new Color(0xd9e6ec);
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
      uTime: { value: 0 },
      uCausticStrength: { value: UNDERWATER_DEBUG.causticStrength },
      uDepthAttenuation: { value: UNDERWATER_DEBUG.depthAttenuation },
    },
    side: DoubleSide,
    depthWrite: true,
  });
  const backdrop = new Mesh(new PlaneGeometry(40, 40, 1, 1), backdropMaterial);
  backdrop.rotation.x = Math.PI / 2;
  backdrop.position.set(0, -1.35, 0.2);
  backdrop.receiveShadow = true;
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
  canvas.dataset.glyphMaterial = usePhysicalMaterial ? "physical-baseline" : "thickness-refraction";
  const heightTarget = new WebGLRenderTarget(128, 128, {
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: false,
  });
  heightTarget.texture.colorSpace = LinearSRGBColorSpace;

  const fullscreenGeometry = new PlaneGeometry(2, 2);
  const fullscreenCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const heightMaterial = new ShaderMaterial({
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: HEIGHTFIELD_FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uSplats: { value: Array.from({ length: MAX_SPLATS }, () => new Vector4()) },
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
      uHeightfield: { value: heightTarget.texture },
      uResolution: { value: new Vector2(1, 1) },
      uExposure: { value: exposure },
      uSurfaceDistortion: { value: UNDERWATER_DEBUG.surfaceDistortion },
      uCausticStrength: { value: UNDERWATER_DEBUG.causticStrength },
      uDepthAttenuation: { value: UNDERWATER_DEBUG.depthAttenuation },
    },
    depthTest: false,
    depthWrite: false,
  });
  const finalScene = new Scene();
  finalScene.add(new Mesh(fullscreenGeometry, finalMaterial));

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
  let lastPhysicsTime = -1;
  let pendingSplats: HeightfieldSplat[] = [];
  let runtimeScale = quality.renderScale;
  let frameCount = 0;
  const frameSamples: number[] = [];
  const workSamples: number[] = [];
  const heroElement = document.querySelector<HTMLElement>(".hero-shell");

  const applySplat = (splat: HeightfieldSplat) => {
    pendingSplats.push(splat);
    if (pendingSplats.length > MAX_SPLATS) pendingSplats.shift();
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
    const renderWidth = Math.max(1, Math.floor(width * dpr * runtimeScale));
    const renderHeight = Math.max(1, Math.floor(height * dpr * runtimeScale));
    sceneTarget.setSize(renderWidth, renderHeight);
    environmentTarget.setSize(renderWidth, renderHeight);
    frontDepthTarget.setSize(renderWidth, renderHeight);
    backDepthTarget.setSize(renderWidth, renderHeight);
    finalMaterial.uniforms.uResolution.value.set(renderWidth, renderHeight);
    configureCamera(camera, width, height, debugCamera);
    canvas.dataset.renderSize = `${renderWidth}x${renderHeight}`;
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

  const updateHeightfield = (time: number) => {
    const physics = getPhysics();
    if (physics.time !== lastPhysicsTime) {
      lastPhysicsTime = physics.time;
      for (const ripple of physics.ripples.slice(-2)) {
        if (ripple.age > 0.12) continue;
        applySplat({
          position: [ripple.x / Math.max(window.innerWidth, 1), 1 - ripple.y / Math.max(window.innerHeight, 1)],
          radius: 0.055,
          impulse: ripple.intensity * 0.035,
        });
      }
    }
    const vectors = heightMaterial.uniforms.uSplats.value as Vector4[];
    pendingSplats.forEach((splat, index) => {
      vectors[index].set(splat.position[0], splat.position[1], splat.radius, splat.impulse);
    });
    heightMaterial.uniforms.uSplatCount.value = pendingSplats.length;
    heightMaterial.uniforms.uTime.value = reducedMotionRef.current ? 0.7 : time;
    renderer.setRenderTarget(heightTarget);
    renderer.render(heightScene, fullscreenCamera);
    pendingSplats = [];
  };

  const render = (now: number) => {
    if (disposed) return;
    const shouldRun = running && heroVisible && !document.hidden && !staticModeRef.current;
    if (!shouldRun) return;
    const workStartedAt = performance.now();
    const delta = Math.min(100, now - lastFrameAt);
    lastFrameAt = now;
    const time = (now - startedAt) / 1000;
    backdropMaterial.uniforms.uTime.value = reducedMotionRef.current ? 0.8 : time;
    if (glyphMaterial instanceof ShaderMaterial) glyphMaterial.uniforms.uTime.value = time;
    updateHeightfield(time);
    const previousMask = camera.layers.mask;
    camera.layers.set(0);
    renderer.setRenderTarget(environmentTarget);
    renderer.setClearColor(0xd9e6ec, 1);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    camera.layers.mask = previousMask;
    renderDepth(backDepthTarget, BackSide);
    renderDepth(frontDepthTarget, FrontSide);
    renderer.setRenderTarget(sceneTarget);
    renderer.setClearColor(0xd9e6ec, 1);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(finalScene, fullscreenCamera);
    workSamples.push(performance.now() - workStartedAt);
    frameCount += 1;
    if (frameCount % 30 === 0) canvas.dataset.frameCount = String(frameCount);

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
    if (disposed || !running || document.hidden || !heroVisible) return;
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
        canvas.style.opacity = heroVisible ? "1" : "0";
        if (heroVisible) resume();
        else cancelAnimationFrame(animationFrame);
      }, { rootMargin: "180px 0px" })
    : null;
  if (heroElement) intersectionObserver?.observe(heroElement);
  document.addEventListener("visibilitychange", onVisibilityChange);
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);

  void loadGlyphs(scene, glyphMaterial, glbUrl)
    .then((loadedGlyphs) => {
      if (disposed) {
        const geometries = new Set(loadedGlyphs.map(({ object }) => object.geometry));
        loadedGlyphs.forEach(({ object }) => scene.remove(object));
        geometries.forEach((geometry) => geometry.dispose());
        return;
      }
      glyphs = loadedGlyphs;
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
    const glyphGeometries = new Set(glyphs.map(({ object }) => object.geometry));
    glyphs.forEach(({ object }) => scene.remove(object));
    glyphGeometries.forEach((geometry) => geometry.dispose());
    glyphMaterial.dispose();
    disposeObject(scene);
    sceneTarget.dispose();
    environmentTarget.dispose();
    frontDepthTarget.dispose();
    backDepthTarget.dispose();
    heightTarget.dispose();
    fullscreenGeometry.dispose();
    heightMaterial.dispose();
    finalMaterial.dispose();
    depthMaterial.dispose();
    renderer.renderLists.dispose();
    renderer.dispose();
  };
}
