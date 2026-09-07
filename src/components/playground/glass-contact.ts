import * as THREE from "three";

/** One instanced draw grounds the letters without a shadow-map render pass. */
export function createGlassContact(count: number) {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      void main() {
        vec2 p = (vUv - .5) * 2.;
        float r = length(p);
        float edge = 1. - smoothstep(.75, 1., r);
        float shadow = exp(-dot(p * vec2(1.25, 2.6), p * vec2(1.25, 2.6))) * .13;
        float ringDistance = (r - .67) / .035;
        float ring = exp(-ringDistance * ringDistance) * .17;
        float highlight = ring * smoothstep(-.3, .5, p.y);
        float alpha = (shadow + highlight) * edge;
        gl_FragColor = vec4(mix(vec3(.2, .34, .48), vec3(.95, .98, 1.),
          highlight / max(shadow + highlight, .001)), alpha);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  // Instances move with the simulation; a stale aggregate bound must not cull them.
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const transform = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  return {
    mesh,
    setLetter(index: number, x: number, y: number, width: number, height: number) {
      position.set(x, y - height * .46, -.12);
      scale.set(width * 1.25, height * .32, 1);
      transform.compose(position, rotation, scale);
      mesh.setMatrixAt(index, transform);
    },
    update() { mesh.instanceMatrix.needsUpdate = true; },
    dispose() { geometry.dispose(); material.dispose(); mesh.dispose(); },
  };
}
