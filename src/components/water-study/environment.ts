import * as THREE from 'three';

/** Analytic daylight shared by the water and the glass; no photographic environment map. */
export const skyGLSL = `
vec3 skyRadiance(vec3 d) {
  float sky=smoothstep(-.25,.30,d.z);
  vec3 horizon=mix(vec3(1.05,1.35,1.62),vec3(.32,.58,.92),max(0.,d.z));
  vec3 radiance=mix(vec3(.075,.13,.20),horizon,sky);
  vec2 openingDistance=vec2((d.x+.30)*3.0,(d.y-.25)*5.0);
  float opening=exp(-dot(openingDistance,openingDistance))*smoothstep(.10,.65,d.z);
  radiance+=vec3(3.5,3.8,4.1)*opening;
  float sun=pow(max(dot(d,normalize(vec3(-.19245,.19245,.96225))),0.),320.);
  return radiance+vec3(12.,11.5,10.5)*sun;
}
`;

export function createStudyEnvironment(renderer: THREE.WebGLRenderer) {
  const scene = new THREE.Scene();
  const geometry = new THREE.SphereGeometry(15, 48, 24);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, toneMapped: false,
    vertexShader: 'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec3 direction;${skyGLSL}\nvoid main(){gl_FragColor=vec4(skyRadiance(normalize(direction)),1.);}`,
  });
  scene.add(new THREE.Mesh(geometry, material));
  const generator = new THREE.PMREMGenerator(renderer);
  try { return generator.fromScene(scene, .025); }
  finally { generator.dispose(); geometry.dispose(); material.dispose(); }
}
