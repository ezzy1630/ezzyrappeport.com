import * as THREE from 'three';

/** A fixed luminous opening with rippled reflections; the glass reflects it as it moves. */
export function createStudyEnvironment(renderer: THREE.WebGLRenderer, backdrop: THREE.Texture) {
  const scene=new THREE.Scene();
  const geometry=new THREE.SphereGeometry(15,48,24);
  const material=new THREE.ShaderMaterial({
    side:THREE.BackSide,toneMapped:false,uniforms:{backdrop:{value:backdrop}},
    vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 direction;uniform sampler2D backdrop;
      void main(){
        vec3 d=normalize(direction);
        vec2 p=d.xy/max(.3,abs(d.z));
        float fold=p.y*5.+sin(p.x*3.)*1.2+sin(p.x*5.+p.y*2.)*.4;
        float ribbon=pow(.5+.5*sin(fold),28.);
        float darkFold=pow(.5+.5*sin(fold+1.0),5.);
        float front=smoothstep(-.4,.6,d.z);
        vec3 radiance=mix(vec3(.025,.045,.09),vec3(.22,.32,.5),front);
        radiance*=1.-darkFold*.88;
        radiance+=vec3(8.,9.,10.)*ribbon;
        float broad=exp(-pow((p.y+.12+sin(p.x*3.)*.06)*12.,2.));
        radiance+=vec3(3.,3.5,4.)*broad*front;
        vec2 waterUV=vec2(.5+atan(d.x,d.z)/6.283,.83+d.y*.14);
        vec3 reflectedWater=texture2D(backdrop,waterUV).rgb;
        float brightness=dot(reflectedWater,vec3(.2126,.7152,.0722));
        radiance+=pow(brightness,5.)*vec3(7.,8.,9.);
        gl_FragColor=vec4(radiance,1.);
      }`,
  });
  scene.add(new THREE.Mesh(geometry,material));
  const generator=new THREE.PMREMGenerator(renderer);
  try{return generator.fromScene(scene,.025);}finally{generator.dispose();geometry.dispose();material.dispose();}
}
