import * as THREE from "three";
import { HERO_CAMERA_DISTANCE } from "./hero-camera";

/** A nearer, deforming water ceiling gives the scene a foreground. */
export function createWaterCanopy(water: THREE.Texture, time: { value: number }) {
  const geometry = new THREE.PlaneGeometry(1, 1, 64, 12);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: { water: { value: water }, time, photoAspect: { value: 1600 / 900 }, submersion: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      varying float vFold;
      uniform float time;
      void main() {
        vUv = uv;
        vec3 p = position;
        float wave = sin(uv.x * 12. + time * .36) * .018
          + sin(uv.x * 23. - time * .24 + uv.y * 4.) * .009;
        p.y += wave;
        p.z += sin(uv.x * 9. + uv.y * 5. + time * .3) * .025;
        vFold = wave;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying float vFold;
      uniform sampler2D water;
      uniform float photoAspect;
      uniform float submersion;
      uniform float time;
      void main() {
        vec2 uv = vec2((vUv.x - .5) * min(1., photoAspect / (1672./941.)) + .5, .73 + vUv.y * .27);
        uv.x += sin(vUv.y * 16. + time * .24) * .004;
        uv.y += vFold * .25;
        vec3 color = texture2D(water, clamp(uv, 0., 1.)).rgb;
        color *= vec3(.93, .98, 1.04);
        float alpha = smoothstep(0., .32, vUv.y) * .94 * (1. - smoothstep(0., .9, submersion));
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = 2;
  mesh.frustumCulled = false;
  return {
    mesh,
    setDepth(value: number) {
      material.uniforms.submersion.value = value;
      mesh.visible = value < 1;
    },
    resize(width: number, height: number, mobile: boolean) {
      material.uniforms.photoAspect.value = mobile ? 390 / 844 : 1600 / 900;
      const depthScale = 1 - mesh.position.z / HERO_CAMERA_DISTANCE;
      mesh.scale.set(width * depthScale * 1.24, height * depthScale * .34, 1);
      mesh.position.y = height * depthScale * .43;
    },
    dispose() { geometry.dispose(); material.dispose(); },
  };
}
