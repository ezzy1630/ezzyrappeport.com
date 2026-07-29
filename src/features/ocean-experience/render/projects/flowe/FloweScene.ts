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
  DoubleSide,
  DynamicDrawUsage,
  EdgesGeometry,
  Group,
  HemisphereLight,
  InstancedBufferAttribute,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  OctahedronGeometry,
  PointLight,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
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

function smoothstep01(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
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
const _fragmentCool = new Color(FLOWE_COLORS.fragment);
const _anchor: [number, number, number] = [0, 0, 0];

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
  let plannerBody: Mesh | null = null;
  let plannerBodyMaterial: MeshPhysicalMaterial | null = null;
  let plannerInset: Mesh | null = null;
  let plannerInsetMaterial: MeshPhysicalMaterial | null = null;
  let plannerFrame: LineSegments | null = null;
  let plannerFrameMaterial: LineBasicMaterial | null = null;
  let flowMark: Mesh | null = null;
  let flowMarkMaterial: MeshPhysicalMaterial | null = null;
  let flowMarkGeometry: TubeGeometry | null = null;
  let flowMarkGlow: Mesh | null = null;
  let flowMarkGlowMaterial: MeshBasicMaterial | null = null;
  let flowMarkGlowGeometry: TubeGeometry | null = null;
  let flowMarkHead: Mesh | null = null;
  let flowMarkHeadMaterial: MeshBasicMaterial | null = null;
  let flowMarkCurve: CatmullRomCurve3 | null = null;
  let flowIdentityPlate: Mesh | null = null;
  let flowIdentityMaterial: MeshBasicMaterial | null = null;
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
          primaryTask ? center.x - 0.27 + taskColumn * 0.27 : center.x + 0.39,
          primaryTask ? center.y - 0.25 - taskRow * 0.12 : center.y - 0.16 - (overflowRank % 8) * 0.065,
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
        depthWrite: true,
      }));
      fragments = new InstancedMesh(
        track(createRoundedPanelGeometry(0.145, 0.06, 0.026, 0.022, 0.004)),
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

      // Product silhouette: the FlowE mobile planner frame and its authored
      // continuous-loop mark. The task-card system now visibly belongs to the
      // app instead of floating as unrelated crystals.
      const plannerGeometry = track(createRoundedPanelGeometry(1.13, 1.33, 0.09, 0.105, 0.012));
      plannerBodyMaterial = track(new MeshPhysicalMaterial({
        color: FLOWE_COLORS.body,
        emissive: 0x06151d,
        emissiveIntensity: 0.22,
        roughness: 0.16,
        metalness: 0.38,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
        transparent: true,
        opacity: 0,
        depthWrite: true,
        side: DoubleSide,
      }));
      plannerBody = new Mesh(
        plannerGeometry,
        plannerBodyMaterial,
      );
      plannerBody.position.copy(center);
      plannerInsetMaterial = track(new MeshPhysicalMaterial({
        color: 0x05090c,
        emissive: 0x020506,
        emissiveIntensity: 0.18,
        roughness: 0.08,
        metalness: 0.22,
        clearcoat: 1,
        clearcoatRoughness: 0.045,
        transparent: true,
        opacity: 0,
        depthWrite: true,
      }));
      plannerInset = new Mesh(
        track(createRoundedPanelGeometry(0.94, 1.16, 0.035, 0.085, 0.006)),
        plannerInsetMaterial,
      );
      plannerInset.position.set(center.x, center.y, 0.058);
      plannerFrameMaterial = track(new LineBasicMaterial({
        color: FLOWE_COLORS.current,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }));
      plannerFrame = new LineSegments(
        track(new EdgesGeometry(plannerGeometry, 34)),
        plannerFrameMaterial,
      );
      plannerFrame.position.copy(center);

      const identityTexture = await new TextureLoader().loadAsync("/projects/flowe/app-icon.webp");
      if (context.signal.aborted || disposed) {
        identityTexture.dispose();
        return;
      }
      identityTexture.colorSpace = SRGBColorSpace;
      identityTexture.anisotropy = context.qualityTier === "high" ? 8 : 4;
      track(identityTexture);
      flowIdentityMaterial = track(new MeshBasicMaterial({
        color: 0xffffff,
        map: identityTexture,
        alphaMap: identityTexture,
        alphaTest: 0.035,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }));
      flowIdentityPlate = new Mesh(
        track(new PlaneGeometry(0.88, 0.88)),
        flowIdentityMaterial,
      );
      flowIdentityPlate.position.set(center.x, center.y + 0.24, 0.088);

      // Traced from the real FlowE icon: one continuous brain/e ribbon. The
      // centerline draws on with scroll before the tasks organize through it.
      flowMarkCurve = new CatmullRomCurve3([
        new Vector3(0.42, -0.46, 0),
        new Vector3(0.2, -0.5, 0.014),
        new Vector3(0.02, -0.38, 0),
        new Vector3(-0.16, -0.23, -0.014),
        new Vector3(-0.18, 0.02, 0),
        new Vector3(-0.03, 0.22, 0.016),
        new Vector3(0.18, 0.28, 0),
        new Vector3(0.32, 0.14, -0.012),
        new Vector3(0.28, -0.02, 0),
        new Vector3(0.08, -0.12, 0.014),
        new Vector3(-0.18, -0.06, 0),
        new Vector3(-0.42, 0.06, -0.012),
        new Vector3(-0.52, 0.28, 0),
        new Vector3(-0.4, 0.48, 0.014),
        new Vector3(-0.12, 0.62, 0),
        new Vector3(0.22, 0.6, -0.014),
        new Vector3(0.5, 0.42, 0),
        new Vector3(0.64, 0.16, 0.014),
        new Vector3(0.58, -0.1, 0),
        new Vector3(0.42, -0.25, -0.012),
        new Vector3(0.24, -0.2, 0),
        new Vector3(0.1, -0.36, 0.014),
        new Vector3(0.18, -0.54, 0),
        new Vector3(0.06, -0.7, -0.012),
      ], false, "catmullrom", 0.42);
      flowMarkGlowMaterial = track(new MeshBasicMaterial({
        color: FLOWE_COLORS.current,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }));
      flowMarkGlowGeometry = track(new TubeGeometry(flowMarkCurve, 120, 0.045, 8, false));
      flowMarkGlow = new Mesh(flowMarkGlowGeometry, flowMarkGlowMaterial);
      flowMarkGlow.position.set(center.x, center.y + 0.24, 0.075);
      flowMarkGlow.scale.setScalar(0.62);
      flowMarkMaterial = track(new MeshPhysicalMaterial({
        color: FLOWE_COLORS.focus,
        emissive: 0x2b6874,
        emissiveIntensity: 0.62,
        roughness: 0.12,
        metalness: 0.08,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        transparent: true,
        opacity: 0,
        depthWrite: true,
      }));
      flowMarkGeometry = track(new TubeGeometry(flowMarkCurve, 120, 0.027, 8, false));
      flowMark = new Mesh(flowMarkGeometry, flowMarkMaterial);
      flowMark.position.set(center.x, center.y + 0.24, 0.08);
      flowMark.scale.setScalar(0.62);
      flowMarkHeadMaterial = track(new MeshBasicMaterial({
        color: FLOWE_COLORS.focus,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }));
      flowMarkHead = new Mesh(track(new SphereGeometry(0.028, 8, 6)), flowMarkHeadMaterial);

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
      const objects = [lightingRig, plannerBody, plannerInset, plannerFrame, flowIdentityPlate, flowMarkGlow, flowMark, flowMarkHead, fragments, fragmentAccents, motes, focusLens, indexField, ...currentLines];
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
      const logoDrawT = frame.reducedMotion ? 1 : smoothstep01((t - 0.04) / 0.38);
      const identityReady = smoothstep01((logoDrawT - 0.68) / 0.32);
      const organizedGroupT = groupT * identityReady;
      const taskAssemblyT = smoothstep01(identityReady * 0.7 + groupT * 0.4);
      const visualScale = layoutMode === "mobile" ? 0.58 : 1;
      // Organization: motes settle, the water calms as the plan forms.
      const organization = smoothstep01(taskAssemblyT * 0.65 + focusT * 0.35);
      const idleAmp = frame.reducedMotion ? 0 : (1 - organization * 0.75);

      if (plannerBody && plannerBodyMaterial) {
        plannerBodyMaterial.opacity = (0.14 + identityReady * 0.62 - contractT * 0.18) * fade;
        plannerBody.rotation.y = plannerFrame?.rotation.y ?? -0.12;
        plannerBody.rotation.x = -0.08;
        plannerBody.scale.setScalar(visualScale);
      }
      if (plannerInset && plannerInsetMaterial) {
        plannerInsetMaterial.opacity = (0.18 + identityReady * 0.72 - contractT * 0.2) * fade;
        plannerInset.rotation.y = plannerFrame?.rotation.y ?? -0.12;
        plannerInset.rotation.x = -0.08;
        plannerInset.scale.setScalar(visualScale);
      }
      if (plannerFrame && plannerFrameMaterial) {
        plannerFrameMaterial.opacity = (0.08 + identityReady * 0.32 + organizedGroupT * 0.12 - contractT * 0.14) * fade;
        plannerFrame.rotation.y = frame.reducedMotion ? -0.12 : -0.12 + Math.sin(frame.time * 0.24) * 0.035;
        plannerFrame.rotation.x = -0.08;
        plannerFrame.scale.setScalar(visualScale);
      }
      if (flowIdentityPlate && flowIdentityMaterial) {
        flowIdentityMaterial.opacity = identityReady * (0.96 - contractT * 0.24) * fade;
        flowIdentityPlate.rotation.y = plannerFrame?.rotation.y ?? -0.12;
        flowIdentityPlate.rotation.x = -0.08;
        flowIdentityPlate.scale.setScalar(visualScale);
      }
      if (flowMark && flowMarkMaterial && flowMarkGeometry && flowMarkCurve) {
        const rotation = frame.reducedMotion ? 0 : Math.sin(frame.time * 0.32) * 0.04;
        const setDrawProgress = (geometry: TubeGeometry) => {
          const indexCount = geometry.index?.count ?? 0;
          geometry.setDrawRange(0, Math.floor(indexCount * logoDrawT / 3) * 3);
        };
        setDrawProgress(flowMarkGeometry);
        if (flowMarkGlowGeometry) setDrawProgress(flowMarkGlowGeometry);
        flowMarkMaterial.opacity = (0.025 + (1 - identityReady) * 0.82 + focusT * 0.035 - contractT * 0.04) * fade;
        flowMark.rotation.z = rotation;
        flowMark.scale.setScalar(0.62 * visualScale);
        if (flowMarkGlow && flowMarkGlowMaterial) {
          flowMarkGlow.rotation.z = rotation;
          flowMarkGlow.scale.setScalar(0.62 * visualScale);
          flowMarkGlowMaterial.opacity = (0.012 + (1 - identityReady) * 0.22 + focusT * 0.018) * fade;
        }
        if (flowMarkHead && flowMarkHeadMaterial) {
          const point = flowMarkCurve.getPointAt(Math.min(logoDrawT, 0.999));
          const cos = Math.cos(rotation);
          const sin = Math.sin(rotation);
          flowMarkHead.position.set(
            center.x + (point.x * cos - point.y * sin) * 0.62,
            center.y + 0.24 + (point.x * sin + point.y * cos) * 0.62,
            0.09 + point.z * 0.62,
          );
          flowMarkHeadMaterial.opacity = logoDrawT > 0.01 && logoDrawT < 0.995 ? fade * 0.95 : 0;
          flowMarkHead.scale.setScalar(0.72 + Math.sin(frame.time * 4) * 0.12);
        }
      }

      // Fragments: drift → cluster (structured plan) → stream (focus) → index.
      if (fragments && fragmentMaterial) {
        fragmentMaterial.opacity = fade * (0.62 + organization * 0.34);
        if (fragmentAccentMaterial) {
          fragmentAccentMaterial.opacity = fade * (0.18 + organization * 0.68);
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
          const organizedScale = index < 9 ? 0.82 : 0.02;
          const scalePulse = (0.75 + Math.sin(frame.time * 0.8 + phase * 6.3) * 0.12 * idleAmp)
            * (1 + (organizedScale - 1) * organization)
            * visualScale;
          _scale.setScalar(scalePulse);
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
        currentMaterials[line].opacity = (organizedGroupT * 0.075 - contractT * 0.06) * fade;
        currentLines[line].rotation.z = 0.3 + organizedGroupT * 0.5 + breathe;
        currentLines[line].scale.setScalar(1 + breathe * 2);
      }

      // Focus lens: appears as the plan narrows.
      if (focusLens && focusMaterial) {
        focusMaterial.opacity = (focusT * 0.16 - contractT * 0.12) * fade;
        focusLens.scale.setScalar(0.72 - focusT * 0.12);
        focusLens.rotation.z = frame.reducedMotion ? 0 : frame.time * 0.15;
      }

      // Index field: points of the contracted local index.
      if (indexField && indexMaterial) {
        indexMaterial.opacity = contractT * 0.7 * fade;
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
        moteMaterial.opacity = fade * (0.34 - organization * 0.22);
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
      const objects = [lightingRig, plannerBody, plannerInset, plannerFrame, flowIdentityPlate, flowMarkGlow, flowMark, flowMarkHead, fragments, fragmentAccents, motes, focusLens, indexField, ...currentLines];
      for (const object of objects) {
        if (object && object.parent === stage) stage.remove(object);
      }
      stage = null;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      if (stage) {
        const objects = [lightingRig, plannerBody, plannerInset, plannerFrame, flowIdentityPlate, flowMarkGlow, flowMark, flowMarkHead, fragments, fragmentAccents, motes, focusLens, indexField, ...currentLines];
        for (const object of objects) {
          if (object && object.parent === stage) stage.remove(object);
        }
        stage = null;
      }
      for (const resource of disposables) resource.dispose();
      disposables.length = 0;
      currentLines.length = 0;
      currentMaterials.length = 0;
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
