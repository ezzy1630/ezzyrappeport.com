/**
 * FlowE encounter — luminous planning current (plan §10.4).
 *
 * A brighter, calmer mid-depth clearing. Loose obligations drift in as
 * luminous fragments; a course-aware current groups them into a structured
 * plan, then narrows into one focused stream; the stream contracts into a
 * local index field (the Argyph sonar hint). Secondary motes settle as
 * organization increases. Breathing room is the design: few objects, soft
 * ray fields, controlled bioluminescence.
 *
 * Every primary transform is a pure function of chapter progress; probe
 * nudges are bounded and rebalance back into the current.
 */

import {
  AdditiveBlending,
  CatmullRomCurve3,
  Color,
  DirectionalLight,
  DynamicDrawUsage,
  Group,
  HemisphereLight,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  OctahedronGeometry,
  PointLight,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  TubeGeometry,
  Vector3,
} from "three";
import type {
  EncounterAudioEvent,
  EncounterFrameResult,
  EncounterLoadContext,
  ProjectEncounter,
} from "../../encounter-contract.ts";
import {
  FLOWE_COLORS,
  FLOWE_COUNTS,
  FLOWE_LOOP,
  FLOWE_STAGE,
  clusterForFragment,
  fragmentDriftAnchor,
  moteSeed,
} from "./floweConfig.ts";
import { createRoundedPanelGeometry } from "../shared/productGeometry.ts";
import { createInstrumentLabel } from "../shared/instrumentLabel.ts";

function smoothstep01(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function scenePresence(value: number, start: number, end: number, feather = 0.035): number {
  const enter = smoothstep01((value - start) / feather);
  const exit = 1 - smoothstep01((value - end) / feather);
  return Math.min(enter, exit);
}

type ProbeNudge = {
  active: boolean;
  fragmentIndex: number;
  bornAt: number;
  offset: Vector3;
};

const _pos = new Vector3();
const _quat = new Quaternion();
const _scale = new Vector3();
const _matrix = new Matrix4();
const _color = new Color();
const _cardAxis = new Vector3(0, 0, 1);
const _focusTarget = new Vector3();
const _fragmentCool = new Color(FLOWE_COLORS.fragment);
const _anchor: [number, number, number] = [0, 0, 0];
const FLOWE_TASK_WIDTHS = [1.28, 0.94, 1.16, 1.02, 1.34, 0.88, 1.18, 0.9, 1.26] as const;
const FLOWE_TASKS = [
  ["Canvas", "2 assignments due"],
  ["Chem lab", "today · 4:00 PM"],
  ["Focus block", "50 minutes"],
  ["Essay draft", "revise introduction"],
  ["Daily plan", "6 tasks · 2 complete"],
  ["Review cards", "18 remaining"],
  ["Office hours", "tomorrow · 2:30"],
  ["Study group", "library · 6:00"],
  ["Submit quiz", "due 11:59 PM"],
] as const;

type FloweFeaturePanel = {
  readonly state: number;
  readonly title: string;
  readonly detail: string;
  readonly x: number;
  readonly y: number;
  readonly scale?: number;
};

const FLOWE_FEATURE_PANELS: readonly FloweFeaturePanel[] = [
  { state: 1, title: "BRAIN DUMP", detail: "break the history project into steps", x: 0, y: -0.08, scale: 1.34 },
  { state: 1, title: "VOICE READY", detail: "text or speech · private by default", x: 0, y: -0.3, scale: 0.88 },
  { state: 2, title: "TASK", detail: "revise history introduction", x: -0.47, y: -0.14 },
  { state: 2, title: "EVENT", detail: "Chem lab · 4:00 PM", x: 0, y: -0.14 },
  { state: 2, title: "FOCUS", detail: "study block · 50 min", x: 0.47, y: -0.14 },
  { state: 2, title: "REVIEW", detail: "confirm before saving", x: 0, y: -0.37, scale: 0.9 },
  { state: 3, title: "CANVAS", detail: "REST / ICS · 2 assignments due", x: -0.28, y: -0.15, scale: 1.05 },
  { state: 3, title: "COURSE MATCH", detail: "Chem 1B · due today", x: 0.28, y: -0.15, scale: 1.05 },
  { state: 5, title: "FOCUS LIVE ACTIVITY", detail: "50:00 · one calm block", x: 0, y: -0.28, scale: 1.28 },
  { state: 6, title: "OFFLINE QUEUE", detail: "3 changes retained on device", x: -0.28, y: -0.16, scale: 1.04 },
  { state: 6, title: "CONVEX SYNC", detail: "user-scoped · retry safe", x: 0.28, y: -0.16, scale: 1.04 },
  { state: 7, title: "MORNING BRIEF", detail: "4 priorities · 2 events", x: 0, y: -0.16, scale: 1.28 },
  { state: 7, title: "READY", detail: "today has a shape", x: 0, y: -0.38, scale: 0.86 },
] as const;

const FLOWE_STATE_WINDOWS = [
  [0, 0.19],
  [0.15, 0.3],
  [0.27, 0.42],
  [0.39, 0.54],
  [0.51, 0.66],
  [0.63, 0.79],
  [0.76, 0.91],
  [0.88, 1.01],
] as const;

export function createFloweEncounter(): ProjectEncounter {
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

  let fragments: InstancedMesh | null = null;
  let fragmentMaterial: MeshPhysicalMaterial | null = null;
  let fragmentAccents: InstancedMesh | null = null;
  let fragmentAccentMaterial: MeshBasicMaterial | null = null;
  let motes: InstancedMesh | null = null;
  let moteMaterial: MeshBasicMaterial | null = null;
  const currentLines: Mesh[] = [];
  const currentMaterials: MeshBasicMaterial[] = [];
  let focusLens: Mesh | null = null;
  let focusMaterial: MeshBasicMaterial | null = null;
  let indexField: InstancedMesh | null = null;
  let indexMaterial: MeshBasicMaterial | null = null;
  let flowIdentityPlate: Mesh | null = null;
  let flowIdentityMaterial: ShaderMaterial | null = null;
  let flowLogoDrawGroup: Group | null = null;
  const flowLogoStrokes: Mesh[] = [];
  const flowLogoStrokeGeometries: TubeGeometry[] = [];
  const flowLogoStrokeMaterials: MeshPhysicalMaterial[] = [];
  const taskLabels: Mesh[] = [];
  const taskLabelMaterials: MeshBasicMaterial[] = [];
  const featurePanels: Mesh[] = [];
  const featurePanelMaterials: MeshBasicMaterial[] = [];
  let lightingRig: Group | null = null;
  const nudges: ProbeNudge[] = [];

  // Deterministic per-fragment state.
  const driftAnchors: Vector3[] = [];
  const clusterTargets: Vector3[] = [];
  const clusterAngles: number[] = [];
  const streamTargets: Vector3[] = [];
  const indexTargets: Vector3[] = [];
  const fragmentPhase: number[] = [];

  let fade = 0;
  const eventBuffer: EncounterAudioEvent[] = [];

  function currentCenter(): Vector3 {
    const c = layoutMode === "mobile" ? FLOWE_STAGE.currentMobile : FLOWE_STAGE.currentDesktop;
    return root.set(c[0], c[1], c[2]);
  }

  return {
    id: "flowe",
    estimatedGpuMb: 4,

    async load(context: EncounterLoadContext) {
      if (loaded || disposed || context.signal.aborted) return;
      layoutMode = context.layout;
      const center = currentCenter();

      // Per-fragment anchors along drift → cluster → stream → index.
      for (let index = 0; index < FLOWE_COUNTS.fragments; index += 1) {
        fragmentDriftAnchor(index, _anchor);
        driftAnchors.push(new Vector3(_anchor[0], _anchor[1], _anchor[2]));
        const cluster = clusterForFragment(index);
        const primaryTask = index < 9;
        const taskColumn = index % 3;
        const taskRow = Math.floor(index / 3);
        const overflowRank = index - 9;
        clusterTargets.push(new Vector3(
          primaryTask ? center.x - 0.48 + taskColumn * 0.48 : center.x + 0.64,
          primaryTask ? center.y - 0.12 - taskRow * 0.2 : center.y - 0.12 - (overflowRank % 8) * 0.08,
          primaryTask ? 0.16 : 0.1 + (cluster % 2) * 0.008,
        ));
        clusterAngles.push(0);
        const streamT = index / Math.max(FLOWE_COUNTS.fragments - 1, 1);
        streamTargets.push(primaryTask
          ? clusterTargets[index].clone()
          : new Vector3(
            center.x - 0.55 + streamT * FLOWE_STAGE.streamLength,
            center.y - 0.28 + Math.sin(streamT * Math.PI) * 0.1,
            0,
          ));
        const col = index % 4;
        const row = Math.floor(index / 4) % 3;
        indexTargets.push(primaryTask
          ? clusterTargets[index].clone()
          : new Vector3(
            center.x + 0.52 + col * 0.09,
            center.y - 0.62 + row * 0.09,
            0,
          ));
        fragmentPhase.push((index * 0.37) % 1);
      }

      fragmentMaterial = track(new MeshPhysicalMaterial({
        color: FLOWE_COLORS.fragment,
        emissive: 0x173f49,
        emissiveIntensity: 0.42,
        roughness: 0.2,
        metalness: 0.12,
        clearcoat: 1,
        clearcoatRoughness: 0.14,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }));
      fragments = new InstancedMesh(
        track(createRoundedPanelGeometry(0.18, 0.066, 0.018, 0.018, 0.003)),
        fragmentMaterial,
        FLOWE_COUNTS.fragments,
      );
      fragments.instanceMatrix.setUsage(DynamicDrawUsage);
      fragments.instanceColor = new InstancedBufferAttribute(
        new Float32Array(FLOWE_COUNTS.fragments * 3).fill(0),
        3,
      );
      fragments.instanceColor.setUsage(DynamicDrawUsage);
      fragmentAccentMaterial = track(new MeshBasicMaterial({
        color: FLOWE_COLORS.focus,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }));
      fragmentAccents = new InstancedMesh(
        track(createRoundedPanelGeometry(0.078, 0.009, 0.008, 0.004, 0.001)),
        fragmentAccentMaterial,
        FLOWE_COUNTS.fragments,
      );
      fragmentAccents.instanceMatrix.setUsage(DynamicDrawUsage);

      // Ambient motes — fine volume that settles as the plan organizes.
      moteMaterial = track(new MeshBasicMaterial({
        color: FLOWE_COLORS.mote,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }));
      motes = new InstancedMesh(
        track(new SphereGeometry(0.008, 4, 3)),
        moteMaterial,
        FLOWE_COUNTS.motes,
      );
      motes.instanceMatrix.setUsage(DynamicDrawUsage);
      for (let mote = 0; mote < FLOWE_COUNTS.motes; mote += 1) {
        moteSeed(mote, _anchor);
        _pos.set(center.x + _anchor[0], center.y + _anchor[1], _anchor[2]);
        _scale.setScalar(0.7 + (mote % 3) * 0.25);
        _quat.identity();
        _matrix.compose(_pos, _quat, _scale);
        motes.setMatrixAt(mote, _matrix);
      }

      // Course-aware current: soft parallel stream lines.
      for (let line = 0; line < 3; line += 1) {
        const material = track(new MeshBasicMaterial({
          color: FLOWE_COLORS.current,
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
        }));
        const mesh = new Mesh(track(new RingGeometry(0.68 + line * 0.1, 0.68 + line * 0.1 + 0.004, 64, 1, Math.PI * 1.08, Math.PI * 0.62)), material);
        mesh.position.set(center.x + 0.18, center.y - 0.1, 0);
        currentLines.push(mesh);
        currentMaterials.push(material);
      }

      // Focus lens: the plan narrows into one stream.
      focusMaterial = track(new MeshBasicMaterial({
        color: FLOWE_COLORS.focus,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: 2,
      }));
      focusLens = new Mesh(
        track(new RingGeometry(FLOWE_STAGE.focusRadius - 0.006, FLOWE_STAGE.focusRadius, 48)),
        focusMaterial,
      );
      focusLens.position.set(center.x, center.y - 0.38, 0.11);

      // Contracted index field — the Argyph sonar hint.
      indexMaterial = track(new MeshBasicMaterial({
        color: FLOWE_COLORS.index,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }));
      indexField = new InstancedMesh(
        track(new OctahedronGeometry(0.016, 0)),
        indexMaterial,
        FLOWE_COUNTS.indexPoints,
      );
      indexField.instanceMatrix.setUsage(DynamicDrawUsage);

      const identityTexture = await new TextureLoader().loadAsync("/projects/flowe/app-icon.webp");
      if (context.signal.aborted || disposed) {
        identityTexture.dispose();
        return;
      }
      identityTexture.colorSpace = SRGBColorSpace;
      identityTexture.anisotropy = context.qualityTier === "high" ? 8 : 4;
      track(identityTexture);
      flowIdentityMaterial = track(new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: false,
        uniforms: {
          uIdentity: { value: identityTexture },
          uOpacity: { value: 0 },
          uReveal: { value: 0 },
          uTracer: { value: 0 },
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
          uniform float uReveal;
          uniform float uTracer;
          varying vec2 vUv;

          void main() {
            vec4 source = texture2D(uIdentity, vUv);
            float luminance = dot(source.rgb, vec3(0.2126, 0.7152, 0.0722));
            float mark = smoothstep(0.42, 0.78, luminance);
            float strokeOrder = clamp(
              0.58 * (1.0 - vUv.y) +
              0.34 * vUv.x +
              sin(vUv.y * 13.0) * 0.035,
              0.0,
              1.0
            );
            float ink = smoothstep(strokeOrder - 0.045, strokeOrder + 0.012, uReveal);
            float leadingEdge = (1.0 - smoothstep(0.018, 0.06, abs(strokeOrder - uReveal))) * uTracer;
            float alpha = mark * max(ink, leadingEdge) * uOpacity;
            if (alpha < 0.01) discard;
            vec3 paperWhite = mix(vec3(0.86, 0.93, 0.96), vec3(1.0), luminance);
            gl_FragColor = vec4(paperWhite + leadingEdge * vec3(0.08, 0.2, 0.24), alpha);
          }
        `,
      }));
      flowIdentityPlate = new Mesh(
        track(new PlaneGeometry(0.72, 0.72)),
        flowIdentityMaterial,
      );
      flowIdentityPlate.name = "flowe-brand-mark-plane";
      flowIdentityPlate.renderOrder = 3;
      flowIdentityPlate.position.set(center.x, center.y + 0.24, 0.052);

      // Literal logo construction. Three independent tubes follow the outer
      // brain, inner e, and descending tail. drawRange is tied to scroll, so
      // the mark is built rather than uncovered by a rectangular wipe.
      flowLogoDrawGroup = new Group();
      flowLogoDrawGroup.name = "flowe-logo-draw-system";
      const logoPaths = [
        [
          [-0.42, 0.08], [-0.39, 0.3], [-0.2, 0.48], [0.08, 0.52],
          [0.34, 0.4], [0.45, 0.17], [0.39, -0.02], [0.23, -0.09],
        ],
        [
          [-0.25, 0.06], [-0.17, 0.28], [0.03, 0.34], [0.18, 0.23],
          [0.15, 0.06], [-0.04, -0.06], [-0.18, -0.18], [-0.08, -0.31],
          [0.15, -0.28], [0.31, -0.16],
        ],
        [
          [0.31, -0.16], [0.38, -0.28], [0.27, -0.38], [0.12, -0.36],
          [0.2, -0.48], [0.25, -0.6],
        ],
      ] as const;
      for (const [strokeIndex, points] of logoPaths.entries()) {
        const curve = new CatmullRomCurve3(points.map(([x, y]) => new Vector3(x, y, 0)));
        const geometry = track(new TubeGeometry(curve, strokeIndex === 1 ? 104 : 72, 0.037, 8, false));
        geometry.setDrawRange(0, 0);
        const material = track(new MeshPhysicalMaterial({
          color: 0xf3fbff,
          emissive: strokeIndex === 1 ? 0x72d8ea : 0x4aa8cc,
          emissiveIntensity: strokeIndex === 1 ? 0.48 : 0.34,
          roughness: 0.18,
          metalness: 0.08,
          clearcoat: 1,
          clearcoatRoughness: 0.08,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }));
        const stroke = new Mesh(geometry, material);
        stroke.renderOrder = 5;
        flowLogoStrokes.push(stroke);
        flowLogoStrokeGeometries.push(geometry);
        flowLogoStrokeMaterials.push(material);
        flowLogoDrawGroup.add(stroke);
      }
      flowLogoDrawGroup.position.set(center.x, center.y + 0.25, 0.09);

      const taskLabelGeometry = track(new PlaneGeometry(0.43, 0.134));
      for (let task = 0; task < FLOWE_TASKS.length; task += 1) {
        const [title, detail] = FLOWE_TASKS[task];
        const label = createInstrumentLabel(title, detail, {
          accent: "rgba(117, 219, 232, 0.96)",
          background: "rgba(8, 25, 32, 0.82)",
          foreground: "rgba(241, 251, 252, 0.98)",
          muted: "rgba(164, 198, 204, 0.94)",
        });
        track(label.texture);
        track(label.material);
        const mesh = new Mesh(taskLabelGeometry, label.material);
        mesh.name = `flowe-task-${task + 1}`;
        mesh.renderOrder = 4;
        taskLabels.push(mesh);
        taskLabelMaterials.push(label.material);
      }

      for (const panel of FLOWE_FEATURE_PANELS) {
        const label = createInstrumentLabel(panel.title, panel.detail, {
          accent: "rgba(94, 214, 232, 0.98)",
          background: "rgba(5, 20, 31, 0.9)",
          foreground: "rgba(244, 252, 255, 1)",
          muted: "rgba(172, 207, 219, 0.96)",
        });
        track(label.texture);
        track(label.material);
        const mesh = new Mesh(track(new PlaneGeometry(0.46, 0.143)), label.material);
        mesh.name = `flowe-state-${panel.state}-${panel.title.toLowerCase().replaceAll(" ", "-")}`;
        mesh.renderOrder = 6;
        featurePanels.push(mesh);
        featurePanelMaterials.push(label.material);
      }

      lightingRig = new Group();
      lightingRig.name = "flowe-product-lighting";
      const ambient = new HemisphereLight(0xe9fbff, 0x071923, 1.45);
      const key = new DirectionalLight(0xf4fdff, 2.3);
      key.position.set(-1.5, 2.2, 2.8);
      const rim = new PointLight(FLOWE_COLORS.current, 3.2, 5.5, 1.4);
      rim.position.set(0.85, -0.2, 1.35);
      lightingRig.add(ambient, key, rim);

      for (let nudge = 0; nudge < FLOWE_COUNTS.probePool; nudge += 1) {
        nudges.push({
          active: false,
          fragmentIndex: -1,
          bornAt: 0,
          offset: new Vector3(),
        });
      }

      loaded = true;
    },

    attach(stageRoot) {
      if (!loaded || stage) return;
      stage = stageRoot;
      const objects = [lightingRig, flowIdentityPlate, flowLogoDrawGroup, fragments, fragmentAccents, motes, focusLens, indexField, ...currentLines, ...taskLabels, ...featurePanels];
      for (const object of objects) {
        if (object) stage.add(object);
      }
    },

    seek(frame) {
      if (!loaded || disposed) return;
      fade = frame.fade;
      layoutMode = frame.layout;
      const t = clamp01(frame.chapterProgress);
      const center = currentCenter();
      const loop = FLOWE_LOOP;
      const driftT = smoothstep01((t - loop.driftStart) / (loop.driftFull - loop.driftStart));
      const groupT = smoothstep01((t - loop.groupStart) / (loop.groupFull - loop.groupStart));
      const focusT = smoothstep01((t - loop.focusStart) / (loop.focusFull - loop.focusStart));
      const contractT = smoothstep01((t - loop.contractStart) / (loop.contractFull - loop.contractStart));
      const logoDrawT = frame.reducedMotion ? 1 : smoothstep01((t - 0.008) / 0.18);
      const identityReady = smoothstep01((logoDrawT - 0.76) / 0.24);
      const organizedGroupT = groupT * identityReady;
      const taskAssemblyT = smoothstep01(identityReady * 0.7 + groupT * 0.4);
      const visualScale = layoutMode === "mobile" ? 0.68 : 1;
      // Organization: motes settle, the water calms as the plan forms.
      const organization = smoothstep01(taskAssemblyT * 0.65 + focusT * 0.35);
      const idleAmp = frame.reducedMotion ? 0 : (1 - organization * 0.75);

      const statePresence = FLOWE_STATE_WINDOWS.map(([start, end]) => scenePresence(t, start, end));
      const logoPresence = Math.max(statePresence[0], statePresence[7] * 0.82);
      const fragmentScenePresence = Math.max(
        statePresence[1],
        statePresence[2],
        statePresence[3],
        statePresence[4],
        statePresence[5],
        statePresence[6],
      );

      if (flowIdentityPlate && flowIdentityMaterial) {
        flowIdentityMaterial.uniforms.uOpacity.value = logoPresence * (0.08 + identityReady * 0.88) * fade;
        flowIdentityMaterial.uniforms.uReveal.value = logoDrawT;
        flowIdentityMaterial.uniforms.uTracer.value = frame.reducedMotion ? 0 : (1 - identityReady) * statePresence[0];
        flowIdentityPlate.rotation.y = frame.reducedMotion ? -0.04 : -0.04 + Math.sin(frame.time * 0.24) * 0.018;
        flowIdentityPlate.rotation.x = -0.035;
        flowIdentityPlate.scale.setScalar(visualScale * (1.08 + statePresence[0] * 0.28 + statePresence[7] * 0.12));
        flowIdentityPlate.position.set(center.x, center.y + 0.24, 0.052);
      }

      if (flowLogoDrawGroup) {
        flowLogoDrawGroup.position.set(center.x, center.y + 0.25, 0.09);
        flowLogoDrawGroup.scale.setScalar(visualScale * (0.94 + statePresence[0] * 0.14));
        flowLogoDrawGroup.rotation.z = frame.reducedMotion ? 0 : Math.sin(frame.time * 0.22) * 0.012;
        for (let strokeIndex = 0; strokeIndex < flowLogoStrokes.length; strokeIndex += 1) {
          const strokeStart = strokeIndex * 0.18;
          const strokeProgress = smoothstep01((logoDrawT - strokeStart) / Math.max(1 - strokeStart, 0.001));
          const geometry = flowLogoStrokeGeometries[strokeIndex];
          const indexCount = geometry.index?.count ?? 0;
          geometry.setDrawRange(0, Math.floor(indexCount * strokeProgress / 3) * 3);
          flowLogoStrokeMaterials[strokeIndex].opacity = logoPresence
            * (0.62 + strokeProgress * 0.38)
            * (1 - identityReady * 0.96)
            * fade;
          flowLogoStrokeMaterials[strokeIndex].emissiveIntensity = 0.28 + (1 - strokeProgress) * 1.1;
        }
      }

      for (let panelIndex = 0; panelIndex < featurePanels.length; panelIndex += 1) {
        const panel = FLOWE_FEATURE_PANELS[panelIndex];
        const presence = statePresence[panel.state];
        const reveal = smoothstep01(presence * 1.3);
        const scale = (panel.scale ?? 1) * visualScale;
        _pos.set(center.x + panel.x, center.y + panel.y + (1 - reveal) * 0.12, 0.2);
        if (visualScale < 1) _pos.sub(center).multiplyScalar(visualScale).add(center);
        featurePanels[panelIndex].position.copy(_pos);
        featurePanels[panelIndex].rotation.z = (1 - reveal) * (panelIndex % 2 === 0 ? -0.035 : 0.035);
        featurePanels[panelIndex].scale.setScalar(scale * (0.88 + reveal * 0.12));
        featurePanelMaterials[panelIndex].opacity = presence * fade;
      }

      const focusTask = 2;
      for (let task = 0; task < taskLabels.length; task += 1) {
        const stagger = task * 0.035;
        const reveal = smoothstep01((taskAssemblyT - stagger) / Math.max(0.72 - stagger, 0.001));
        _pos.copy(clusterTargets[task]);
        _pos.y += (1 - reveal) * 0.18;
        if (task === focusTask) {
          _focusTarget.set(center.x, center.y - 0.06, 0.24);
          _pos.lerp(_focusTarget, focusT);
        } else {
          _pos.x += (task % 3 - 1) * focusT * 0.08;
          _pos.y -= focusT * 0.05;
        }
        if (visualScale < 1) _pos.sub(center).multiplyScalar(visualScale).add(center);
        taskLabels[task].position.copy(_pos);
        taskLabels[task].rotation.z = (1 - reveal) * (task % 2 === 0 ? -0.12 : 0.12);
        const focusScale = task === focusTask ? 1 + focusT * 0.38 : 1 - focusT * 0.12;
        taskLabels[task].scale.setScalar((0.72 + reveal * 0.28) * focusScale * visualScale);
        const focusOpacity = task === focusTask ? 1 : 1 - focusT * 0.88;
        taskLabelMaterials[task].opacity = reveal * focusOpacity * statePresence[4] * fade;
      }

      // Fragments: drift → cluster (structured plan) → stream (focus) → index.
      if (fragments && fragmentMaterial) {
        fragmentMaterial.opacity = fade * fragmentScenePresence * (0.62 + organization * 0.34);
        if (fragmentAccentMaterial) {
          fragmentAccentMaterial.opacity = fade * fragmentScenePresence * (0.18 + organization * 0.68);
        }
        for (let index = 0; index < FLOWE_COUNTS.fragments; index += 1) {
          const phase = fragmentPhase[index];
          const wobble = Math.sin(frame.time * 0.5 + phase * Math.PI * 2) * 0.05 * idleAmp;
          _pos.copy(driftAnchors[index]);
          _pos.x += center.x + wobble;
          _pos.y += center.y * 0 + Math.cos(frame.time * 0.4 + phase * 5.1) * 0.04 * idleAmp;
          // Group into the cluster column with per-fragment stagger.
          const clusterT = smoothstep01((taskAssemblyT - phase * 0.1) / 0.9);
          _pos.lerp(clusterTargets[index], clusterT);
          // Narrow into the focus stream.
          const streamT = smoothstep01((focusT - phase * 0.15) / 0.85);
          _pos.lerp(streamTargets[index], streamT);
          // Contract into the index field.
          const contractFragT = smoothstep01((contractT - phase * 0.1) / 0.9);
          _pos.lerp(indexTargets[index], contractFragT);
          // Probe nudges offset the fragment; the current reabsorbs it.
          const nudge = nudges.find((candidate) => candidate.active && candidate.fragmentIndex === index);
          if (nudge) _pos.add(nudge.offset);
          if (visualScale < 1) {
            _pos.sub(center).multiplyScalar(visualScale).add(center);
          }
          const tangentAngle = clusterAngles[index];
          const cardTurn = (1 - organization) * Math.sin(phase * Math.PI * 2) * 0.9
            + organization * tangentAngle;
          _quat.setFromAxisAngle(_cardAxis, cardTurn);
          const organizedScale = index < 9 ? 0.94 : 0;
          const scalePulse = (0.75 + Math.sin(frame.time * 0.8 + phase * 6.3) * 0.12 * idleAmp)
            * (1 + (organizedScale - 1) * organization)
            * visualScale
            * (index < 9 ? 1 - taskAssemblyT * 0.84 : Math.pow(1 - organization, 2.5));
          _scale.set(
            scalePulse * (index < FLOWE_TASK_WIDTHS.length ? FLOWE_TASK_WIDTHS[index] : 1),
            scalePulse,
            scalePulse,
          );
          _matrix.compose(_pos, _quat, _scale);
          fragments.setMatrixAt(index, _matrix);
          if (fragmentAccents) {
            _pos.z += 0.022;
            _scale.set(scalePulse * 0.72, scalePulse * 0.78, scalePulse);
            _matrix.compose(_pos, _quat, _scale);
            fragmentAccents.setMatrixAt(index, _matrix);
          }
          // Warm loose obligations cool into the planned stream.
          const warmth = 1 - organization;
          _color.setHex(FLOWE_COLORS.fragmentWarm);
          _color.lerp(_fragmentCool, 1 - warmth * 0.65);
          _color.multiplyScalar(0.35 + driftT * 0.5 + organization * 0.3);
          fragments.setColorAt(index, _color);
        }
        fragments.instanceMatrix.needsUpdate = true;
        if (fragments.instanceColor) fragments.instanceColor.needsUpdate = true;
        if (fragmentAccents) fragmentAccents.instanceMatrix.needsUpdate = true;
      }

      // Current lines breathe in as grouping begins.
      for (let line = 0; line < currentLines.length; line += 1) {
        const breathe = frame.reducedMotion ? 0 : Math.sin(frame.time * 0.6 + line) * 0.02;
        currentMaterials[line].opacity = Math.max(0, organizedGroupT * 0.1 - contractT * 0.06) * fragmentScenePresence * fade;
        currentLines[line].rotation.z = 0.3 + organizedGroupT * 0.5 + breathe;
        currentLines[line].scale.setScalar(1 + breathe * 2);
      }

      // Focus lens: appears as the plan narrows.
      if (focusLens && focusMaterial) {
        focusMaterial.opacity = statePresence[5] * 0.42 * fade;
        focusLens.position.set(center.x, center.y - 0.19, 0.11);
        focusLens.scale.setScalar((0.82 + statePresence[5] * 0.18) * visualScale);
        focusLens.rotation.z = frame.reducedMotion ? 0 : frame.time * 0.15;
      }

      // Index field: points of the contracted local index.
      if (indexField && indexMaterial) {
        indexMaterial.opacity = statePresence[6] * 0.78 * fade;
        for (let point = 0; point < FLOWE_COUNTS.indexPoints; point += 1) {
          const anchor = indexTargets[point % indexTargets.length];
          const col = point % 4;
          const row = Math.floor(point / 4);
          _pos.set(
            anchor.x + (col - 1.5) * 0.01 + contractT * 0,
            anchor.y + (row - 1) * 0.01,
            0,
          );
          _quat.identity();
          _scale.setScalar(0.5 + contractT * 0.7);
          _matrix.compose(_pos, _quat, _scale);
          indexField.setMatrixAt(point, _matrix);
        }
        indexField.instanceMatrix.needsUpdate = true;
      }

      // Motes settle: sink slightly and dim as organization increases.
      if (moteMaterial) {
        moteMaterial.opacity = fade * (0.2 + logoPresence * 0.26 + statePresence[1] * 0.16 - organization * 0.08);
      }

    },

    probe(event) {
      if (!loaded || disposed || fade < 0.35) return;
      if (event.kind !== "down") return;
      const nudge = nudges.find((candidate) => !candidate.active);
      if (!nudge) return;
      // Nudge the nearest unplanned fragment; the current absorbs it.
      const center = currentCenter();
      let nearest = -1;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (let index = 0; index < FLOWE_COUNTS.fragments; index += 1) {
        const anchor = driftAnchors[index];
        const distance = Math.hypot(anchor.x + center.x - event.x, anchor.y + center.y - event.y);
        if (distance < nearestDistance) {
          nearest = index;
          nearestDistance = distance;
        }
      }
      if (nearest < 0 || nearestDistance > 0.9) return;
      nudge.active = true;
      nudge.fragmentIndex = nearest;
      nudge.bornAt = event.time;
      nudge.offset.set(
        Math.max(-0.2, Math.min(0.2, (event.x - (driftAnchors[nearest].x + center.x)) * 0.3)),
        Math.max(-0.2, Math.min(0.2, (event.y - (driftAnchors[nearest].y + center.y)) * 0.3)),
        0,
      );
      if (eventBuffer.length < 4) eventBuffer.push("current-rebalance");
    },

    update(frame) {
      const drained = eventBuffer.slice();
      eventBuffer.length = 0;
      const empty: EncounterFrameResult = { drawCalls: 0, audioEvents: drained };
      if (!loaded || disposed) return empty;

      // Nudges rebalance: the offset decays and the fragment rejoins the
      // current at its authored position (no persistent user state).
      for (const nudge of nudges) {
        if (!nudge.active) continue;
        const age = frame.time - nudge.bornAt;
        nudge.offset.multiplyScalar(Math.exp(-age * 2.6));
        if (age > 1.6 || nudge.offset.length() < 0.005) {
          nudge.active = false;
          nudge.fragmentIndex = -1;
          nudge.offset.set(0, 0, 0);
        }
      }
      return {
        drawCalls: 0,
        audioEvents: drained.concat(eventBuffer),
      };
    },

    detach() {
      if (!stage) return;
      const objects = [lightingRig, flowIdentityPlate, flowLogoDrawGroup, fragments, fragmentAccents, motes, focusLens, indexField, ...currentLines, ...taskLabels, ...featurePanels];
      for (const object of objects) {
        if (object && object.parent === stage) stage.remove(object);
      }
      stage = null;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      if (stage) {
        const objects = [lightingRig, flowIdentityPlate, flowLogoDrawGroup, fragments, fragmentAccents, motes, focusLens, indexField, ...currentLines, ...taskLabels, ...featurePanels];
        for (const object of objects) {
          if (object && object.parent === stage) stage.remove(object);
        }
        stage = null;
      }
      for (const resource of disposables) resource.dispose();
      disposables.length = 0;
      currentLines.length = 0;
      currentMaterials.length = 0;
      taskLabels.length = 0;
      taskLabelMaterials.length = 0;
      featurePanels.length = 0;
      featurePanelMaterials.length = 0;
      flowLogoStrokes.length = 0;
      flowLogoStrokeGeometries.length = 0;
      flowLogoStrokeMaterials.length = 0;
      driftAnchors.length = 0;
      clusterTargets.length = 0;
      clusterAngles.length = 0;
      streamTargets.length = 0;
      indexTargets.length = 0;
      fragmentPhase.length = 0;
      nudges.length = 0;
      loaded = false;
    },
  };
}

export default createFloweEncounter;
