import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createGlassEnvironment } from "./glass-studio";
import { createGlassMaterial } from "./glass-material";
import { createGlassContact } from "./glass-contact";
import { createWaterCanopy } from "./water-canopy";
import { fitHeroCamera, HERO_CAMERA_DISTANCE } from "./hero-camera";
import { advanceSpring } from "./spring";
import { WaterField } from "./water-field";
import { resolveContact } from "./contact";
import { createHeroDiagnostics } from "./hero-diagnostics";
import { RenderBudget, type RenderMode } from "./render-budget";
import { waterVertexShader, waterFragmentShader } from "./water-shader";


type Letter = {
  position: THREE.Vector3;
  mesh: THREE.Mesh;
  home: THREE.Vector3;
  velocity: THREE.Vector3;
  width: number;
  height: number;
  mass: number;
};
export async function createGlassScene(
  host: HTMLDivElement,
  onReady: () => void,
  onUnavailable: () => void,
) {
  const hero = host.parentElement;
  if (!hero) throw new Error("Water world host is detached");
  const root = host.closest<HTMLElement>("[data-water-world]") ?? hero;
  const canvas = document.createElement("canvas");
  const debug = new URLSearchParams(window.location.search).has("heroDebug");
  const context = canvas.getContext("webgl2", {
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  });
  if (!context) throw new Error("WebGL2 unavailable");
  const renderer = new THREE.WebGLRenderer({
    canvas,
    context,
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
    preserveDrawingBuffer: false,
  });
  const diagnostics = debug ? createHeroDiagnostics(canvas, context) : undefined;
  renderer.setClearColor(0xe0e8f0);
  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio || 1,
      window.innerWidth < 700 ? 1.75 : 1.5,
    ),
  );
  // Refraction samples a soft water plate; keep full-resolution glass edges.
  renderer.transmissionResolutionScale = 0.85;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 40);
  camera.position.set(0, 0, HERO_CAMERA_DISTANCE);
  const resources: Array<{ dispose: () => void }> = [];
  if (diagnostics) resources.push(diagnostics);
  let disposed = false;
  let detach = () => {};
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    detach();
    resources.forEach((resource) => resource.dispose());
    renderer.dispose();
    renderer.domElement.remove();
  };
  try {
    const loaded = await Promise.allSettled([
      new GLTFLoader().loadAsync("/assets/hero/playground-glyphs.glb"),
      new THREE.TextureLoader().loadAsync(
        "/assets/water/shallow-desktop-v1.webp",
      ),
    ]);
    // Wait for every request before cleanup, including partially successful loads.
    const [modelResult, waterResult] = loaded;
    if (modelResult.status === "fulfilled") {
      const geometries = new Set<THREE.BufferGeometry>();
      modelResult.value.scene.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        geometries.add(node.geometry);
        const materials = Array.isArray(node.material)
          ? node.material
          : [node.material];
        materials.forEach((material) => material.dispose());
      });
      resources.push(...geometries);
    }
    if (waterResult.status === "fulfilled") resources.push(waterResult.value);
    if (
      modelResult.status === "rejected" ||
      waterResult.status === "rejected"
    ) {
      throw new Error("Hero assets unavailable");
    }
    const gltf = modelResult.value;
    const texture = waterResult.value;
    texture.colorSpace = THREE.SRGBColorSpace;
    const environment = createGlassEnvironment(renderer);
    scene.environment = environment.texture;
    resources.push(environment);
    const field = new WaterField(window.innerWidth < 700 ? 72 : 96, 80);
    const surface = new THREE.DataTexture(
      field.pixels,
      field.columns,
      field.rows,
      THREE.RGBAFormat,
    );
    surface.minFilter = THREE.LinearFilter;
    surface.magFilter = THREE.LinearFilter;
    surface.generateMipmaps = false;
    surface.needsUpdate = true;
    resources.push(surface);
    const waterTime = { value: 0 };
    const waterWorldSize = new THREE.Vector2(5.1, 3);
    const glass = createGlassMaterial(surface, waterWorldSize, waterTime);
    resources.push(glass);
    const normalView = debug && new URLSearchParams(window.location.search).get("heroView") === "normals";
    const displayMaterial = normalView ? new THREE.MeshNormalMaterial() : glass;
    if (normalView) resources.push(displayMaterial);
    const letters: Letter[] = [];
    const model = gltf.scene;
    model.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.material = displayMaterial;
      const box = new THREE.Box3().setFromObject(node);
      const size = box.getSize(new THREE.Vector3());
      letters.push({
        mesh: node,
        position: node.position,
        home: node.position.clone(),
        velocity: new THREE.Vector3(),
        width: size.x,
        height: size.y,
        mass: Math.max(0.65, size.x * size.y * 3),
      });
    });
    scene.add(model);
    const contact = createGlassContact(letters.length);
    scene.add(contact.mesh);
    resources.push(contact);
    const light = new THREE.DirectionalLight(0xe8f4ff, 3.2);
    light.position.set(-3, 4, 6);
    scene.add(light);
    const fill = new THREE.DirectionalLight(0xffffff, 2);
    fill.position.set(4, 1, 3);
    scene.add(fill);
    const backgroundMaterial = new THREE.ShaderMaterial({
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
      uniforms: {
        water: { value: texture },
        resolution: { value: new THREE.Vector2(1, 1) },
        photoAspect: { value: 1600 / 900 },
        worldSize: { value: waterWorldSize },
        viewOffset: { value: new THREE.Vector2() },
        unproject: { value: new THREE.Matrix4() },
        dive: { value: 0 },
        titleCenterY: { value: 0 },
        time: waterTime,
        transmittedView: { value: 0 },
        capturePoster: { value: 0 },
        surface: { value: surface },
      },
      depthWrite: false,
      toneMapped: false,
    });
    const planeGeometry = new THREE.PlaneGeometry(1, 1);
    const background = new THREE.Mesh(planeGeometry, backgroundMaterial);
    // Three already draws this plane into the transmission target; no extra pass is needed.
    background.onBeforeRender = (activeRenderer) => {
      backgroundMaterial.uniforms.transmittedView.value =
        activeRenderer.getRenderTarget() ? 1 : 0;
      backgroundMaterial.uniformsNeedUpdate = true;
    };
    background.position.z = -1;
    scene.add(background);
    const canopy = createWaterCanopy(texture, waterTime);
    scene.add(canopy.mesh);
    resources.push(canopy);
    resources.push(backgroundMaterial, planeGeometry);
    let width = 1,
      height = 1,
      worldWidth = 5.1,
      worldHeight = 3,
      titleDocumentCenter = 0;
    let syncScroll = () => {};
    const resize = () => {
      width = host.clientWidth;
      height = host.clientHeight;
      if (!width || !height) return;
      renderer.setPixelRatio(
        Math.min(
          renderer.getPixelRatio(),
          Math.sqrt(3000000 / (width * height)),
        ),
      );
      renderer.setSize(width, height);
      // Read the actual poster frame instead of maintaining a second CSS layout.
      const title = hero.querySelector<HTMLImageElement>("[data-hero-title]");
      const titleBounds = title?.getBoundingClientRect();
      const hostBounds = host.getBoundingClientRect();
      worldWidth = 5.1 * width / (titleBounds?.width || width);
      worldHeight = (worldWidth * height) / width;
      fitHeroCamera(camera, worldWidth, worldHeight);
      canopy.resize(worldWidth, worldHeight, width < 600);
      background.scale.set(worldWidth, worldHeight, 1);
      field.resize(worldWidth, worldHeight);
      surface.needsUpdate = true;
      backgroundMaterial.uniforms.resolution.value.set(width, height);
      backgroundMaterial.uniforms.photoAspect.value = width < 600 ? 390 / 844 : 1600 / 900;
      const centerY = titleBounds
        ? titleBounds.top + titleBounds.height / 2 - hostBounds.top
        : height / 2;
      titleDocumentCenter = centerY + window.scrollY;
      model.position.y = worldHeight * (0.5 - centerY / height);
      backgroundMaterial.uniforms.worldSize.value.set(worldWidth, worldHeight);
      backgroundMaterial.uniforms.titleCenterY.value = model.position.y;
      syncScroll();
      render();
    };
    const raycaster = new THREE.Raycaster();
    const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const pointer = new THREE.Vector2(-20, -20);
    const worldPointer = new THREE.Vector3();
    const dragOffset = new THREE.Vector3();
    const dragTarget = new THREE.Vector3();
    let selected: Letter | undefined;
    let activePointer: number | undefined;
    let hovering: Letter | undefined;
    let paused = false,
      visible = true,
      frame = 0,
      elapsed = 0,
      last = 0,
      lastRipple = -1;
    let ready = false;
    let nextFrameAt = 0;
    let lastInput = 0;
    let lastPick = 0;
    let scrollDepth = 0;
    let waterJourney = 0;
    let heroVisible = true;
    let lastScrollY = window.scrollY;
    let lastScrollImpulse = 0;
    let litSurface: HTMLElement | null = null;
    const clearSurfaceLight = () => {
      if (litSurface) delete litSurface.dataset.waterLit;
      litSurface = null;
    };
    const budget = new RenderBudget();
    const render = (mode?: RenderMode) => {
      if (disposed) return;
      if (diagnostics) {
        renderer.info.autoReset = false;
        renderer.info.reset();
      }
      if (mode) diagnostics?.beginGpu(mode);
      letters.forEach((letter, index) => {
        contact.setLetter(index, letter.mesh.position.x, letter.mesh.position.y + model.position.y, letter.width, letter.height);
      });
      contact.update();
      camera.updateMatrixWorld();
      backgroundMaterial.uniforms.unproject.value.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
      renderer.render(scene, camera);
      diagnostics?.endGpu();
      diagnostics?.rendered(renderer.info.render, renderer.getPixelRatio());
      if (!ready) {
        ready = true;
        onReady();
      }
    };
    const updatePointer = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / width) * 2 - 1,
        1 - ((event.clientY - rect.top) / height) * 2,
      );
      // Intersect the actual perspective view with the held letter's plane.
      // Water disturbance and drag targets then share that same world position.
      interactionPlane.constant = -(selected?.mesh.position.z ?? 0);
      raycaster.setFromCamera(pointer, camera);
      raycaster.ray.intersectPlane(interactionPlane, worldPointer);
      worldPointer.y -= model.position.y;
    };
    const ripple = (strength: number) => {
      field.disturb(
        worldPointer.x,
        worldPointer.y + model.position.y,
        -strength * 0.16,
      );
    };
    const pickable = letters.map((letter) => letter.mesh);
    const pick = () => {
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pickable, false)[0];
      return hit ? letters.find((l) => l.mesh === hit.object) : undefined;
    };
    const acceptsPointer = (event: PointerEvent) =>
      event.pointerType !== "touch" || (heroVisible && host.dataset.touchMode === "true");
    const move = (event: PointerEvent) => {
      if (!acceptsPointer(event)) return;
      const nextSurface = event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-water-surface]") : null;
      if (litSurface !== nextSurface) {
        clearSurfaceLight();
        litSurface = nextSurface;
      }
      if (litSurface) {
        const bounds = litSurface.getBoundingClientRect();
        litSurface.style.setProperty("--light-x", `${event.clientX - bounds.left}px`);
        litSurface.style.setProperty("--light-y", `${event.clientY - bounds.top}px`);
        litSurface.dataset.waterLit = "true";
      }
      if (activePointer !== undefined && event.pointerId !== activePointer)
        return;
      lastInput = performance.now();
      updatePointer(event);
      if (paused) return;
      if (selected) {
        dragTarget.x =
          selected.home.x +
          THREE.MathUtils.clamp(
            worldPointer.x - dragOffset.x - selected.home.x,
            -0.65,
            0.65,
          );
        dragTarget.y =
          selected.home.y +
          THREE.MathUtils.clamp(
            worldPointer.y - dragOffset.y - selected.home.y,
            -0.55,
            0.55,
          );
        dragTarget.x = THREE.MathUtils.clamp(
          dragTarget.x,
          -worldWidth / 2 + selected.width / 2 + 0.03,
          worldWidth / 2 - selected.width / 2 - 0.03,
        );
      } else {
        if (lastInput - lastPick > 16) {
          hovering = heroVisible ? pick() : undefined;
          lastPick = lastInput;
        }
        renderer.domElement.style.cursor = hovering ? "grab" : "default";
        root.dataset.waterHover = String(Boolean(hovering));
      }
      if (elapsed - lastRipple > 0.075) {
        ripple(selected ? 0.8 : 0.3);
        lastRipple = elapsed;
      }
    };
    const down = (event: PointerEvent) => {
      if (
        paused ||
        !acceptsPointer(event) ||
        activePointer !== undefined ||
        event.button !== 0 ||
        !event.isPrimary
      )
        return;
      if (event.target instanceof Element && event.target.closest("a, button, input, textarea, select, summary")) return;
      lastInput = performance.now();
      updatePointer(event);
      selected = heroVisible ? pick() : undefined;
      ripple(1);
      if (selected) {
        event.preventDefault();
        root.dataset.waterDragging = "true";
        activePointer = event.pointerId;
        dragTarget.copy(selected.mesh.position);
        dragOffset.copy(worldPointer).sub(selected.mesh.position);
        renderer.domElement.setPointerCapture(event.pointerId);
        renderer.domElement.style.cursor = "grabbing";
      }
    };
    const release = (event?: PointerEvent) => {
      if (
        event &&
        activePointer !== undefined &&
        event.pointerId !== activePointer
      )
        return;
      if (selected && !paused) {
        field.disturb(
          selected.mesh.position.x,
          selected.mesh.position.y + model.position.y,
          -0.18,
          0.23,
        );
        if (event?.type === "pointercancel") selected.velocity.set(0, 0, 0);
      }
      selected = undefined;
      if (
        activePointer !== undefined &&
        renderer.domElement.hasPointerCapture(activePointer)
      )
        renderer.domElement.releasePointerCapture(activePointer);
      activePointer = undefined;
      delete root.dataset.waterDragging;
      if (event?.pointerType === "touch") pointer.set(-20, -20);
      renderer.domElement.style.cursor = "default";
    };
    const leave = () => {
      clearSurfaceLight();
      delete root.dataset.waterHover;
      hovering = undefined;
      if (!selected) pointer.set(-20, -20);
    };
    const tick = (now: number) => {
      frame = 0;
      if (disposed || paused || !visible || document.hidden) return;
      const interacting = selected !== undefined || now - lastInput < 2500;
      const interval = interacting ? 1000 / 60 : 1000 / 30;
      if (last && now + 0.5 < nextFrameAt) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const cpuStartedAt = diagnostics ? performance.now() : 0;
      // A restrained change in viewpoint reveals depth without moving the page UI.
      const inScene = Math.abs(pointer.x) <= 1 && Math.abs(pointer.y) <= 1;
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, inScene ? pointer.x * .85 : 0, .055);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, inScene ? pointer.y * .4 : 0, .055);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, HERO_CAMERA_DISTANCE - scrollDepth * .9, .06);
      camera.lookAt(0, 0, 0);
      backgroundMaterial.uniforms.viewOffset.value.set(camera.position.x, camera.position.y);
      backgroundMaterial.uniforms.dive.value = scrollDepth * .25 + waterJourney * .75;
      // Preserve cadence on 90/120/144Hz displays instead of rounding every frame down.
      if (!nextFrameAt || now - nextFrameAt > interval) nextFrameAt = now;
      nextFrameAt += interval;
      const frameMs = last ? now - last : interval;
      const dt = Math.min(frameMs / 1000, 0.05);
      last = now;
      elapsed += dt;
      backgroundMaterial.uniforms.time.value = elapsed;
      if (field.advance(dt)) surface.needsUpdate = true;
      letters.forEach((letter, index) => {
        const px = letter.mesh.position.x,
          py = letter.mesh.position.y + model.position.y;
        const lift = field.sample(px, py);
        const tiltX =
          (field.sample(px, py + 0.08) - field.sample(px, py - 0.08)) / 0.16;
        const tiltY =
          (field.sample(px + 0.08, py) - field.sample(px - 0.08, py)) / 0.16;
        letter.mesh.position.z = THREE.MathUtils.damp(
          letter.mesh.position.z,
          letter === selected ? 0.12 : lift * 1.7,
          9,
          dt,
        );
        letter.mesh.rotation.x = THREE.MathUtils.damp(
          letter.mesh.rotation.x,
          THREE.MathUtils.clamp(tiltX, -0.12, 0.12),
          7,
          dt,
        );
        if (letter === selected) {
          const x = advanceSpring(
            px,
            letter.velocity.x,
            dragTarget.x,
            dt,
            240 / letter.mass,
            28 / Math.sqrt(letter.mass),
          );
          const y = advanceSpring(
            letter.mesh.position.y,
            letter.velocity.y,
            dragTarget.y,
            dt,
            240 / letter.mass,
            28 / Math.sqrt(letter.mass),
          );
          letter.mesh.position.x = x.position;
          letter.mesh.position.y = y.position;
          letter.velocity.x = THREE.MathUtils.clamp(x.velocity, -1.8, 1.8);
          letter.velocity.y = THREE.MathUtils.clamp(y.velocity, -1.8, 1.8);
          field.disturb(
            px,
            py,
            -Math.min(Math.hypot(x.velocity, y.velocity), 1.2) * dt * 0.35,
            0.23,
          );
          return;
        }
        const float = Math.sin(elapsed * 0.8 + index * 0.73) * 0.009;
        const targetX =
          letter.home.x - THREE.MathUtils.clamp(tiltY, -0.2, 0.2) * 0.08;
        const targetY =
          letter.home.y + float + (letter === hovering ? 0.025 : 0);
        const x = advanceSpring(
          letter.mesh.position.x,
          letter.velocity.x,
          targetX,
          dt,
          95 / letter.mass,
          12 / Math.sqrt(letter.mass),
        );
        const y = advanceSpring(
          letter.mesh.position.y,
          letter.velocity.y,
          targetY,
          dt,
          95 / letter.mass,
          12 / Math.sqrt(letter.mass),
        );
        letter.mesh.position.x = x.position;
        letter.velocity.x = x.velocity;
        letter.mesh.position.y = y.position;
        letter.velocity.y = y.velocity;
        const speed = Math.hypot(x.velocity, y.velocity);
        if (speed > 0.06)
          field.disturb(px, py, -Math.min(speed, 0.8) * dt * 0.22, 0.2);
        letter.mesh.rotation.z = THREE.MathUtils.damp(
          letter.mesh.rotation.z,
          -letter.velocity.x * 0.09,
          8,
          dt,
        );
        letter.mesh.rotation.y = THREE.MathUtils.damp(
          letter.mesh.rotation.y,
          THREE.MathUtils.clamp(
            -tiltY + (letter === hovering ? 0.04 : 0),
            -0.12,
            0.12,
          ),
          6,
          dt,
        );
      });
      if (selected) {
        selected.mesh.rotation.z = THREE.MathUtils.damp(
          selected.mesh.rotation.z,
          (selected.home.x - selected.mesh.position.x) * 0.16,
          8,
          dt,
        );
      }
      // Contact impulses only matter away from rest; the composed typography stays still.
      for (let i = 0; i < letters.length; i++)
        for (let j = i + 1; j < letters.length; j++) {
          const a = letters[i],
            b = letters[j];
          if (
            a.mesh.position.distanceToSquared(a.home) < 0.001 &&
            b.mesh.position.distanceToSquared(b.home) < 0.001
          )
            continue;
          const impact = resolveContact(a, b, dt, selected);
          if (impact > 0) {
            field.disturb(
              (a.mesh.position.x + b.mesh.position.x) / 2,
              (a.mesh.position.y + b.mesh.position.y) / 2 + model.position.y,
              -Math.min(impact, 0.8) * 0.03,
              0.2,
            );
          }
        }
      // Idle rendering has its own budget; slow idle frames must adapt too.
      const mode = interacting ? "active" : "idle";
      if (budget.sample(mode, frameMs) && renderer.getPixelRatio() > 0.8) {
        renderer.setPixelRatio(Math.max(0.8, renderer.getPixelRatio() - 0.25));
        renderer.setSize(width, height);
      }
      render(mode);
      diagnostics?.frame(interacting ? "active" : "idle", now, performance.now() - cpuStartedAt);
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      if (frame || paused || !visible || document.hidden || disposed) return;
      last = 0;
      nextFrameAt = 0;
      budget.reset();
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      diagnostics?.stopped(disposed ? "disposed" : paused ? "paused" : document.hidden ? "hidden" : "offscreen");
    };
    const blur = () => {
      clearSurfaceLight();
      delete root.dataset.waterHover;
      pointer.set(-20, -20);
      hovering = undefined;
      release();
    };
    const visibility = () => {
      if (document.hidden) {
        release();
        stop();
      } else if (paused) render();
      else start();
    };
    const onScroll = () => {
      const bounds = hero.getBoundingClientRect();
      scrollDepth = THREE.MathUtils.clamp(-bounds.top / Math.max(1, bounds.height), 0, 1);
      waterJourney = THREE.MathUtils.clamp(window.scrollY / Math.max(1, root.scrollHeight - height), 0, 1);
      heroVisible = bounds.bottom > 0 && bounds.top < height;
      if (!heroVisible && selected) release();
      model.visible = heroVisible;
      contact.mesh.visible = heroVisible;
      model.position.y = worldHeight * (0.5 - (titleDocumentCenter - window.scrollY) / height);
      backgroundMaterial.uniforms.titleCenterY.value = model.position.y;
      canopy.setDepth(scrollDepth);
      const now = performance.now();
      const delta = window.scrollY - lastScrollY;
      if (!paused && Math.abs(delta) > 1 && now - lastScrollImpulse > 80) {
        field.disturb(-worldWidth * .15, -Math.sign(delta) * worldHeight * .3,
          -.025 * THREE.MathUtils.clamp(delta / 80, -1, 1), worldWidth * .22);
        lastScrollImpulse = now;
        lastInput = now;
      }
      lastScrollY = window.scrollY;
      backgroundMaterial.uniforms.dive.value = scrollDepth * .25 + waterJourney * .75;
      // Pause stops autonomous motion; native scrolling must still move the scene.
      if (paused && !document.hidden) {
        camera.position.z = HERO_CAMERA_DISTANCE - scrollDepth * .9;
        render();
      }
    };
    syncScroll = onScroll;
    window.addEventListener("scroll", onScroll, { passive: true });
    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
        if (visible) start();
        else {
          release();
          stop();
        }
      },
      { threshold: 0 },
    );
    const resizeObserver = new ResizeObserver(resize);
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    renderer.domElement.addEventListener("lostpointercapture", release);
    document.documentElement.addEventListener("pointerleave", leave);
    const contextLost = (event: Event) => {
      event.preventDefault();
      dispose();
      onUnavailable();
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", blur);
    detach = () => {
      stop();
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", blur);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      document.documentElement.removeEventListener("pointerleave", leave);
      clearSurfaceLight();
      delete root.dataset.waterDragging;
      delete root.dataset.waterHover;
    };
    resize();
    onScroll();
    observer.observe(root);
    resizeObserver.observe(host);
    start();
    const resetLetters = () => {
      release();
      letters.forEach((letter) => {
        letter.mesh.position.copy(letter.home);
        letter.mesh.rotation.set(0, 0, 0);
        letter.velocity.set(0, 0, 0);
      });
      field.reset();
      elapsed = 0;
      lastRipple = -1;
      surface.needsUpdate = true;
      backgroundMaterial.uniforms.time.value = 0;
    };
    return {
      splash() {
        if (paused || disposed) return;
        lastInput = performance.now();
        field.disturb(0, model.position.y - 0.55, -0.32, 0.34);
        for (const letter of letters) {
          const distance = Math.hypot(
            letter.mesh.position.x,
            letter.mesh.position.y + 0.55,
          );
          const impulse = (Math.exp(-distance * 1.8) * 0.45) / letter.mass;
          letter.velocity.y += impulse;
          letter.velocity.x +=
            Math.sign(letter.mesh.position.x) * impulse * 0.3;
        }
        start();
      },
      setPaused(value: boolean) {
        paused = value;
        release();
        if (value) stop();
        else start();
      },
      reset() {
        resetLetters();
        render();
      },
      capturePoster(layer: "title" | "waterDesktop" | "waterMobile" = "title") {
        if (!debug || disposed) return null;
        stop();
        // Asset exports deliberately reset the simulation to a reproducible rest pose.
        resetLetters();
        const ratio = renderer.getPixelRatio();
        const cameraPosition = camera.position.clone();
        camera.position.set(0, 0, HERO_CAMERA_DISTANCE);
        camera.lookAt(0, 0, 0);
        try {
          // Export the same optics at rest with only the final background hidden.
          // The water and rear faces still participate in the transmission pass.
          const titleLayer = layer === "title";
          const captureWidth = layer === "waterMobile" ? 780 : 1600;
          const captureHeight = titleLayer ? 780 : layer === "waterMobile" ? 1688 : 900;
          const captureWorldHeight = 5.1 * captureHeight / captureWidth;
          renderer.setPixelRatio(1);
          renderer.setSize(captureWidth, captureHeight, false);
          renderer.setClearAlpha(titleLayer ? 0 : 1);
          fitHeroCamera(camera, 5.1, captureWorldHeight);
          canopy.setDepth(0);
          canopy.mesh.visible = !titleLayer;
          canopy.resize(5.1, captureWorldHeight, layer === "waterMobile");
          model.visible = titleLayer;
          contact.mesh.visible = titleLayer;
          model.position.y = 0;
          backgroundMaterial.uniforms.worldSize.value.set(5.1, captureWorldHeight);
          backgroundMaterial.uniforms.titleCenterY.value = 0;
          backgroundMaterial.uniforms.viewOffset.value.set(0, 0);
          backgroundMaterial.uniforms.dive.value = 0;
          backgroundMaterial.uniforms.photoAspect.value = layer === "waterMobile" ? 390 / 844 : 1600 / 900;
          background.scale.set(5.1, captureWorldHeight, 1);
          backgroundMaterial.uniforms.resolution.value.set(captureWidth, captureHeight);
          backgroundMaterial.uniforms.capturePoster.value = titleLayer ? 1 : 0;
          render();
          return renderer.domElement.toDataURL("image/png");
        } finally {
          backgroundMaterial.uniforms.capturePoster.value = 0;
          canopy.setDepth(scrollDepth);
          model.visible = heroVisible;
          contact.mesh.visible = heroVisible;
          backgroundMaterial.uniforms.viewOffset.value.set(cameraPosition.x, cameraPosition.y);
          backgroundMaterial.uniforms.dive.value = scrollDepth * .25 + waterJourney * .75;
          renderer.setClearAlpha(1);
          renderer.setPixelRatio(ratio);
          camera.position.copy(cameraPosition);
          camera.lookAt(0, 0, 0);
          resize();
          start();
        }
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
