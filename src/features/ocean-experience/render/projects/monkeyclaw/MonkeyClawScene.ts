/**
 * MonkeyClaw encounter — continuous agent-security loop (plan §10.2).
 *
 * A suspended NemoClaw victim sits inside the real target → red → judge →
 * repro → blue → purple lifecycle. Each frame exposes one production concept:
 * dual-axis coverage, attack execution, tiered judgment, cold-verified repro,
 * eight-gate patch verification, and detection-as-pass feedback.
 *
 * Every primary transform is a pure function of chapter progress — reverse
 * scroll reconstructs the exact composition. Probe pulses and idle pulses
 * are bounded secondary response that decays back to the primary state.
 */

import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  DirectionalLight,
  DynamicDrawUsage,
  EdgesGeometry,
  Group,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Line,
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
  findingRankForVector,
  vectorBecomesFinding,
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
  let identityCarrier: Mesh | null = null;
  let identityCarrierMaterial: MeshBasicMaterial | null = null;
  let identityCarrierEdgeMaterial: LineBasicMaterial | null = null;
  let cage: LineSegments | null = null;
  let cageMaterial: LineBasicMaterial | null = null;
  let ring: Mesh | null = null;
  let ringMaterial: MeshBasicMaterial | null = null;
  let perimeter: Mesh | null = null;
  let perimeterMaterial: ShaderMaterial | null = null;
  let securityLoop: Group | null = null;
  let lightingRig: Group | null = null;
  let containmentShield: Group | null = null;
  let containmentMaterial: MeshBasicMaterial | null = null;
  let judgeProgramChecks: InstancedMesh | null = null;
  let judgeProgramMaterial: MeshBasicMaterial | null = null;
  let judgeEnsembleNodes: InstancedMesh | null = null;
  let judgeEnsembleMaterial: MeshBasicMaterial | null = null;
  let reproSystem: Group | null = null;
  let reproVictims: InstancedMesh | null = null;
  let reproVictimMaterial: MeshPhysicalMaterial | null = null;
  const reproRingMaterials: MeshBasicMaterial[] = [];
  let patchLattice: LineSegments | null = null;
  let patchLatticeMaterial: LineBasicMaterial | null = null;
  let patchNodes: InstancedMesh | null = null;
  let patchNodeMaterial: MeshBasicMaterial | null = null;
  const loopSegments: Mesh[] = [];
  const loopSegmentMaterials: MeshBasicMaterial[] = [];
  const loopStageNodes: Mesh[] = [];
  const loopStageMaterials: MeshPhysicalMaterial[] = [];
  const loopStageLabels: Mesh[] = [];
  const loopStageLabelMaterials: MeshBasicMaterial[] = [];
  const gateMeshes: Mesh[] = [];
  const gateMaterials: MeshPhysicalMaterial[] = [];
  const gateStatusMeshes: Mesh[] = [];
  const gateStatusMaterials: MeshBasicMaterial[] = [];
  let verifierSpokes: LineSegments | null = null;
  let verifierSpokeMaterial: LineBasicMaterial | null = null;
  const railMeshes: Line[] = [];
  const railMaterials: MeshBasicMaterial[] = [];
  const telemetryCurves: CatmullRomCurve3[] = [];
  let feedbackReturn: Line | null = null;
  let feedbackReturnMaterial: LineBasicMaterial | null = null;
  let telemetryBeads: InstancedMesh | null = null;
  let telemetryBeadMaterial: MeshBasicMaterial | null = null;
  let detectionQuadrants: Group | null = null;
  const detectionQuadrantMaterials: MeshPhysicalMaterial[] = [];
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
      const spawnPoint = new Vector3(spawnDir[0], spawnDir[1], spawnDir[2]).multiplyScalar(radius);
      spawnPoint.x = Math.max(-0.72, Math.min(spawnPoint.x, 0.92));
      spawnPoint.y = Math.max(-0.7, Math.min(0.7, spawnPoint.y));
      pathSpawn.push(spawnPoint);
      const inward = new Vector3(spawnDir[0], spawnDir[1], spawnDir[2]).normalize();
      pathPerimeter.push(inward.clone().multiplyScalar(MONKEYCLAW_STAGE.perimeterRadius));
      if (vectorBecomesFinding(index)) {
        const rank = findingRankForVector(index);
        const angle = (rank / MONKEYCLAW_COUNTS.confirmedFindings) * Math.PI * 2 + 0.42;
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
        const deflectPoint = inward.clone().multiplyScalar(MONKEYCLAW_STAGE.perimeterRadius)
            .addScaledVector(tangent, 0.62)
            .addScaledVector(inward, 0.4);
        deflectPoint.x = Math.max(-0.68, Math.min(deflectPoint.x, 0.92));
        deflectPoint.y = Math.max(-0.74, Math.min(0.74, deflectPoint.y));
        pathDeflect.push(deflectPoint);
      }
    }
    for (let rail = 0; rail < MONKEYCLAW_COUNTS.telemetryRails; rail += 1) {
      const angle = (rail / MONKEYCLAW_COUNTS.telemetryRails) * Math.PI * 2 + 0.2;
      const fan = (rail - (MONKEYCLAW_COUNTS.telemetryRails - 1) / 2) * 0.045;
      const arcPoints = Array.from({ length: 7 }, (_, pointIndex) => {
        const arcT = pointIndex / 6;
        const pointAngle = angle + (Math.PI - angle) * arcT;
        const radius = MONKEYCLAW_STAGE.judgeRadius + rail * 0.004;
        return new Vector3(
          Math.cos(pointAngle) * radius,
          Math.sin(pointAngle) * radius,
          0.035 + arcT * 0.008,
        );
      });
      arcPoints.push(
        new Vector3(-0.82, fan * 1.2, 0.042),
        new Vector3(-1.02, fan * 1.7, 0.03),
      );
      telemetryCurves.push(new CatmullRomCurve3(arcPoints, false, "centripetal"));
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
            vec3 ink = vec3(0.008, 0.075, 0.085);
            vec3 rendered = mix(ink, lifted, 0.08 + signal * 0.04);
            float alpha = smoothstep(0.001, 0.028, signal) * min(1.0, uOpacity * 1.35);
            if (alpha < 0.01) discard;
            gl_FragColor = vec4(rendered, alpha);
          }
        `,
      }));
      identityCarrierMaterial = track(new MeshBasicMaterial({
        color: 0xd5e9ec,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }));
      const identityCarrierGeometry = track(
        createRoundedPanelGeometry(0.43, 0.235, 0.065, 0.025, 0.005),
      );
      identityCarrier = new Mesh(
        identityCarrierGeometry,
        identityCarrierMaterial,
      );
      identityCarrier.name = "monkeyclaw-protected-runtime";
      identityCarrier.position.z = -0.005;
      identityMark.add(identityCarrier);
      identityCarrierEdgeMaterial = track(new LineBasicMaterial({
        color: 0x315f67,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
      }));
      const carrierEdge = new LineSegments(
        track(new EdgesGeometry(identityCarrierGeometry, 24)),
        identityCarrierEdgeMaterial,
      );
      carrierEdge.position.z = 0.012;
      identityMark.add(carrierEdge);
      const logoDecal = new Mesh(
        track(new PlaneGeometry(0.52, 0.27)),
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
        ["RED", "ideate + execute"],
        ["JUDGE", "tiered analysis"],
        ["REPRO", "replay + minimize"],
        ["BLUE", "patch + verify"],
        ["PURPLE", "detect + route gap"],
      ] as const;
      const stageAccent = ["#e88a81", "#d8f7ff", "#b9dbe2", "#72c8dd", "#a69bd8"] as const;
      const stageLabelGeometry = track(new PlaneGeometry(0.34, 0.105));
      const productLoopRadius = 0.48;
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
        labelMesh.position.set(Math.cos(nodeAngle) * 0.74, Math.sin(nodeAngle) * 0.74, 0.08);
        labelMesh.renderOrder = 4;
        labelMesh.visible = false;
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
        track(new TorusGeometry(MONKEYCLAW_STAGE.judgeRadius, 0.007, 6, 96)),
        ringMaterial,
      );
      ring.position.copy(root);

      perimeterMaterial = makeFresnelMaterial(MONKEYCLAW_COLORS.blue, 0.16);
      perimeter = new Mesh(
        track(new SphereGeometry(MONKEYCLAW_STAGE.perimeterRadius * 0.76, 40, 28)),
        perimeterMaterial,
      );
      perimeter.position.copy(root);

      // Six segmented containment plates: a readable, physical answer to
      // the incoming vectors instead of another decorative ring.
      containmentShield = new Group();
      containmentShield.name = "monkeyclaw-containment-shield";
      containmentShield.position.copy(root);
      containmentMaterial = track(new MeshBasicMaterial({
        color: 0x357eac,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
      }));
      for (let segmentIndex = 0; segmentIndex < 6; segmentIndex += 1) {
        const segment = new Mesh(
          track(new TorusGeometry(
            MONKEYCLAW_STAGE.perimeterRadius * 0.74,
            0.024,
            6,
            18,
            Math.PI * 0.24,
          )),
          containmentMaterial,
        );
        segment.rotation.z = segmentIndex * Math.PI / 3 + 0.08;
        containmentShield.add(segment);
      }

      // Judge state: six deterministic programmatic checks inside a five-role
      // semantic ensemble. Distinct rings keep this separate from blue's
      // eight patch-verifier gates.
      const judgeCheckGeometry = track(new SphereGeometry(0.025, 10, 8));
      judgeProgramMaterial = track(new MeshBasicMaterial({
        color: MONKEYCLAW_COLORS.judge,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
      }));
      judgeProgramChecks = new InstancedMesh(judgeCheckGeometry, judgeProgramMaterial, 6);
      judgeProgramChecks.instanceMatrix.setUsage(DynamicDrawUsage);
      for (let checkIndex = 0; checkIndex < 6; checkIndex += 1) {
        const angle = checkIndex / 6 * Math.PI * 2 + 0.2;
        _pos.set(
          root.x + Math.cos(angle) * 0.34,
          root.y + Math.sin(angle) * 0.34,
          root.z + 0.05,
        );
        _quat.identity();
        _scale.setScalar(1);
        _matrix.compose(_pos, _quat, _scale);
        judgeProgramChecks.setMatrixAt(checkIndex, _matrix);
      }
      judgeProgramChecks.instanceMatrix.needsUpdate = true;

      judgeEnsembleMaterial = track(new MeshBasicMaterial({
        color: 0xa8dce8,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
      }));
      judgeEnsembleNodes = new InstancedMesh(judgeCheckGeometry, judgeEnsembleMaterial, 5);
      judgeEnsembleNodes.instanceMatrix.setUsage(DynamicDrawUsage);
      for (let roleIndex = 0; roleIndex < 5; roleIndex += 1) {
        const angle = roleIndex / 5 * Math.PI * 2 - 0.35;
        _pos.set(
          root.x + Math.cos(angle) * 0.47,
          root.y + Math.sin(angle) * 0.47,
          root.z + 0.035,
        );
        _quat.identity();
        _scale.setScalar(1.18);
        _matrix.compose(_pos, _quat, _scale);
        judgeEnsembleNodes.setMatrixAt(roleIndex, _matrix);
      }
      judgeEnsembleNodes.instanceMatrix.needsUpdate = true;

      // Repro state: three fresh-victim replays orbit the minimized evidence
      // package before the cold-verifier handoff.
      reproSystem = new Group();
      reproSystem.name = "monkeyclaw-replay-minimize-cold-verify";
      reproSystem.position.copy(root);
      for (let replayIndex = 0; replayIndex < 3; replayIndex += 1) {
        const material = track(new MeshBasicMaterial({
          color: MONKEYCLAW_COLORS.repro,
          transparent: true,
          opacity: 0,
          depthTest: false,
          depthWrite: false,
        }));
        const replayRing = new Mesh(
          track(new TorusGeometry(0.38 + replayIndex * 0.095, 0.006, 5, 72)),
          material,
        );
        replayRing.rotation.x = (replayIndex - 1) * 0.18;
        replayRing.rotation.y = (1 - replayIndex) * 0.12;
        reproSystem.add(replayRing);
        reproRingMaterials.push(material);
      }
      reproVictimMaterial = track(new MeshPhysicalMaterial({
        color: 0xd99b35,
        emissive: MONKEYCLAW_COLORS.repro,
        emissiveIntensity: 0.7,
        roughness: 0.28,
        metalness: 0.36,
        clearcoat: 0.9,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }));
      reproVictims = new InstancedMesh(
        track(createRoundedPanelGeometry(0.115, 0.058, 0.035, 0.014, 0.003)),
        reproVictimMaterial,
        3,
      );
      reproVictims.instanceMatrix.setUsage(DynamicDrawUsage);
      reproSystem.add(reproVictims);

      // Purple's prevention × observability oracle is one literal 2×2 matrix.
      // PASS is the only bright result; the other three remain rejected.
      detectionQuadrants = new Group();
      detectionQuadrants.name = "monkeyclaw-detection-as-pass";
      detectionQuadrants.position.copy(root);
      const quadrantColors = [0x2da44e, 0xd9a315, 0xdd6b20, 0xd64531] as const;
      for (let quadrantIndex = 0; quadrantIndex < quadrantColors.length; quadrantIndex += 1) {
        const material = track(new MeshPhysicalMaterial({
          color: quadrantColors[quadrantIndex],
          emissive: quadrantColors[quadrantIndex],
          emissiveIntensity: quadrantIndex === 0 ? 1.1 : 0.28,
          roughness: 0.3,
          metalness: 0.25,
          clearcoat: 0.86,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }));
        const quadrant = new Mesh(
          track(createRoundedPanelGeometry(0.135, 0.065, 0.035, 0.014, 0.003)),
          material,
        );
        const column = quadrantIndex % 2;
        const row = Math.floor(quadrantIndex / 2);
        quadrant.position.set(
          -0.09 + column * 0.18,
          -0.52 - row * 0.095,
          0.065,
        );
        detectionQuadrants.add(quadrant);
        detectionQuadrantMaterials.push(material);
      }

      // Patch state: a bounded defense lattice and twelve explicit policy
      // nodes assemble around the sandbox, then yield to telemetry.
      patchLatticeMaterial = track(new LineBasicMaterial({
        color: 0x6651c8,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
      }));
      const patchSource = track(new IcosahedronGeometry(
        MONKEYCLAW_STAGE.perimeterRadius * 0.66,
        1,
      ));
      patchLattice = new LineSegments(
        track(new EdgesGeometry(patchSource, 12)),
        patchLatticeMaterial,
      );
      patchLattice.name = "monkeyclaw-defense-patch-lattice";
      patchLattice.position.copy(root);

      patchNodeMaterial = track(new MeshBasicMaterial({
        color: 0x6f5bd3,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
      }));
      patchNodes = new InstancedMesh(
        track(new BoxGeometry(0.042, 0.042, 0.025)),
        patchNodeMaterial,
        12,
      );
      patchNodes.instanceMatrix.setUsage(DynamicDrawUsage);
      for (let nodeIndex = 0; nodeIndex < 12; nodeIndex += 1) {
        const direction: [number, number, number] = [0, 0, 0];
        vectorSpawnDirection(Math.round(nodeIndex * 17 / 11), direction);
        _pos.set(direction[0], direction[1], direction[2])
          .normalize()
          .multiplyScalar(MONKEYCLAW_STAGE.perimeterRadius * 0.66)
          .add(root);
        _quat.identity();
        _scale.setScalar(1);
        _matrix.compose(_pos, _quat, _scale);
        patchNodes.setMatrixAt(nodeIndex, _matrix);
      }
      patchNodes.instanceMatrix.needsUpdate = true;

      lightingRig = new Group();
      lightingRig.position.copy(root);
      const ambient = new HemisphereLight(0xc5edff, 0x040b10, 1.25);
      const key = new DirectionalLight(0xe8f8ff, 3.4);
      key.position.set(-1.5, 1.7, 2.1);
      const hostileRim = new PointLight(MONKEYCLAW_COLORS.hostile, 4.6, 4, 1.7);
      hostileRim.position.set(1.2, 0.65, 1.5);
      lightingRig.add(ambient, key, hostileRim);

      // Eight verifier gates on the judge layer.
      const gateGeometry = track(createRoundedPanelGeometry(
        0.18,
        0.09,
        0.065,
        0.021,
        0.004,
      ));
      const gateStatusGeometry = track(new RingGeometry(0.012, 0.025, 16));
      const spokePoints: Vector3[] = [];
      for (let gate = 0; gate < MONKEYCLAW_COUNTS.verifierGates; gate += 1) {
        const material = track(new MeshPhysicalMaterial({
          color: 0x426c75,
          emissive: MONKEYCLAW_COLORS.judge,
          emissiveIntensity: 0.24,
          roughness: 0.24,
          metalness: 0.42,
          clearcoat: 0.9,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }));
        const mesh = new Mesh(gateGeometry, material);
        const angle = (gate / MONKEYCLAW_COUNTS.verifierGates) * Math.PI * 2 + 0.42;
        mesh.position.set(
          root.x + Math.cos(angle) * MONKEYCLAW_STAGE.judgeRadius,
          root.y + Math.sin(angle) * MONKEYCLAW_STAGE.judgeRadius,
          root.z,
        );
        mesh.rotation.z = angle + Math.PI / 2;
        gateMeshes.push(mesh);
        gateMaterials.push(material);

        const statusMaterial = track(new MeshBasicMaterial({
          color: 0xb8f1dc,
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthTest: false,
          depthWrite: false,
        }));
        const status = new Mesh(gateStatusGeometry, statusMaterial);
        status.position.copy(mesh.position);
        status.position.z += 0.05;
        gateStatusMeshes.push(status);
        gateStatusMaterials.push(statusMaterial);

        spokePoints.push(
          new Vector3(
            root.x + Math.cos(angle) * (MONKEYCLAW_STAGE.coreRadius + 0.08),
            root.y + Math.sin(angle) * (MONKEYCLAW_STAGE.coreRadius + 0.08),
            root.z + 0.015,
          ),
          new Vector3(
            root.x + Math.cos(angle) * (MONKEYCLAW_STAGE.judgeRadius - 0.11),
            root.y + Math.sin(angle) * (MONKEYCLAW_STAGE.judgeRadius - 0.11),
            root.z + 0.015,
          ),
        );
      }
      verifierSpokeMaterial = track(new LineBasicMaterial({
        color: 0x78c9d8,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
      }));
      verifierSpokes = new LineSegments(
        track(new BufferGeometry().setFromPoints(spokePoints)),
        verifierSpokeMaterial,
      );
      verifierSpokes.name = "monkeyclaw-eight-verifier-bus";

      // Eight gate-evidence paths converge into one detection oracle. Curves
      // route around the runtime instead of slicing through its identity.
      for (let rail = 0; rail < MONKEYCLAW_COUNTS.telemetryRails; rail += 1) {
        const material = track(new MeshBasicMaterial({
          color: 0x168ba0,
          transparent: true,
          opacity: 0,
          depthTest: false,
          depthWrite: false,
        }));
        const geometry = track(new BufferGeometry().setFromPoints(
          telemetryCurves[rail].getPoints(48),
        ));
        geometry.setDrawRange(0, 0);
        const mesh = new Line(geometry, material);
        mesh.position.copy(root);
        mesh.renderOrder = 7;
        railMeshes.push(mesh);
        railMaterials.push(material);
      }
      feedbackReturnMaterial = track(new LineBasicMaterial({
        color: MONKEYCLAW_COLORS.purple,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthTest: false,
        depthWrite: false,
      }));
      const feedbackCurve = new CatmullRomCurve3([
        new Vector3(-1.02, 0, 0.02),
        new Vector3(-1.2, 0.72, 0.015),
        new Vector3(-0.36, 1.03, 0.01),
        new Vector3(0.53, 0.46, 0.035),
      ], false, "centripetal");
      const feedbackGeometry = track(new BufferGeometry().setFromPoints(feedbackCurve.getPoints(64)));
      feedbackGeometry.setDrawRange(0, 0);
      feedbackReturn = new Line(feedbackGeometry, feedbackReturnMaterial);
      feedbackReturn.name = "monkeyclaw-gap-to-red-feedback";
      feedbackReturn.position.copy(root);
      feedbackReturn.renderOrder = 7;
      telemetryBeadMaterial = track(new MeshBasicMaterial({
        color: 0xb7f1f5,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }));
      telemetryBeads = new InstancedMesh(
        track(new SphereGeometry(0.024, 10, 6)),
        telemetryBeadMaterial,
        MONKEYCLAW_COUNTS.telemetryRails,
      );
      telemetryBeads.instanceMatrix.setUsage(DynamicDrawUsage);
      telemetryBeads.renderOrder = 8;

      // Attack vectors — one instanced cone per seeded attack zone.
      vectorMaterial = track(new MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
      }));
      vectors = new InstancedMesh(
        track(new ConeGeometry(0.038, 0.18, 5)),
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
        perimeter,
        containmentShield,
        judgeProgramChecks,
        judgeEnsembleNodes,
        reproSystem,
        patchLattice,
        patchNodes,
        detectionQuadrants,
        verifierSpokes,
        securityLoop,
        lightingRig,
        core,
        identityMark,
        cage,
        ring,
        vectors,
        flashes,
        telemetryBeads,
        feedbackReturn,
        ...gateMeshes, ...gateStatusMeshes, ...railMeshes, ...pulseMeshes,
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

      // Mobile is a distinct poster composition. Scale the complete system —
      // gates, traces, attacks, lights, and identity — as one instrument so
      // desktop-world objects cannot crowd the copy or escape the frame.
      if (stage) {
        stage.scale.setScalar(layoutMode === "mobile" ? 0.66 : 1);
      }

      const loop = MONKEYCLAW_LOOP;
      const targetT = smoothstep01(
        (t - loop.targetStart) / Math.max(loop.targetFull - loop.targetStart, 1e-6),
      );
      const redT = smoothstep01((t - loop.redStart) / Math.max(loop.redFull - loop.redStart, 1e-6));
      const judgeT = smoothstep01((t - loop.judgeStart) / Math.max(loop.judgeFull - loop.judgeStart, 1e-6));
      const reproT = smoothstep01((t - loop.reproStart) / Math.max(loop.reproFull - loop.reproStart, 1e-6));
      const blueT = smoothstep01((t - loop.blueStart) / Math.max(loop.blueFull - loop.blueStart, 1e-6));
      const purpleT = smoothstep01((t - loop.purpleStart) / Math.max(loop.purpleFull - loop.purpleStart, 1e-6));
      const baseProductScale = layoutMode === "mobile" ? 1.27 : 1.48;
      const productScale = baseProductScale * (
        0.92
        + targetT * 0.08
        + judgeT * (1 - reproT) * 0.045
        - purpleT * 0.025
      );

      // Core: authored rotation from progress + restrained pulse.
      if (core && coreMaterial) {
        core.rotation.y = t * 1.2;
        core.rotation.x = t * 0.35;
        const judgePulse = judgeT * (1 - reproT) * 0.075;
        core.scale.setScalar((0.94 + targetT * 0.06 + judgePulse + redT * 0.025) * productScale);
        coreMaterial.uniforms.uIntensity.value = (
          0.34 + targetT * 0.08 + redT * 0.15 + judgeT * 0.16
        ) * fade;
      }
      if (identityMark && identityMaterial) {
        identityMark.rotation.set(0, 0, 0);
        identityMark.scale.setScalar(productScale);
        identityMaterial.uniforms.uOpacity.value = Math.min(
          1,
          0.92 + targetT * 0.04 + judgeT * 0.04,
        ) * fade;
        if (identityCarrierMaterial) {
          identityCarrierMaterial.opacity = (0.13 + targetT * 0.12 + blueT * 0.04) * fade;
        }
        if (identityCarrierEdgeMaterial) {
          identityCarrierEdgeMaterial.opacity = (0.28 + blueT * 0.18 + purpleT * 0.12) * fade;
        }
      }
      if (cage && cageMaterial) {
        cage.rotation.y = -t * 0.8;
        cage.rotation.z = t * 0.5;
        cageMaterial.opacity = 0.48 * fade * (0.55 + redT * 0.45);
        cage.scale.setScalar(productScale);
      }
      if (ring && ringMaterial) {
        ring.rotation.z = t * 0.4;
        ringMaterial.color
          .setHex(MONKEYCLAW_COLORS.judge)
          .lerp(_color.setHex(MONKEYCLAW_COLORS.purple), blueT * (1 - purpleT))
          .lerp(_color.setHex(MONKEYCLAW_COLORS.telemetry), purpleT * 0.88);
        ringMaterial.opacity = (0.14 + judgeT * 0.62 + purpleT * 0.1) * fade;
        ring.scale.setScalar(1 + judgeT * (1 - blueT) * 0.045);
      }
      if (perimeter && perimeterMaterial) {
        perimeterMaterial.uniforms.uIntensity.value = (
          0.035 + targetT * 0.025 + judgeT * 0.11 + blueT * 0.04
        ) * fade;
      }
      if (containmentShield && containmentMaterial) {
        containmentShield.rotation.z = -t * 0.18;
        const judgeFocus = judgeT * (1 - reproT * 0.72);
        containmentMaterial.opacity = (0.03 + judgeFocus * 0.58 + blueT * 0.08) * fade;
      }
      if (judgeProgramMaterial && judgeEnsembleMaterial) {
        const judgeFocus = judgeT * (1 - reproT * 0.78);
        judgeProgramMaterial.opacity = judgeFocus * 0.95 * fade;
        judgeEnsembleMaterial.opacity = judgeFocus * 0.72 * fade;
      }
      if (reproSystem && reproVictims && reproVictimMaterial) {
        const reproFocus = reproT * Math.pow(1 - blueT, 3);
        reproSystem.rotation.z = -t * 0.34;
        reproSystem.rotation.y = Math.sin(t * Math.PI) * 0.12;
        reproSystem.scale.setScalar(layoutMode === "mobile" ? 0.76 : 1);
        reproRingMaterials.forEach((material, replayIndex) => {
          material.opacity = reproFocus * (0.38 + replayIndex * 0.2) * fade;
        });
        reproVictimMaterial.opacity = reproFocus * fade;
        for (let replayIndex = 0; replayIndex < 3; replayIndex += 1) {
          const angle = t * Math.PI * (1.15 + replayIndex * 0.16)
            + replayIndex * Math.PI * 2 / 3;
          const radius = 0.38 + replayIndex * 0.095;
          _pos.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.07);
          _quat.setFromAxisAngle(UP, 0);
          _scale.setScalar(0.76 + reproFocus * 0.34);
          _matrix.compose(_pos, _quat, _scale);
          reproVictims.setMatrixAt(replayIndex, _matrix);
        }
        reproVictims.instanceMatrix.needsUpdate = true;
      }
      if (patchLattice && patchLatticeMaterial && patchNodes && patchNodeMaterial) {
        patchLattice.rotation.y = t * 0.34;
        patchLattice.rotation.z = -t * 0.16;
        patchLattice.scale.setScalar(0.92 + blueT * 0.08);
        const patchFocus = blueT * Math.pow(1 - purpleT, 4);
        patchLatticeMaterial.opacity = Math.min(1, patchFocus * 1.3) * fade;
        patchNodeMaterial.opacity = Math.min(1, patchFocus * 1.55) * fade;
      }
      if (detectionQuadrants) {
        detectionQuadrants.rotation.z = 0;
        detectionQuadrants.scale.setScalar(0.82 + purpleT * 0.18);
        detectionQuadrantMaterials.forEach((material, quadrantIndex) => {
          const semanticWeight = quadrantIndex === 0 ? 0.92 : 0.26;
          material.opacity = purpleT * semanticWeight * fade;
          material.emissiveIntensity = quadrantIndex === 0
            ? 0.45 + purpleT * 1.15
            : 0.12 + purpleT * 0.18;
        });
      }
      if (securityLoop) {
        const stageProgress = [redT, judgeT, reproT, blueT, purpleT];
        securityLoop.rotation.z = t * 0.12;
        securityLoop.rotation.x = Math.sin(t * Math.PI) * 0.09;
        securityLoop.scale.setScalar(productScale);
        for (let stageIndex = 0; stageIndex < stageProgress.length; stageIndex += 1) {
          const activation = stageProgress[stageIndex];
          const nextActivation = stageProgress[stageIndex + 1] ?? 0;
          const focus = activation * (1 - nextActivation * 0.72);
          loopSegmentMaterials[stageIndex].opacity = (0.06 + activation * 0.34) * fade;
          loopStageMaterials[stageIndex].opacity = (0.16 + activation * 0.82) * fade;
          // DOM annotations own readable stage names. The old instrument
          // planes escaped the frame on wide/short viewports.
          loopStageLabelMaterials[stageIndex].opacity = 0;
          const assembled = smoothstep01((activation - stageIndex * 0.035) / Math.max(1 - stageIndex * 0.035, 1e-6));
          loopSegments[stageIndex].scale.setScalar(0.72 + assembled * 0.28);
          loopSegments[stageIndex].rotation.z = stageIndex * Math.PI * 2 / stageProgress.length
            + Math.PI * 0.08
            + (1 - assembled) * 0.34;
          loopStageLabels[stageIndex].scale.setScalar(0.72 + assembled * 0.28);
          loopStageLabels[stageIndex].rotation.z = -securityLoop.rotation.z;
          const pulse = 0.64 + assembled * 0.5 + focus * 0.08;
          loopStageNodes[stageIndex].scale.setScalar(pulse);
        }
      }

      // Attack vectors — pure function of loop progress per zone.
      if (vectors && vectorMaterial) {
        vectorMaterial.opacity = fade
          * (0.12 + redT * 0.88)
          * Math.pow(1 - reproT, 3)
          * Math.pow(1 - purpleT, 2);
        for (let index = 0; index < MONKEYCLAW_COUNTS.vectors; index += 1) {
          const timing = vectorTiming(index);
          const finding = vectorBecomesFinding(index);
          const approach = smoothstep01(
            (t - timing.startT) / Math.max(timing.arriveT - timing.startT, 1e-6),
          );
          _pos.copy(pathSpawn[index]).lerp(pathPerimeter[index], approach);
          let brightness = approach * (1 - approach * 0.25);
          if (finding) {
            const rank = findingRankForVector(index);
            const converge = smoothstep01(
              (t - timing.arriveT) / Math.max(timing.judgeT - timing.arriveT, 1e-6),
            );
            _pos.lerp(pathRing[index], converge);
            const penetrate = smoothstep01(
              (t - (loop.reproStart + rank * 0.018)) / 0.16,
            );
            _pos.lerp(pathCore[index], penetrate);
            brightness = Math.max(
              brightness * (1 - penetrate * 0.6),
              purpleT * 0.2 * (1 - penetrate),
            );
          } else {
            const deflectT = smoothstep01(
              (t - (loop.judgeStart + (index % 5) * 0.016)) / 0.18,
            );
            _pos.lerp(pathDeflect[index], deflectT);
            brightness *= 1 - deflectT * 0.92;
          }
          // Orient along the path direction (spawn → current segment target).
          _dir.copy(pathPerimeter[index]).sub(pathSpawn[index]);
          if (_dir.lengthSq() < 1e-6) _dir.set(0, -1, 0);
          _dir.normalize();
          _quat.setFromUnitVectors(UP, _dir);
          const scaleBase = 0.9 + approach * 0.8;
          const outcomeScale = finding ? 1 : Math.max(0.18, 1 - judgeT * 0.82);
          const vectorStateScale = outcomeScale * (1 - reproT * 0.68);
          _scale.setScalar(
            scaleBase
            * (0.7 + brightness * 0.5)
            * (0.32 + redT * 0.68)
            * Math.max(0.3, vectorStateScale),
          );
          _pos.add(root);
          _matrix.compose(_pos, _quat, _scale);
          vectors.setMatrixAt(index, _matrix);
          // Hostile red pressure → judged mineral → telemetry cool.
          if (finding && t > timing.judgeT - 0.06) {
            _color.setHex(MONKEYCLAW_COLORS.judge).multiplyScalar(0.5 + brightness * 0.5);
          } else if (!finding && judgeT > 0.25) {
            _color.setHex(MONKEYCLAW_COLORS.blue).multiplyScalar(0.46 + brightness * 0.54);
          } else {
            _color.setHex(MONKEYCLAW_COLORS.hostile).multiplyScalar(0.52 + brightness * 0.48);
          }
          vectors.setColorAt(index, _color);
        }
        vectors.instanceMatrix.needsUpdate = true;
        if (vectors.instanceColor) vectors.instanceColor.needsUpdate = true;
      }

      // Deflect flashes at the perimeter.
      if (flashes && flashMaterial) {
        flashMaterial.opacity = fade * judgeT * (1 - reproT * 0.85);
        for (let index = 0; index < MONKEYCLAW_COUNTS.vectors; index += 1) {
          if (vectorBecomesFinding(index)) {
            _scale.setScalar(0);
          } else {
            const deflectT = smoothstep01(
              (t - (loop.judgeStart + (index % 5) * 0.016)) / 0.18,
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

      // Blue's eight verifier gates resolve in sequence around the candidate
      // patch. They are deliberately absent during the judge and repro beats.
      for (let gate = 0; gate < gateMaterials.length; gate += 1) {
        const lit = smoothstep01((t - (loop.blueStart + gate * 0.015)) / 0.08);
        gateMaterials[gate].opacity = lit * fade;
        gateMaterials[gate].emissiveIntensity = 0.2 + lit * 1.35;
        const gateScale = 0.76 + lit * 0.38;
        gateMeshes[gate].scale.set(gateScale, gateScale, gateScale);
        gateStatusMeshes[gate].scale.setScalar(0.72 + lit * 0.34);
        gateStatusMaterials[gate].opacity = lit * (0.38 + blueT * 0.52) * fade;
      }
      if (verifierSpokeMaterial) {
        verifierSpokeMaterial.opacity = blueT * (0.12 + purpleT * 0.42) * fade;
      }

      // Gate evidence resolves toward one oracle; the final purple return
      // closes the architecture by routing the observed gap back to Red.
      for (let rail = 0; rail < railMaterials.length; rail += 1) {
        const railT = smoothstep01(
          (t - (loop.purpleStart + rail * 0.01)) / 0.1,
        );
        const pointCount = railMeshes[rail].geometry.getAttribute("position").count;
        railMeshes[rail].geometry.setDrawRange(0, Math.ceil(pointCount * railT));
        railMaterials[rail].opacity = railT * (rail === 0 ? 0.95 : 0.68) * fade;
      }
      if (feedbackReturn && feedbackReturnMaterial) {
        const feedbackT = smoothstep01((t - (loop.purpleStart + 0.09)) / 0.14);
        const pointCount = feedbackReturn.geometry.getAttribute("position").count;
        feedbackReturn.geometry.setDrawRange(0, Math.ceil(pointCount * feedbackT));
        feedbackReturnMaterial.opacity = feedbackT * 0.72 * fade;
      }
      if (telemetryBeadMaterial) {
        telemetryBeadMaterial.opacity = purpleT * 0.95 * fade;
      }

      // Edge-triggered audio hooks from primary crossings (bounded).
      if (eventBuffer.length < 4) {
        for (let finding = 0; finding < MONKEYCLAW_COUNTS.confirmedFindings; finding += 1) {
          const vectorIndex = MONKEYCLAW_COUNTS.vectors
            - MONKEYCLAW_COUNTS.confirmedFindings
            + finding;
          const judgeAt = vectorTiming(vectorIndex).judgeT;
          if (previousT < judgeAt && t >= judgeAt && eventBuffer.length < 4) {
            eventBuffer.push("judge-hit");
          }
        }
        const deflectEdge = loop.judgeStart + 0.05;
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

      // One bright evidence packet per rail. Primary placement remains tied to
      // scroll; time only supplies the restrained secondary streaming motion.
      if (telemetryBeads) {
        for (let rail = 0; rail < MONKEYCLAW_COUNTS.telemetryRails; rail += 1) {
          const railT = smoothstep01(
            (lastLoopT - (MONKEYCLAW_LOOP.purpleStart + rail * 0.01)) / 0.1,
          );
          const travel = frame.reducedMotion
            ? 0.72
            : (time * 0.22 + rail / MONKEYCLAW_COUNTS.telemetryRails) % 1;
          _pos.copy(telemetryCurves[rail].getPoint(railT * travel)).add(root);
          _quat.identity();
          _scale.setScalar(Math.max(railT * (0.72 + 0.28 * fade), 1e-4));
          _matrix.compose(_pos, _quat, _scale);
          telemetryBeads.setMatrixAt(rail, _matrix);
        }
        telemetryBeads.instanceMatrix.needsUpdate = true;
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
        perimeter,
        containmentShield,
        judgeProgramChecks,
        judgeEnsembleNodes,
        reproSystem,
        patchLattice,
        patchNodes,
        detectionQuadrants,
        verifierSpokes,
        securityLoop,
        lightingRig,
        core,
        identityMark,
        cage,
        ring,
        vectors,
        flashes,
        telemetryBeads,
        feedbackReturn,
        ...gateMeshes, ...gateStatusMeshes, ...railMeshes, ...pulseMeshes,
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
          perimeter, containmentShield, judgeProgramChecks, judgeEnsembleNodes,
          reproSystem, patchLattice, patchNodes, detectionQuadrants, verifierSpokes, securityLoop,
          lightingRig, core, identityMark, cage, ring, vectors, flashes, telemetryBeads,
          feedbackReturn, ...gateMeshes, ...gateStatusMeshes, ...railMeshes, ...pulseMeshes,
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
      gateStatusMeshes.length = 0;
      gateStatusMaterials.length = 0;
      railMeshes.length = 0;
      railMaterials.length = 0;
      telemetryCurves.length = 0;
      pulseMeshes.length = 0;
      pulseMaterials.length = 0;
      pulses.length = 0;
      loopSegments.length = 0;
      loopSegmentMaterials.length = 0;
      loopStageNodes.length = 0;
      loopStageMaterials.length = 0;
      loopStageLabels.length = 0;
      loopStageLabelMaterials.length = 0;
      reproRingMaterials.length = 0;
      detectionQuadrantMaterials.length = 0;
      loaded = false;
    },
  };
}
