/**
 * Authored underwater camera rig
 * ------------------------------
 * Layers three continuous drives onto the framed rest pose from configureCamera:
 *   1. Intro progress (breach → live) — rise from slightly deeper / looking up
 *   2. World depth (scroll) — tip and dolly into the basin
 *   3. Pointer parallax — secondary ≤1.1° life on top
 *
 * Scene convention (see configureCamera): camera sits on +Y looking toward the
 * origin with up = (0, 0, −1). Screen-up is −Z; deeper water is +Z.
 */

import { Euler, Quaternion, Vector3, type PerspectiveCamera } from "three";

export type CameraRestPose = {
  position: Vector3;
  quaternion: Quaternion;
  fov: number;
};

export type CameraRigInput = {
  /** 0 at breach start → 1 when intro dolly settles. */
  introProgress: number;
  /** World depth 0..1 (surface → floor). */
  worldDepth: number;
  /** Smoothed pointer in −1..1 (screen NDC-ish). */
  pointerX: number;
  pointerY: number;
  /**
   * Optional device-orientation tilt in −1..1. Combined with pointer parallax
   * under a shared angular ceiling so mobile never exceeds ~2°.
   */
  tiltX?: number;
  tiltY?: number;
  /** Seconds since renderer start (breathing). */
  time: number;
  reducedMotion: boolean;
};

/** Authored path parameters — tune here, not in the 2k-line renderer. */
export const CAMERA_RIG = {
  baseFov: 42,
  introDurationFirst: 1.55,
  introDurationRepeat: 0.92,
  /** Extra distance along view (+Y) at intro start — starts farther / “deeper”. */
  introOffsetY: 0.82,
  /** Start deeper in the water column (+Z). */
  introOffsetZ: 0.36,
  /** Look slightly up toward the surface (−Z) at intro start, radians. */
  introPitch: (6.5 * Math.PI) / 180,
  introFovWiden: 3.2,
  /** World-depth influence saturates by mid-shallow descent. */
  depthInfluenceEnd: 0.42,
  /** Drift downward (+Z) as depth increases. */
  depthDropZ: 0.38,
  /** Gentle dolly toward the scene along +Y reduction. */
  depthPullY: 0.22,
  /** Pitch toward looking down into the basin, radians. */
  depthPitch: (3.4 * Math.PI) / 180,
  depthFovTighten: 2.0,
  /** Pointer parallax ceiling — secondary to the authored dolly. */
  parallaxTilt: (1.1 * Math.PI) / 180,
  /** Device-orientation contribution (phones) — kept ≤ ~1.6°. */
  deviceTilt: (1.6 * Math.PI) / 180,
  /** Combined pointer + device tilt hard ceiling. */
  maxCombinedTilt: (2.0 * Math.PI) / 180,
  parallaxLateral: 0.045,
  breatheAmp: 0.011,
  driftAmp: 0.006,
} as const;

const _euler = new Euler(0, 0, 0, "YXZ");
const _quat = new Quaternion();
const _pos = new Vector3();

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function clampMagnitude(value: number, limit: number) {
  return Math.max(-limit, Math.min(limit, value));
}

/** Smoothstep ease for continuous, reversible depth mapping. */
export function smoothstep01(value: number) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

/** Ease-out cubic — intro settles forward without overshoot drama. */
export function easeOutCubic(value: number) {
  const t = clamp01(value);
  return 1 - (1 - t) ** 3;
}

export function introDurationForVisit(shortened: boolean): number {
  return shortened ? CAMERA_RIG.introDurationRepeat : CAMERA_RIG.introDurationFirst;
}

/**
 * Map absolute time to eased intro progress. Returns 1 when entrance was
 * skipped (reduced motion / static / no glyphs).
 */
export function introProgressAt(
  nowSeconds: number,
  entranceStart: number,
  durationSeconds: number,
  reducedMotion: boolean,
) {
  if (reducedMotion || !Number.isFinite(entranceStart) || durationSeconds <= 0) return 1;
  return easeOutCubic((nowSeconds - entranceStart) / durationSeconds);
}

/**
 * Brief surface-caustic exposure pulse at breach. Peak then decay ~800ms.
 * Repeat visits get a subtler bump.
 */
export function breachExposureBoost(ageSeconds: number, shortened: boolean) {
  if (!Number.isFinite(ageSeconds) || ageSeconds < 0 || ageSeconds > 0.85) return 0;
  const peak = shortened ? 0.06 : 0.14;
  const rise = smoothstep01(ageSeconds / 0.08);
  const fall = 1 - smoothstep01((ageSeconds - 0.08) / 0.72);
  return peak * rise * Math.max(0, fall);
}

/**
 * Per-letter exit progress: optical dissolve still uses the shared exit, but
 * physical rise staggers ~28ms of curve per glyph index.
 */
export function staggeredGlyphExit(exit: number, glyphIndex: number) {
  const delay = glyphIndex * 0.028;
  return smoothstep01((exit - delay) / Math.max(0.55, 1 - delay));
}

/**
 * Apply the authored camera pose into `out` (and optionally write FOV onto
 * the live PerspectiveCamera). Does not mutate `rest`.
 */
export function applyCameraRig(
  rest: CameraRestPose,
  input: CameraRigInput,
  out: { position: Vector3; quaternion: Quaternion },
  camera?: PerspectiveCamera,
) {
  const introRemain = 1 - clamp01(input.introProgress);
  const depthT = input.reducedMotion
    ? 0
    : smoothstep01(input.worldDepth / CAMERA_RIG.depthInfluenceEnd);

  _pos.copy(rest.position);
  // Intro: start farther (+Y) and deeper (+Z), settle to rest.
  _pos.y += CAMERA_RIG.introOffsetY * introRemain - CAMERA_RIG.depthPullY * depthT;
  _pos.z += CAMERA_RIG.introOffsetZ * introRemain + CAMERA_RIG.depthDropZ * depthT;

  const breathe = input.reducedMotion
    ? 0
    : Math.sin(input.time * (Math.PI * 2 / 6)) * CAMERA_RIG.breatheAmp;
  const drift = input.reducedMotion
    ? 0
    : Math.sin(input.time * (Math.PI * 2 / 11)) * CAMERA_RIG.driftAmp;

  const tiltX = input.reducedMotion ? 0 : (input.tiltX ?? 0);
  const tiltY = input.reducedMotion ? 0 : (input.tiltY ?? 0);
  const pointerYaw = input.pointerX * CAMERA_RIG.parallaxTilt;
  const deviceYaw = tiltX * CAMERA_RIG.deviceTilt;
  const pointerPitch = -input.pointerY * CAMERA_RIG.parallaxTilt * 0.7;
  const devicePitch = -tiltY * CAMERA_RIG.deviceTilt;
  const yaw = clampMagnitude(pointerYaw + deviceYaw, CAMERA_RIG.maxCombinedTilt);
  const pitch =
    clampMagnitude(pointerPitch + devicePitch, CAMERA_RIG.maxCombinedTilt)
    + breathe * 0.4
    + CAMERA_RIG.introPitch * introRemain
    - CAMERA_RIG.depthPitch * depthT;

  _pos.x += (input.pointerX + tiltX * 0.35) * CAMERA_RIG.parallaxLateral + drift;
  _pos.z += breathe;

  _euler.set(pitch, yaw, 0, "YXZ");
  _quat.setFromEuler(_euler);
  out.position.copy(_pos);
  out.quaternion.copy(rest.quaternion).multiply(_quat);

  if (camera) {
    const fov =
      rest.fov
      + CAMERA_RIG.introFovWiden * introRemain
      - CAMERA_RIG.depthFovTighten * depthT;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    camera.position.copy(out.position);
    camera.quaternion.copy(out.quaternion);
  }
}

/** Alias kept for call sites / regression guards. */
export const evaluateCameraRig = applyCameraRig;

export function captureCameraRestPose(
  camera: PerspectiveCamera,
  out: CameraRestPose,
) {
  out.position.copy(camera.position);
  out.quaternion.copy(camera.quaternion);
  out.fov = camera.fov;
}
