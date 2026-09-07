export const waterVertexShader = `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy*2.,.999,1.);}`;
export const waterFragmentShader = `
precision highp float;
varying vec2 vUv;
uniform sampler2D water;
uniform sampler2D surface;
uniform vec2 resolution;
uniform float photoAspect;
uniform vec2 worldSize;
uniform float titleCenterY;
uniform float time;
uniform vec2 viewOffset;
uniform mat4 unproject;
uniform float dive;
uniform float transmittedView;
uniform float capturePoster;
void main(){
 if(capturePoster>.5 && transmittedView<.5) discard;
 vec4 farPoint = unproject * vec4(vUv * 2. - 1., 1., 1.);
 vec3 ray = farPoint.xyz / farPoint.w - cameraPosition;
 vec2 worldPoint = (cameraPosition - ray * (cameraPosition.z / ray.z)).xy;
 vec2 fieldUV = worldPoint / worldSize + .5;
 vec4 field=texture2D(surface,clamp(fieldUV,0.,1.));
 vec2 slope=(field.gb-vec2(128./255.))*2.;
 vec2 swell=vec2(sin(vUv.y*8.+time*.3),cos(vUv.x*9.-time*.23))*.006;
 vec2 offset=slope*.06+swell;
 float aspect=photoAspect;
 vec2 imageUV=vUv;
 float sourceAspect=1672./941.;
 if(aspect>sourceAspect) imageUV.y=(vUv.y-.5)*sourceAspect/aspect+.5;
 else imageUV.x=(vUv.x-.5)*aspect/sourceAspect+.5;
 // The distant water uses the floor portion; the nearer ceiling is real geometry.
 imageUV.y *= .74;
 imageUV += viewOffset * vec2(.025, .018);
 vec3 color=texture2D(water,clamp(imageUV+offset,0.,1.)).rgb;
 vec3 normal=normalize(vec3(-slope*2.,1.));
 float glint=pow(max(dot(normal,normalize(vec3(-.18,.3,1.))),0.),65.);
 color+=field.a*.06+glint*length(slope)*.35;
 color-=length(slope)*.045;
 // A broad sunward opening and a cooler distance give the eye a place in space.
 float depth = 1. - vUv.y;
 float sun = exp(-dot((vUv - vec2(.32,.87)) * vec2(1.3,1.),
   (vUv - vec2(.32,.87)) * vec2(1.3,1.)) * 3.);
 float rayPhase = (vUv.x - .28 + vUv.y * .17) * 21. + time * .06;
 float beam = pow(max(.5 + .5 * sin(rayPhase), 0.), 8.);
 color *= .86 + sun * .14;
 color = mix(color, color * vec3(.62,.82,1.04), .24 + depth * .12 + dive * .18);
 color += vec3(.11,.14,.17) * beam * sun;
 float edgeDepth = smoothstep(.16,.78,length((vUv-vec2(.43,.6))*vec2(1.,.65)));
 color *= 1. - edgeDepth * .2;
 color = mix(color, vec3(.66,.78,.87), dive * .36);
 // Keep one continuous water image through the glass; tiled caustics read as ice.
 if(transmittedView>.5){
 vec2 opticalUV=vec2(worldPoint.x/5.1+.5,
   (worldPoint.y-titleCenterY)/5.1*sourceAspect+.5);
 vec3 opticalSample=texture2D(water,clamp(opticalUV+offset,0.,1.)).rgb;
 float caustic=smoothstep(.36,.82,dot(opticalSample,vec3(.2126,.7152,.0722)));
 vec3 opticalColor=mix(vec3(.025,.09,.2),vec3(1.3,1.4,1.5),caustic);
 color=mix(opticalSample,opticalColor,.92);
 }
 gl_FragColor=vec4(color,1.);
 #include <colorspace_fragment>
}`;

