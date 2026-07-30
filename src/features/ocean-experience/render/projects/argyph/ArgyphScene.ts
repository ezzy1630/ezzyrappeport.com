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
  ShaderMaterial,
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
import { createInstrumentLabel } from "../shared/instrumentLabel.ts";

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
  let brandLogo: Mesh | null = null;
  let brandLogoMaterial: ShaderMaterial | null = null;
  const tierLabels: Mesh[] = [];
  const tierLabelMaterials: MeshBasicMaterial[] = [];
  let stackRails: InstancedMesh | null = null;
  let stackRailMaterial: MeshBasicMaterial | null = null;
  let stackFins: InstancedMesh | null = null;
  let stackFinMaterial: MeshPhysicalMaterial | null = null;
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

      // Open local-index instrument: rails, graph fins, and live symbols.
      // Repository structure stays spatial without becoming another device.
      indexStack = new Group();
      indexStack.name = "argyph-local-index-stack";
      indexStack.position.copy(center);
      indexStack.scale.setScalar(layoutMode === "mobile" ? 0.56 : 0.82);
      stackRailMaterial = track(new MeshBasicMaterial({
        color: ARGYPH_COLORS.link,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }));
      stackRails = new InstancedMesh(
        track(createRoundedPanelGeometry(0.12, 0.012, 0.009, 0.005, 0.001)),
        stackRailMaterial,
        12,
      );
      stackRails.instanceMatrix.setUsage(DynamicDrawUsage);
      indexStack.add(stackRails);

      stackFinMaterial = track(new MeshPhysicalMaterial({
        color: 0x2c3556,
        emissive: 0x0a0e1d,
        emissiveIntensity: 0.24,
        roughness: 0.2,
        metalness: 0.62,
        clearcoat: 0.8,
        transparent: true,
        opacity: 0,
        depthWrite: true,
      }));
      stackFins = new InstancedMesh(
        track(createRoundedPanelGeometry(0.13, 0.025, 0.055, 0.008, 0.002)),
        stackFinMaterial,
        7,
      );
      for (let fin = 0; fin < 7; fin += 1) {
        _pos.set(0.55, -0.3 + fin * 0.1, 0.01 + fin * 0.004);
        _quat.identity();
        _scale.setScalar(1);
        _matrix.compose(_pos, _quat, _scale);
        stackFins.setMatrixAt(fin, _matrix);
      }
      indexStack.add(stackFins);

      // Exact A/G identity sits directly on the shallow local index layers.
      // The mark stays flat; only the indexed data stack carries depth.
      brandMark = new Group();
      brandMark.name = "argyph-angular-mark";
      brandMark.position.set(
        center.x,
        center.y + (layoutMode === "mobile" ? 0.14 : 0.16),
        0.2,
      );
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
      brandLogoMaterial = track(new ShaderMaterial({
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv * vec2(0.28, 0.24) + vec2(0.36, 0.69);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D uIdentity;
          uniform float uOpacity;
          varying vec2 vUv;
          void main() {
            vec4 texel = texture2D(uIdentity, vUv);
            float luminance = dot(texel.rgb, vec3(0.2126, 0.7152, 0.0722));
            float mask = smoothstep(0.055, 0.24, luminance);
            if (mask < 0.02) discard;
            gl_FragColor = vec4(vec3(0.76, 0.82, 1.0) * (0.72 + luminance), mask * uOpacity);
          }
        `,
        uniforms: {
          uIdentity: { value: identityTexture },
          uOpacity: { value: 0 },
        },
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      }));
      brandLogo = new Mesh(track(new PlaneGeometry(0.54, 0.48)), brandLogoMaterial);
      brandLogo.name = "argyph-flat-identity-mark";
      brandLogo.position.z = 0.02;
      brandMark.add(brandLogo);

      const tierGeometry = track(new PlaneGeometry(0.21, 0.065));
      const tiers = [
        ["REPOSITORY", "packed source + docs", -0.38, 0.14],
        ["SEMANTIC", "local chunk index", 0.34, -0.02],
        ["SYMBOLS", "definitions + refs", -0.22, -0.3],
      ] as const;
      for (let tier = 0; tier < tiers.length; tier += 1) {
        const [title, detail, x, y] = tiers[tier];
        const label = createInstrumentLabel(title, detail, {
          accent: tier === 0 ? "#9aa9e8" : tier === 1 ? "#8ed2dc" : "#c0b4ef",
          background: "rgba(8, 13, 31, 0.82)",
          foreground: "rgba(244, 246, 255, 0.98)",
          muted: "rgba(169, 177, 211, 0.94)",
        });
        track(label.texture);
        track(label.material);
        const mesh = new Mesh(tierGeometry, label.material);
        mesh.name = `argyph-tier-${tier + 1}`;
        mesh.position.set(center.x + x, center.y + y, 0.22);
        mesh.renderOrder = 4;
        tierLabels.push(mesh);
        tierLabelMaterials.push(label.material);
      }

      for (let index = 0; index < ARGYPH_COUNTS.reefPoints; index += 1) {
        reefPoint(index, _anchor);
        reefPositions.push(new Vector3(
          center.x + _anchor[0] * 0.48,
          center.y - 0.12 + _anchor[1] * 0.58,
          0.18 + _anchor[2] * 0.15,
        ));
      }
      for (let index = 0; index < ARGYPH_COUNTS.symbols; index += 1) {
        symbolPoint(index, _anchor);
        const position = new Vector3(
          center.x + _anchor[0] * 0.52,
          center.y - 0.12 + _anchor[1] * 0.58,
          0.2 + _anchor[2] * 0.12,
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
        track(new IcosahedronGeometry(0.006, 1)),
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
        track(new IcosahedronGeometry(0.018, 1)),
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
      const objects = [lightingRig, brandMark, reef, symbols, links, sweepRing, ...pulseMeshes, ...tierLabels];
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
      const spread = 1 + widenT * 0.06;

      if (indexStack) {
        indexStack.rotation.y = frame.reducedMotion
          ? -0.12
          : -0.12 + Math.sin(frame.time * 0.22) * 0.045;
        indexStack.rotation.z = widenT * -0.035;
        if (stackRails && stackRailMaterial) {
          stackRailMaterial.opacity = linksT * 0.68 * fade;
          for (let rail = 0; rail < 12; rail += 1) {
            const row = Math.floor(rail / 4);
            const column = rail % 4;
            _pos.set(
              -0.27 + column * 0.18,
              -0.25 - row * 0.1,
              0.185,
            );
            _quat.setFromAxisAngle(_slabAxis, -0.14);
            _scale.setScalar(smoothstep01((linksT - rail * 0.025) / 0.7));
            _matrix.compose(_pos, _quat, _scale);
            stackRails.setMatrixAt(rail, _matrix);
          }
          stackRails.instanceMatrix.needsUpdate = true;
        }
        if (stackFinMaterial) {
          stackFinMaterial.opacity = reefT * 0.76 * fade;
        }
      }
      if (brandMark) {
        const markReveal = smoothstep01((sweepT - 0.28) / 0.55);
        brandMark.rotation.y = frame.reducedMotion ? 0.1 : Math.sin(frame.time * 0.31) * 0.12;
        brandMark.scale.setScalar((0.72 + markReveal * 0.16) * (layoutMode === "mobile" ? 0.68 : 1));
        if (brandLogo && brandLogoMaterial) {
          brandLogoMaterial.uniforms.uOpacity.value = markReveal * fade;
          brandLogo.scale.setScalar(0.68 + markReveal * 0.32);
        }
      }
      const tierProgress = [reefT, sweepT, linksT];
      for (let tier = 0; tier < tierLabels.length; tier += 1) {
        const reveal = smoothstep01((tierProgress[tier] - tier * 0.06) / Math.max(1 - tier * 0.06, 1e-6));
        tierLabelMaterials[tier].opacity = reveal * (0.92 - widenT * 0.16) * fade;
        tierLabels[tier].scale.setScalar((0.72 + reveal * 0.28) * (layoutMode === "mobile" ? 0.66 : 1));
      }

      // Sonar sweep: one decisive pass, then it rests as the map widens.
      if (sweepRing && sweepMaterial) {
        const radius = 0.08 + sweepT * ARGYPH_STAGE.sweepRadiusMax * 0.48;
        sweepRing.scale.setScalar(Math.max(radius, 1e-4) * (1 + widenT * 0.1));
        sweepMaterial.opacity = sweepT > 0 && sweepT < 1
          ? (0.1 - sweepT * 0.07) * fade
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
          let brightness = reefT * 0.07 + passed * 0.22;
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
        symbolMaterial.opacity = fade * 0.72;
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
      const objects = [lightingRig, brandMark, reef, symbols, links, sweepRing, ...pulseMeshes, ...tierLabels];
      for (const object of objects) {
        if (object && object.parent === stage) stage.remove(object);
      }
      stage = null;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      if (stage) {
        const objects = [lightingRig, brandMark, reef, symbols, links, sweepRing, ...pulseMeshes, ...tierLabels];
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
      tierLabels.length = 0;
      tierLabelMaterials.length = 0;
      loaded = false;
    },
  };
}

export default createArgyphEncounter;
