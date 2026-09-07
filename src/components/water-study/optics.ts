import { waterWaves, waterWarp } from './surface';
import { skyGLSL } from './environment';
const waveTerms=waterWaves.map((wave,index)=>`
  float phase${index}=dot(q,vec2(${wave.x.toFixed(4)},${wave.y.toFixed(4)}))+time*${wave.rate.toFixed(4)};
  swell+=${wave.amplitude.toFixed(5)}*sin(phase${index});
  slope+=vec2(${wave.x.toFixed(4)},${wave.y.toFixed(4)})*${wave.amplitude.toFixed(5)}*cos(phase${index});
`).join('');

// Half-float pressure and its world-space gradient; analytic ambient-wave derivatives.
const analyticSurfaceGLSL = `
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
`;

// Evaluate the wave spectrum once per surface texel, rather than repeatedly for
// every display pixel, every glass fragment, and every caustic vertex.
export const surfaceVertex = `varying vec2 surfaceUv;void main(){surfaceUv=uv;gl_Position=vec4(position.xy*2.,0.,1.);}`;
export const surfaceFragment = `${analyticSurfaceGLSL}
uniform vec4 surfaceArea;
varying vec2 surfaceUv;
void main(){
  vec3 state=surfaceAt((surfaceUv-.5)*surfaceArea.zw+surfaceArea.xy);
  gl_FragColor=vec4(state,1.);
}`;
export const surfaceGLSL = `
uniform sampler2D surfaceMap;
uniform vec4 surfaceArea;
uniform vec4 causticArea;
vec3 surfaceAt(vec2 p){
  vec2 uv=(p-surfaceArea.xy)/surfaceArea.zw+.5;
  vec3 state=texture2D(surfaceMap,clamp(uv,vec2(.001),vec2(.999))).rgb;
  return state;
}
float heightAt(vec2 p){return surfaceAt(p).x;}
vec3 normalAt(vec2 p){return normalize(vec3(-surfaceAt(p).yz,1.));}
const vec3 sunRay=vec3(.19245,-.19245,-.96225);
vec3 floorHit(vec3 p,vec3 direction){return p+direction*((-2.1-p.z)/min(-.001,direction.z));}
`;

// Devices without renderable half-float targets retain analytic precision.
// Encoding tiny slopes into an 8-bit render target would introduce visible bands.
export const uncachedSurfaceGLSL = `${analyticSurfaceGLSL}
float heightAt(vec2 p){return surfaceAt(p).x;}
vec3 normalAt(vec2 p){return normalize(vec3(-surfaceAt(p).yz,1.));}
const vec3 sunRay=vec3(.19245,-.19245,-.96225);
vec3 floorHit(vec3 p,vec3 direction){return p+direction*((-2.1-p.z)/min(-.001,direction.z));}
`;

// Project a tessellated water surface along refracted sunlight. Overlapping light
// footprints add energy, rather than selecting one inverse ray at a caustic fold.
export const causticVertex = `${surfaceGLSL}
varying vec2 sourcePoint;
varying vec2 receiverPoint;
void main(){
  sourcePoint=position.xy*(causticArea.zw+vec2(2.))+causticArea.xy;
  vec3 state=surfaceAt(sourcePoint);
  vec3 normal=normalize(vec3(-state.yz,1.));
  vec3 projected=floorHit(vec3(sourcePoint,state.x),refract(sunRay,normal,1./1.333));
  receiverPoint=projected.xy;
  gl_Position=vec4((receiverPoint-causticArea.xy)/causticArea.zw*2.,0.,1.);
}`;
export const causticFragment = `
varying vec2 sourcePoint;
varying vec2 receiverPoint;
void main(){
  float before=abs(dFdx(sourcePoint.x)*dFdy(sourcePoint.y)-dFdy(sourcePoint.x)*dFdx(sourcePoint.y));
  float after=abs(dFdx(receiverPoint.x)*dFdy(receiverPoint.y)-dFdy(receiverPoint.x)*dFdx(receiverPoint.y));
  float density=before/max(after,.00000001);
  float focus=density/(1.+density*.12);
  gl_FragColor=vec4(vec3(focus*.22),1.);
}`;

export const floorVertex = `varying vec3 world; void main(){world=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}`;
const floorLightingGLSL = `
uniform sampler2D caustics;
uniform sampler2D glassShadow;
uniform float immersion;
uniform float returnLight;
uniform float projectFocus;
uniform float showGlass;
vec3 floorColor(vec3 p){
  vec2 q=(p.xy-causticArea.xy)/causticArea.zw+.5;
  float focused=texture2D(caustics,q).r;
  float soft=texture2DLodEXT(caustics,q,2.).r;
  focused=mix(focused,soft,clamp(immersion*.62+projectFocus*.22,0.,.85));
  float shade=texture2DLodEXT(glassShadow,q,3.).r*showGlass;
  // A pale mineral floor receives actual moving light footprints from the surface.
  // Its albedo has almost no detail: all visible water patterns come from refraction.
  float mineral=.985+.015*sin(p.x*23.1+p.y*11.7)*sin(p.y*19.3-p.x*7.1);
  vec3 albedo=mix(vec3(.43,.61,.72),vec3(.30,.51,.65),immersion*.80)*mineral;
  float broadLight=.94+.06*cos(p.x*.42-p.y*.28);
  float light=(.65+focused*1.35+soft*.48)*broadLight;
  float shaft=exp(-(p.x*.33+p.y*.16-.8)*(p.x*.33+p.y*.16-.8));
  light+=returnLight*(.12+.18*shaft);
  return albedo*light*(1.-shade*.38);
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
${skyGLSL}
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
  // Shade the converged intersection so moving ripples keep their refraction attached to the surface.
  vec3 surfaceState=vec3(0.);
  for(int i=0;i<2;i++){
    surfaceState=surfaceAt(world.xy);
    float derivative=min(-.1,viewRay.z-dot(surfaceState.yz,viewRay.xy));
    world-=viewRay*((world.z-surfaceState.x)/derivative);
  }
  surfaceState=surfaceAt(world.xy);
  vec3 n=normalize(vec3(-surfaceState.yz,1.));
  vec3 incoming=normalize(world-cameraPosition);
  vec3 bent=refract(incoming,n,1./1.333);
  vec3 target=floorHit(world,bent);
  vec2 uv=vec2(.5);
  // The shallow title occupies one narrow depth layer. Intersect that layer once,
  // then use scene depth to distinguish solid glass from the unobstructed floor.
  // This keeps silhouettes continuous and avoids a costly, quantized depth march.
  bool hitGlass=false;
  if(showGlass>.5){
  vec3 glassPoint=world+bent*((-.30-world.z)/min(-.001,bent.z));
  vec4 glassScreen=viewProjection*vec4(glassPoint,1.);
  vec2 glassUV=glassScreen.xy/glassScreen.w*.5+.5;
  float receiverDepth=texture2D(submergedDepth,clamp(glassUV,.002,.998)).x;
  vec4 receiver=inverseViewProjection*vec4(glassUV*2.-1.,receiverDepth*2.-1.,1.);
  // Offscreen projections must see the floor, not a clamped edge glyph.
  bool insideGlassTarget=glassScreen.w>0. && all(greaterThanEqual(glassUV,vec2(0.))) && all(lessThanEqual(glassUV,vec2(1.)));
  hitGlass=insideGlassTarget && receiver.z/receiver.w> -1.5;
  if(hitGlass)target=glassPoint;
  }
  vec4 finalScreen=viewProjection*vec4(target,1.);
  uv=finalScreen.xy/finalScreen.w*.5+.5;
  // The floor is prefiltered by depth before glass is drawn, preserving sharp silhouettes.
  // A missed ray sees the actual floor, not a glyph pixel occluding it in the source view.
  // The procedural floor is available even where a screen-space color target is occluded.
  vec3 beneath=hitGlass?texture2D(submerged,clamp(uv,.002,.998)).rgb:floorColor(target);
  float frameEdge=smoothstep(0.,.04,min(min(uv.x,uv.y),min(1.-uv.x,1.-uv.y)));
  beneath=mix(vec3(.52,.61,.74),beneath,frameEdge);
  float distanceThroughWater=length(target-world);
  vec3 transmission=exp(-vec3(.10,.043,.020)*distanceThroughWater);
  beneath=beneath*transmission+vec3(.20,.42,.57)*(1.-transmission);
  vec3 reflected=reflect(incoming,n);
  vec3 sky=skyRadiance(reflected);
  float fresnel=.0204+.9796*pow(1.-clamp(dot(-incoming,n),0.,1.),5.);
  vec3 color=mix(beneath,sky,fresnel);
  if(showGlass>.5){
    // Above-water glass follows the straight camera ray. The wet transition uses
    // the identical height field as the refracted ray, so it follows each swell.
    float directDepth=texture2D(submergedDepth,screenUv).x;
    vec4 directPoint=inverseViewProjection*vec4(screenUv*2.-1.,directDepth*2.-1.,1.);
    vec3 exposed=directPoint.xyz/directPoint.w;
    float clearance=exposed.z-heightAt(exposed.xy);
    float dry=smoothstep(-.018,.022,clearance)*step(-1.5,exposed.z);
    color=mix(color,texture2D(submerged,screenUv).rgb,dry);
  }
  gl_FragColor=vec4(color,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
