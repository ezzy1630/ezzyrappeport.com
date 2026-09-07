import * as THREE from "three";

// A fixed resting distance keeps perspective and poster magnification consistent
// at every aspect ratio; resizing changes the field of view instead of distance.
export const HERO_CAMERA_DISTANCE = 8;
export function fitHeroCamera(camera: THREE.PerspectiveCamera, width: number, height: number) {
  camera.aspect = width / height;
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(height / (2 * HERO_CAMERA_DISTANCE)));
  camera.updateProjectionMatrix();
}
