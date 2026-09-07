import { waterWaves, waterWarp } from './surface';
const waveTerms=waterWaves.map((wave,index)=>`
  float phase${index}=dot(q,vec2(${wave.x.toFixed(4)},${wave.y.toFixed(4)}))+time*${wave.rate.toFixed(4)};
  swell+=${wave.amplitude.toFixed(5)}*sin(phase${index});
  slope+=vec2(${wave.x.toFixed(4)},${wave.y.toFixed(4)})*${wave.amplitude.toFixed(5)}*cos(phase${index});
`).join('');

// Half-float pressure and its world-space gradient; analytic ambient-wave derivatives.
export const surfaceGLSL = `
uniform sampler2D field;
uniform vec2 extent;
uniform float time;
uniform vec4 causticArea;
vec3 surfaceAt(vec2 p) {
  vec3 pressure=texture2D(field,clamp(p/extent+.5,0.,1.)).rgb;
  float envelope=exp(-dot(p*vec2(.40,.70),p*vec2(.40,.70)));
  float calm=.68+.30*(1.-envelope);
  vec2 calmSlope=.60*envelope*p*vec2(.16,.49);
  float swell=0.;vec2 slope=vec2(0.);
  vec2 q=p+vec2(${waterWarp.xAmplitude}*sin(p.y*${waterWarp.xFrequency}+time*${waterWarp.xRate}),${waterWarp.yAmplitude}*sin(p.x*${waterWarp.yFrequency}+time*${waterWarp.yRate}));
  ${waveTerms}
  vec2 crossSlope=vec2(${waterWarp.yAmplitude*waterWarp.yFrequency}*cos(p.x*${waterWarp.yFrequency}+time*${waterWarp.yRate}),${waterWarp.xAmplitude*waterWarp.xFrequency}*cos(p.y*${waterWarp.xFrequency}+time*${waterWarp.xRate}));
  slope+=slope.yx*crossSlope;
  return pressure+vec3(calm*swell,calm*slope+calmSlope*swell);
}
float heightAt(vec2 p){return surfaceAt(p).x;}
vec3 normalAt(vec2 p){return normalize(vec3(-surfaceAt(p).yz,1.));}
const vec3 sunRay=vec3(.19245,-.19245,-.96225);
vec3 floorHit(vec3 p,vec3 direction){return p+direction*((-2.1-p.z)/min(-.001,direction.z));}
`;

export const causticVertex = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy*2.,0.,1.);}`;
export const causticFragment = `${surfaceGLSL}
varying vec2 vUv;
void main(){
  vec2 receiver=(vUv-.5)*causticArea.zw+causticArea.xy;
  vec2 source=receiver-vec2(.30,-.30);
  vec3 projected=vec3(receiver,-2.1);
  // Invert the continuous light mapping; no triangle areas or mesh edges enter the intensity.
  for(int i=0;i<3;i++){
    vec3 state=surfaceAt(source);
    vec3 n=normalize(vec3(-state.yz*1.65,1.));
    projected=floorHit(vec3(source,state.x),refract(sunRay,n,1./1.333));
    source+=(receiver-projected.xy)*.65;
  }
  vec3 state=surfaceAt(source);
  projected=floorHit(vec3(source,state.x),refract(sunRay,normalize(vec3(-state.yz*1.65,1.)),1./1.333));
  float sourceArea=abs(dFdx(source.x)*dFdy(source.y)-dFdy(source.x)*dFdx(source.y));
  float targetArea=abs(dFdx(projected.x)*dFdy(projected.y)-dFdy(projected.x)*dFdx(projected.y));
  float ratio=sourceArea/max(targetArea,.0000001);
  // A finite light opening softens singular focal lines rather than clipping them to white.
  float focus=ratio/sqrt(1.+ratio*ratio*.018);
  gl_FragColor=vec4(vec3(focus*.25),1.);
}`;

export const floorVertex = `varying vec3 world; void main(){world=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}`;
const floorLightingGLSL = `
uniform sampler2D caustics;
uniform sampler2D glassShadow;
uniform sampler2D backdrop;
uniform mat4 backdropProjection;
uniform vec2 backdropCrop;
vec3 backdropRadiance(vec2 uv){
  vec3 y=texture2D(backdrop,clamp((uv-.5)*backdropCrop+.5,.001,.999)).rgb;
  // Approximate inverse filmic curve keeps the photographic plate in its authored exposure.
  vec3 a=2.51-2.43*y,b=.59*y-.03;
  return (b+sqrt(b*b+.56*y*a))/(2.*a)/1.15;
}
vec3 floorColor(vec3 p){
  vec2 q=(p.xy-causticArea.xy)/causticArea.zw+.5;
  vec4 projected=backdropProjection*vec4(p,1.);
  vec2 uv=projected.xy/projected.w*.5+.5;
  float light=texture2DLodEXT(caustics,q,1.).r;
  float shade=texture2DLodEXT(glassShadow,q,3.).r;
  // The photographic water supplies fine optical detail; simulated pressure changes its refraction.
  return backdropRadiance(uv)*(1.+(light-.25)*.12)*(1.-shade*.17);
}
`;

export const floorFragment = `
uniform vec4 causticArea;
${floorLightingGLSL}
varying vec3 world;
void main(){
  gl_FragColor=vec4(floorColor(world),1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const waterVertex = `varying vec2 screenUv;void main(){screenUv=uv;gl_Position=vec4(position.xy*2.,.999,1.);}`;
export const waterFragment = `${surfaceGLSL}
${floorLightingGLSL}
uniform sampler2D submerged;
uniform mat4 viewProjection;
uniform mat4 inverseViewProjection;
uniform sampler2D submergedDepth;
uniform int viewMode;
varying vec2 screenUv;
void main(){
  if(viewMode==1){
    gl_FragColor=vec4(texture2D(submerged,screenUv).rgb,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    return;
  }
  vec4 farPoint=inverseViewProjection*vec4(screenUv*2.-1.,1.,1.);
  vec3 viewRay=normalize(farPoint.xyz/farPoint.w-cameraPosition);
  vec3 world=cameraPosition-viewRay*(cameraPosition.z/viewRay.z);
  // Two Newton steps intersect the continuous surface using its analytic gradient.
  // Reuse the last gradient for shading instead of evaluating the wave spectrum a third time.
  vec3 surfaceState=vec3(0.);
  for(int i=0;i<2;i++){
    surfaceState=surfaceAt(world.xy);
    float derivative=min(-.1,viewRay.z-dot(surfaceState.yz,viewRay.xy));
    world-=viewRay*((world.z-surfaceState.x)/derivative);
  }
  vec3 n=normalize(vec3(-surfaceState.yz,1.));
  vec3 incoming=normalize(world-cameraPosition);
  vec3 bent=refract(incoming,n,1./1.333);
  vec3 target=floorHit(world,bent);
  vec2 uv=vec2(.5);
  // The shallow title occupies one narrow depth layer. Intersect that layer once,
  // then use scene depth to distinguish solid glass from the unobstructed floor.
  // This keeps silhouettes continuous and avoids a costly, quantized depth march.
  vec3 glassPoint=world+bent*((-.30-world.z)/min(-.001,bent.z));
  vec4 glassScreen=viewProjection*vec4(glassPoint,1.);
  vec2 glassUV=glassScreen.xy/glassScreen.w*.5+.5;
  float receiverDepth=texture2D(submergedDepth,clamp(glassUV,.002,.998)).x;
  vec4 receiver=inverseViewProjection*vec4(glassUV*2.-1.,receiverDepth*2.-1.,1.);
  bool hitGlass=receiver.z/receiver.w> -1.5;
  if(hitGlass)target=glassPoint;
  vec4 finalScreen=viewProjection*vec4(target,1.);
  uv=finalScreen.xy/finalScreen.w*.5+.5;
  // The floor is prefiltered by depth before glass is drawn, preserving sharp silhouettes.
  // A missed ray sees the actual floor, not a glyph pixel occluding it in the source view.
  // The procedural floor is available even where a screen-space color target is occluded.
  vec3 beneath=hitGlass?texture2D(submerged,clamp(uv,.002,.998)).rgb:floorColor(target);
  float frameEdge=smoothstep(0.,.04,min(min(uv.x,uv.y),min(1.-uv.x,1.-uv.y)));
  beneath=mix(vec3(.52,.61,.74),beneath,frameEdge);
  float distanceThroughWater=length(target-world);
  vec3 transmission=exp(-vec3(.015,.009,.004)*distanceThroughWater);
  beneath=beneath*transmission+vec3(.58,.69,.87)*(1.-transmission);
  vec3 reflected=reflect(incoming,n);
  float opening=exp(-pow((reflected.x+.30)*2.0,2.)-pow((reflected.y-.35)*2.5,2.));
  vec3 sky=mix(vec3(.32,.42,.62),vec3(.96,.98,1.),opening);
  float sun=pow(max(dot(reflected,-sunRay),0.),480.);
  float fresnel=.0204+.9796*pow(1.-max(dot(-incoming,n),0.),5.);
  vec3 color=mix(beneath,sky,fresnel)+vec3(.94,.97,1.)*sun*.035;
  gl_FragColor=vec4(color,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
