/**
 * MonkeyClaw encounter — adversarial current field (plan §10.2).
 *
 * A suspended translucent agent core in darkening blue water. Eighteen faint
 * attack vectors approach; the sandbox perimeter deflects most; eight reach
 * the judge layer and light the verifier gates; verified detections return
 * as telemetry rails that exit as clean parallel paths toward Etch.
 *
 * Every primary transform is a pure function of chapter progress — reverse
 * scroll reconstructs the exact composition. Probe pulses and idle pulses
 * are bounded secondary response that decays back to the primary state.
 */

import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  ConeGeometry,
  DirectionalLight,
  DynamicDrawUsage,
  EdgesGeometry,
  Group,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Quaternion,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  HemisphereLight,
  PointLight,
  PlaneGeometry,
  SRGBColorSpace,
  TextureLoader,
  type Object3D,
} from "three";
import type {
  EncounterAudioEvent,
  EncounterFrameResult,
  EncounterLoadContext,
  ProjectEncounter,
} from "../../encounter-contract.ts";
import {
  MONKEYCLAW_COLORS,
  MONKEYCLAW_COUNTS,
  MONKEYCLAW_LOOP,
  MONKEYCLAW_STAGE,
  telemetryRankForVector,
  vectorReachesJudge,
  vectorSpawnDirection,
  vectorTiming,
} from "./monkeyclawConfig.ts";
import { createRoundedPanelGeometry } from "../shared/productGeometry.ts";
import { createInstrumentLabel } from "../shared/instrumentLabel.ts";

function smoothstep01(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

const CORE_FRESNEL = {
  vertex: /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      vec4 world = modelMatrix * vec4(position, 1.0);
      vNormal = normalize(mat3(modelMatrix) * normal);
      vView = normalize(cameraPosition - world.xyz);
      gl_Position = projectionMatrix * viewMatrix * world;
    }
  `,
  fragment: /* glsl */ `
    uniform vec3 uColor;
    uniform float uIntensity;
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.4);
      gl_FragColor = vec4(uColor * (rim * uIntensity + 0.02), 1.0);
    }
  `,
};

type ProbePulse = {
  active: boolean;
  bornAt: number;
  origin: Vector3;
  judged: boolean;
  deflected: boolean;
};

const UP = new Vector3(0, 1, 0);
const _pos = new Vector3();
const _dir = new Vector3();
const _quat = new Quaternion();
const _scale = new Vector3();
const _matrix = new Matrix4();
const _color = new Color();

export function createMonkeyClawEncounter(): ProjectEncounter {
  const root = new Vector3();
  let stage: Group | null = null;
  let loaded = false;
  let disposed = false;

  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(resource: T): T => {
    disposables.push(resource);
    return resource;
  };

  // Core + cage + judge ring
  let core: Mesh | null = null;
  let coreMaterial: ShaderMaterial | null = null;
  let identityMark: Group | null = null;
  let identityMaterial: ShaderMaterial | null = null;
  let cage: LineSegments | null = null;
  let cageMaterial: LineBasicMaterial | null = null;
  let ring: Mesh | null = null;
  let ringMaterial: MeshBasicMaterial | null = null;
  let perimeter: Mesh | null = null;
  let perimeterMaterial: ShaderMaterial | null = null;
  let securityLoop: Group | null = null;
  let lightingRig: Group | null = null;
  const loopSegments: Mesh[] = [];
  const loopSegmentMaterials: MeshBasicMaterial[] = [];
  const loopStageNodes: Mesh[] = [];
  const loopStageMaterials: MeshPhysicalMaterial[] = [];
  const loopStageLabels: Mesh[] = [];
  const loopStageLabelMaterials: MeshBasicMaterial[] = [];
  const gateMeshes: Mesh[] = [];
  const gateMaterials: MeshBasicMaterial[] = [];
  const railMeshes: Mesh[] = [];
  const railMaterials: MeshBasicMaterial[] = [];
  let vectors: InstancedMesh | null = null;
  let vectorMaterial: MeshBasicMaterial | null = null;
  let flashes: InstancedMesh | null = null;
  let flashMaterial: MeshBasicMaterial | null = null;
  const pulseMeshes: Mesh[] = [];
  const pulseMaterials: MeshBasicMaterial[] = [];
  const pulses: ProbePulse[] = [];

  // Deterministic per-vector path data (computed once at load).
  const pathSpawn: Vector3[] = [];
  const pathPerimeter: Vector3[] = [];
  const pathRing: Vector3[] = [];
  const pathCore: Vector3[] = [];
  const pathDeflect: Vector3[] = [];
  const railStart: Vector3[] = [];
  const railDir: Vector3[] = [];

  let fade = 0;
  let lastLoopT = 0;
  let layoutMode: "desktop" | "mobile" = "desktop";
  const eventBuffer: EncounterAudioEvent[] = [];

  function buildPaths() {
    const spawnDir: [number, number, number] = [0, 0, 0];
    for (let index = 0; index < MONKEYCLAW_COUNTS.vectors; index += 1) {
      vectorSpawnDirection(index, spawnDir);
      const radius = MONKEYCLAW_STAGE.spawnRadiusMin
        + ((index * 7) % 5) / 4 * (MONKEYCLAW_STAGE.spawnRadiusMax - MONKEYCLAW_STAGE.spawnRadiusMin);
      pathSpawn.push(new Vector3(spawnDir[0], spawnDir[1], spawnDir[2]).multiplyScalar(radius));
      const inward = new Vector3(spawnDir[0], spawnDir[1], spawnDir[2]).normalize();
      pathPerimeter.push(inward.clone().multiplyScalar(MONKEYCLAW_STAGE.perimeterRadius));
      if (vectorReachesJudge(index)) {
        const rank = telemetryRankForVector(index);
        const angle = (rank / MONKEYCLAW_COUNTS.judged) * Math.PI * 2 + 0.42;
        const ringPoint = new Vector3(
          Math.cos(angle) * MONKEYCLAW_STAGE.judgeRadius,
          Math.sin(angle) * MONKEYCLAW_STAGE.judgeRadius,
          0,
        );
        pathRing.push(ringPoint);
        pathCore.push(ringPoint.clone().normalize().multiplyScalar(MONKEYCLAW_STAGE.coreRadius + 0.03));
        pathDeflect.push(new Vector3());
      } else {
        pathRing.push(new Vector3());
        pathCore.push(new Vector3());
        // Deflect along the perimeter tangent with a deterministic handedness.
        const tangent = new Vector3(-inward.y, inward.x, 0)
          .multiplyScalar(index % 2 === 0 ? 1 : -1);
        pathDeflect.push(
          inward.clone().multiplyScalar(MONKEYCLAW_STAGE.perimeterRadius)
            .addScaledVector(tangent, 0.62)
            .addScaledVector(inward, 0.4),
        );
      }
    }
    for (let rail = 0; rail < MONKEYCLAW_COUNTS.telemetryRails; rail += 1) {
      const angle = (rail / MONKEYCLAW_COUNTS.telemetryRails) * Math.PI * 2 + 0.2;
      railStart.push(new Vector3(
        Math.cos(angle) * (MONKEYCLAW_STAGE.coreRadius + 0.05),
        Math.sin(angle) * (MONKEYCLAW_STAGE.coreRadius + 0.05),
        0,
      ));
      // Rails leave as one aligned family — Etch's verification geometry.
      railDir.push(new Vector3(-0.22, -1, 0).normalize());
    }
  }

  function makeFresnelMaterial(color: number, intensity: number) {
    return track(new ShaderMaterial({
      vertexShader: CORE_FRESNEL.vertex,
      fragmentShader: CORE_FRESNEL.fragment,
      uniforms: {
        uColor: { value: new Color(color) },
        uIntensity: { value: intensity },
      },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    }));
  }

  return {
    id: "monkeyclaw",
    estimatedGpuMb: 2,

    async load(context: EncounterLoadContext) {
      if (loaded || disposed) return;
      if (context.signal.aborted) return;
      layoutMode = context.layout;
      buildPaths();

      const coreOffset = layoutMode === "mobile"
        ? MONKEYCLAW_STAGE.coreMobile
        : MONKEYCLAW_STAGE.coreDesktop;
      root.set(coreOffset[0], coreOffset[1], coreOffset[2]);

      coreMaterial = makeFresnelMaterial(0x4c8594, 0.38);
      const kernelGeometry = track(new IcosahedronGeometry(MONKEYCLAW_STAGE.coreRadius * 0.58, 2));
      core = new Mesh(
        kernelGeometry,
        coreMaterial,
      );
      core.position.copy(root);

      // The real MonkeyClaw head is a flat identity decal. Depth belongs to
      // the sandbox and five-stage security loop, never to a made-up logo.
      const identityTexture = await new TextureLoader().loadAsync("/projects/monkeyclaw/logo.webp");
      if (context.signal.aborted || disposed) {
        identityTexture.dispose();
        return;
      }
      identityTexture.colorSpace = SRGBColorSpace;
      identityTexture.anisotropy = context.qualityTier === "high" ? 8 : 4;
      track(identityTexture);
      identityMark = new Group();
      identityMark.name = "monkeyclaw-brand-decal";
      identityMark.position.set(root.x, root.y, root.z + MONKEYCLAW_STAGE.coreRadius * 0.62);
      identityMaterial = track(new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uIdentity: { value: identityTexture },
          uOpacity: { value: 0 },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D uIdentity;
          uniform float uOpacity;
          varying vec2 vUv;
          void main() {
            vec2 sourceUv = vUv * vec2(0.48, 0.28) + vec2(0.24, 0.58);
            vec3 source = texture2D(uIdentity, sourceUv).rgb;
            float signal = max(source.r, max(source.g, source.b));
            vec3 lifted = min(source * 2.2 + vec3(0.12, 0.18, 0.2), vec3(1.0));
            float alpha = smoothstep(0.001, 0.028, signal) * uOpacity;
            if (alpha < 0.01) discard;
            gl_FragColor = vec4(lifted, alpha);
          }
        `,
      }));
      const logoDecal = new Mesh(
        track(new PlaneGeometry(0.4, 0.21)),
        identityMaterial,
      );
      logoDecal.position.z = 0.04;
      identityMark.add(logoDecal);

      cageMaterial = track(new LineBasicMaterial({
        color: MONKEYCLAW_COLORS.cage,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }));
      const cageSource = track(new IcosahedronGeometry(MONKEYCLAW_STAGE.coreRadius * 0.88, 1));
      cage = new LineSegments(
        track(new EdgesGeometry(cageSource, 28)),
        cageMaterial,
      );
      cage.position.copy(root);

      // Product silhouette: the five-stage autonomous security loop wrapped
      // around a literal sandboxed agent runtime. Each joint is one real
      // MonkeyClaw stage: red, judge, repro, blue, purple.
      securityLoop = new Group();
      securityLoop.name = "monkeyclaw-red-judge-repro-blue-purple";
      securityLoop.position.copy(root);
      const stageColors = [
        MONKEYCLAW_COLORS.hostile,
        MONKEYCLAW_COLORS.judge,
        MONKEYCLAW_COLORS.judge,
        MONKEYCLAW_COLORS.blue,
        MONKEYCLAW_COLORS.purple,
      ] as const;
      const stageCopy = [
        ["RED", "seed attack"],
        ["JUDGE", "score verdict"],
        ["REPRO", "lock evidence"],
        ["BLUE", "repair runtime"],
        ["PURPLE", "regression"],
      ] as const;
      const stageAccent = ["#e88a81", "#d8f7ff", "#b9dbe2", "#72c8dd", "#a69bd8"] as const;
      const stageLabelGeometry = track(new PlaneGeometry(0.24, 0.075));
      const productLoopRadius = 0.43;
      const segmentArc = Math.PI * 2 / 5 - 0.16;
      for (let stageIndex = 0; stageIndex < stageColors.length; stageIndex += 1) {
        const angle = stageIndex * Math.PI * 2 / stageColors.length + Math.PI * 0.08;
        const segmentMaterial = track(new MeshBasicMaterial({
          color: stageColors[stageIndex],
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
        }));
        const segment = new Mesh(
          track(new TorusGeometry(productLoopRadius, 0.012, 6, 20, segmentArc)),
          segmentMaterial,
        );
        segment.rotation.z = angle;
        securityLoop.add(segment);
        loopSegments.push(segment);
        loopSegmentMaterials.push(segmentMaterial);

        const nodeMaterial = track(new MeshPhysicalMaterial({
          color: stageColors[stageIndex],
          emissive: stageColors[stageIndex],
          emissiveIntensity: 0.5,
          roughness: 0.2,
          metalness: 0.3,
          clearcoat: 1,
          transparent: true,
          opacity: 0,
          depthWrite: true,
        }));
        const node = new Mesh(
          track(createRoundedPanelGeometry(0.085, 0.042, 0.055, 0.014, 0.004)),
          nodeMaterial,
        );
        const nodeAngle = angle + segmentArc;
        node.position.set(Math.cos(nodeAngle) * productLoopRadius, Math.sin(nodeAngle) * productLoopRadius, 0.03);
        node.rotation.z = nodeAngle + Math.PI / 2;
        securityLoop.add(node);
        loopStageNodes.push(node);
        loopStageMaterials.push(nodeMaterial);

        const [labelTitle, labelDetail] = stageCopy[stageIndex];
        const label = createInstrumentLabel(labelTitle, labelDetail, {
          accent: stageAccent[stageIndex],
          background: "rgba(5, 18, 25, 0.84)",
          foreground: "rgba(244, 251, 252, 0.98)",
          muted: "rgba(160, 188, 194, 0.94)",
        });
        track(label.texture);
        track(label.material);
        const labelMesh = new Mesh(stageLabelGeometry, label.material);
        labelMesh.name = `monkeyclaw-stage-${labelTitle.toLowerCase()}`;
        labelMesh.position.set(Math.cos(nodeAngle) * 0.6, Math.sin(nodeAngle) * 0.6, 0.08);
        labelMesh.renderOrder = 4;
        securityLoop.add(labelMesh);
        loopStageLabels.push(labelMesh);
        loopStageLabelMaterials.push(label.material);
      }

      ringMaterial = track(new MeshBasicMaterial({
        color: MONKEYCLAW_COLORS.judge,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }));
      ring = new Mesh(
        track(new TorusGeometry(0.335, 0.005, 6, 72)),
        ringMaterial,
      );
      ring.position.copy(root);

      perimeterMaterial = makeFresnelMaterial(MONKEYCLAW_COLORS.blue, 0.16);
      perimeter = new Mesh(
        track(new SphereGeometry(0.52, 28, 20)),
        perimeterMaterial,
      );
      perimeter.position.copy(root);

      lightingRig = new Group();
      lightingRig.position.copy(root);
      const ambient = new HemisphereLight(0xc5edff, 0x040b10, 1.25);
      const key = new DirectionalLight(0xe8f8ff, 3.4);
      key.position.set(-1.5, 1.7, 2.1);
      const hostileRim = new PointLight(MONKEYCLAW_COLORS.hostile, 4.6, 4, 1.7);
      hostileRim.position.set(1.2, 0.65, 1.5);
      lightingRig.add(ambient, key, hostileRim);

      // Eight verifier gates on the judge layer.
      const gateGeometry = track(new BoxGeometry(0.085, 0.018, 0.018));
      for (let gate = 0; gate < MONKEYCLAW_COUNTS.judged; gate += 1) {
        const material = track(new MeshBasicMaterial({
          color: MONKEYCLAW_COLORS.judge,
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
        }));
        const mesh = new Mesh(gateGeometry, material);
        const angle = (gate / MONKEYCLAW_COUNTS.judged) * Math.PI * 2 + 0.42;
        mesh.position.set(
          root.x + Math.cos(angle) * 0.335,
          root.y + Math.sin(angle) * 0.335,
          root.z,
        );
        mesh.rotation.z = angle + Math.PI / 2;
        gateMeshes.push(mesh);
        gateMaterials.push(material);
      }

      // Telemetry rails — aligned family leaving toward Etch.
      const railGeometry = track(new BoxGeometry(1, 0.007, 0.007));
      for (let rail = 0; rail < MONKEYCLAW_COUNTS.telemetryRails; rail += 1) {
        const material = track(new MeshBasicMaterial({
          color: MONKEYCLAW_COLORS.telemetry,
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
        }));
        const mesh = new Mesh(railGeometry, material);
        mesh.rotation.z = Math.atan2(railDir[rail].y, railDir[rail].x);
        railMeshes.push(mesh);
        railMaterials.push(material);
      }

      // Attack vectors — one instanced cone per seeded attack zone.
      vectorMaterial = track(new MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }));
      vectors = new InstancedMesh(
        track(new ConeGeometry(0.017, 0.1, 5)),
        vectorMaterial,
        MONKEYCLAW_COUNTS.vectors,
      );
      vectors.instanceMatrix.setUsage(DynamicDrawUsage);
      vectors.instanceColor = new InstancedBufferAttribute(
        new Float32Array(MONKEYCLAW_COUNTS.vectors * 3).fill(0),
        3,
      );
      vectors.instanceColor.setUsage(DynamicDrawUsage);

      // Deflect flashes at the sandbox perimeter.
      flashMaterial = track(new MeshBasicMaterial({
        color: MONKEYCLAW_COLORS.blue,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: 2,
      }));
      flashes = new InstancedMesh(
        track(new RingGeometry(0.045, 0.085, 18)),
        flashMaterial,
        MONKEYCLAW_COUNTS.vectors,
      );
      flashes.instanceMatrix.setUsage(DynamicDrawUsage);

      // Probe pulse pool (pointer signature).
      const pulseGeometry = track(new ConeGeometry(0.024, 0.13, 6));
      for (let pulse = 0; pulse < MONKEYCLAW_COUNTS.probePool; pulse += 1) {
        const material = track(new MeshBasicMaterial({
          color: 0xf2fbff,
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
        }));
        const mesh = new Mesh(pulseGeometry, material);
        mesh.visible = false;
        pulseMeshes.push(mesh);
        pulseMaterials.push(material);
        pulses.push({
          active: false,
          bornAt: 0,
          origin: new Vector3(),
          judged: false,
          deflected: false,
        });
      }

      loaded = true;
    },

    attach(stageRoot) {
      if (!loaded || stage) return;
      stage = stageRoot;
      const objects = ([
        perimeter, securityLoop, lightingRig, core, identityMark, cage, ring, vectors, flashes,
        ...gateMeshes, ...railMeshes, ...pulseMeshes,
      ] as (Object3D | null)[]).filter((object): object is Object3D => object !== null);
      for (const object of objects) {
        if (object) stage.add(object);
      }
    },

    seek(frame) {
      if (!loaded || disposed) return;
      fade = frame.fade;
      layoutMode = frame.layout;
      const t = clamp01(frame.chapterProgress);
      const previousT = lastLoopT;
      lastLoopT = t;

      const loop = MONKEYCLAW_LOOP;
      const redT = smoothstep01((t - loop.redStart) / Math.max(loop.redFull - loop.redStart, 1e-6));
      const judgeT = smoothstep01((t - loop.judgeStart) / Math.max(loop.judgeFull - loop.judgeStart, 1e-6));
      const blueT = smoothstep01((t - loop.blueStart) / Math.max(loop.blueFull - loop.blueStart, 1e-6));
      const purpleT = smoothstep01((t - loop.purpleStart) / Math.max(loop.purpleFull - loop.purpleStart, 1e-6));
      const productScale = layoutMode === "mobile" ? 1.08 : 1.32;

      // Core: authored rotation from progress + restrained pulse.
      if (core && coreMaterial) {
        core.rotation.y = t * 1.2;
        core.rotation.x = t * 0.35;
        const judgePulse = judgeT * (1 - blueT) * 0.06;
        core.scale.setScalar((1 + judgePulse + redT * 0.02) * productScale);
        coreMaterial.uniforms.uIntensity.value = (0.26 + redT * 0.14 + judgeT * 0.12) * fade;
      }
      if (identityMark && identityMaterial) {
        identityMark.rotation.set(0, 0, 0);
        identityMark.scale.setScalar(productScale);
        identityMaterial.uniforms.uOpacity.value = (0.58 + judgeT * 0.24 + blueT * 0.1) * fade;
      }
      if (cage && cageMaterial) {
        cage.rotation.y = -t * 0.8;
        cage.rotation.z = t * 0.5;
        cageMaterial.opacity = 0.34 * fade * (0.5 + redT * 0.5);
        cage.scale.setScalar(productScale);
      }
      if (ring && ringMaterial) {
        ring.rotation.z = t * 0.4;
        ringMaterial.opacity = (0.1 + judgeT * 0.5 + purpleT * 0.12) * fade;
        ring.scale.setScalar((1 + judgeT * (1 - blueT) * 0.03) * productScale);
      }
      if (perimeter && perimeterMaterial) {
        perimeterMaterial.uniforms.uIntensity.value = (0.012 + blueT * 0.055) * fade;
      }
      if (securityLoop) {
        const stageProgress = [redT, judgeT, judgeT, blueT, purpleT];
        securityLoop.rotation.z = t * 0.12;
        securityLoop.rotation.x = Math.sin(t * Math.PI) * 0.09;
        securityLoop.scale.setScalar(productScale);
        for (let stageIndex = 0; stageIndex < stageProgress.length; stageIndex += 1) {
          const activation = stageProgress[stageIndex];
          loopSegmentMaterials[stageIndex].opacity = (0.04 + activation * 0.28) * fade;
          loopStageMaterials[stageIndex].opacity = (0.1 + activation * 0.78) * fade;
          loopStageLabelMaterials[stageIndex].opacity = activation * 0.92 * fade;
          const assembled = smoothstep01((activation - stageIndex * 0.035) / Math.max(1 - stageIndex * 0.035, 1e-6));
          loopSegments[stageIndex].scale.setScalar(0.72 + assembled * 0.28);
          loopSegments[stageIndex].rotation.z = stageIndex * Math.PI * 2 / stageProgress.length
            + Math.PI * 0.08
            + (1 - assembled) * 0.34;
          loopStageLabels[stageIndex].scale.setScalar(0.72 + assembled * 0.28);
          loopStageLabels[stageIndex].rotation.z = -securityLoop.rotation.z;
          const pulse = 0.58 + assembled * 0.52;
          loopStageNodes[stageIndex].scale.setScalar(pulse);
        }
      }

      // Attack vectors — pure function of loop progress per zone.
      if (vectors && vectorMaterial) {
        vectorMaterial.opacity = fade;
        for (let index = 0; index < MONKEYCLAW_COUNTS.vectors; index += 1) {
          const timing = vectorTiming(index);
          const judged = vectorReachesJudge(index);
          const approach = smoothstep01(
            (t - timing.startT) / Math.max(timing.arriveT - timing.startT, 1e-6),
          );
          _pos.copy(pathSpawn[index]).lerp(pathPerimeter[index], approach);
          let brightness = approach * (1 - approach * 0.25);
          if (judged) {
            const rank = telemetryRankForVector(index);
            const converge = smoothstep01(
              (t - timing.arriveT) / Math.max(timing.judgeT - timing.arriveT, 1e-6),
            );
            _pos.lerp(pathRing[index], converge);
            const penetrate = smoothstep01(
              (t - (loop.blueStart + rank * 0.018)) / 0.16,
            );
            _pos.lerp(pathCore[index], penetrate);
            brightness = Math.max(
              brightness * (1 - penetrate * 0.6),
              purpleT * 0.2 * (1 - penetrate),
            );
          } else {
            const deflectT = smoothstep01(
              (t - (loop.blueStart + (index % 5) * 0.016)) / 0.18,
            );
            _pos.lerp(pathDeflect[index], deflectT);
            brightness *= 1 - deflectT * 0.92;
          }
          // Orient along the path direction (spawn → current segment target).
          _dir.copy(pathPerimeter[index]).sub(pathSpawn[index]);
          if (_dir.lengthSq() < 1e-6) _dir.set(0, -1, 0);
          _dir.normalize();
          _quat.setFromUnitVectors(UP, _dir);
          const scaleBase = 0.55 + approach * 0.75;
          _scale.setScalar(scaleBase * (0.4 + brightness * 0.6));
          _pos.add(root);
          _matrix.compose(_pos, _quat, _scale);
          vectors.setMatrixAt(index, _matrix);
          // Hostile red pressure → judged mineral → telemetry cool.
          if (judged && t > timing.judgeT - 0.06) {
            _color.setHex(MONKEYCLAW_COLORS.judge).multiplyScalar(brightness * 0.9);
          } else if (!judged && blueT > 0.25) {
            _color.setHex(MONKEYCLAW_COLORS.blue).multiplyScalar(brightness * 0.75);
          } else {
            _color.setHex(MONKEYCLAW_COLORS.hostile).multiplyScalar(brightness * 0.8);
          }
          vectors.setColorAt(index, _color);
        }
        vectors.instanceMatrix.needsUpdate = true;
        if (vectors.instanceColor) vectors.instanceColor.needsUpdate = true;
      }

      // Deflect flashes at the perimeter.
      if (flashes && flashMaterial) {
        flashMaterial.opacity = fade * blueT;
        for (let index = 0; index < MONKEYCLAW_COUNTS.vectors; index += 1) {
          if (vectorReachesJudge(index)) {
            _scale.setScalar(0);
          } else {
            const deflectT = smoothstep01(
              (t - (loop.blueStart + (index % 5) * 0.016)) / 0.18,
            );
            const ring = deflectT > 0 && deflectT < 1
              ? Math.sin(deflectT * Math.PI) * 0.9
              : 0;
            _scale.setScalar(ring * 0.9);
          }
          _pos.copy(pathPerimeter[index]).add(root);
          _quat.identity();
          _matrix.compose(_pos, _quat, _scale);
          flashes.setMatrixAt(index, _matrix);
        }
        flashes.instanceMatrix.needsUpdate = true;
      }

      // Verifier gates light as their judged vector arrives.
      for (let gate = 0; gate < gateMaterials.length; gate += 1) {
        const vectorIndex = MONKEYCLAW_COUNTS.vectors - MONKEYCLAW_COUNTS.judged + gate;
        const timing = vectorTiming(vectorIndex);
        const lit = smoothstep01((t - timing.judgeT) / 0.05);
        gateMaterials[gate].opacity = (0.06 + lit * 0.85) * fade;
        const gateScale = 0.7 + lit * 0.5;
        gateMeshes[gate].scale.set(gateScale, gateScale, gateScale);
      }

      // Telemetry rails grow outward as detections verify.
      for (let rail = 0; rail < railMaterials.length; rail += 1) {
        const railT = smoothstep01(
          (t - (loop.purpleStart + rail * 0.024)) / 0.16,
        );
        const length = MONKEYCLAW_STAGE.telemetryLength * railT;
        railMeshes[rail].scale.set(Math.max(length, 1e-4), 1, 1);
        _pos.copy(railStart[rail])
          .addScaledVector(railDir[rail], length * 0.5)
          .add(root);
        railMeshes[rail].position.copy(_pos);
        railMaterials[rail].opacity = railT * 0.72 * fade;
      }

      // Edge-triggered audio hooks from primary crossings (bounded).
      if (eventBuffer.length < 4) {
        for (let gate = 0; gate < MONKEYCLAW_COUNTS.judged; gate += 1) {
          const vectorIndex = MONKEYCLAW_COUNTS.vectors - MONKEYCLAW_COUNTS.judged + gate;
          const judgeAt = vectorTiming(vectorIndex).judgeT;
          if (previousT < judgeAt && t >= judgeAt && eventBuffer.length < 4) {
            eventBuffer.push("judge-hit");
          }
        }
        const deflectEdge = loop.blueStart + 0.05;
        if (previousT < deflectEdge && t >= deflectEdge && eventBuffer.length < 4) {
          eventBuffer.push("deflect");
        }
        if (previousT < loop.purpleStart + 0.08 && t >= loop.purpleStart + 0.08 && eventBuffer.length < 4) {
          eventBuffer.push("telemetry-return");
        }
      }
    },

    probe(event) {
      if (!loaded || disposed || fade < 0.35) return;
      if (event.kind !== "down") return;
      const pulse = pulses.find((candidate) => !candidate.active);
      if (!pulse) return;
      // Bounded adversarial pulse: enters from the probe bearing, gets
      // routed to the judge layer, blocked, and recorded.
      pulse.active = true;
      pulse.judged = false;
      pulse.deflected = false;
      pulse.bornAt = event.time;
      _pos.set(event.x, event.y, 0).sub(root);
      if (_pos.lengthSq() < 1e-6) _pos.set(0.4, 0.4, 0);
      _pos.normalize().multiplyScalar(MONKEYCLAW_STAGE.spawnRadiusMax * 0.9);
      pulse.origin.copy(_pos);
      if (eventBuffer.length < 4) eventBuffer.push("probe-pulse");
    },

    update(frame) {
      // Drain seek()/probe() events first; pulse lifecycle events append.
      const drained = eventBuffer.slice();
      eventBuffer.length = 0;
      const empty: EncounterFrameResult = { drawCalls: 0, audioEvents: drained };
      if (!loaded || disposed) return empty;
      const idle = frame.reducedMotion ? 0 : 1;
      const time = frame.time;

      // Low-amplitude secondary life while the camera holds.
      if (core && idle > 0) {
        core.rotation.y += Math.sin(time * 0.21) * 0.0006 * idle;
        if (cage) cage.rotation.x = Math.sin(time * 0.17) * 0.05 * idle;
      }

      // Probe pulses: approach → judge → blocked → recorded.
      for (let index = 0; index < pulses.length; index += 1) {
        const pulse = pulses[index];
        const mesh = pulseMeshes[index];
        const material = pulseMaterials[index];
        if (!pulse.active) {
          mesh.visible = false;
          material.opacity = 0;
          continue;
        }
        const life = (time - pulse.bornAt) / 1.15;
        if (life >= 1) {
          pulse.active = false;
          mesh.visible = false;
          material.opacity = 0;
          continue;
        }
        mesh.visible = true;
        const approach = smoothstep01(life / 0.45);
        _pos.copy(pulse.origin).lerp(
          _dir.copy(pulse.origin).normalize().multiplyScalar(MONKEYCLAW_STAGE.judgeRadius),
          approach,
        );
        if (life > 0.45 && !pulse.judged) {
          pulse.judged = true;
          if (eventBuffer.length < 4) eventBuffer.push("judge-hit");
          if (ringMaterial) ringMaterial.opacity = Math.min(1, ringMaterial.opacity + 0.25);
        }
        if (life > 0.68 && !pulse.deflected) {
          pulse.deflected = true;
          if (eventBuffer.length < 4) eventBuffer.push("deflect");
        }
        const scatter = smoothstep01((life - 0.68) / 0.3);
        if (scatter > 0) {
          _dir.copy(pulse.origin).normalize();
          _pos.addScaledVector(_dir, scatter * 0.5);
        }
        _pos.add(root);
        _dir.copy(pulse.origin).normalize().negate();
        _quat.setFromUnitVectors(UP, _dir);
        mesh.position.copy(_pos);
        mesh.quaternion.copy(_quat);
        material.opacity = (1 - scatter) * 0.95 * fade;
      }

      const result: EncounterFrameResult = {
        drawCalls: 0,
        audioEvents: drained.concat(eventBuffer),
      };
      eventBuffer.length = 0;
      return result;
    },


    detach() {
      if (!stage) return;
      const objects = ([
        perimeter, securityLoop, lightingRig, core, identityMark, cage, ring, vectors, flashes,
        ...gateMeshes, ...railMeshes, ...pulseMeshes,
      ] as (Object3D | null)[]).filter((object): object is Object3D => object !== null);
      for (const object of objects) {
        if (object && object.parent === stage) stage.remove(object);
      }
      stage = null;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      // detach via host (stage reference dropped here too)
      if (stage) {
        const objects = ([
          perimeter, securityLoop, lightingRig, core, identityMark, cage, ring, vectors, flashes,
          ...gateMeshes, ...railMeshes, ...pulseMeshes,
        ] as (Object3D | null)[]).filter((object): object is Object3D => object !== null);
        for (const object of objects) {
          if (object.parent === stage) stage.remove(object);
        }
        stage = null;
      }
      for (const resource of disposables) resource.dispose();
      disposables.length = 0;
      gateMeshes.length = 0;
      gateMaterials.length = 0;
      railMeshes.length = 0;
      railMaterials.length = 0;
      pulseMeshes.length = 0;
      pulseMaterials.length = 0;
      pulses.length = 0;
      loopSegments.length = 0;
      loopSegmentMaterials.length = 0;
      loopStageNodes.length = 0;
      loopStageMaterials.length = 0;
      loopStageLabels.length = 0;
      loopStageLabelMaterials.length = 0;
      loaded = false;
    },
  };
}
