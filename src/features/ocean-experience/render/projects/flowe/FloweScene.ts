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
import { createFloweAppCard, type FloweCardKind } from "./floweAppCard.ts";

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

function stateProgress(value: number, start: number, end: number): number {
  return smoothstep01((value - start) / Math.max(end - start, 0.001));
}

function staggeredReveal(progress: number, index: number, count: number): number {
  const delay = count <= 1 ? 0 : index / count * 0.38;
  return smoothstep01((progress - delay) / 0.48);
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
const FLOWE_TASK_WIDTHS = [1.28, 1.04, 1.18, 0.94, 1.22, 1.06, 1.18, 0.9, 1.26] as const;
const FLOWE_TASKS = [
  { title: "Study for psych quiz", detail: "Due Jun 6 · 2 Pomodoros", kind: "study", badge: "STUDY PLAN", tone: "gold" },
  { title: "Email Prof. Carter", detail: "Extension request", kind: "task", badge: "TASK" },
  { title: "History focus hour", detail: "Find a free hour next week", kind: "calendar", badge: "TASK" },
  { title: "Homework 3", detail: "12:00 PM · 10 pts", kind: "task", badge: "CANVAS" },
  { title: "Intro Psych", detail: "8:00–9:35 AM", kind: "course", badge: "PSYC-2" },
  { title: "Review drafts", detail: "Ready before saving", kind: "review", badge: "3 ITEMS" },
] as const;

type FloweFeaturePanel = {
  readonly state: number;
  readonly title: string;
  readonly detail: string;
  readonly x: number;
  readonly y: number;
  readonly scale?: number;
  readonly kind: FloweCardKind;
  readonly badge?: string;
  readonly tone?: "gold" | "teal";
};

const FLOWE_FEATURE_PANELS: readonly FloweFeaturePanel[] = [
  { state: 1, title: "Brain Dump", detail: "Break the history project into steps", x: 0, y: -0.08, scale: 1.34, kind: "brain", badge: "INPUT" },
  { state: 1, title: "Checking calendar", detail: "School context stays attached", x: 0, y: -0.31, scale: 0.9, kind: "calendar", badge: "WORKING" },
  { state: 2, title: "Study for psych quiz", detail: "Due Jun 6 · 2 Pomodoros", x: -0.48, y: -0.14, kind: "study", badge: "STUDY PLAN", tone: "gold" },
  { state: 2, title: "Email Prof. Carter", detail: "Extension request", x: 0, y: -0.14, kind: "task", badge: "TASK" },
  { state: 2, title: "History focus hour", detail: "Find a free hour next week", x: 0.48, y: -0.14, kind: "calendar", badge: "TASK" },
  { state: 2, title: "3 items drafted", detail: "Review before saving", x: 0, y: -0.38, scale: 0.94, kind: "review", badge: "CONFIRM" },
  { state: 3, title: "Canvas deadlines", detail: "Homework 3 · 12:00 PM", x: -0.29, y: -0.16, scale: 1.06, kind: "task", badge: "CANVAS" },
  { state: 3, title: "Intro Psych", detail: "PSYC-2 · 8:00–9:35 AM", x: 0.29, y: -0.16, scale: 1.06, kind: "course", badge: "COURSE" },
  { state: 5, title: "Study for psych quiz", detail: "50:00 · Focus Live Activity", x: 0, y: -0.28, scale: 1.3, kind: "focus", badge: "FOCUS" },
  { state: 6, title: "Offline queue", detail: "3 changes retained on device", x: -0.29, y: -0.17, scale: 1.05, kind: "sync", badge: "LOCAL" },
  { state: 6, title: "Convex sync", detail: "User-scoped · retry safe", x: 0.29, y: -0.17, scale: 1.05, kind: "sync", badge: "SYNCED" },
  { state: 7, title: "Good morning, Student!", detail: "Friday, 5 June · 0 tasks · 1 event", x: 0, y: -0.16, scale: 1.3, kind: "brain", badge: "BRIEFING" },
  { state: 7, title: "Today", detail: "PSYC-2 · 8:00–9:35 AM", x: 0, y: -0.4, scale: 0.92, kind: "course", badge: "1 EVENT" },
] as const;

const FLOWE_STATE_WINDOWS = [
  [0, 0.22],
  [0.2, 0.32],
  [0.3, 0.43],
  [0.41, 0.55],
  [0.53, 0.67],
  [0.65, 0.8],
  [0.78, 0.92],
  [0.9, 1.01],
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
  let semanticLinks: InstancedMesh | null = null;
  let semanticLinkMaterial: MeshBasicMaterial | null = null;
  let planGuides: InstancedMesh | null = null;
  let planGuideMaterial: MeshBasicMaterial | null = null;
  let focusTicks: InstancedMesh | null = null;
  let focusTickMaterial: MeshBasicMaterial | null = null;
  const syncOrbits: Mesh[] = [];
  const syncOrbitMaterials: MeshBasicMaterial[] = [];
  let briefHalo: Mesh | null = null;
  let briefHaloMaterial: MeshBasicMaterial | null = null;
  let flowIdentityPlate: Mesh | null = null;
  let flowIdentityMaterial: ShaderMaterial | null = null;
  const taskLabels: Mesh[] = [];
  const taskLabelMaterials: MeshBasicMaterial[] = [];
  const taskShells: Mesh[] = [];
  let taskShellMaterial: MeshPhysicalMaterial | null = null;
  const featurePanels: Mesh[] = [];
  const featurePanelMaterials: MeshBasicMaterial[] = [];
  const featurePanelShells: Mesh[] = [];
  const featurePanelShellMaterials: MeshPhysicalMaterial[] = [];
  let lightingRig: Group | null = null;
  let flowKeyLight: DirectionalLight | null = null;
  let flowRimLight: PointLight | null = null;
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

      // State grammar. Each product step gets a distinct structural signal:
      // parse links, plan guides, focus ticks, sync orbits, and a final halo.
      semanticLinkMaterial = track(new MeshBasicMaterial({
        color: 0x9fe9f2,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }));
      semanticLinks = new InstancedMesh(
        track(new PlaneGeometry(1, 0.006)),
        semanticLinkMaterial,
        5,
      );
      semanticLinks.name = "flowe-semantic-link-system";
      semanticLinks.instanceMatrix.setUsage(DynamicDrawUsage);

      planGuideMaterial = track(new MeshBasicMaterial({
        color: 0x76cddd,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }));
      planGuides = new InstancedMesh(
        track(new PlaneGeometry(1, 0.005)),
        planGuideMaterial,
        4,
      );
      planGuides.name = "flowe-plan-guide-system";
      planGuides.instanceMatrix.setUsage(DynamicDrawUsage);

      focusTickMaterial = track(new MeshBasicMaterial({
        color: 0xd5f8fb,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }));
      focusTicks = new InstancedMesh(
        track(new PlaneGeometry(0.055, 0.007)),
        focusTickMaterial,
        16,
      );
      focusTicks.name = "flowe-focus-tick-system";
      focusTicks.instanceMatrix.setUsage(DynamicDrawUsage);

      for (let orbit = 0; orbit < 2; orbit += 1) {
        const material = track(new MeshBasicMaterial({
          color: orbit === 0 ? 0x92dcea : 0x719fdf,
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
        }));
        const mesh = new Mesh(
          track(new RingGeometry(0.34 + orbit * 0.12, 0.345 + orbit * 0.12, 72, 1, 0, Math.PI * (1.28 + orbit * 0.22))),
          material,
        );
        mesh.name = `flowe-sync-orbit-${orbit + 1}`;
        mesh.renderOrder = 2;
        syncOrbits.push(mesh);
        syncOrbitMaterials.push(material);
      }

      briefHaloMaterial = track(new MeshBasicMaterial({
        color: 0xb8f1f4,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }));
      briefHalo = new Mesh(
        track(new RingGeometry(0.51, 0.516, 80, 1, Math.PI * 0.12, Math.PI * 1.76)),
        briefHaloMaterial,
      );
      briefHalo.name = "flowe-brief-halo";
      briefHalo.renderOrder = 2;

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
          uTime: { value: 0 },
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
          uniform float uTime;
          varying vec2 vUv;

          void considerSegment(
            vec2 point,
            vec2 startPoint,
            vec2 endPoint,
            float startOrder,
            float endOrder,
            inout float bestDistance,
            inout float bestOrder
          ) {
            vec2 segment = endPoint - startPoint;
            float position = clamp(
              dot(point - startPoint, segment) / max(dot(segment, segment), 0.00001),
              0.0,
              1.0
            );
            float distanceToSegment = length(point - (startPoint + segment * position));
            if (distanceToSegment < bestDistance) {
              bestDistance = distanceToSegment;
              bestOrder = mix(startOrder, endOrder, position);
            }
          }

          void main() {
            vec4 source = texture2D(uIdentity, vUv);
            float luminance = dot(source.rgb, vec3(0.2126, 0.7152, 0.0722));
            float mark = smoothstep(0.18, 0.58, luminance);
            float bestDistance = 10.0;
            float strokeOrder = 1.0;

            // The reveal follows the real FlowE mark's four centerlines. The
            // sampled logo remains the final alpha mask, so no substitute
            // geometry can change its silhouette, overlaps, or tapered tail.
            considerSegment(vUv, vec2(.344,.453), vec2(.246,.457), .000,.025, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.246,.457), vec2(.188,.492), .025,.050, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.188,.492), vec2(.152,.547), .050,.075, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.152,.547), vec2(.148,.605), .075,.100, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.148,.605), vec2(.176,.668), .100,.125, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.176,.668), vec2(.227,.719), .125,.150, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.227,.719), vec2(.313,.777), .150,.175, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.313,.777), vec2(.410,.813), .175,.200, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.410,.813), vec2(.504,.824), .200,.225, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.504,.824), vec2(.602,.813), .225,.250, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.602,.813), vec2(.688,.770), .250,.275, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.688,.770), vec2(.762,.703), .275,.300, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.762,.703), vec2(.813,.621), .300,.325, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.813,.621), vec2(.840,.543), .325,.350, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.840,.543), vec2(.836,.477), .350,.375, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.836,.477), vec2(.801,.438), .375,.400, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.801,.438), vec2(.691,.430), .400,.425, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.691,.430), vec2(.648,.418), .425,.450, bestDistance, strokeOrder);

            considerSegment(vUv, vec2(.344,.453), vec2(.344,.547), .170,.195, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.344,.547), vec2(.395,.621), .195,.220, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.395,.621), vec2(.512,.680), .220,.245, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.512,.680), vec2(.602,.625), .245,.270, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.602,.625), vec2(.598,.531), .270,.295, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.598,.531), vec2(.492,.488), .295,.320, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.492,.488), vec2(.344,.453), .320,.345, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.344,.453), vec2(.367,.367), .345,.380, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.367,.367), vec2(.500,.324), .380,.415, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.500,.324), vec2(.648,.418), .415,.450, bestDistance, strokeOrder);

            considerSegment(vUv, vec2(.648,.418), vec2(.777,.426), .450,.500, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.777,.426), vec2(.824,.383), .500,.550, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.824,.383), vec2(.816,.332), .550,.600, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.816,.332), vec2(.707,.266), .600,.650, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.707,.266), vec2(.621,.258), .650,.700, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.621,.258), vec2(.512,.297), .700,.750, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.512,.297), vec2(.492,.340), .750,.800, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.492,.340), vec2(.551,.402), .800,.850, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.551,.402), vec2(.648,.418), .850,.875, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.621,.258), vec2(.613,.215), .875,.910, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.613,.215), vec2(.625,.164), .910,.950, bestDistance, strokeOrder);
            considerSegment(vUv, vec2(.625,.164), vec2(.648,.117), .950,1.000, bestDistance, strokeOrder);

            float centerlineCoverage = 1.0 - smoothstep(0.095, 0.155, bestDistance);
            float ink = smoothstep(strokeOrder - 0.018, strokeOrder + 0.008, uReveal) * centerlineCoverage;
            float completedMark = smoothstep(0.9, 0.97, uReveal);
            float leadingEdge = (
              1.0 - smoothstep(0.012, 0.045, abs(strokeOrder - uReveal))
            ) * centerlineCoverage * uTracer * (0.88 + sin(uTime * 4.0) * 0.12);
            float alpha = mark * max(max(ink, completedMark), leadingEdge) * uOpacity;
            if (alpha < 0.01) discard;
            gl_FragColor = vec4(source.rgb + leadingEdge * vec3(0.08, 0.22, 0.28), alpha);
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

      const taskLabelGeometry = track(new PlaneGeometry(0.58, 0.181));
      const taskShellGeometry = track(createRoundedPanelGeometry(0.612, 0.198, 0.027, 0.03, 0.003));
      taskShellMaterial = track(new MeshPhysicalMaterial({
        color: 0x17323e,
        emissive: 0x0e4655,
        emissiveIntensity: 0.24,
        roughness: 0.2,
        metalness: 0.08,
        clearcoat: 1,
        clearcoatRoughness: 0.12,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }));
      for (let task = 0; task < FLOWE_TASKS.length; task += 1) {
        const taskCard = FLOWE_TASKS[task];
        const label = createFloweAppCard(taskCard.title, taskCard.detail, {
          badge: taskCard.badge,
          kind: taskCard.kind,
          tone: "tone" in taskCard ? taskCard.tone : undefined,
        });
        track(label.texture);
        track(label.material);
        const mesh = new Mesh(taskLabelGeometry, label.material);
        mesh.name = `flowe-task-${task + 1}`;
        mesh.renderOrder = 4;
        taskLabels.push(mesh);
        taskLabelMaterials.push(label.material);
        const shell = new Mesh(taskShellGeometry, taskShellMaterial);
        shell.name = `flowe-task-shell-${task + 1}`;
        shell.renderOrder = 3;
        taskShells.push(shell);
      }

      for (const panel of FLOWE_FEATURE_PANELS) {
        const label = createFloweAppCard(panel.title, panel.detail, {
          badge: panel.badge,
          kind: panel.kind,
          tone: panel.tone,
        });
        track(label.texture);
        track(label.material);
        const mesh = new Mesh(track(new PlaneGeometry(0.51, 0.159)), label.material);
        mesh.name = `flowe-state-${panel.state}-${panel.title.toLowerCase().replaceAll(" ", "-")}`;
        mesh.renderOrder = 6;
        featurePanels.push(mesh);
        featurePanelMaterials.push(label.material);
        const shellMaterial = track(new MeshPhysicalMaterial({
          color: panel.tone === "gold" ? 0x5c4221 : panel.state === 5 ? 0x18495a : 0x0c2440,
          emissive: panel.tone === "gold" ? 0x6b481a : panel.state === 5 ? 0x145c6a : 0x082f42,
          emissiveIntensity: panel.state === 5 ? 0.34 : 0.2,
          roughness: 0.2,
          metalness: 0.06,
          clearcoat: 1,
          clearcoatRoughness: 0.08,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }));
        const shell = new Mesh(
          track(createRoundedPanelGeometry(0.545, 0.176, 0.027, 0.03, 0.003)),
          shellMaterial,
        );
        shell.name = `${mesh.name}-shell`;
        shell.renderOrder = 5;
        featurePanelShells.push(shell);
        featurePanelShellMaterials.push(shellMaterial);
      }

      lightingRig = new Group();
      lightingRig.name = "flowe-product-lighting";
      const ambient = new HemisphereLight(0xe9fbff, 0x071923, 1.45);
      flowKeyLight = new DirectionalLight(0xf4fdff, 2.3);
      flowKeyLight.position.set(-1.5, 2.2, 2.8);
      flowRimLight = new PointLight(FLOWE_COLORS.current, 3.2, 5.5, 1.4);
      flowRimLight.position.set(0.85, -0.2, 1.35);
      lightingRig.add(ambient, flowKeyLight, flowRimLight);

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
      const objects = [lightingRig, flowIdentityPlate, fragments, fragmentAccents, motes, focusLens, indexField, semanticLinks, planGuides, focusTicks, briefHalo, ...syncOrbits, ...currentLines, ...taskShells, ...taskLabels, ...featurePanelShells, ...featurePanels];
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
      // The chapter first enters the viewport near 0.12. Keep the full draw
      // inside the visible range so it never begins offscreen.
      const logoDrawT = frame.reducedMotion ? 1 : smoothstep01((t - 0.11) / 0.08);
      const identityReady = smoothstep01((logoDrawT - 0.76) / 0.24);
      const organizedGroupT = groupT * identityReady;
      const taskAssemblyT = groupT;
      const visualScale = layoutMode === "mobile" ? 0.68 : 1;
      // Organization: motes settle, the water calms as the plan forms.
      const organization = smoothstep01(taskAssemblyT * 0.65 + focusT * 0.35);
      const idleAmp = frame.reducedMotion ? 0 : (1 - organization * 0.75);

      const statePresence = FLOWE_STATE_WINDOWS.map(([start, end]) => scenePresence(t, start, end, 0.02));
      const stateProgresses = FLOWE_STATE_WINDOWS.map(([start, end]) => {
        const entranceEnd = start + (end - start) * 0.56;
        return frame.reducedMotion ? 1 : stateProgress(t, start, entranceEnd);
      });
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
        flowIdentityMaterial.uniforms.uOpacity.value = logoPresence * fade;
        flowIdentityMaterial.uniforms.uReveal.value = logoDrawT;
        flowIdentityMaterial.uniforms.uTracer.value = frame.reducedMotion ? 0 : (1 - identityReady) * statePresence[0];
        flowIdentityMaterial.uniforms.uTime.value = frame.time;
        flowIdentityPlate.rotation.set(0, 0, 0);
        flowIdentityPlate.scale.setScalar(visualScale * (1.08 + statePresence[0] * 0.28 + statePresence[7] * 0.12));
        flowIdentityPlate.position.set(center.x, center.y + 0.24, 0.052);
      }

      for (let panelIndex = 0; panelIndex < featurePanels.length; panelIndex += 1) {
        const panel = FLOWE_FEATURE_PANELS[panelIndex];
        const presence = statePresence[panel.state];
        const statePanels = FLOWE_FEATURE_PANELS.filter((candidate) => candidate.state === panel.state);
        const panelRank = FLOWE_FEATURE_PANELS.slice(0, panelIndex)
          .filter((candidate) => candidate.state === panel.state).length;
        const baseReveal = frame.reducedMotion
          ? 1
          : staggeredReveal(stateProgresses[panel.state], panelRank, statePanels.length);
        const reveal = panel.state === 5 && !frame.reducedMotion
          ? smoothstep01((stateProgresses[5] - 0.82) / 0.18)
          : baseReveal;
        const scale = (panel.scale ?? 1) * visualScale;
        const originX = panel.state === 2
          ? 0
          : panel.state === 3
            ? (panelRank === 0 ? -0.08 : 0.08)
            : 0;
        const originY = panel.state === 7 ? -0.2 : panel.state >= 5 ? -0.24 : -0.1;
        _pos.set(
          center.x + originX + (panel.x - originX) * reveal,
          center.y + originY + (panel.y - originY) * reveal,
          0.13 + reveal * 0.07,
        );
        if (visualScale < 1) _pos.sub(center).multiplyScalar(visualScale).add(center);
        featurePanels[panelIndex].position.copy(_pos);
        featurePanelShells[panelIndex].position.copy(_pos).addScaledVector(_cardAxis, -0.018);
        featurePanels[panelIndex].rotation.z = (1 - reveal) * (panelIndex % 2 === 0 ? -0.035 : 0.035);
        featurePanelShells[panelIndex].rotation.z = featurePanels[panelIndex].rotation.z;
        featurePanels[panelIndex].scale.setScalar(scale * (0.88 + reveal * 0.12));
        featurePanelShells[panelIndex].scale.copy(featurePanels[panelIndex].scale);
        featurePanelMaterials[panelIndex].opacity = presence * reveal * fade;
        featurePanelShellMaterials[panelIndex].opacity = presence * reveal * 0.68 * fade;
        featurePanels[panelIndex].visible = presence * reveal > 0.001;
        featurePanelShells[panelIndex].visible = presence * reveal > 0.001;
      }

      if (semanticLinks && semanticLinkMaterial) {
        const parseReveal = frame.reducedMotion ? 1 : staggeredReveal(stateProgresses[2], 2, 4);
        const contextReveal = frame.reducedMotion ? 1 : staggeredReveal(stateProgresses[3], 1, 2);
        const semanticPresence = Math.max(statePresence[2], statePresence[3]);
        for (let link = 0; link < 5; link += 1) {
          const isContextBridge = link === 4;
          const linkReveal = isContextBridge ? contextReveal : parseReveal;
          const xOffset = link === 0 ? 0 : (link - 2) * 0.47;
          _pos.set(
            center.x + xOffset * visualScale,
            center.y + (link === 0 ? -0.22 : isContextBridge ? -0.15 : -0.19) * visualScale,
            0.12,
          );
          _quat.setFromAxisAngle(
            _cardAxis,
            link > 0 && !isContextBridge ? Math.PI * 0.5 : 0,
          );
          const linkLength = isContextBridge ? 0.58 : link === 0 ? 1.08 : 0.14;
          _scale.set(linkLength * visualScale * linkReveal, visualScale, 1);
          _matrix.compose(_pos, _quat, _scale);
          semanticLinks.setMatrixAt(link, _matrix);
        }
        semanticLinks.instanceMatrix.needsUpdate = true;
        semanticLinkMaterial.opacity = semanticPresence * 0.48 * fade;
        semanticLinks.visible = semanticPresence > 0.001;
      }

      if (planGuides && planGuideMaterial) {
        const planReveal = stateProgresses[4];
        for (let guide = 0; guide < 4; guide += 1) {
          const vertical = guide === 3;
          _pos.set(
            center.x,
            center.y + (vertical ? -0.305 : -0.19 - guide * 0.225) * visualScale,
            0.11,
          );
          _quat.setFromAxisAngle(_cardAxis, vertical ? Math.PI * 0.5 : 0);
          _scale.set((vertical ? 0.57 : 1.32) * visualScale * planReveal, visualScale, 1);
          _matrix.compose(_pos, _quat, _scale);
          planGuides.setMatrixAt(guide, _matrix);
        }
        planGuides.instanceMatrix.needsUpdate = true;
        planGuideMaterial.opacity = statePresence[4] * 0.34 * fade;
        planGuides.visible = statePresence[4] > 0.001;
      }

      if (focusTicks && focusTickMaterial) {
        const focusPresence = statePresence[5];
        const focusCenterY = center.y - 0.19 * visualScale;
        for (let tick = 0; tick < 16; tick += 1) {
          const angle = tick / 16 * Math.PI * 2 - Math.PI * 0.5;
          const radius = 0.47 * visualScale;
          _pos.set(
            center.x + Math.cos(angle) * radius,
            focusCenterY + Math.sin(angle) * radius,
            0.13,
          );
          _quat.setFromAxisAngle(_cardAxis, angle);
          const activeSweep = frame.reducedMotion
            ? 1
            : smoothstep01((stateProgresses[5] - tick / 16 * 0.38) / 0.62);
          _scale.set((0.7 + activeSweep * 0.55) * visualScale, visualScale, 1);
          _matrix.compose(_pos, _quat, _scale);
          focusTicks.setMatrixAt(tick, _matrix);
        }
        focusTicks.instanceMatrix.needsUpdate = true;
        focusTickMaterial.opacity = focusPresence * 0.7 * fade;
        focusTicks.visible = focusPresence > 0.001;
      }

      for (let orbit = 0; orbit < syncOrbits.length; orbit += 1) {
        const syncPresence = statePresence[6];
        syncOrbits[orbit].position.set(center.x, center.y - 0.2 * visualScale, 0.1);
        const syncReveal = stateProgresses[6];
        syncOrbits[orbit].scale.setScalar(visualScale * (0.72 + syncReveal * 0.28));
        syncOrbits[orbit].rotation.z = frame.reducedMotion
          ? orbit * 0.7
          : frame.time * (orbit === 0 ? 0.14 : -0.09) + orbit * 0.7;
        syncOrbitMaterials[orbit].opacity = syncPresence * (0.4 - orbit * 0.08) * fade;
        syncOrbits[orbit].visible = syncPresence > 0.001;
      }

      if (briefHalo && briefHaloMaterial) {
        const briefPresence = statePresence[7];
        const briefReveal = stateProgresses[7];
        briefHalo.position.set(center.x, center.y + (-0.18 + briefReveal * 0.42) * visualScale, 0.04);
        briefHalo.scale.setScalar(visualScale * (0.72 + briefReveal * 0.28));
        briefHalo.rotation.z = frame.reducedMotion ? 0 : Math.sin(frame.time * 0.22) * 0.035;
        briefHaloMaterial.opacity = briefPresence * 0.28 * fade;
        briefHalo.visible = briefPresence > 0.001;
      }

      const focusTask = 0;
      const focusHandoff = frame.reducedMotion
        ? 1
        : smoothstep01((stateProgresses[5] - 0.82) / 0.18);
      for (let task = 0; task < taskLabels.length; task += 1) {
        const reveal = frame.reducedMotion
          ? 1
          : staggeredReveal(stateProgresses[4], task, taskLabels.length);
        const planColumn = task % 2;
        const planRow = Math.floor(task / 2);
        _pos.set(
          center.x - 0.32 + planColumn * 0.64,
          center.y - 0.08 - planRow * 0.225,
          0.16,
        );
        _pos.y += (1 - reveal) * 0.18;
        if (task === focusTask) {
          _focusTarget.set(center.x, center.y - 0.06, 0.24);
          _pos.lerp(_focusTarget, stateProgresses[5]);
        } else {
          _pos.x += (task % 3 - 1) * focusT * 0.08;
          _pos.y -= focusT * 0.05;
        }
        if (visualScale < 1) _pos.sub(center).multiplyScalar(visualScale).add(center);
        taskLabels[task].position.copy(_pos);
        taskShells[task].position.copy(_pos).addScaledVector(_cardAxis, -0.018);
        taskLabels[task].rotation.z = (1 - reveal) * (task % 2 === 0 ? -0.12 : 0.12);
        taskShells[task].rotation.z = taskLabels[task].rotation.z;
        const focusScale = task === focusTask ? 1 + focusT * 0.38 : 1 - focusT * 0.12;
        taskLabels[task].scale.setScalar((0.72 + reveal * 0.28) * focusScale * visualScale);
        taskShells[task].scale.copy(taskLabels[task].scale);
        const focusOpacity = task === focusTask ? 1 : 1 - focusT * 0.88;
        const taskScenePresence = task === focusTask
          ? Math.max(statePresence[4], statePresence[5] * (1 - focusHandoff))
          : statePresence[4];
        taskLabelMaterials[task].opacity = reveal * focusOpacity * taskScenePresence * fade;
        taskLabels[task].visible = taskLabelMaterials[task].opacity > 0.001;
        taskShells[task].visible = taskLabelMaterials[task].opacity > 0.001;
      }
      if (taskShellMaterial) {
        taskShellMaterial.opacity = Math.max(
          statePresence[4],
          statePresence[5] * (1 - focusHandoff),
        ) * 0.64 * fade;
      }

      if (flowKeyLight && flowRimLight) {
        const focusLight = statePresence[5];
        const logoLight = Math.max(statePresence[0], statePresence[7] * 0.7);
        flowKeyLight.intensity = 1.9 + logoLight * 1.1 - focusLight * 0.35;
        flowKeyLight.position.x = -1.5 + statePresence[2] * 0.45;
        flowRimLight.intensity = 2.4 + focusLight * 2.8 + logoLight * 1.2;
        flowRimLight.position.set(center.x + 0.72, center.y - 0.06 + focusLight * 0.2, 1.35);
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
      const objects = [lightingRig, flowIdentityPlate, fragments, fragmentAccents, motes, focusLens, indexField, semanticLinks, planGuides, focusTicks, briefHalo, ...syncOrbits, ...currentLines, ...taskShells, ...taskLabels, ...featurePanelShells, ...featurePanels];
      for (const object of objects) {
        if (object && object.parent === stage) stage.remove(object);
      }
      stage = null;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      if (stage) {
        const objects = [lightingRig, flowIdentityPlate, fragments, fragmentAccents, motes, focusLens, indexField, semanticLinks, planGuides, focusTicks, briefHalo, ...syncOrbits, ...currentLines, ...taskShells, ...taskLabels, ...featurePanelShells, ...featurePanels];
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
      featurePanelShells.length = 0;
      featurePanelShellMaterials.length = 0;
      taskShells.length = 0;
      syncOrbits.length = 0;
      syncOrbitMaterials.length = 0;
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
