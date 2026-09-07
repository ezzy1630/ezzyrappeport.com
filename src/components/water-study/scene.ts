import * as THREE from 'three';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createHeroDiagnostics } from '../playground/hero-diagnostics';
import { WaterField } from '../playground/water-field';
import { surfaceHeight, refractDirection } from './surface';
import { encodeOpticalField } from './field-texture';
import { waveResponse, addWake, addBodyWake } from './dynamics';
import { resolveContact } from '../playground/contact';
import type { RenderMode } from '../playground/render-budget';
import { WaterQuality } from './quality';
import { PresentationClock } from './presentation';
import { journeyState } from './journey';
import { advanceSpring } from '../playground/spring';
import { createStudyEnvironment } from './environment';
import { PointerMomentum, ScrollCurrent, disturbStroke, splash, clamp } from './interaction';
import { createWorldMotion } from './world-motion';
import { surfaceVertex, surfaceFragment, surfaceGLSL, uncachedSurfaceGLSL, causticVertex, causticFragment, floorVertex, floorFragment, waterVertex, waterFragment } from './optics';

export async function createWaterStudy(host: HTMLElement, unavailable: () => void, showTitle = true) {
  const root = host.closest<HTMLElement>('[data-water-world]') ?? host;
  const heroSection = root.querySelector<HTMLElement>('[data-water-hero]');
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.transmissionResolutionScale = .5;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(0xb9cadf);
  const owned: Array<{dispose(): void}> = [];
  const debug=new URLSearchParams(location.search).has('capture');
  const diagnostics=debug?createHeroDiagnostics(renderer.domElement,renderer.getContext() as WebGL2RenderingContext):undefined;
  if(diagnostics)owned.push(diagnostics);
  renderer.info.autoReset=false;
  let dead = false;
  let frame = 0;
  const cleanup = () => { cancelAnimationFrame(frame); owned.forEach(x=>x.dispose()); renderer.dispose(); renderer.domElement.remove(); };
  try {
    const gltf = showTitle ? await new GLTFLoader().loadAsync('/assets/hero/playground-glyphs.glb') : {scene:new THREE.Group()};
    const environment = showTitle ? createStudyEnvironment(renderer) : null;
    if(environment)owned.push(environment);
    const scene = new THREE.Scene();
    scene.environment = environment?.texture ?? null;
    const camera = new THREE.PerspectiveCamera(39,1,.1,40);
    const extent = new THREE.Vector2(18,24);
    const field = new WaterField(192,256,false,1.8);
    field.resize(extent.x,extent.y);
    const opticalPixels=new Uint16Array(field.columns*field.rows*4);
    const texture = new THREE.DataTexture(opticalPixels,field.columns,field.rows,THREE.RGBAFormat,THREE.HalfFloatType);
    const updateField=()=>{encodeOpticalField(field,extent.x,extent.y,opticalPixels);texture.needsUpdate=true;};
    texture.minFilter=texture.magFilter=THREE.LinearFilter;
    texture.needsUpdate=true;
    owned.push(texture);
    const common = {surfaceArea:{value:new THREE.Vector4(0,0,22,28)},returnLight:{value:0},projectFocus:{value:0},immersion:{value:0},showGlass:{value:1},field:{value:texture},extent:{value:extent},time:{value:0},causticArea:{value:new THREE.Vector4(0,0,18,24)}};
    const hdrType=renderer.extensions.has('EXT_color_buffer_float')&&!(debug&&new URLSearchParams(location.search).get('precision')==='byte')?THREE.HalfFloatType:THREE.UnsignedByteType;
    const cacheSurface=hdrType===THREE.HalfFloatType;
    const opticalShader=(source:string)=>cacheSurface?source:source.replace(surfaceGLSL,uncachedSurfaceGLSL);
    if(debug)renderer.domElement.dataset.surfaceMode=cacheSurface?'cached-float':'analytic';
    const surfaceTarget=new THREE.WebGLRenderTarget(512,512,{depthBuffer:false,type:hdrType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
    const opticalSurface={...common,surfaceMap:{value:surfaceTarget.texture}};
    const surfaceMaterial=new THREE.ShaderMaterial({vertexShader:surfaceVertex,fragmentShader:surfaceFragment,uniforms:common,depthTest:false,depthWrite:false,toneMapped:false});
    const surfaceGeometry=new THREE.PlaneGeometry(1,1);
    const surfaceScene=new THREE.Scene();
    const surfaceMesh=new THREE.Mesh(surfaceGeometry,surfaceMaterial);surfaceMesh.frustumCulled=false;surfaceScene.add(surfaceMesh);
    owned.push(surfaceTarget,surfaceMaterial,surfaceGeometry);
    const caustics = new THREE.WebGLRenderTarget(640,640,{depthBuffer:false,type:hdrType,minFilter:THREE.LinearMipmapLinearFilter,generateMipmaps:true});
    const shadowTarget=new THREE.WebGLRenderTarget(512,512,{depthBuffer:true,minFilter:THREE.LinearMipmapLinearFilter,generateMipmaps:true});
    const shadowScene=new THREE.Scene();
    const shadowMaterial=new THREE.ShaderMaterial({
      uniforms:{causticArea:common.causticArea},
      vertexShader:`uniform vec4 causticArea; varying float edge;
        void main(){vec3 p=(modelMatrix*vec4(position,1.)).xyz;
        vec3 n=normalize(mat3(modelMatrix)*normal);edge=.16+.65*pow(clamp(1.-abs(n.z),0.,1.),2.);
        p.xy+=vec2(.20,-.20)*(p.z+2.1);
        gl_Position=vec4((p.xy-causticArea.xy)/causticArea.zw*2.,-p.z*.1,1.);}`,
      fragmentShader:'varying float edge;void main(){gl_FragColor=vec4(vec3(edge),1.);}',toneMapped:false,
    });
    owned.push(shadowTarget,shadowMaterial);
    const shadowArea=new THREE.Vector4();
    const shadowCopies:Array<{source:THREE.Mesh;copy:THREE.Mesh}>=[];
    const submerged = new THREE.WebGLRenderTarget(1,1,{samples:2,type:hdrType});
    submerged.texture.colorSpace = THREE.LinearSRGBColorSpace;
    submerged.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
    const refracted=new THREE.WebGLRenderTarget(1,1,{depthBuffer:false,type:hdrType});
    const resolveUniforms=THREE.UniformsUtils.clone(FXAAShader.uniforms);
    resolveUniforms.tDiffuse.value=refracted.texture;
    const resolveMaterial=new THREE.ShaderMaterial({
      uniforms:resolveUniforms,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy*2.,0.,1.);}',
      fragmentShader:FXAAShader.fragmentShader.replace('gl_FragColor = ApplyFXAA( tDiffuse, resolution.xy, vUv );',`gl_FragColor = ApplyFXAA( tDiffuse, resolution.xy, vUv );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>`),
      depthTest:false,depthWrite:false,
    });
    const resolveGeometry=new THREE.PlaneGeometry(1,1);
    const resolveScene=new THREE.Scene();
    const resolveMesh=new THREE.Mesh(resolveGeometry,resolveMaterial);resolveMesh.frustumCulled=false;resolveScene.add(resolveMesh);
    owned.push(caustics,submerged,refracted,resolveMaterial,resolveGeometry);
    const grid = new THREE.PlaneGeometry(1,1,128,160);
    const causticMaterial = new THREE.ShaderMaterial({vertexShader:opticalShader(causticVertex),fragmentShader:causticFragment,uniforms:opticalSurface,depthTest:false,depthWrite:false,toneMapped:false,transparent:true,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
    const lightScene = new THREE.Scene();
    const projected = new THREE.Mesh(grid,causticMaterial);
    projected.frustumCulled=false;
    lightScene.add(projected);
    const floorMaterial = new THREE.ShaderMaterial({vertexShader:floorVertex,fragmentShader:floorFragment,uniforms:{...opticalSurface,caustics:{value:caustics.texture},glassShadow:{value:shadowTarget.texture}}});
    const floorGeometry = new THREE.PlaneGeometry(extent.x,extent.y);
    const floor = new THREE.Mesh(floorGeometry,floorMaterial);
    floor.position.z=-2.1;
    scene.add(floor);
    const glass = new THREE.MeshPhysicalMaterial({color:0xffffff,metalness:0,roughness:.025,transmission:.96,thickness:1.35,ior:1.5,envMapIntensity:1.2,clearcoat:.35,clearcoatRoughness:.025,attenuationColor:new THREE.Color(0x829bc7),attenuationDistance:4.2});
    // Fine polishing undulations bend highlights without deforming the solid silhouette.
    glass.onBeforeCompile = shader => {
      Object.assign(shader.uniforms,opticalSurface);
      shader.vertexShader='varying vec3 waterWorld;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
        waterWorld=(modelMatrix*vec4(transformed,1.)).xyz;`);
      shader.fragmentShader=opticalShader(surfaceGLSL)+'\nvarying vec3 waterWorld;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
vec3 glassPoint=vViewPosition;
normal=normalize(normal+vec3(
  .008*sin(glassPoint.y*17.+sin(glassPoint.x*9.)),
  .008*sin(glassPoint.x*19.+sin(glassPoint.y*7.)),0.));
`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
// Approximate the longer optical path at grazing angles for the fixed-thickness mesh.
float wetDepth=heightAt(waterWorld.xy)-waterWorld.z;
float wet=smoothstep(-.025,.035,wetDepth);
float wetDistance=wetDepth/.025;
float meniscus=exp(-wetDistance*wetDistance);
outgoingLight*=mix(vec3(1.),vec3(.78,.91,.96),wet*.45);
outgoingLight+=vec3(.28,.36,.39)*meniscus*(.3+.7*pow(clamp(1.-abs(dot(normal,geometryViewDir)),0.,1.),2.));
float grazingPath = 1. / max(abs(dot(normal,geometryViewDir)),.12) - 1.;
outgoingLight *= exp(-vec3(.32,.18,.065) * grazingPath * .52);
float shoulder=clamp(1.-abs(dot(normal,geometryViewDir)),0.,1.);
float internalFold=.5+.5*sin(normal.x*6.+normal.y*4.+sin(normal.y*9.)*.2);
float foldedPath=pow(internalFold,5.)*(.35+.40*sqrt(shoulder));
outgoingLight*=mix(vec3(1.),vec3(.30,.41,.60),foldedPath*.40);

\n#include <opaque_fragment>`);
    };
    const meshes: Array<{mesh:THREE.Mesh;home:THREE.Vector3;velocity:THREE.Vector2;mass:number;position:THREE.Vector3;width:number;height:number;originalHome:THREE.Vector3;originalScale:THREE.Vector3;originalWidth:number;originalHeight:number;liftVelocity:number;spinVelocity:number;tiltVelocity:THREE.Vector2}> = [];
    const geometries=new Set<THREE.BufferGeometry>();
    gltf.scene.traverse(node=>{
      if(!(node instanceof THREE.Mesh))return;
      geometries.add(node.geometry);
      (Array.isArray(node.material)?node.material:[node.material]).forEach(m=>m.dispose());
      node.material=glass;
      const shadowCopy=new THREE.Mesh(node.geometry,shadowMaterial);shadowCopy.matrixAutoUpdate=false;shadowCopy.frustumCulled=false;
      shadowScene.add(shadowCopy);shadowCopies.push({source:node,copy:shadowCopy});
      const size=new THREE.Box3().setFromObject(node).getSize(new THREE.Vector3());
      meshes.push({position:node.position,width:size.x,height:size.y,originalHome:node.position.clone(),originalScale:node.scale.clone(),originalWidth:size.x,originalHeight:size.y,liftVelocity:0,spinVelocity:0,tiltVelocity:new THREE.Vector2(),mesh:node,home:node.position.clone(),velocity:new THREE.Vector2(),mass:Math.max(.75,size.x*2.8)});
    });
    gltf.scene.position.set(0,.25,-.20);
    gltf.scene.rotation.z=0;
    gltf.scene.scale.set(1.48,1.55,1.25);
    scene.add(gltf.scene);
    const sun=new THREE.DirectionalLight(0xf4f7ff,2.2);
    sun.position.set(-2,2,10);scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xf5f8ff,0x7186ab,.35));
    const waterMaterial=new THREE.ShaderMaterial({vertexShader:waterVertex,fragmentShader:opticalShader(waterFragment),uniforms:{...opticalSurface,caustics:{value:caustics.texture},glassShadow:{value:shadowTarget.texture},submerged:{value:submerged.texture},viewProjection:{value:new THREE.Matrix4()},inverseViewProjection:{value:new THREE.Matrix4()},submergedDepth:{value:submerged.depthTexture},viewMode:{value:debug&&new URLSearchParams(location.search).get('view')==='submerged'?1:0}}});
    const waterGrid=new THREE.PlaneGeometry(1,1);
    const water=new THREE.Mesh(waterGrid,waterMaterial);
    water.frustumCulled=false;
    scene.add(water);
    owned.push(waterGrid,grid,causticMaterial,floorGeometry,floorMaterial,glass,waterMaterial,...geometries);
    const ray=new THREE.Raycaster();
    const cursor=new THREE.Vector2();
    const plane=new THREE.Plane(new THREE.Vector3(0,0,1),0);
    const hit=new THREE.Vector3();
    const target=new THREE.Vector3();
    const offset=new THREE.Vector3();
    const momentum=new PointerMomentum();
    const current=new ScrollCurrent();
    let viewWidth=host.clientWidth,viewHeight=host.clientHeight,heroHeight=heroSection?.offsetHeight??host.clientHeight;
    let publishedDepth=-1;
    let contactTop=Number.POSITIVE_INFINITY;
    const contactSection=root.querySelector<HTMLElement>('#contact');
    const surfaceRay=new THREE.Raycaster();
    const surfaceCursor=new THREE.Vector2();
    const surfacePoint=new THREE.Vector3();
    const worldMotion=createWorldMotion(root,(x,y)=>{
      surfaceCursor.set(x/viewWidth*2-1,1-y/viewHeight*2);
      surfaceRay.setFromCamera(surfaceCursor,camera);
      if(!surfaceRay.ray.intersectPlane(plane,surfacePoint))return {height:0,x:0,y:0,worldX:0,worldY:0,scale:0};
      const {x:px,y:py}=surfacePoint,span=.16;
      return {height:field.sample(px,py),worldX:px,worldY:py,scale:2*camera.position.z*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))/viewHeight,x:(field.sample(px+span,py)-field.sample(px-span,py))/(span*2),y:(field.sample(px,py+span)-field.sample(px,py-span))/(span*2)};
    },(x,y,vx,vy,dt)=>addWake(field,x,y,vx,vy,dt));
    owned.push(worldMotion);
    let lastScroll=scrollY;
    let currentClock=0;
    let hoverClock=0;
    let held: typeof meshes[number] | undefined;
    let pointerId:number|undefined;
    let touchPlay=false;
    let offscreen=false;
    let paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
    worldMotion.setActive(!paused);
    let previousTime=0;
    let time=0;
    let orbitX=0;
    let orbitY=0;
    let viewX=0, viewY=0;
    let lastActivity=performance.now();
    let mode:RenderMode='active';
    const quality=new WaterQuality();
    const bodyPosition=new THREE.Vector3();
    const presentation=new PresentationClock();
    let lastResponseReport=0;
    const corner=new THREE.Vector3();
    const floorBounds=new THREE.Box2();
    const glyphBounds=new THREE.Box3();
    const floorPoint=new THREE.Vector2();
    const render=()=>{
      renderer.info.reset();
      diagnostics?.beginGpu(mode);
      camera.updateMatrixWorld();
      gltf.scene.visible=common.showGlass.value>0;
      gltf.scene.updateMatrixWorld(true);
      if(common.showGlass.value>0 && scrollY>heroHeight*.35){
        glyphBounds.setFromObject(gltf.scene);
        let lowest=Infinity;
        for(let i=0;i<8;i++){
          corner.set(i&1?glyphBounds.max.x:glyphBounds.min.x,i&2?glyphBounds.max.y:glyphBounds.min.y,i&4?glyphBounds.max.z:glyphBounds.min.z).project(camera);
          lowest=Math.min(lowest,corner.y);
        }
        if(lowest>1.04){common.showGlass.value=0;gltf.scene.visible=false;}
      }
      floorBounds.makeEmpty();
      for(let i=0;i<4;i++){
        corner.set(i&1?1:-1,i&2?1:-1,1).unproject(camera).sub(camera.position);
        corner.multiplyScalar((-2.1-camera.position.z)/corner.z).add(camera.position);
        floorBounds.expandByPoint(floorPoint.set(corner.x,corner.y));
      }
      common.causticArea.value.set((floorBounds.min.x+floorBounds.max.x)*.5,(floorBounds.min.y+floorBounds.max.y)*.5,floorBounds.max.x-floorBounds.min.x+.8,floorBounds.max.y-floorBounds.min.y+.8);
      common.surfaceArea.value.copy(common.causticArea.value);
      common.surfaceArea.value.z+=4;common.surfaceArea.value.w+=4;
      if(cacheSurface){renderer.setRenderTarget(surfaceTarget);renderer.render(surfaceScene,camera);}
      waterMaterial.uniforms.viewProjection.value.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
      waterMaterial.uniforms.inverseViewProjection.value.copy(waterMaterial.uniforms.viewProjection.value).invert();
      let shadowChanged=!shadowArea.equals(common.causticArea.value);
      for(const item of shadowCopies){
        if(!item.copy.matrix.equals(item.source.matrixWorld))shadowChanged=true;
        item.copy.matrix.copy(item.source.matrixWorld);
      }
      // Resting glass casts the same shadow; ambient surface waves do not require another geometry pass.
      if(shadowChanged && common.showGlass.value>0){
        shadowArea.copy(common.causticArea.value);
        renderer.setRenderTarget(shadowTarget);renderer.setClearColor(0x000000);renderer.clear();renderer.render(shadowScene,camera);
      }
      renderer.setRenderTarget(caustics);
      renderer.setClearColor(0x000000);renderer.clear();
      renderer.render(lightScene,camera);
      // Once the title leaves the viewport the water can shade its floor directly.
      // Avoid the geometry/transmission pass while visitors explore the rest of the world.
      if(common.showGlass.value>0){
        water.visible=false;
        renderer.setRenderTarget(submerged);
        renderer.setClearColor(0xb9cadf);renderer.clear();
        renderer.render(scene,camera);
        water.visible=true;
      }
      // Only draw the water for the final image: its refraction target contains the floor and glass.
      floor.visible=false;gltf.scene.visible=false;
      if(common.showGlass.value>0){
        renderer.setRenderTarget(refracted);renderer.render(scene,camera);
        renderer.setRenderTarget(null);renderer.render(resolveScene,camera);
      }else{
        // The continuous water has no silhouette edges needing FXAA. Shade directly
        // to the display, avoiding an HDR write and full-screen resolve during reading.
        renderer.setRenderTarget(null);renderer.render(scene,camera);
      }
      floor.visible=true;gltf.scene.visible=common.showGlass.value>0;
      diagnostics?.endGpu();
      diagnostics?.rendered(renderer.info.render,renderer.getPixelRatio());
    };
    const positionCamera=()=>{
      const progress=scrollY/Math.max(1,heroHeight);
      const journey=showTitle?journeyState(scrollY,heroHeight,contactTop,viewHeight):{depth:.65,returnLight:0};
      const depth=journey.depth;
      common.returnLight.value=journey.returnLight;
      const fitDistance=Math.max(6.6,4.2/(Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*camera.aspect));
      camera.position.set(viewX*.20,-.55+viewY*.13,fitDistance-depth*.15);
      camera.lookAt(viewX*.025,.1+viewY*.025,-.4);
      const worldHeight=2*(fitDistance+.4)*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5));
      gltf.scene.position.y=.25+Math.min(scrollY/Math.max(1,viewHeight),1.8)*worldHeight;
      common.immersion.value=depth;
      common.showGlass.value=showTitle&&progress<1.25?1:0;
      if(depth!==publishedDepth){root.style.setProperty('--world-depth',depth.toFixed(3));publishedDepth=depth;}
    };
    let compactLayout:boolean|undefined;
    const applyRenderSize=()=>{
      diagnostics?.resetSamples();
      const base=Math.min(devicePixelRatio,2,Math.sqrt(3200000/(viewWidth*viewHeight)));
      // Keep at least one physical pixel per CSS pixel. First spend quality savings
      // on the floor seen through glass and caustics, rather than blurring silhouettes.
      renderer.setPixelRatio(Math.max(Math.min(1,base),base*(.85+.15*quality.scale)));
      renderer.transmissionResolutionScale=.5*quality.scale;
      renderer.setSize(viewWidth,viewHeight);
      const size=renderer.getDrawingBufferSize(new THREE.Vector2());
      if(showTitle){
        submerged.setSize(size.x,size.y);
        refracted.setSize(size.x,size.y);resolveUniforms.resolution.value.set(1/size.x,1/size.y);
      }
      const side=Math.round(640*quality.scale);
      caustics.setSize(side,side);
      if(debug)renderer.domElement.dataset.waterQuality=String(quality.scale);
    };
    const resize=()=>{
      viewWidth=host.clientWidth;viewHeight=host.clientHeight;heroHeight=heroSection?.offsetHeight??viewHeight;
      contactTop=contactSection?contactSection.getBoundingClientRect().top+scrollY:Number.POSITIVE_INFINITY;
      const compact=viewWidth<600;
      if(compactLayout!==compact){
        compactLayout=compact;
        for(const item of meshes){
          const firstLine=item.mesh.name.startsWith('line1_');
          const scale=compact&&firstLine?1.45:1;
          item.mesh.scale.copy(item.originalScale).multiplyScalar(scale);
          item.home.copy(item.originalHome);
          if(compact&&firstLine){item.home.x*=scale;item.home.y=.52;}
          item.mesh.position.copy(item.home);item.velocity.set(0,0);
          item.width=item.originalWidth*scale;item.height=item.originalHeight*scale;
        }
      }

      applyRenderSize();quality.resetSamples();previousTime=0;
      camera.aspect=viewWidth/viewHeight;
      camera.fov=viewWidth<600?49:39;
      camera.updateProjectionMatrix();
      positionCamera();render();
    };
    const frameLoop=(now:number)=>{
      frame=0;
      if(dead||paused||offscreen||document.hidden)return;
      mode=held||now-lastActivity<2200||meshes.some(item=>item.velocity.lengthSq()>.0004)?'active':'idle';
      if(!presentation.due(now,mode)){frame=requestAnimationFrame(frameLoop);return;}
      const frameMs=now-(previousTime||now);
      const dt=Math.min(frameMs/1000,.04);previousTime=now;
      // Resize every dependent target together; physics stays independent of render quality.
      if(quality.sample(mode,frameMs))applyRenderSize();
      const cpuStart=performance.now();
      time+=dt;common.time.value=time;
      const flow=current.advance(dt);
      currentClock+=dt;
      if(Math.abs(flow)>.012 && currentClock>=1/30){
        const step=Math.min(currentClock,.05);
        for(const x of [-3,0,3])addWake(field,x,0,0,-flow*4,step);
        currentClock=0;
      }
      if(common.showGlass.value>0){
      for(const item of meshes){
        const p=item.mesh.getWorldPosition(bodyPosition);
        const response=waveResponse(field,p.x,p.y,item.mass);
        if(item!==held){item.velocity.x+=response.ax*dt;item.velocity.y+=(response.ay-flow*.65)*dt;}
        const desired=item===held?target:item.home;
        for(const axis of ['x','y'] as const){
          const next=advanceSpring(item.mesh.position[axis],item.velocity[axis],desired[axis],dt,(item===held?900:9)/item.mass,(item===held?60:4.8)/Math.sqrt(item.mass));
          item.mesh.position[axis]=next.position;item.velocity[axis]=next.velocity;
        }
        const spin=advanceSpring(item.mesh.rotation.z,item.spinVelocity,0,dt,9/item.mass,3.8/Math.sqrt(item.mass));
        item.mesh.rotation.z=clamp(spin.position,.5);item.spinVelocity=spin.velocity;
        item.mesh.getWorldPosition(p);
        addBodyWake(field,p.x,p.y,item.velocity.x*1.65,item.velocity.y*1.65,item.width*gltf.scene.scale.x,dt);
        const ambient=surfaceHeight(field,p.x,p.y,time)-field.sample(p.x,p.y)*2.2;
        const lift=advanceSpring(item.mesh.position.z,item.liftVelocity,item.home.z+response.lift+ambient*.75+(item===held?.065:0),dt,44,7.5);
        item.mesh.position.z=lift.position;item.liftVelocity=lift.velocity;
        for(const axis of ['x','y'] as const){
          const angle=advanceSpring(item.mesh.rotation[axis],item.tiltVelocity[axis],axis==='x'?response.tiltX:response.tiltY,dt,32,9);
          item.mesh.rotation[axis]=angle.position;item.tiltVelocity[axis]=angle.velocity;
        }
      }
      for(let a=0;a<meshes.length;a++)for(let b=a+1;b<meshes.length;b++){
        const impact=resolveContact(meshes[a],meshes[b],dt,held);
        if(impact>.02){const p=meshes[a].mesh.getWorldPosition(bodyPosition);field.disturb(p.x,p.y,-Math.min(.15,impact*.08),.3);}
      }
      }
      if(field.advance(dt))updateField();
      const follow=1-Math.exp(-dt*12);
      viewX+=(orbitX-viewX)*follow;viewY+=(orbitY-viewY)*follow;
      positionCamera();camera.updateMatrixWorld();common.projectFocus.value=worldMotion.update(dt,time,flow);render();
      diagnostics?.frame(mode,now,performance.now()-cpuStart);
      if(debug&&now-lastResponseReport>250){
        renderer.domElement.dataset.waterResponse=JSON.stringify({
          displacement:Math.max(0,...meshes.map(item=>item.mesh.position.distanceTo(item.home))),
          tilt:Math.max(0,...meshes.map(item=>Math.hypot(item.mesh.rotation.x,item.mesh.rotation.y))),
          mode,current:flow,immersion:common.immersion.value,
        });
        lastResponseReport=now;
      }
      frame=requestAnimationFrame(frameLoop);
    };
    const start=()=>{if(!frame&&!paused&&!offscreen&&!dead&&!document.hidden){previousTime=0;presentation.reset();quality.resetSamples();frame=requestAnimationFrame(frameLoop);}};
    const locate=(event:PointerEvent)=>{
      cursor.set(event.clientX/viewWidth*2-1,1-event.clientY/viewHeight*2);
      ray.setFromCamera(cursor,camera);
      return ray.ray.intersectPlane(plane,hit);
    };
    const isControl=(event:PointerEvent)=>event.target instanceof Element && !!event.target.closest('[data-water-controls]');
    const isLink=(event:PointerEvent)=>event.target instanceof Element && !!event.target.closest('a,button,summary,input,textarea,select');
    const pick=()=>{
      const objects=meshes.map(item=>item.mesh);
      // Exposed faces are reached before entering water. Starting the ray below
      // their surface would put it inside a front-sided mesh and miss the hit.
      const direct=ray.intersectObjects(objects,false)[0];
      if(direct && direct.point.z>=surfaceHeight(field,direct.point.x,direct.point.y,time)){
        return meshes.find(item=>item.mesh===direct.object);
      }
      const e=.025;
      const n=new THREE.Vector3(surfaceHeight(field,hit.x-e,hit.y,time)-surfaceHeight(field,hit.x+e,hit.y,time),surfaceHeight(field,hit.x,hit.y-e,time)-surfaceHeight(field,hit.x,hit.y+e,time),2*e).normalize();
      const bent=refractDirection(ray.ray.direction.toArray(),n.toArray());
      if(bent)ray.set(new THREE.Vector3(hit.x,hit.y,surfaceHeight(field,hit.x,hit.y,time)),new THREE.Vector3(...bent));
      const picked=ray.intersectObjects(objects,false)[0];
      return meshes.find(x=>x.mesh===picked?.object);
    };
    const move=(event:PointerEvent)=>{
      if(paused||document.hidden||isControl(event)||(event.pointerType==='touch'&&!touchPlay)||!locate(event))return;
      if(pointerId!==undefined && event.pointerId!==pointerId)return;
      const surfaceDragging=worldMotion.pointer(event);
      const now=performance.now();lastActivity=now;
      orbitX=cursor.x;orbitY=cursor.y;
      const ax=momentum.x,ay=momentum.y;
      if(momentum.sample(hit.x,hit.y,now))disturbStroke(field,ax,ay,hit.x,hit.y,Math.hypot(momentum.vx,momentum.vy));
      if(held){
        target.copy(hit);gltf.scene.worldToLocal(target);target.add(offset);
        target.x=clamp(target.x,2.6);target.y=clamp(target.y,1.5);
      }else if(!surfaceDragging && now-hoverClock>50){
        root.dataset.waterHover=String(common.showGlass.value>0&&!isLink(event)&&!!pick());
        hoverClock=now;
      }
    };
    const down=(event:PointerEvent)=>{
      if(paused||document.hidden||event.button!==0||isControl(event)||(event.pointerType==='touch'&&!touchPlay)||!locate(event))return;
      if(pointerId!==undefined)return;
      lastActivity=performance.now();
      momentum.reset();momentum.sample(hit.x,hit.y,lastActivity);
      splash(field,hit.x,hit.y);worldMotion.down(event);
      if(common.showGlass.value>0&&!isLink(event))held=pick();
      if(held){
        target.copy(hit);gltf.scene.worldToLocal(target);offset.copy(held.mesh.position).sub(target);target.copy(held.mesh.position);
        pointerId=event.pointerId;root.setPointerCapture(event.pointerId);
        root.dataset.waterDragging='true';
        if(debug)renderer.domElement.dataset.held=held.mesh.name;
      }
    };
    const release=(throwLetter=false)=>{
      if(held){
        const velocity=throwLetter?momentum.release(performance.now(),held.mass):{x:0,y:0};
        held.velocity.set(velocity.x/gltf.scene.scale.x,velocity.y/gltf.scene.scale.y);
        held.spinVelocity=throwLetter?clamp((offset.x*velocity.y-offset.y*velocity.x)*1.7,2):0;
        if(throwLetter){
          const p=held.mesh.getWorldPosition(bodyPosition);
          splash(field,p.x,p.y,.45+Math.min(.8,Math.hypot(velocity.x,velocity.y)*.22));
          held.liftVelocity=-.28;
        }
      }
      if(pointerId!==undefined&&root.hasPointerCapture(pointerId))root.releasePointerCapture(pointerId);
      pointerId=undefined;held=undefined;momentum.reset();
      delete renderer.domElement.dataset.held;delete root.dataset.waterDragging;
    };
    const up=(event:PointerEvent)=>{worldMotion.up(event);if(event.pointerId===pointerId)release(true);};
    const cancel=()=>{release();worldMotion.cancel();worldMotion.leave();delete root.dataset.waterHover;};
    const leave=()=>{if(!held)momentum.reset();worldMotion.leave();delete root.dataset.waterHover;orbitX=orbitY=0;};
    const visibility=()=>{
      cancel();current.reset();cancelAnimationFrame(frame);frame=0;
      worldMotion.setActive(!paused&&!document.hidden);
      if(document.hidden)diagnostics?.stopped('hidden');else start();
    };
    const scroll=()=>{
      const change=scrollY-lastScroll;lastScroll=scrollY;
      if(!paused)current.add(change,innerHeight);
      lastActivity=performance.now();
      if(held)release();worldMotion.cancel();
      const bounds=root.getBoundingClientRect();
      const hidden=bounds.bottom<=0||bounds.top>=innerHeight;
      if(hidden!==offscreen){offscreen=hidden;cancelAnimationFrame(frame);frame=0;if(hidden){cancel();diagnostics?.stopped('offscreen');}else start();}
      positionCamera();if(paused&&!offscreen)render();
    };
    let selected=0;
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){cancel();return;}
      if(meshes.length===0)return;
      if(event.key==='['||event.key===']'){
        selected=(selected+(event.key===']'?1:meshes.length-1))%meshes.length;
      }else if(event.key.startsWith('Arrow')){
        event.preventDefault();if(paused)return;
        const item=meshes[selected];
        item.velocity.x+=event.key==='ArrowLeft'?-1.4:event.key==='ArrowRight'?1.4:0;
        item.velocity.y+=event.key==='ArrowDown'?-1.4:event.key==='ArrowUp'?1.4:0;
        lastActivity=performance.now();
      }
    };
    const lost=(event:Event)=>{event.preventDefault();dispose();unavailable();};
    const dispose=()=>{
      if(dead)return;dead=true;release();resizeObserver.disconnect();
      window.removeEventListener('scroll',scroll);window.removeEventListener('blur',cancel);
      document.removeEventListener('visibilitychange',visibility);
      root.removeEventListener('pointermove',move);root.removeEventListener('pointerdown',down);
      root.removeEventListener('pointerup',up);root.removeEventListener('pointercancel',cancel);root.removeEventListener('lostpointercapture',cancel);root.removeEventListener('pointerleave',leave);
      delete root.dataset.waterHover;delete root.dataset.waterDragging;root.style.removeProperty('--world-depth');
      (heroSection??root).style.removeProperty('touch-action');
      renderer.domElement.removeEventListener('webglcontextlost',lost);renderer.domElement.removeEventListener('keydown',key);cleanup();
    };
    const resizeObserver=new ResizeObserver(resize);
    renderer.domElement.style.touchAction='pan-y';
    renderer.domElement.style.cursor='crosshair';
    renderer.domElement.tabIndex=0;
    renderer.domElement.setAttribute('role','img');
    renderer.domElement.setAttribute('aria-label',showTitle?'Interactive glass lettering. Arrow keys move a letter. Left and right brackets select another letter. Motion controls follow.':'Interactive water. Motion controls follow.');
    host.appendChild(renderer.domElement);
    root.addEventListener('pointermove',move,{passive:true});root.addEventListener('pointerdown',down,{passive:true});
    root.addEventListener('pointerup',up);root.addEventListener('pointercancel',cancel);root.addEventListener('lostpointercapture',cancel);root.addEventListener('pointerleave',leave);
    renderer.domElement.addEventListener('webglcontextlost',lost);renderer.domElement.addEventListener('keydown',key);
    document.addEventListener('visibilitychange',visibility);window.addEventListener('blur',cancel);window.addEventListener('scroll',scroll,{passive:true});
    resizeObserver.observe(host);resizeObserver.observe(root);resize();scroll();start();
    return {
      dispose,
      pause(value:boolean){paused=value;if(value)common.projectFocus.value=0;release();delete root.dataset.waterHover;current.reset();worldMotion.setActive(!value);cancelAnimationFrame(frame);frame=0;if(value)diagnostics?.stopped('paused');start();},
      wave(){if(paused)return;lastActivity=performance.now();splash(field,0,-.7);},
      touch(value:boolean){touchPlay=value;release();(heroSection??root).style.touchAction=value?'none':'pan-y';},
      reset(){release();current.reset();common.projectFocus.value=0;worldMotion.reset();orbitX=0;orbitY=0;viewX=0;viewY=0;positionCamera();time=0;common.time.value=0;field.reset();updateField();for(const item of meshes){item.mesh.position.copy(item.home);item.mesh.rotation.set(0,0,0);item.velocity.set(0,0);item.liftVelocity=0;item.spinVelocity=0;item.tiltVelocity.set(0,0);}render();},
      capture(){render();return renderer.domElement.toDataURL('image/png');},
    };
  } catch(error) {cleanup();throw error;}
}
