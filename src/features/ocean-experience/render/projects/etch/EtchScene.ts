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
  BoxGeometry,
  Color,
  DynamicDrawUsage,
  EdgesGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
  Group,
} from "three";
import type {
  EncounterAudioEvent,
  EncounterFrameResult,
  EncounterLoadContext,
  ProjectEncounter,
} from "../../encounter-contract.ts";
import {
  ETCH_COLORS,
  ETCH_COUNTS,
  ETCH_GATES,
  ETCH_LOOP,
  ETCH_STAGE,
  candidateClearance,
  gateStationX,
} from "./etchConfig.ts";

function smoothstep01(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
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
  const candidateMaterials: MeshBasicMaterial[] = [];
  const candidateBase: Vector3[] = [];
  const gatePlanes: LineSegments[] = [];
  const gateMaterials: LineBasicMaterial[] = [];
  let resultMesh: Mesh | null = null;
  let resultLattice: LineSegments | null = null;
  let resultAssembly: Group | null = null;
  let resultMaterial: MeshBasicMaterial | null = null;
  let latticeMaterial: LineBasicMaterial | null = null;
  let dieCells: InstancedMesh | null = null;
  let dieCellMaterial: MeshBasicMaterial | null = null;
  let diePins: InstancedMesh | null = null;
  let diePinMaterial: MeshBasicMaterial | null = null;
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
        line.position.set(axisX0, 0, (plane - 1) * 0.16);
        fill.position.copy(line.position);
        axisGroup.add(line, fill);
        frameLines.push(line);
        frameFills.push(fill);
        frameMaterials.push(material);
        fillMaterials.push(fillMaterial);
      }

      // Candidate crystalline structures.
      const candidateGeometries = [
        track(new BoxGeometry(ETCH_STAGE.candidateSize * 1.35, ETCH_STAGE.candidateSize, 0.045)),
        track(new BoxGeometry(ETCH_STAGE.candidateSize * 1.15, ETCH_STAGE.candidateSize * 1.12, 0.045)),
        track(new BoxGeometry(ETCH_STAGE.candidateSize * 1.35, ETCH_STAGE.candidateSize, 0.045)),
      ];
      for (let candidate = 0; candidate < ETCH_COUNTS.candidates; candidate += 1) {
        const material = track(new MeshBasicMaterial({
          color: ETCH_COLORS.candidate,
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
          wireframe: true,
        }));
        const mesh = new Mesh(candidateGeometries[candidate], material);
        const stationX = axisX0 + 0.34 + candidate * 0.3;
        mesh.position.set(axisX0, 0, 0);
        axisGroup.add(mesh);
        candidateMeshes.push(mesh);
        candidateMaterials.push(material);
        candidateBase.push(new Vector3(stationX, 0, (candidate - 1) * 0.14));
      }

      // Verification gate light planes; the signoff gate stays an open frame.
      const gateGeometry = track(new EdgesGeometry(
        new BoxGeometry(0.08, ETCH_STAGE.gateHeight, 0.06),
      ));
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
      }

      // Evidence-backed result: an actual FIFO die, not a generic crystal.
      // The cell bank and buses make the generated RTL tangible while the
      // final open gate still communicates that physical signoff is pending.
      resultAssembly = new Group();
      resultAssembly.name = "etch-verified-fifo-die";
      resultMaterial = track(new MeshBasicMaterial({
        color: 0x123543,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }));
      resultMesh = new Mesh(
        track(new BoxGeometry(0.62, 0.48, 0.07)),
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
        track(new EdgesGeometry(new BoxGeometry(0.66, 0.52, 0.085))),
        latticeMaterial,
      );
      const resultX = layoutMode === "mobile"
        ? 0.5
        : gateStationX(ETCH_COUNTS.gates - 1, axisX0, ETCH_STAGE.gateSpacing) - 0.3;
      resultAssembly.position.set(resultX, 0, 0);
      resultAssembly.add(resultMesh, resultLattice);

      const cellGeometry = track(new BoxGeometry(0.08, 0.055, 0.018));
      dieCellMaterial = track(new MeshBasicMaterial({
        color: ETCH_COLORS.result,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }));
      dieCells = new InstancedMesh(cellGeometry, dieCellMaterial, 12);
      dieCells.instanceMatrix.setUsage(DynamicDrawUsage);
      for (let cell = 0; cell < 12; cell += 1) {
        _dieMatrix.makeTranslation(
          -0.18 + (cell % 4) * 0.12,
          0.13 - Math.floor(cell / 4) * 0.13,
          0.052,
        );
        dieCells.setMatrixAt(cell, _dieMatrix);
      }
      resultAssembly.add(dieCells);
      const busGeometry = track(new BoxGeometry(0.54, 0.012, 0.014));
      for (let bus = 0; bus < 2; bus += 1) {
        const material = track(new MeshBasicMaterial({
          color: ETCH_COLORS.constraint,
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
        }));
        const mesh = new Mesh(busGeometry, material);
        mesh.position.set(0, bus === 0 ? 0.205 : -0.205, 0.055);
        resultAssembly.add(mesh);
        dieDetails.push(mesh);
        dieDetailMaterials.push(material);
      }
      diePinMaterial = track(new MeshBasicMaterial({
        color: ETCH_COLORS.constraint,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }));
      diePins = new InstancedMesh(
        track(new BoxGeometry(0.095, 0.026, 0.026)),
        diePinMaterial,
        16,
      );
      for (let pin = 0; pin < 16; pin += 1) {
        const side = pin < 8 ? -1 : 1;
        const rank = pin % 8;
        _dieMatrix.makeTranslation(side * 0.37, -0.205 + rank * 0.0585, 0);
        diePins.setMatrixAt(pin, _dieMatrix);
      }
      resultAssembly.add(diePins);
      axisGroup.add(resultAssembly);

      // Soft linked paths relaxing toward FlowE.
      for (let path = 0; path < ETCH_COUNTS.relaxPaths; path += 1) {
        const material = track(new MeshBasicMaterial({
          color: ETCH_COLORS.relax,
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
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
      const relaxT = smoothstep01((t - loop.relaxStart) / (loop.relaxFull - loop.relaxStart));

      // Inspection travel: the ladder pans laterally and settles slightly
      // downward as scroll scrubs the gates (pure function of progress).
      axisGroup.position.set(
        root.x - gatesT * 0.42 + relaxT * 0.2,
        root.y - gatesT * 0.06,
        0,
      );

      // Intent volume: churns until constraints crystallize the boundary.
      if (intentMesh && intentMaterial) {
        const instability = 1 - constraintsT;
        intentMaterial.uniforms.uTime.value = frame.time;
        intentMaterial.uniforms.uInstability.value = instability;
        intentMaterial.uniforms.uIntensity.value = (0.25 + intentT * 0.55) * fade
          * (1 - candidatesT * 0.85);
        intentMesh.scale.setScalar(0.55 + intentT * 0.45 + instability * 0.06);
        intentMesh.rotation.y = t * 0.9;
        intentMesh.position.x = axisX0 + candidatesT * 0.18;
      }

      // Constraint planes converge onto the boundary, then hand off.
      for (let plane = 0; plane < frameLines.length; plane += 1) {
        const stagger = plane * 0.06;
        const arrive = smoothstep01((constraintsT - stagger) / Math.max(1 - stagger, 1e-6));
        const offset = (1 - arrive) * (plane % 2 === 0 ? 0.5 : -0.5);
        frameLines[plane].position.set(axisX0 + candidatesT * 0.18, offset, (plane - 1) * 0.16);
        frameFills[plane].position.copy(frameLines[plane].position);
        const compression = 1 - arrive * 0.16;
        frameLines[plane].scale.setScalar(compression);
        frameFills[plane].scale.setScalar(compression);
        const handoff = 1 - candidatesT * 0.9;
        frameMaterials[plane].opacity = arrive * 0.5 * fade * handoff;
        fillMaterials[plane].opacity = arrive * 0.08 * fade * handoff;
      }

      // Candidates form along the ladder, then travel it through the gates.
      for (let candidate = 0; candidate < candidateMeshes.length; candidate += 1) {
        const mesh = candidateMeshes[candidate];
        const material = candidateMaterials[candidate];
        const formDelay = candidate * 0.08;
        const form = smoothstep01((candidatesT - formDelay) / Math.max(1 - formDelay, 1e-6));
        const clearance = candidateClearance(candidate);
        const travel = smoothstep01((gatesT - candidate * 0.1) / Math.max(1 - candidate * 0.1, 1e-6));
        const stopX = clearance >= ETCH_COUNTS.gates - 1
          ? gateStationX(ETCH_COUNTS.gates - 1, axisX0, ETCH_STAGE.gateSpacing) - 0.3
          : gateStationX(clearance, axisX0, ETCH_STAGE.gateSpacing) - 0.16;
        // Candidates form at the crystallized boundary, take their station,
        // then travel the ladder to their clearance point.
        const stationX = candidateBase[candidate].x;
        const x = axisX0 + (stationX - axisX0) * form + (stopX - stationX) * travel;
        mesh.position.set(x, candidateBase[candidate].y, candidateBase[candidate].z);
        mesh.rotation.y = frame.time * 0.12 + candidate;
        mesh.rotation.z = t * 0.4;
        const failed = clearance < ETCH_COUNTS.gates - 1 && travel > 0.97;
        const held = failed ? 0.32 : 1;
        // Failed candidates stay visibly held at their gate — dimmed, sunk.
        if (failed) mesh.position.y = candidateBase[candidate].y - 0.09;
        material.opacity = form * 0.62 * fade * held * (1 - relaxT * 0.4);
        mesh.scale.setScalar(form * (failed ? 0.85 : 1));
        _color.setHex(ETCH_COLORS.candidate);
        if (failed) _color.setHex(ETCH_COLORS.pending);
        material.color.copy(_color);

        // Probe perturbation: constraint planes reveal the violation bounds.
        const perturb = perturbations.find((p) => p.active && p.candidateIndex === candidate);
        if (perturb) {
          mesh.position.add(perturb.offset);
        }
      }

      // Gates light as the lead candidate crosses; signoff stays pending.
      const leadTravel = smoothstep01((gatesT - 0.2) / 0.8);
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
        gateMaterials[gate].opacity = (
          crossed ? 0.5 : passed ? 0.1 + leadTravel * 0.06 : pendingPulse
        ) * fade * (1 - relaxT * 0.5);
        gatePlanes[gate].scale.y = crossed ? 1.04 : 1;
      }

      // Result: evidence-backed FIFO die held before the pending gate.
      if (resultMesh && resultMaterial && resultLattice && latticeMaterial) {
        const revealStart = layoutMode === "mobile" ? 0.38 : 0.62;
        const reveal = smoothstep01((gatesT - revealStart) / 0.3);
        resultMaterial.opacity = reveal * 0.42 * fade * (1 - relaxT * 0.25);
        latticeMaterial.opacity = reveal * 0.78 * fade * (1 - relaxT * 0.25);
        if (dieCellMaterial) {
          dieCellMaterial.opacity = reveal * 0.96 * fade * (1 - relaxT * 0.25);
        }
        if (diePinMaterial) {
          diePinMaterial.opacity = reveal * 0.7 * fade * (1 - relaxT * 0.25);
        }
        for (let detail = 0; detail < dieDetailMaterials.length; detail += 1) {
          const stagger = (detail % 4) * 0.07;
          const detailReveal = smoothstep01((reveal - stagger) / Math.max(1 - stagger, 1e-6));
          dieDetailMaterials[detail].opacity = detailReveal * 0.96 * fade * (1 - relaxT * 0.25);
        }
        if (resultAssembly) {
          resultAssembly.rotation.y = (frame.reducedMotion ? 0.18 : Math.sin(frame.time * 0.28) * 0.22) + 0.18;
          resultAssembly.rotation.x = -0.22;
          resultAssembly.scale.setScalar(0.36 + reveal * 1.3);
        }
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
      candidateBase.length = 0;
      gatePlanes.length = 0;
      gateMaterials.length = 0;
      relaxCurves.length = 0;
      relaxMaterials.length = 0;
      perturbations.length = 0;
      dieDetails.length = 0;
      dieDetailMaterials.length = 0;
      loaded = false;
    },
  };
}

export default createEtchEncounter;
