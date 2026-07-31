/**
 * Etch encounter — pressure-forged verification path (plan §10.3).
 *
 * Natural-language intent churns as an unstable pressure volume. Typed
 * constraint planes crystallize its boundary. Candidate structures form,
 * travel the verification ladder through simulation/formal light planes,
 * and only the evidence-backed result remains — stopped before the visibly
 * pending physical-signoff gate. No false completion.
 *
 * Every primary transform is a pure function of chapter progress; the probe
 * perturbation is a bounded, critically damped secondary response.
 */

import {
  AdditiveBlending,
  BufferGeometry,
  BoxGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  DynamicDrawUsage,
  EdgesGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
  Group,
  HemisphereLight,
  MeshPhysicalMaterial,
  PointLight,
  SRGBColorSpace,
  TextureLoader,
} from "three";
import type {
  EncounterAudioEvent,
  EncounterFrameResult,
  EncounterLoadContext,
  ProjectEncounter,
} from "../../encounter-contract.ts";
import {
  ETCH_COLORS,
  ETCH_CANDIDATES,
  ETCH_COUNTS,
  ETCH_GATES,
  ETCH_LOOP,
  ETCH_STAGE,
  gateStationX,
} from "./etchConfig.ts";
import { createRoundedPanelGeometry } from "../shared/productGeometry.ts";
import { createInstrumentLabel } from "../shared/instrumentLabel.ts";

function smoothstep01(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** A scene owns a bounded scroll interval with soft crossfades at each edge. */
function scenePresence(progress: number, start: number, end: number, feather = 0.055): number {
  const enters = smoothstep01((progress - (start - feather)) / feather);
  const exits = 1 - smoothstep01((progress - end) / feather);
  return enters * exits;
}

const INTENT_SHADER = {
  vertex: /* glsl */ `
    uniform float uTime;
    uniform float uInstability;
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      vec3 displaced = position + normal * (
        sin(position.x * 7.1 + uTime * 1.7)
        * sin(position.y * 6.3 - uTime * 1.1)
        * sin(position.z * 5.7 + uTime * 0.6)
        * uInstability * 0.075
      );
      vec4 world = modelMatrix * vec4(displaced, 1.0);
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
      float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.2);
      gl_FragColor = vec4(uColor * (rim * uIntensity + 0.03), 1.0);
    }
  `,
};

type ProbePerturbation = {
  active: boolean;
  candidateIndex: number;
  bornAt: number;
  offset: Vector3;
};

const _color = new Color();
const _dieMatrix = new Matrix4();

export function createEtchEncounter(): ProjectEncounter {
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

  let axisGroup: Group | null = null;
  let intentMesh: Mesh | null = null;
  let intentMaterial: ShaderMaterial | null = null;
  const frameLines: LineSegments[] = [];
  const frameFills: Mesh[] = [];
  const frameMaterials: LineBasicMaterial[] = [];
  const fillMaterials: MeshBasicMaterial[] = [];
  const candidateMeshes: Mesh[] = [];
  const candidateMaterials: MeshPhysicalMaterial[] = [];
  const candidateCellMaterials: MeshBasicMaterial[] = [];
  const candidateBase: Vector3[] = [];
  const candidateLabels: Mesh[] = [];
  const candidateLabelMaterials: MeshBasicMaterial[] = [];
  let counterexampleTrace: Line | null = null;
  let counterexampleMaterial: LineBasicMaterial | null = null;
  const gatePlanes: LineSegments[] = [];
  const gateMaterials: LineBasicMaterial[] = [];
  const gateLabels: Mesh[] = [];
  const gateLabelMaterials: MeshBasicMaterial[] = [];
  let resultMesh: Mesh | null = null;
  let resultLattice: LineSegments | null = null;
  let resultAssembly: Group | null = null;
  let dossierAssembly: Group | null = null;
  let dossierSheets: InstancedMesh | null = null;
  let dossierMaterial: MeshPhysicalMaterial | null = null;
  let dossierRows: InstancedMesh | null = null;
  let dossierRowMaterial: MeshBasicMaterial | null = null;
  let dossierStatuses: InstancedMesh | null = null;
  let dossierStatusMaterial: MeshBasicMaterial | null = null;
  const dossierLabels: Mesh[] = [];
  const dossierLabelMaterials: MeshBasicMaterial[] = [];
  let resultMaterial: MeshPhysicalMaterial | null = null;
  let resultIdentityMaterial: ShaderMaterial | null = null;
  let latticeMaterial: LineBasicMaterial | null = null;
  let dieCells: InstancedMesh | null = null;
  let dieCellMaterial: MeshPhysicalMaterial | null = null;
  let diePins: InstancedMesh | null = null;
  let diePinMaterial: MeshPhysicalMaterial | null = null;
  let dieScrews: InstancedMesh | null = null;
  let dieScrewMaterial: MeshPhysicalMaterial | null = null;
  let dieTraces: InstancedMesh | null = null;
  let dieTraceMaterial: MeshBasicMaterial | null = null;
  let dieVias: InstancedMesh | null = null;
  let dieViaMaterial: MeshPhysicalMaterial | null = null;
  const dieDetails: Mesh[] = [];
  const dieDetailMaterials: MeshBasicMaterial[] = [];
  const relaxCurves: Mesh[] = [];
  const relaxMaterials: MeshBasicMaterial[] = [];
  const perturbations: ProbePerturbation[] = [];

  let fade = 0;
  let lastT = 0;
  let axisX0: number = ETCH_STAGE.axisDesktop.x0;
  const eventBuffer: EncounterAudioEvent[] = [];
  const gateLit = [false, false, false, false];

  function axisY(): number {
    return layoutMode === "mobile" ? ETCH_STAGE.axisMobile.y : ETCH_STAGE.axisDesktop.y;
  }

  return {
    id: "etch",
    estimatedGpuMb: 2,

    async load(context: EncounterLoadContext) {
      if (loaded || disposed || context.signal.aborted) return;
      layoutMode = context.layout;
      const axis = layoutMode === "mobile" ? ETCH_STAGE.axisMobile : ETCH_STAGE.axisDesktop;
      axisX0 = axis.x0;
      root.set(0, axisY(), 0);

      axisGroup = new Group();
      axisGroup.name = "etch-verification-ladder";

      // Intent pressure volume — unstable until constraints crystallize it.
      intentMaterial = track(new ShaderMaterial({
        vertexShader: INTENT_SHADER.vertex,
        fragmentShader: INTENT_SHADER.fragment,
        uniforms: {
          uTime: { value: 0 },
          uInstability: { value: 1 },
          uColor: { value: new Color(ETCH_COLORS.intent) },
          uIntensity: { value: 0 },
        },
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      }));
      intentMesh = new Mesh(
        track(new IcosahedronGeometry(ETCH_STAGE.intentRadius, 1)),
        intentMaterial,
      );
      intentMesh.position.set(axisX0, 0, 0);
      axisGroup.add(intentMesh);

      // Typed constraint planes crystallize the boundary.
      const frameGeometry = track(new EdgesGeometry(
        new BoxGeometry(ETCH_STAGE.intentRadius * 2.3, ETCH_STAGE.intentRadius * 2.3, 0.02),
      ));
      const fillGeometry = track(new PlaneGeometry(
        ETCH_STAGE.intentRadius * 2.3, ETCH_STAGE.intentRadius * 2.3,
      ));
      for (let plane = 0; plane < ETCH_COUNTS.constraintPlanes; plane += 1) {
        const material = track(new LineBasicMaterial({
          color: ETCH_COLORS.constraint,
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
        }));
        const line = new LineSegments(frameGeometry, material);
        const fillMaterial = track(new MeshBasicMaterial({
          color: ETCH_COLORS.constraint,
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
        }));
        const fill = new Mesh(fillGeometry, fillMaterial);
        const planeDepth = (plane - (ETCH_COUNTS.constraintPlanes - 1) * 0.5) * 0.13;
        line.position.set(axisX0, 0, planeDepth);
        fill.position.copy(line.position);
        axisGroup.add(line, fill);
        frameLines.push(line);
        frameFills.push(fill);
        frameMaterials.push(material);
        fillMaterials.push(fillMaterial);
      }

      // Candidate crystalline structures.
      const candidateGeometries = [
        track(createRoundedPanelGeometry(ETCH_STAGE.candidateSize * 1.35, ETCH_STAGE.candidateSize, 0.055, 0.03, 0.005)),
        track(createRoundedPanelGeometry(ETCH_STAGE.candidateSize * 1.15, ETCH_STAGE.candidateSize * 1.12, 0.055, 0.03, 0.005)),
        track(createRoundedPanelGeometry(ETCH_STAGE.candidateSize * 1.35, ETCH_STAGE.candidateSize, 0.055, 0.03, 0.005)),
      ];
      const candidateLabelGeometry = track(new PlaneGeometry(0.5, 0.12));
      const candidateCellGeometry = track(createRoundedPanelGeometry(0.058, 0.038, 0.012, 0.008, 0.002));
      for (let candidate = 0; candidate < ETCH_COUNTS.candidates; candidate += 1) {
        const material = track(new MeshPhysicalMaterial({
          color: ETCH_COLORS.candidate,
          emissive: 0x1d4654,
          emissiveIntensity: 0.42,
          roughness: 0.18,
          metalness: 0.28,
          clearcoat: 1,
          clearcoatRoughness: 0.1,
          transparent: true,
          opacity: 0,
          depthWrite: true,
        }));
        const mesh = new Mesh(candidateGeometries[candidate], material);
        const cellMaterial = track(new MeshBasicMaterial({
          color: ETCH_COLORS.constraint,
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
        }));
        const cells = new InstancedMesh(candidateCellGeometry, cellMaterial, 6);
        for (let cell = 0; cell < 6; cell += 1) {
          _dieMatrix.makeTranslation(
            -0.075 + (cell % 3) * 0.075,
            0.035 - Math.floor(cell / 3) * 0.07,
            0.066,
          );
          cells.setMatrixAt(cell, _dieMatrix);
        }
        mesh.add(cells);
        const stationX = axisX0 + 0.34 + candidate * 0.3;
        mesh.position.set(axisX0, 0, 0);
        axisGroup.add(mesh);
        candidateMeshes.push(mesh);
        candidateMaterials.push(material);
        candidateCellMaterials.push(cellMaterial);
        candidateBase.push(new Vector3(stationX, (1 - candidate) * 0.2, (candidate - 1) * 0.08));

        const evidence = ETCH_CANDIDATES[candidate];
        const instrument = createInstrumentLabel(
          `CANDIDATE ${evidence.id} · ${evidence.verdict}`,
          evidence.metric,
          {
            accent: `#${evidence.color.toString(16).padStart(6, "0")}`,
            background: "rgba(5, 22, 29, 0.9)",
            foreground: "rgba(242, 250, 251, 0.98)",
            muted: "rgba(174, 205, 211, 0.94)",
          },
        );
        track(instrument.texture);
        track(instrument.material);
        const label = new Mesh(candidateLabelGeometry, instrument.material);
        label.renderOrder = 5;
        label.visible = false;
        axisGroup.add(label);
        candidateLabels.push(label);
        candidateLabelMaterials.push(instrument.material);
      }

      // Candidate B's retained counterexample. The binary step breaks at
      // cycle 1, where rd_valid diverges while the reference remains low.
      const counterexampleGeometry = track(new BufferGeometry().setFromPoints([
        new Vector3(-0.22, 0, 0), new Vector3(-0.14, 0, 0),
        new Vector3(-0.14, 0.08, 0), new Vector3(-0.05, 0.08, 0),
        new Vector3(-0.05, -0.05, 0), new Vector3(0.05, -0.05, 0),
        new Vector3(0.05, 0.08, 0), new Vector3(0.2, 0.08, 0),
      ]));
      counterexampleMaterial = track(new LineBasicMaterial({
        color: ETCH_COLORS.fail,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }));
      counterexampleTrace = new Line(counterexampleGeometry, counterexampleMaterial);
      counterexampleTrace.renderOrder = 5;
      axisGroup.add(counterexampleTrace);

      // Verification gate light planes; the signoff gate stays an open frame.
      const gateGeometry = track(new EdgesGeometry(
        new BoxGeometry(0.08, ETCH_STAGE.gateHeight, 0.06),
      ));
      const gateLabelGeometry = track(new PlaneGeometry(0.3, 0.09));
      for (let gate = 0; gate < ETCH_COUNTS.gates; gate += 1) {
        const pending = !ETCH_GATES[gate].passed;
        const material = track(new LineBasicMaterial({
          color: pending ? ETCH_COLORS.pending : ETCH_COLORS.pass,
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
        }));
        const plane = new LineSegments(gateGeometry, material);
        plane.position.set(
          gateStationX(gate, axisX0, ETCH_STAGE.gateSpacing),
          0,
          0,
        );
        axisGroup.add(plane);
        gatePlanes.push(plane);
        gateMaterials.push(material);

        const label = createInstrumentLabel(ETCH_GATES[gate].id.toUpperCase(), ETCH_GATES[gate].label, {
          accent: pending ? "#9fb2bf" : "#79d8c9",
          background: "rgba(8, 24, 30, 0.82)",
          foreground: "rgba(242, 250, 251, 0.98)",
          muted: "rgba(163, 192, 197, 0.94)",
        });
        track(label.texture);
        track(label.material);
        const labelMesh = new Mesh(gateLabelGeometry, label.material);
        labelMesh.name = `etch-gate-${ETCH_GATES[gate].id}`;
        labelMesh.position.set(plane.position.x, ETCH_STAGE.gateHeight * 0.58, 0.07);
        labelMesh.renderOrder = 4;
        axisGroup.add(labelMesh);
        gateLabels.push(labelMesh);
        gateLabelMaterials.push(label.material);
      }

      // Evidence-backed result: an actual FIFO die, not a generic crystal.
      // The cell bank and buses make the generated RTL tangible while the
      // final open gate still communicates that physical signoff is pending.
      resultAssembly = new Group();
      resultAssembly.name = "etch-verified-fifo-die";
      resultMaterial = track(new MeshPhysicalMaterial({
        color: 0x0d2631,
        emissive: 0x071b23,
        emissiveIntensity: 0.38,
        roughness: 0.2,
        metalness: 0.58,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
        transparent: true,
        opacity: 0,
        depthWrite: true,
        side: DoubleSide,
      }));
      const resultBodyGeometry = track(new BoxGeometry(0.72, 0.54, 0.03));
      resultMesh = new Mesh(
        resultBodyGeometry,
        resultMaterial,
      );
      latticeMaterial = track(new LineBasicMaterial({
        color: ETCH_COLORS.result,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }));
      resultLattice = new LineSegments(
        track(new EdgesGeometry(resultBodyGeometry, 32)),
        latticeMaterial,
      );
      const resultX = layoutMode === "mobile"
        ? 0.5
        : gateStationX(ETCH_COUNTS.gates - 1, axisX0, ETCH_STAGE.gateSpacing) - 0.9;
      resultAssembly.position.set(resultX, 0, 0);
      resultAssembly.add(resultMesh, resultLattice);

      const identityTexture = await new TextureLoader().loadAsync("/projects/etch/logo.svg");
      if (context.signal.aborted || disposed) {
        identityTexture.dispose();
        return;
      }
      identityTexture.colorSpace = SRGBColorSpace;
      identityTexture.anisotropy = context.qualityTier === "high" ? 8 : 4;
      track(identityTexture);
      resultIdentityMaterial = track(new ShaderMaterial({
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
            vec3 source = texture2D(uIdentity, vUv).rgb;
            float alpha = smoothstep(0.2, 0.72, dot(source, vec3(0.2126, 0.7152, 0.0722))) * uOpacity;
            if (alpha < 0.01) discard;
            gl_FragColor = vec4(mix(vec3(0.72, 0.82, 0.86), vec3(1.0), source.r), alpha);
          }
        `,
      }));
      const identityDecal = new Mesh(
        track(new PlaneGeometry(0.15, 0.15)),
        resultIdentityMaterial,
      );
      identityDecal.name = "etch-nib-surface-engraving";
      identityDecal.position.set(-0.26, 0, 0.096);
      resultAssembly.add(identityDecal);

      const cellGeometry = track(createRoundedPanelGeometry(0.095, 0.066, 0.027, 0.012, 0.003));
      dieCellMaterial = track(new MeshPhysicalMaterial({
        color: ETCH_COLORS.result,
        emissive: ETCH_COLORS.result,
        emissiveIntensity: 0.52,
        roughness: 0.22,
        metalness: 0.34,
        clearcoat: 1,
        transparent: true,
        opacity: 0,
        depthWrite: true,
      }));
      dieCells = new InstancedMesh(cellGeometry, dieCellMaterial, 12);
      dieCells.instanceMatrix.setUsage(DynamicDrawUsage);
      for (let cell = 0; cell < 12; cell += 1) {
        _dieMatrix.makeTranslation(
          -0.115 + (cell % 4) * 0.125,
          0.15 - Math.floor(cell / 4) * 0.15,
          0.094,
        );
        dieCells.setMatrixAt(cell, _dieMatrix);
      }
      resultAssembly.add(dieCells);
      const busGeometry = track(new BoxGeometry(0.64, 0.012, 0.014));
      for (let bus = 0; bus < 2; bus += 1) {
        const material = track(new MeshBasicMaterial({
          color: ETCH_COLORS.constraint,
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
        }));
        const mesh = new Mesh(busGeometry, material);
        mesh.position.set(0, bus === 0 ? 0.245 : -0.245, 0.092);
        resultAssembly.add(mesh);
        dieDetails.push(mesh);
        dieDetailMaterials.push(material);
      }
      diePinMaterial = track(new MeshPhysicalMaterial({
        color: ETCH_COLORS.constraint,
        emissive: 0x516c76,
        emissiveIntensity: 0.22,
        roughness: 0.16,
        metalness: 0.74,
        clearcoat: 0.8,
        transparent: true,
        opacity: 0,
        depthWrite: true,
      }));
      diePins = new InstancedMesh(
        track(createRoundedPanelGeometry(0.11, 0.028, 0.028, 0.008, 0.002)),
        diePinMaterial,
        24,
      );
      for (let pin = 0; pin < 24; pin += 1) {
        if (pin < 16) {
          const side = pin < 8 ? -1 : 1;
          const rank = pin % 8;
          _dieMatrix.makeTranslation(side * 0.43, -0.235 + rank * 0.067, 0);
        } else {
          const top = pin < 20 ? 1 : -1;
          const rank = pin % 4;
          _dieMatrix.makeRotationZ(Math.PI * 0.5);
          _dieMatrix.setPosition(-0.205 + rank * 0.137, top * 0.34, 0);
        }
        diePins.setMatrixAt(pin, _dieMatrix);
      }
      resultAssembly.add(diePins);

      // Fine copper routing and via field. These instanced details keep the
      // result legible as a designed FIFO die, not a flat glowing rectangle.
      dieTraceMaterial = track(new MeshBasicMaterial({
        color: ETCH_COLORS.constraint,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }));
      dieTraces = new InstancedMesh(
        track(new BoxGeometry(0.09, 0.008, 0.008)),
        dieTraceMaterial,
        18,
      );
      for (let trace = 0; trace < 18; trace += 1) {
        const vertical = trace >= 10;
        if (vertical) _dieMatrix.makeRotationZ(Math.PI * 0.5);
        else _dieMatrix.identity();
        _dieMatrix.setPosition(
          vertical ? -0.17 + (trace - 10) * 0.055 : -0.2 + (trace % 5) * 0.1,
          vertical ? 0.015 : -0.19 + Math.floor(trace / 5) * 0.125,
          0.09,
        );
        dieTraces.setMatrixAt(trace, _dieMatrix);
      }
      resultAssembly.add(dieTraces);

      dieViaMaterial = track(new MeshPhysicalMaterial({
        color: 0xd8f8ff,
        emissive: ETCH_COLORS.result,
        emissiveIntensity: 0.5,
        roughness: 0.16,
        metalness: 0.62,
        transparent: true,
        opacity: 0,
      }));
      dieVias = new InstancedMesh(
        track(new IcosahedronGeometry(0.012, 1)),
        dieViaMaterial,
        12,
      );
      for (let via = 0; via < 12; via += 1) {
        _dieMatrix.makeTranslation(
          -0.19 + (via % 4) * 0.13,
          0.17 - Math.floor(via / 4) * 0.17,
          0.102,
        );
        dieVias.setMatrixAt(via, _dieMatrix);
      }
      resultAssembly.add(dieVias);
      dieScrewMaterial = track(new MeshPhysicalMaterial({
        color: 0xc7d5db,
        emissive: 0x293a40,
        emissiveIntensity: 0.16,
        roughness: 0.2,
        metalness: 0.86,
        clearcoat: 0.7,
        transparent: true,
        opacity: 0,
        depthWrite: true,
      }));
      dieScrews = new InstancedMesh(
        track(new IcosahedronGeometry(0.018, 1)),
        dieScrewMaterial,
        4,
      );
      for (let screw = 0; screw < 4; screw += 1) {
        _dieMatrix.makeTranslation(
          screw % 2 === 0 ? -0.325 : 0.325,
          screw < 2 ? 0.245 : -0.245,
          0.098,
        );
        dieScrews.setMatrixAt(screw, _dieMatrix);
      }
      resultAssembly.add(dieScrews);
      axisGroup.add(resultAssembly);

      // The durable product is the proof dossier, not an implied fabricated
      // chip. Layered sheets frame the verified die and stay visibly open.
      dossierAssembly = new Group();
      dossierAssembly.name = "etch-proof-dossier";
      dossierAssembly.position.set(resultX + 0.09, 0.16, 0.08);
      dossierMaterial = track(new MeshPhysicalMaterial({
        color: ETCH_COLORS.dossier,
        emissive: 0x183d48,
        emissiveIntensity: 0.16,
        roughness: 0.34,
        metalness: 0.08,
        clearcoat: 0.8,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: DoubleSide,
      }));
      dossierSheets = new InstancedMesh(
        track(createRoundedPanelGeometry(0.94, 0.68, 0.012, 0.035, 0.006)),
        dossierMaterial,
        3,
      );
      dossierSheets.instanceMatrix.setUsage(DynamicDrawUsage);
      for (let sheet = 0; sheet < 3; sheet += 1) {
        _dieMatrix.makeRotationZ((sheet - 1) * 0.025);
        _dieMatrix.setPosition((sheet - 1) * 0.025, (sheet - 1) * 0.025, -sheet * 0.018);
        dossierSheets.setMatrixAt(sheet, _dieMatrix);
      }
      dossierAssembly.add(dossierSheets);

      dossierRowMaterial = track(new MeshBasicMaterial({
        color: 0xb7dce4,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }));
      dossierRows = new InstancedMesh(
        track(new BoxGeometry(1, 1, 0.008)),
        dossierRowMaterial,
        8,
      );
      dossierRows.instanceMatrix.setUsage(DynamicDrawUsage);
      for (let row = 0; row < 4; row += 1) {
        const y = -0.05 - row * 0.075;
        _dieMatrix.makeScale(0.54, 0.012, 1);
        _dieMatrix.setPosition(-0.06, y, 0.078);
        dossierRows.setMatrixAt(row * 2, _dieMatrix);
        _dieMatrix.makeScale(0.16 + row * 0.035, 0.012, 1);
        _dieMatrix.setPosition(0.26, y, 0.079);
        dossierRows.setMatrixAt(row * 2 + 1, _dieMatrix);
      }
      dossierAssembly.add(dossierRows);

      dossierStatusMaterial = track(new MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }));
      dossierStatuses = new InstancedMesh(
        track(new IcosahedronGeometry(0.018, 1)),
        dossierStatusMaterial,
        4,
      );
      dossierStatuses.instanceMatrix.setUsage(DynamicDrawUsage);
      for (let status = 0; status < 4; status += 1) {
        _dieMatrix.makeTranslation(-0.39, -0.05 - status * 0.075, 0.09);
        dossierStatuses.setMatrixAt(status, _dieMatrix);
        dossierStatuses.setColorAt(status, new Color(status === 3 ? ETCH_COLORS.pending : ETCH_COLORS.pass));
      }
      dossierAssembly.add(dossierStatuses);

      const dossierLabelGeometry = track(new PlaneGeometry(0.62, 0.135));
      const dossierLabelData = [
        ["PROOF DOSSIER", "Markdown + JSON"],
        ["WINNER · A", "486 cells · BMC depth 32"],
      ] as const;
      for (let labelIndex = 0; labelIndex < dossierLabelData.length; labelIndex += 1) {
        const [heading, detail] = dossierLabelData[labelIndex];
        const instrument = createInstrumentLabel(heading, detail, {
          accent: labelIndex === 0 ? "#79d8c9" : "#7fd0e8",
          background: "rgba(5, 22, 29, 0.92)",
          foreground: "rgba(242, 250, 251, 0.98)",
          muted: "rgba(174, 205, 211, 0.94)",
        });
        track(instrument.texture);
        track(instrument.material);
        const label = new Mesh(dossierLabelGeometry, instrument.material);
        label.position.set(0.06, labelIndex === 0 ? 0.245 : 0.09, 0.082);
        label.renderOrder = 6;
        dossierAssembly.add(label);
        dossierLabels.push(label);
        dossierLabelMaterials.push(instrument.material);
      }
      axisGroup.add(dossierAssembly);

      const lightingRig = new Group();
      const ambient = new HemisphereLight(0xc7edff, 0x071017, 1.35);
      const key = new DirectionalLight(0xe7f8ff, 3.2);
      key.position.set(-1.4, 1.8, 2.2);
      const rim = new PointLight(0x79dff2, 5.2, 4.5, 1.6);
      rim.position.set(1.3, -0.45, 1.4);
      lightingRig.add(ambient, key, rim);
      axisGroup.add(lightingRig);

      // Soft linked paths relaxing toward FlowE.
      for (let path = 0; path < ETCH_COUNTS.relaxPaths; path += 1) {
        const material = track(new MeshBasicMaterial({
          color: ETCH_COLORS.relax,
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: true,
        }));
        const mesh = new Mesh(track(new BoxGeometry(1, 0.006, 0.006)), material);
        relaxCurves.push(mesh);
        relaxMaterials.push(material);
      }

      for (let probe = 0; probe < ETCH_COUNTS.probePool; probe += 1) {
        perturbations.push({
          active: false,
          candidateIndex: -1,
          bornAt: 0,
          offset: new Vector3(),
        });
      }

      loaded = true;
    },

    attach(stageRoot) {
      if (!loaded || stage || !axisGroup) return;
      stage = stageRoot;
      stage.add(axisGroup);
    },

    seek(frame) {
      if (!loaded || disposed || !axisGroup) return;
      fade = frame.fade;
      layoutMode = frame.layout;
      const t = clamp01(frame.chapterProgress);
      const previousT = lastT;
      lastT = t;
      const axis = layoutMode === "mobile" ? ETCH_STAGE.axisMobile : ETCH_STAGE.axisDesktop;
      axisX0 = axis.x0;
      root.set(0, axisY(), 0);

      const loop = ETCH_LOOP;
      const intentT = smoothstep01((t - loop.intentStart) / (loop.intentFull - loop.intentStart));
      const constraintsT = smoothstep01((t - loop.constraintsStart) / (loop.constraintsFull - loop.constraintsStart));
      const candidatesT = smoothstep01((t - loop.candidatesStart) / (loop.candidatesFull - loop.candidatesStart));
      const gatesT = smoothstep01((t - loop.gatesStart) / (loop.gatesFull - loop.gatesStart));
      const simulationEvidence = smoothstep01((t - loop.simulationStart) / 0.11);
      const rankingT = smoothstep01((t - loop.rankingStart) / 0.13);
      const physicalT = smoothstep01((t - loop.physicalStart) / 0.12);
      const relaxT = smoothstep01((t - loop.relaxStart) / (loop.relaxFull - loop.relaxStart));
      const stateFeather = 0.032;
      const intentScene = scenePresence(t, 0, 0.12, stateFeather);
      const specScene = scenePresence(t, 0.12, 0.24, stateFeather);
      const candidateScene = scenePresence(t, 0.24, 0.36, stateFeather);
      const simulationScene = scenePresence(t, 0.36, 0.48, stateFeather);
      const formalScene = scenePresence(t, 0.48, 0.6, stateFeather);
      const rankScene = scenePresence(t, 0.6, 0.72, stateFeather);
      const physicalScene = scenePresence(t, 0.72, 0.84, stateFeather);
      const dossierScene = scenePresence(t, 0.84, 1, stateFeather);
      const candidateStory = Math.max(candidateScene, simulationScene, formalScene, rankScene);
      const resultReveal = Math.max(physicalScene, dossierScene);

      // Inspection travel: the ladder pans laterally and settles slightly
      // downward as scroll scrubs the gates (pure function of progress).
      axisGroup.position.set(
        root.x - gatesT * 0.22 + relaxT * 0.12,
        root.y + physicalScene * 0.06 + dossierScene * 0.08,
        0,
      );
      axisGroup.scale.setScalar(layoutMode === "mobile" ? 0.86 : 1.02);

      // Intent volume: churns until constraints crystallize the boundary.
      if (intentMesh && intentMaterial) {
        const instability = 1 - constraintsT;
        intentMaterial.uniforms.uTime.value = frame.time;
        intentMaterial.uniforms.uInstability.value = instability;
        intentMaterial.uniforms.uIntensity.value = (0.25 + intentT * 0.55) * fade
          * Math.max(intentScene, specScene * 0.32);
        intentMesh.scale.setScalar(0.55 + intentT * 0.45 + instability * 0.06);
        intentMesh.rotation.y = t * 0.9;
        intentMesh.position.x = axisX0 + candidatesT * 0.18;
      }

      // Constraint planes converge onto the boundary, then hand off.
      for (let plane = 0; plane < frameLines.length; plane += 1) {
        const stagger = plane * 0.06;
        const arrive = smoothstep01((constraintsT - stagger) / Math.max(1 - stagger, 1e-6));
        const offset = (1 - arrive) * (plane % 2 === 0 ? 0.5 : -0.5);
        const planeDepth = (plane - (ETCH_COUNTS.constraintPlanes - 1) * 0.5) * 0.13;
        frameLines[plane].position.set(axisX0 + candidatesT * 0.18, offset, planeDepth);
        frameFills[plane].position.copy(frameLines[plane].position);
        const compression = 1 - arrive * 0.16;
        frameLines[plane].scale.setScalar(compression);
        frameFills[plane].scale.setScalar(compression);
        const handoff = Math.max(specScene, candidateScene * 0.32);
        frameLines[plane].visible = handoff > 0.001;
        frameFills[plane].visible = handoff > 0.001;
        frameMaterials[plane].opacity = arrive * 0.72 * fade * handoff;
        fillMaterials[plane].opacity = arrive * 0.065 * fade * handoff;
      }

      // Candidates form along the ladder, then travel it through the gates.
      for (let candidate = 0; candidate < candidateMeshes.length; candidate += 1) {
        const mesh = candidateMeshes[candidate];
        const material = candidateMaterials[candidate];
        const formDelay = candidate * 0.08;
        const form = smoothstep01((candidatesT - formDelay) / Math.max(1 - formDelay, 1e-6));
        const candidatePresence = candidate === 1
          ? Math.max(candidateScene, simulationScene, formalScene * 0.28)
          : candidateStory;
        mesh.visible = form > 0.001 && candidatePresence > 0.001;
        const travel = smoothstep01((gatesT - candidate * 0.1) / Math.max(1 - candidate * 0.1, 1e-6));
        const stopX = gateStationX(ETCH_COUNTS.gates - 1, axisX0, ETCH_STAGE.gateSpacing) - 0.42;
        // Candidates form at the crystallized boundary, take their station,
        // then travel the ladder to their clearance point.
        const stationX = candidateBase[candidate].x;
        const x = axisX0 + (stationX - axisX0) * form + (stopX - stationX) * travel;
        mesh.position.set(x, candidateBase[candidate].y, candidateBase[candidate].z);
        if (formalScene > 0) {
          const formalX = layoutMode === "mobile"
            ? axisX0 + 0.62 + candidate * 0.24
            : axisX0 + 1.0 + candidate * 0.38;
          const formalY = 0.23 - candidate * 0.23;
          mesh.position.x += (formalX - mesh.position.x) * formalScene;
          mesh.position.y += (formalY - mesh.position.y) * formalScene;
        }
        if (rankScene > 0) {
          const rankX = layoutMode === "mobile"
            ? candidate === 0 ? axisX0 + 0.68 : axisX0 + 1.02
            : candidate === 0 ? axisX0 + 1.25 : axisX0 + 1.7;
          const rankY = candidate === 0 ? 0.1 : -0.22;
          mesh.position.x += (rankX - mesh.position.x) * rankScene;
          mesh.position.y += (rankY - mesh.position.y) * rankScene;
          mesh.position.z += (0.1 - mesh.position.z) * rankScene;
        }
        mesh.rotation.y = frame.time * 0.08 + candidate * 0.18;
        mesh.rotation.z = t * 0.16;
        const evidenceFacing = Math.max(formalScene, rankScene);
        if (evidenceFacing > 0) {
          mesh.rotation.y += (0.12 - mesh.rotation.y) * evidenceFacing;
          mesh.rotation.z *= 1 - evidenceFacing;
        }
        const falsified = candidate === 1 && simulationEvidence > 0.12;
        const winner = candidate === 0;
        const runnerUp = candidate === 2;
        if (falsified) mesh.position.y -= 0.08 * simulationEvidence;
        const verdictStrength = falsified ? 0.48 : runnerUp ? 0.72 : 1;
        material.opacity = form * 0.9 * fade * verdictStrength * candidatePresence;
        candidateCellMaterials[candidate].opacity = material.opacity * 0.78;
        const rankScale = winner ? 1.68 : 0.98;
        const baseScale = falsified ? 0.82 : winner ? 1 + rankingT * 0.12 : 0.94;
        mesh.scale.setScalar(form * (baseScale + (rankScale - baseScale) * rankScene));
        _color.setHex(ETCH_COLORS.candidate);
        if (falsified) _color.setHex(ETCH_COLORS.fail);
        else if (runnerUp) _color.setHex(ETCH_COLORS.runnerUp);
        else if (rankingT > 0.1) _color.setHex(ETCH_COLORS.result);
        material.color.copy(_color);
        candidateCellMaterials[candidate].color.copy(_color).offsetHSL(0, -0.08, 0.18);

        const label = candidateLabels[candidate];
        const labelMaterial = candidateLabelMaterials[candidate];
        const verdictScene = candidate === 1
          ? Math.max(simulationScene, formalScene * 0.28)
          : Math.max(formalScene, rankScene);
        label.visible = verdictScene > 0.01;
        label.position.set(
          mesh.position.x + (candidate === 1 ? 0.02 : 0),
          mesh.position.y + 0.155 + rankScene * 0.07,
          mesh.position.z + 0.12,
        );
        label.scale.setScalar(layoutMode === "mobile" ? 0.64 : 0.94 + rankScene * 0.1);
        labelMaterial.opacity = verdictScene * fade * 0.94;

        // Probe perturbation: constraint planes reveal the violation bounds.
        const perturb = perturbations.find((p) => p.active && p.candidateIndex === candidate);
        if (perturb) {
          mesh.position.add(perturb.offset);
        }
      }

      if (counterexampleTrace && counterexampleMaterial && candidateMeshes[1]) {
        const failedCandidate = candidateMeshes[1];
        const counterexampleScene = Math.max(simulationScene, formalScene * 0.25);
        counterexampleTrace.visible = counterexampleScene > 0.01;
        counterexampleTrace.position.set(
          failedCandidate.position.x,
          failedCandidate.position.y - 0.17,
          failedCandidate.position.z + 0.13,
        );
        counterexampleMaterial.opacity = counterexampleScene * fade * 0.92;
      }

      // Gates light as the lead candidate crosses; signoff stays pending.
      const leadTravel = smoothstep01((gatesT - 0.2) / 0.8);
      const gateScenes = [simulationScene, formalScene, rankScene, physicalScene] as const;
      for (let gate = 0; gate < gatePlanes.length; gate += 1) {
        const passed = ETCH_GATES[gate].passed;
        const stationT = (gate + 1) / (ETCH_COUNTS.gates + 1);
        const crossed = passed && leadTravel >= stationT;
        if (crossed && !gateLit[gate]) {
          gateLit[gate] = true;
          if (eventBuffer.length < 4) eventBuffer.push("gate-pass");
        }
        if (!crossed) gateLit[gate] = false;
        const pendingPulse = !passed
          ? 0.16 + Math.sin(frame.time * 1.4) * 0.05
          : 0;
        const gateScene = gateScenes[gate] ?? 0;
        gatePlanes[gate].visible = gateScene > 0.001;
        gateLabels[gate].visible = gateScene > 0.001;
        gateMaterials[gate].opacity = (
          crossed ? 0.5 : passed ? 0.1 + leadTravel * 0.06 : pendingPulse
        ) * fade * gateScene;
        gatePlanes[gate].scale.y = crossed ? 1.04 : 1;
        const gateReveal = smoothstep01((gatesT - gate * 0.08) / Math.max(1 - gate * 0.08, 1e-6));
        gateLabelMaterials[gate].opacity = gateReveal * gateScene
          * (passed ? 0.9 : 0.72 + pendingPulse) * fade;
        gateLabels[gate].scale.setScalar(layoutMode === "mobile" ? 0.76 : 1.02);
      }

      // Result: evidence-backed FIFO die held before the pending gate.
      if (resultMesh && resultMaterial && resultLattice && latticeMaterial) {
        const reveal = resultReveal;
        if (resultAssembly) resultAssembly.visible = reveal > 0.001;
        resultMaterial.opacity = reveal * 0.72 * fade;
        latticeMaterial.opacity = reveal * 0.9 * fade;
        if (dieCellMaterial) {
          dieCellMaterial.opacity = reveal * 0.96 * fade;
        }
        if (resultIdentityMaterial) {
          resultIdentityMaterial.uniforms.uOpacity.value = reveal * 0.82 * fade;
        }
        if (diePinMaterial) {
          diePinMaterial.opacity = reveal * 0.7 * fade;
        }
        if (dieScrewMaterial) {
          dieScrewMaterial.opacity = reveal * 0.9 * fade;
        }
        if (dieTraceMaterial) {
          dieTraceMaterial.opacity = reveal * 0.74 * fade;
        }
        if (dieViaMaterial) {
          dieViaMaterial.opacity = reveal * 0.96 * fade;
        }
        for (let detail = 0; detail < dieDetailMaterials.length; detail += 1) {
          const stagger = (detail % 4) * 0.07;
          const detailReveal = smoothstep01((reveal - stagger) / Math.max(1 - stagger, 1e-6));
          dieDetailMaterials[detail].opacity = detailReveal * 0.96 * fade;
        }
        if (resultAssembly) {
          const resultX = layoutMode === "mobile"
            ? 0.5
            : gateStationX(ETCH_COUNTS.gates - 1, axisX0, ETCH_STAGE.gateSpacing) - 0.9;
          resultAssembly.position.set(resultX - dossierScene * 0.46, dossierScene * 0.1, 0);
          resultAssembly.rotation.y = (frame.reducedMotion ? 0.18 : Math.sin(frame.time * 0.28) * 0.22) + 0.18;
          resultAssembly.rotation.x = -0.22;
          const resultScale = layoutMode === "mobile"
            ? 0.3 + reveal * 0.62
            : (0.42 + reveal * 0.66) * (1 - dossierScene * 0.4);
          resultAssembly.scale.setScalar(resultScale);
        }
      }


      if (dossierAssembly && dossierMaterial) {
        dossierAssembly.visible = dossierScene > 0.001;
        const resultX = layoutMode === "mobile"
          ? 0.5
          : gateStationX(ETCH_COUNTS.gates - 1, axisX0, ETCH_STAGE.gateSpacing) - 0.9;
        dossierAssembly.position.set(
          resultX + (layoutMode === "mobile" ? 0.14 : 0.09),
          0.16,
          0.08,
        );
        dossierMaterial.opacity = dossierScene * 0.86 * fade;
        if (dossierRowMaterial) dossierRowMaterial.opacity = dossierScene * 0.42 * fade;
        if (dossierStatusMaterial) dossierStatusMaterial.opacity = dossierScene * 0.95 * fade;
        dossierAssembly.rotation.x = -0.08;
        dossierAssembly.rotation.y = 0.08;
        dossierAssembly.scale.setScalar(
          layoutMode === "mobile" ? 0.78 + dossierScene * 0.12 : 0.88 + dossierScene * 0.18,
        );
        if (dossierSheets) {
          for (let sheet = 0; sheet < 3; sheet += 1) {
            const sheetReveal = smoothstep01((dossierScene - sheet * 0.08) / Math.max(1 - sheet * 0.08, 1e-6));
            _dieMatrix.makeRotationZ((sheet - 1) * 0.035 * sheetReveal);
            _dieMatrix.setPosition(
              (sheet - 1) * 0.03 * sheetReveal,
              (sheet - 1) * 0.025 - (1 - sheetReveal) * 0.12,
              -sheet * 0.018,
            );
            dossierSheets.setMatrixAt(sheet, _dieMatrix);
          }
          dossierSheets.instanceMatrix.needsUpdate = true;
        }
        if (dossierRows) {
          for (let row = 0; row < 4; row += 1) {
            const rowReveal = smoothstep01((dossierScene - 0.18 - row * 0.08) / 0.58);
            const y = -0.05 - row * 0.075;
            _dieMatrix.makeScale(Math.max(0.54 * rowReveal, 1e-4), 0.012, 1);
            _dieMatrix.setPosition(-0.33 + 0.27 * rowReveal, y, 0.078);
            dossierRows.setMatrixAt(row * 2, _dieMatrix);
            _dieMatrix.makeScale(Math.max((0.16 + row * 0.035) * rowReveal, 1e-4), 0.012, 1);
            _dieMatrix.setPosition(0.17 + (0.09 + row * 0.0175) * rowReveal, y, 0.079);
            dossierRows.setMatrixAt(row * 2 + 1, _dieMatrix);
          }
          dossierRows.instanceMatrix.needsUpdate = true;
        }
        if (dossierStatuses) {
          for (let status = 0; status < 4; status += 1) {
            const statusReveal = smoothstep01((dossierScene - 0.24 - status * 0.07) / 0.48);
            _dieMatrix.makeScale(statusReveal, statusReveal, statusReveal);
            _dieMatrix.setPosition(-0.39, -0.05 - status * 0.075, 0.09);
            dossierStatuses.setMatrixAt(status, _dieMatrix);
          }
          dossierStatuses.instanceMatrix.needsUpdate = true;
        }
        for (let label = 0; label < dossierLabelMaterials.length; label += 1) {
          const staggered = smoothstep01((dossierScene - label * 0.12) / Math.max(1 - label * 0.12, 1e-6));
          dossierLabelMaterials[label].opacity = staggered * fade;
        }
      }

      // The last station remains an unresolved boundary. Physical proxies can
      // exist, but missing OpenROAD, DRC and LVS cannot become a pass state.
      if (gateMaterials[3]) {
        gateMaterials[3].opacity *= 0.7 + physicalT * 0.3;
      }

      // Relax: rigid proof geometry softens into linked paths toward FlowE.
      for (let path = 0; path < relaxCurves.length; path += 1) {
        const stagger = path * 0.05;
        const grow = smoothstep01((relaxT - stagger) / Math.max(1 - stagger, 1e-6));
        const length = ETCH_STAGE.relaxLength * grow;
        const sourceX = gateStationX(ETCH_COUNTS.gates - 1, axisX0, ETCH_STAGE.gateSpacing) - 0.3;
        const drift = (path - 2) * 0.09;
        relaxCurves[path].scale.set(Math.max(length, 1e-4), 1, 1);
        relaxCurves[path].position.set(
          sourceX + length * 0.5 * 0.86,
          drift - length * 0.5 * 0.5,
          0,
        );
        relaxCurves[path].rotation.z = Math.atan2(-0.5 - drift * 0.2, 0.86);
        relaxMaterials[path].opacity = grow * 0.55 * fade;
      }

      void previousT;
    },

    probe(event) {
      if (!loaded || disposed || fade < 0.35 || !axisGroup) return;
      if (event.kind !== "down") return;
      const perturb = perturbations.find((candidate) => !candidate.active);
      if (!perturb) return;
      // Perturb the nearest candidate; constraint planes reveal the bounds.
      let nearest = -1;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (let candidate = 0; candidate < candidateMeshes.length; candidate += 1) {
        const world = candidateMeshes[candidate].position;
        const distance = Math.hypot(world.x + axisGroup.position.x - event.x, world.y + axisGroup.position.y - event.y);
        if (distance < nearestDistance) {
          nearest = candidate;
          nearestDistance = distance;
        }
      }
      if (nearest < 0 || nearestDistance > 0.9) return;
      perturb.active = true;
      perturb.candidateIndex = nearest;
      perturb.bornAt = event.time;
      perturb.offset.set(
        Math.max(-0.16, Math.min(0.16, (event.x - (candidateMeshes[nearest].position.x + axisGroup.position.x)) * 0.35)),
        Math.max(-0.16, Math.min(0.16, (event.y - (candidateMeshes[nearest].position.y + axisGroup.position.y)) * 0.35)),
        0,
      );
      if (eventBuffer.length < 4) eventBuffer.push("probe-pulse");
    },

    update(frame) {
      const drained = eventBuffer.slice();
      eventBuffer.length = 0;
      const empty: EncounterFrameResult = { drawCalls: 0, audioEvents: drained };
      if (!loaded || disposed) return empty;

      // Critically damped return from probe perturbation; constraint planes
      // flash the violation bounds while any perturbation is held.
      let anyPerturbed = false;
      for (const perturb of perturbations) {
        if (!perturb.active) continue;
        anyPerturbed = true;
        const age = frame.time - perturb.bornAt;
        const decay = Math.exp(-age * 3.2);
        perturb.offset.multiplyScalar(decay);
        if (age > 1.4 || perturb.offset.length() < 0.004) {
          perturb.active = false;
          perturb.offset.set(0, 0, 0);
          perturb.candidateIndex = -1;
        }
      }
      const flash = anyPerturbed ? 0.35 : 0;
      for (const material of frameMaterials) {
        material.opacity = Math.min(1, material.opacity + flash * fade);
      }
      return {
        drawCalls: 0,
        audioEvents: drained.concat(eventBuffer),
      };
    },

    detach() {
      if (!stage || !axisGroup) return;
      if (axisGroup.parent === stage) stage.remove(axisGroup);
      stage = null;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      if (stage && axisGroup && axisGroup.parent === stage) stage.remove(axisGroup);
      stage = null;
      for (const resource of disposables) resource.dispose();
      disposables.length = 0;
      frameLines.length = 0;
      frameFills.length = 0;
      frameMaterials.length = 0;
      fillMaterials.length = 0;
      candidateMeshes.length = 0;
      candidateMaterials.length = 0;
      candidateCellMaterials.length = 0;
      candidateBase.length = 0;
      candidateLabels.length = 0;
      candidateLabelMaterials.length = 0;
      gatePlanes.length = 0;
      gateMaterials.length = 0;
      gateLabels.length = 0;
      gateLabelMaterials.length = 0;
      relaxCurves.length = 0;
      relaxMaterials.length = 0;
      perturbations.length = 0;
      dieDetails.length = 0;
      dieDetailMaterials.length = 0;
      dossierLabels.length = 0;
      dossierLabelMaterials.length = 0;
      loaded = false;
    },
  };
}

export default createEtchEncounter;
