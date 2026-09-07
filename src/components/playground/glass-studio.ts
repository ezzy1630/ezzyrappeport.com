import * as THREE from "three";

/** Broad studio cards create continuous highlights as the curved letters move. */
export function createGlassEnvironment(renderer: THREE.WebGLRenderer) {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0.025, 0.055, 0.12);
  const geometry = new THREE.PlaneGeometry(1, 1);
  const materials: THREE.MeshBasicMaterial[] = [];
  const card = (
    position: [number, number, number],
    size: [number, number],
    color: [number, number, number],
  ) => {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(...color),
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    materials.push(material);
    const panel = new THREE.Mesh(geometry, material);
    panel.position.set(...position);
    panel.scale.set(size[0], size[1], 1);
    panel.lookAt(0, 0, 0);
    studio.add(panel);
  };
  card([0, 1.2, 5], [7, 0.5], [3.4, 3.7, 4]);
  card([0, -0.8, 5], [7, 0.35], [2.2, 2.8, 3.5]);
  card([-4, 3, 5], [2.5, 8], [4.2, 4.5, 5]);
  card([4, 1, 4], [1.5, 7], [2.8, 3.4, 4.2]);
  card([0, 5, 1], [9, 2], [4, 4.3, 4.8]);
  card([0, -4, 3], [8, 1.5], [1.2, 1.6, 2.2]);
  card([-3, 0, -4], [3, 6], [0.8, 1.2, 1.8]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  try {
    return pmrem.fromScene(studio, 0.035);
  } finally {
    pmrem.dispose();
    geometry.dispose();
    materials.forEach((material) => material.dispose());
  }
}
