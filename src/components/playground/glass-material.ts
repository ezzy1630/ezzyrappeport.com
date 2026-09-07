import * as THREE from "three";

/** Clear transmission with subtle cast-surface variation; reflections come from the studio. */
export function createGlassMaterial(surface: THREE.Texture, worldSize: THREE.Vector2, time: { value: number }) {
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    metalness: 0,
    roughness: 0.008,
    transmission: 1,
    thickness: 0.45,
    ior: 1.46,
    envMapIntensity: 1.15,
    clearcoat: 0.12,
    clearcoatRoughness: 0.025,
    attenuationColor: new THREE.Color(0xf1f8ff),
    attenuationDistance: 8,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.waterSurface = { value: surface };
    shader.uniforms.waterWorldSize = { value: worldSize };
    shader.uniforms.waterTime = time;
    shader.vertexShader = `varying vec3 vGlassBend;\n${shader.vertexShader}`.replace(
      "#include <beginnormal_vertex>",
      `#include <beginnormal_vertex>
      // Low-frequency cast-surface variation; no time noise or grain.
      vec2 bend = vec2(
        sin(position.x * 7.0 + position.y * 5.0),
        sin(position.y * 8.0 - position.x * 4.0)
      ) * 0.035;
      vGlassBend = normalMatrix * vec3(bend, 0.0);`,
    );
    shader.fragmentShader = `varying vec3 vGlassBend;\nuniform sampler2D waterSurface;\nuniform vec2 waterWorldSize;\nuniform float waterTime;\n${shader.fragmentShader}`.replace(
      "#include <normal_fragment_maps>",
      `#include <normal_fragment_maps>
      vec4 waterWave = texture2D(waterSurface, vWorldPosition.xy / waterWorldSize + .5);
      vec2 waterSlope = (waterWave.gb - vec2(128./255.)) * 2.;
      normal = normalize(normal + vGlassBend * abs(normal.z) + vec3(waterSlope * .35, 0.));`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `
      // Thin reflected studio strips follow the curved shoulders rather than
      // filling the face with a broad colored band.
      // Keep shoulder contrast stable in tall frames with a wide vertical field of view.
      float portrait = smoothstep(1.2, 2., waterWorldSize.y / waterWorldSize.x);
      vec3 glassView = normalize(mix(geometryViewDir, vec3(0.,0.,1.), portrait * .75));
      float shoulder = 1. - clamp(abs(dot(normal, glassView)), 0., 1.);
      vec3 reflected = reflect(-glassView, normal);
      float phase = reflected.y * 6. + reflected.x * 3. + reflected.z * 2. + waterTime * .09;
      float curve = smoothstep(.025, .2, shoulder);
      float shoulderBand = smoothstep(.06, .2, shoulder) * (1. - smoothstep(.38, .62, shoulder));
      float darkStrip = pow(max(sin(phase), 0.), 10.);
      float lightStrip = pow(max(sin(phase + 1.15), 0.), 6.);
      float rimDistance = (shoulder - .87) / .07;
      float rim = exp(-rimDistance * rimDistance);
      outgoingLight = mix(outgoingLight, vec3(.045, .11, .21),
        min(.86, shoulderBand * .65 + curve * (.1 + darkStrip * .25 + rim * .3)));
      outgoingLight += vec3(.75, .86, 1.) * lightStrip * curve * .4;
      #include <opaque_fragment>
      `,
    );
  };
  material.customProgramCacheKey = () => "portfolio-water-glass-v4";
  return material;
}
