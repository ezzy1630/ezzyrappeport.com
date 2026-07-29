/**
 * Argyph encounter — short local sonar index (plan §10.5).
 *
 * One decisive bathymetric scan: a sonar sweep crosses the local code reef;
 * tier-0 reef points light immediately, symbol nodes (the 19 read-only
 * tools) resolve as the sweep passes, semantic links emerge last. A click
 * sends one bounded query pulse that briefly reveals its returned span.
 * The resolved map then widens into the Charted Work catalog.
 *
 * Every primary transform is a pure function of chapter progress; query
 * pulses are bounded secondary responses.
 */

import {
  AdditiveBlending,
  BoxGeometry,
  ClampToEdgeWrapping,
  Color,
  DirectionalLight,
  DoubleSide,
  DynamicDrawUsage,
  EdgesGeometry,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PointLight,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
} from "three";
import type {
  EncounterAudioEvent,
  EncounterFrameResult,
  EncounterLoadContext,
  ProjectEncounter,
} from "../../encounter-contract.ts";
import {
  ARGYPH_COLORS,
  ARGYPH_COUNTS,
  ARGYPH_LOOP,
  ARGYPH_STAGE,
  linkPair,
  reefPoint,
  symbolPoint,
} from "./argyphConfig.ts";
import { createRoundedPanelGeometry } from "../shared/productGeometry.ts";

function smoothstep01(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

type QueryPulse = {
  active: boolean;
  bornAt: number;
  center: Vector3;
  revealed: boolean;
};

const _pos = new Vector3();
const _quat = new Quaternion();
const _scale = new Vector3();
const _matrix = new Matrix4();
const _color = new Color();
const _linkAxis = new Vector3(0, 0, 1);
const _slabAxis = new Vector3(1, 0, 0);
const _reefCool = new Color(ARGYPH_COLORS.reef);
const _queryWarm = new Color(ARGYPH_COLORS.query);
const _anchor: [number, number, number] = [0, 0, 0];

export function createArgyphEncounter(): ProjectEncounter {
  const root = new Vector3();
  let stage: Group | null = null;
  let loaded = false;
  let disposed = false;
  let layoutMode: "desktop" | "mobile" = "desktop";

  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(resource: T): T => {
    disposables.push(resource);
    return resource;
  };

  let reef: InstancedMesh | null = null;
  let reefMaterial: MeshBasicMaterial | null = null;
  let symbols: InstancedMesh | null = null;
  let symbolMaterial: MeshPhysicalMaterial | null = null;
  let links: InstancedMesh | null = null;
  let linkMaterial: MeshBasicMaterial | null = null;
  let sweepRing: Mesh | null = null;
  let sweepMaterial: MeshBasicMaterial | null = null;
  let indexStack: Group | null = null;
  let brandMark: Group | null = null;
  let lightingRig: Group | null = null;
  let brandMedallionMaterial: MeshPhysicalMaterial | null = null;
  let brandLogo: Mesh | null = null;
  let brandLogoMaterial: MeshBasicMaterial | null = null;
  const stackSlabs: Mesh[] = [];
  const stackSlabMaterials: MeshPhysicalMaterial[] = [];
  const stackEdges: LineSegments[] = [];
  const stackEdgeMaterials: LineBasicMaterial[] = [];
  let stackRails: InstancedMesh | null = null;
  let stackRailMaterial: MeshBasicMaterial | null = null;
  const pulseMeshes: Mesh[] = [];
  const pulseMaterials: MeshBasicMaterial[] = [];
  const pulses: QueryPulse[] = [];

  const reefPositions: Vector3[] = [];
  const symbolPositions: Vector3[] = [];
  const symbolRadius: number[] = [];

  let fade = 0;
  const eventBuffer: EncounterAudioEvent[] = [];

  function reefCenter(): Vector3 {
    const c = layoutMode === "mobile" ? ARGYPH_STAGE.reefMobile : ARGYPH_STAGE.reefDesktop;
    return root.set(c[0], c[1], c[2]);
  }

  return {
    id: "argyph",
    estimatedGpuMb: 2,

    async load(context: EncounterLoadContext) {
      if (loaded || disposed || context.signal.aborted) return;
      layoutMode = context.layout;
      const center = reefCenter();

      // Product silhouette from the portfolio's real Argyph identity: three
      // sealed local layers for repo packing, semantic chunks, and the symbol
      // graph. The live index resolves over this physical stack.
      indexStack = new Group();
      indexStack.name = "argyph-local-index-stack";
      indexStack.position.copy(center);
      indexStack.scale.setScalar(layoutMode === "mobile" ? 0.56 : 0.82);
      const slabGeometry = track(createRoundedPanelGeometry(1.48, 0.72, 0.095, 0.105, 0.012));
      const slabEdgeGeometry = track(new EdgesGeometry(slabGeometry, 32));
      for (let layer = 0; layer < 3; layer += 1) {
        const material = track(new MeshPhysicalMaterial({
          color: layer === 2 ? 0x303963 : layer === 1 ? 0x1e2d4b : 0x111d32,
          emissive: layer === 2 ? 0x11162d : 0x070d18,
          emissiveIntensity: 0.3,
          roughness: 0.18 + layer * 0.04,
          metalness: 0.42,
          clearcoat: 1,
          clearcoatRoughness: 0.12,
          transparent: true,
          opacity: 0,
          depthWrite: true,
          side: DoubleSide,
        }));
        const slab = new Mesh(slabGeometry, material);
        slab.position.set(0, (layer - 1) * 0.24, (layer - 1) * 0.12);
        slab.rotation.x = -0.32;
        indexStack.add(slab);
        stackSlabs.push(slab);
        stackSlabMaterials.push(material);

        const edgeMaterial = track(new LineBasicMaterial({
          color: layer === 2 ? ARGYPH_COLORS.symbol : ARGYPH_COLORS.link,
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
        }));
        const edge = new LineSegments(slabEdgeGeometry, edgeMaterial);
        edge.position.copy(slab.position);
        edge.rotation.copy(slab.rotation);
        indexStack.add(edge);
        stackEdges.push(edge);
        stackEdgeMaterials.push(edgeMaterial);
      }

      stackRailMaterial = track(new MeshBasicMaterial({
        color: ARGYPH_COLORS.link,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }));
      stackRails = new InstancedMesh(
        track(createRoundedPanelGeometry(0.43, 0.012, 0.009, 0.005, 0.001)),
        stackRailMaterial,
        12,
      );
      stackRails.instanceMatrix.setUsage(DynamicDrawUsage);
      indexStack.add(stackRails);

      // Exact A/G identity embedded into the local index appliance. It reads
      // as one product, not a separate logo tile floating above a diagram.
      brandMark = new Group();
      brandMark.name = "argyph-angular-mark";
      brandMark.position.set(
        center.x,
        center.y + (layoutMode === "mobile" ? 0.22 : 0.3),
        0.2,
      );
      brandMedallionMaterial = track(new MeshPhysicalMaterial({
        color: 0x0a1020,
        emissive: 0x050712,
        emissiveIntensity: 0.3,
        roughness: 0.15,
        metalness: 0.5,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        transparent: true,
        opacity: 0,
        depthWrite: true,
      }));
      const medallion = new Mesh(
        track(createRoundedPanelGeometry(0.5, 0.44, 0.075, 0.105, 0.01)),
        brandMedallionMaterial,
      );
      medallion.position.z = -0.055;
      brandMark.add(medallion);
      const identityTexture = await new TextureLoader().loadAsync("/projects/argyph/argyph-identity.webp");
      if (context.signal.aborted || disposed) {
        identityTexture.dispose();
        return;
      }
      identityTexture.colorSpace = SRGBColorSpace;
      identityTexture.wrapS = ClampToEdgeWrapping;
      identityTexture.wrapT = ClampToEdgeWrapping;
      identityTexture.repeat.set(0.28, 0.24);
      identityTexture.offset.set(0.36, 0.69);
      identityTexture.anisotropy = context.qualityTier === "high" ? 8 : 4;
      identityTexture.needsUpdate = true;
      track(identityTexture);
      brandLogoMaterial = track(new MeshBasicMaterial({
        color: 0xffffff,
        map: identityTexture,
        alphaMap: identityTexture,
        alphaTest: 0.045,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }));
      brandLogo = new Mesh(track(new PlaneGeometry(0.42, 0.36)), brandLogoMaterial);
      brandLogo.position.z = 0.02;
      brandMark.add(brandLogo);

      for (let index = 0; index < ARGYPH_COUNTS.reefPoints; index += 1) {
        reefPoint(index, _anchor);
        reefPositions.push(new Vector3(
          center.x + _anchor[0],
          center.y + _anchor[1],
          _anchor[2],
        ));
      }
      for (let index = 0; index < ARGYPH_COUNTS.symbols; index += 1) {
        symbolPoint(index, _anchor);
        const position = new Vector3(
          center.x + _anchor[0],
          center.y + _anchor[1],
          _anchor[2],
        );
        symbolPositions.push(position);
        symbolRadius.push(Math.hypot(position.x - center.x, position.y - center.y));
      }

      reefMaterial = track(new MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }));
      reef = new InstancedMesh(
        track(new IcosahedronGeometry(0.011, 1)),
        reefMaterial,
        ARGYPH_COUNTS.reefPoints,
      );
      reef.instanceMatrix.setUsage(DynamicDrawUsage);
      reef.instanceColor = new InstancedBufferAttribute(
        new Float32Array(ARGYPH_COUNTS.reefPoints * 3).fill(0),
        3,
      );
      reef.instanceColor.setUsage(DynamicDrawUsage);
      _quat.identity();
      for (let index = 0; index < ARGYPH_COUNTS.reefPoints; index += 1) {
        _scale.setScalar(0.6 + (index % 4) * 0.18);
        _matrix.compose(reefPositions[index], _quat, _scale);
        reef.setMatrixAt(index, _matrix);
      }

      symbolMaterial = track(new MeshPhysicalMaterial({
        color: ARGYPH_COLORS.symbol,
        emissive: 0x30386f,
        emissiveIntensity: 0.7,
        roughness: 0.16,
        metalness: 0.3,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        transparent: true,
        opacity: 0,
        depthWrite: true,
      }));
      symbols = new InstancedMesh(
        track(new IcosahedronGeometry(0.03, 1)),
        symbolMaterial,
        ARGYPH_COUNTS.symbols,
      );
      symbols.instanceMatrix.setUsage(DynamicDrawUsage);

      // Semantic links share one instanced draw. Per-link emergence remains
      // deterministic through each instance matrix.
      linkMaterial = track(new MeshBasicMaterial({
        color: ARGYPH_COLORS.link,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }));
      links = new InstancedMesh(
        track(new BoxGeometry(1, 0.004, 0.004)),
        linkMaterial,
        ARGYPH_COUNTS.links,
      );
      links.instanceMatrix.setUsage(DynamicDrawUsage);

      // Sonar sweep ring.
      sweepMaterial = track(new MeshBasicMaterial({
        color: ARGYPH_COLORS.sweep,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: 2,
      }));
      sweepRing = new Mesh(
        track(new RingGeometry(0.96, 1, 96)),
        sweepMaterial,
      );
      sweepRing.position.copy(center);

      // Query pulse pool.
      for (let pulse = 0; pulse < ARGYPH_COUNTS.probePool; pulse += 1) {
        const material = track(new MeshBasicMaterial({
          color: ARGYPH_COLORS.query,
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
          side: 2,
        }));
        const mesh = new Mesh(track(new RingGeometry(0.97, 1, 48)), material);
        mesh.visible = false;
        pulseMeshes.push(mesh);
        pulseMaterials.push(material);
        pulses.push({ active: false, bornAt: 0, center: new Vector3(), revealed: false });
      }

      lightingRig = new Group();
      lightingRig.name = "argyph-product-lighting";
      const ambient = new HemisphereLight(0xe9efff, 0x050914, 1.2);
      const key = new DirectionalLight(0xf3f5ff, 2.15);
      key.position.set(-1.6, 2.4, 2.8);
      const rim = new PointLight(ARGYPH_COLORS.symbol, 3.6, 5.2, 1.5);
      rim.position.set(0.9, -0.25, 1.5);
      lightingRig.add(ambient, key, rim);

      loaded = true;
    },

    attach(stageRoot) {
      if (!loaded || stage) return;
      stage = stageRoot;
      const objects = [lightingRig, indexStack, brandMark, reef, symbols, links, sweepRing, ...pulseMeshes];
      for (const object of objects) {
        if (object) stage.add(object);
      }
    },

    seek(frame) {
      if (!loaded || disposed) return;
      fade = frame.fade;
      layoutMode = frame.layout;
      const t = clamp01(frame.chapterProgress);
      const center = reefCenter();
      const loop = ARGYPH_LOOP;
      const reefT = smoothstep01((t - loop.reefStart) / (loop.reefFull - loop.reefStart));
      const sweepT = smoothstep01((t - loop.sweepStart) / (loop.sweepFull - loop.sweepStart));
      const linksT = smoothstep01((t - loop.linksStart) / (loop.linksFull - loop.linksStart));
      const widenT = smoothstep01((t - loop.widenStart) / (loop.widenFull - loop.widenStart));
      const spread = 1 + widenT * 0.55;

      if (indexStack) {
        indexStack.rotation.y = frame.reducedMotion
          ? -0.12
          : -0.12 + Math.sin(frame.time * 0.22) * 0.045;
        indexStack.rotation.z = widenT * -0.035;
        const layerProgress = [reefT, sweepT, linksT];
        for (let layer = 0; layer < layerProgress.length; layer += 1) {
          const reveal = layerProgress[layer];
          stackSlabMaterials[layer].opacity = reveal * (0.52 + layer * 0.1) * fade;
          stackEdgeMaterials[layer].opacity = reveal * (0.22 + layer * 0.08) * fade;
          stackSlabs[layer].position.y = (layer - 1) * (0.17 + widenT * 0.045);
          stackSlabs[layer].position.z = (layer - 1) * 0.11;
          stackEdges[layer].position.copy(stackSlabs[layer].position);
        }
        if (stackRails && stackRailMaterial) {
          stackRailMaterial.opacity = linksT * 0.68 * fade;
          for (let rail = 0; rail < 12; rail += 1) {
            const layer = Math.floor(rail / 4);
            const cell = rail % 4;
            _pos.set(
              cell % 2 === 0 ? -0.36 : 0.36,
              (layer - 1) * (0.17 + widenT * 0.045) + (cell < 2 ? 0.14 : -0.14),
              (layer - 1) * 0.11 + 0.065,
            );
            _quat.setFromAxisAngle(_slabAxis, -0.32);
            _scale.setScalar(smoothstep01((layerProgress[layer] - cell * 0.07) / 0.79));
            _matrix.compose(_pos, _quat, _scale);
            stackRails.setMatrixAt(rail, _matrix);
          }
          stackRails.instanceMatrix.needsUpdate = true;
        }
      }
      if (brandMark) {
        const markReveal = smoothstep01((sweepT - 0.28) / 0.55);
        brandMark.rotation.y = frame.reducedMotion ? 0.1 : Math.sin(frame.time * 0.31) * 0.12;
        brandMark.scale.setScalar((0.72 + markReveal * 0.16) * (layoutMode === "mobile" ? 0.68 : 1));
        if (brandMedallionMaterial) {
          brandMedallionMaterial.opacity = (0.2 + markReveal * 0.72) * fade;
        }
        if (brandLogo && brandLogoMaterial) {
          brandLogoMaterial.opacity = markReveal * fade;
          brandLogo.scale.setScalar(0.68 + markReveal * 0.32);
        }
      }

      // Sonar sweep: one decisive pass, then it rests as the map widens.
      if (sweepRing && sweepMaterial) {
        const radius = 0.08 + sweepT * ARGYPH_STAGE.sweepRadiusMax * 0.68;
        sweepRing.scale.setScalar(Math.max(radius, 1e-4) * (1 + widenT * 0.1));
        sweepMaterial.opacity = sweepT > 0 && sweepT < 1
          ? (0.17 - sweepT * 0.12) * fade
          : (1 - sweepT) * 0.12 * fade;
        sweepRing.position.copy(center);
      }

      // Reef points: tier-0 lights immediately; the sweep brightens as it
      // passes each point's radius; query pulses warm their bounded span.
      if (reef && reefMaterial) {
        reefMaterial.opacity = fade;
        for (let index = 0; index < ARGYPH_COUNTS.reefPoints; index += 1) {
          const position = reefPositions[index];
          const radius = Math.hypot(position.x - center.x, position.y - center.y);
          const sweepRadius = sweepT * ARGYPH_STAGE.sweepRadiusMax * 1.15;
          const passed = smoothstep01((sweepRadius - radius) / 0.2);
          let brightness = reefT * 0.16 + passed * 0.5;
          for (const pulse of pulses) {
            if (!pulse.active) continue;
            const age = frame.time - pulse.bornAt;
            const pulseRadius = age * 1.6;
            const distance = Math.hypot(position.x - pulse.center.x, position.y - pulse.center.y);
            const inSpan = distance < ARGYPH_STAGE.queryRadius ? 1 : 0;
            const ringHit = Math.exp(-((distance - pulseRadius) ** 2) * 60);
            brightness += (inSpan * 0.5 + ringHit * 0.6) * Math.exp(-age * 1.8);
          }
          _pos.set(
            center.x + (position.x - center.x) * spread,
            center.y + (position.y - center.y) * spread,
            position.z,
          );
          _quat.identity();
          _scale.setScalar((0.6 + (index % 4) * 0.18) * (1 + brightness * 0.3));
          _matrix.compose(_pos, _quat, _scale);
          reef.setMatrixAt(index, _matrix);
          _color.copy(_reefCool).multiplyScalar(brightness);
          reef.setColorAt(index, _color);
        }
        reef.instanceMatrix.needsUpdate = true;
        if (reef.instanceColor) reef.instanceColor.needsUpdate = true;
      }

      // Symbol nodes resolve as the sweep passes their radius.
      if (symbols && symbolMaterial) {
        symbolMaterial.opacity = fade * 0.96;
        for (let index = 0; index < ARGYPH_COUNTS.symbols; index += 1) {
          const resolve = smoothstep01((sweepT * 1.2 - symbolRadius[index] / ARGYPH_STAGE.sweepRadiusMax) / 0.3);
          _pos.set(
            center.x + (symbolPositions[index].x - center.x) * spread,
            center.y + (symbolPositions[index].y - center.y) * spread,
            symbolPositions[index].z,
          );
          _quat.identity();
          _scale.setScalar(resolve * (1 + Math.sin(frame.time * 0.7 + index) * 0.06 * (frame.reducedMotion ? 0 : 1)));
          _matrix.compose(_pos, _quat, _scale);
          symbols.setMatrixAt(index, _matrix);
        }
        symbols.instanceMatrix.needsUpdate = true;
      }

      // Semantic links emerge after the symbols resolve.
      if (links && linkMaterial) {
        linkMaterial.opacity = 0.42 * fade * (1 - widenT * 0.3);
      }
      for (let link = 0; link < ARGYPH_COUNTS.links; link += 1) {
        const [first, second] = linkPair(link);
        const stagger = (link % 6) * 0.05;
        const emerge = smoothstep01((linksT - stagger) / Math.max(1 - stagger, 1e-6));
        const a = symbolPositions[first];
        const b = symbolPositions[second];
        const ax = center.x + (a.x - center.x) * spread;
        const ay = center.y + (a.y - center.y) * spread;
        const bx = center.x + (b.x - center.x) * spread;
        const by = center.y + (b.y - center.y) * spread;
        const length = Math.hypot(bx - ax, by - ay) * emerge;
        _pos.set((ax + bx) / 2, (ay + by) / 2, 0.02);
        _quat.setFromAxisAngle(_linkAxis, Math.atan2(by - ay, bx - ax));
        _scale.set(Math.max(length, 1e-4), emerge, emerge);
        _matrix.compose(_pos, _quat, _scale);
        links?.setMatrixAt(link, _matrix);
      }
      if (links) links.instanceMatrix.needsUpdate = true;

      // Audio hook: the sweep completes once per traversal.
      if (sweepT >= 0.98 && sweepT < 1 && eventBuffer.length < 4) {
        eventBuffer.push("telemetry-return");
      }
    },

    probe(event) {
      if (!loaded || disposed || fade < 0.35) return;
      if (event.kind !== "down") return;
      const pulse = pulses.find((candidate) => !candidate.active);
      if (!pulse) return;
      // One local sonar query pulse from the probe point.
      pulse.active = true;
      pulse.revealed = false;
      pulse.bornAt = event.time;
      pulse.center.set(event.x, event.y, 0);
      if (eventBuffer.length < 4) eventBuffer.push("probe-pulse");
    },

    update(frame) {
      const drained = eventBuffer.slice();
      eventBuffer.length = 0;
      const empty: EncounterFrameResult = { drawCalls: 0, audioEvents: drained };
      if (!loaded || disposed) return empty;

      for (let index = 0; index < pulses.length; index += 1) {
        const pulse = pulses[index];
        const mesh = pulseMeshes[index];
        const material = pulseMaterials[index];
        if (!pulse.active) {
          mesh.visible = false;
          continue;
        }
        const age = frame.time - pulse.bornAt;
        if (age > 1.4) {
          pulse.active = false;
          mesh.visible = false;
          continue;
        }
        if (!pulse.revealed && age > 0.3) {
          pulse.revealed = true;
          if (eventBuffer.length < 4) eventBuffer.push("judge-hit");
        }
        mesh.visible = true;
        mesh.position.copy(pulse.center);
        mesh.scale.setScalar(Math.max(age * 1.6, 1e-4));
        material.opacity = Math.exp(-age * 2.2) * 0.7 * fade;
      }
      return {
        drawCalls: 0,
        audioEvents: drained.concat(eventBuffer),
      };
    },

    detach() {
      if (!stage) return;
      const objects = [lightingRig, indexStack, brandMark, reef, symbols, links, sweepRing, ...pulseMeshes];
      for (const object of objects) {
        if (object && object.parent === stage) stage.remove(object);
      }
      stage = null;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      if (stage) {
        const objects = [lightingRig, indexStack, brandMark, reef, symbols, links, sweepRing, ...pulseMeshes];
        for (const object of objects) {
          if (object && object.parent === stage) stage.remove(object);
        }
        stage = null;
      }
      for (const resource of disposables) resource.dispose();
      disposables.length = 0;
      pulseMeshes.length = 0;
      pulseMaterials.length = 0;
      pulses.length = 0;
      reefPositions.length = 0;
      symbolPositions.length = 0;
      symbolRadius.length = 0;
      stackSlabs.length = 0;
      stackSlabMaterials.length = 0;
      stackEdges.length = 0;
      stackEdgeMaterials.length = 0;
      loaded = false;
    },
  };
}

export default createArgyphEncounter;
