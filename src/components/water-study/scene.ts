import * as THREE from 'three';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createHeroDiagnostics } from '../playground/hero-diagnostics';
import { WaterField } from '../playground/water-field';
import { surfaceHeight, refractDirection } from './surface';
import { encodeOpticalField } from './field-texture';
import { waveResponse, addWake } from './dynamics';
import { resolveContact } from '../playground/contact';
import { RenderBudget, type RenderMode } from '../playground/render-budget';
import { advanceSpring } from '../playground/spring';
import { createStudyEnvironment } from './environment';
import { causticVertex, causticFragment, floorVertex, floorFragment, waterVertex, waterFragment } from './optics';

export async function createWaterStudy(host: HTMLElement, unavailable: () => void) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
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
    const gltf = await new GLTFLoader().loadAsync('/assets/hero/playground-glyphs.glb');
    const backdrop = await new THREE.TextureLoader().loadAsync('/assets/hero/reference-water-v1.webp');
    backdrop.colorSpace=THREE.SRGBColorSpace;backdrop.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());owned.push(backdrop);
    const environment = createStudyEnvironment(renderer,backdrop);
    owned.push(environment);
    const scene = new THREE.Scene();
    scene.environment = environment.texture;
    const camera = new THREE.PerspectiveCamera(39,1,.1,40);
    const extent = new THREE.Vector2(18,24);
    const field = new WaterField(192,256,false);
    field.resize(extent.x,extent.y);
    const opticalPixels=new Uint16Array(field.columns*field.rows*4);
    const texture = new THREE.DataTexture(opticalPixels,field.columns,field.rows,THREE.RGBAFormat,THREE.HalfFloatType);
    const updateField=()=>{encodeOpticalField(field,extent.x,extent.y,opticalPixels);texture.needsUpdate=true;};
    texture.minFilter=texture.magFilter=THREE.LinearFilter;
    texture.needsUpdate=true;
    owned.push(texture);
    const common = {backdrop:{value:backdrop},backdropProjection:{value:new THREE.Matrix4()},backdropCrop:{value:new THREE.Vector2(1,1)},field:{value:texture},extent:{value:extent},time:{value:0},causticArea:{value:new THREE.Vector4(0,0,18,24)}};
    const hdrType=renderer.extensions.has('EXT_color_buffer_float')?THREE.HalfFloatType:THREE.UnsignedByteType;
    const caustics = new THREE.WebGLRenderTarget(640,640,{depthBuffer:false,type:hdrType,minFilter:THREE.LinearMipmapLinearFilter,generateMipmaps:true});
    const shadowTarget=new THREE.WebGLRenderTarget(512,512,{depthBuffer:true,minFilter:THREE.LinearMipmapLinearFilter,generateMipmaps:true});
    const shadowScene=new THREE.Scene();
    const shadowMaterial=new THREE.ShaderMaterial({
      uniforms:{causticArea:common.causticArea},
      vertexShader:`uniform vec4 causticArea; varying float edge;
        void main(){vec3 p=(modelMatrix*vec4(position,1.)).xyz;
        vec3 n=normalize(mat3(modelMatrix)*normal);edge=.16+.65*pow(1.-abs(n.z),2.);
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
    const grid = new THREE.PlaneGeometry(1,1);
    const causticMaterial = new THREE.ShaderMaterial({vertexShader:causticVertex,fragmentShader:causticFragment,uniforms:common,depthTest:false,depthWrite:false,toneMapped:false});
    const lightScene = new THREE.Scene();
    const projected = new THREE.Mesh(grid,causticMaterial);
    projected.frustumCulled=false;
    lightScene.add(projected);
    const floorMaterial = new THREE.ShaderMaterial({vertexShader:floorVertex,fragmentShader:floorFragment,uniforms:{...common,caustics:{value:caustics.texture},glassShadow:{value:shadowTarget.texture}}});
    const floorGeometry = new THREE.PlaneGeometry(extent.x,extent.y);
    const floor = new THREE.Mesh(floorGeometry,floorMaterial);
    floor.position.z=-2.1;
    scene.add(floor);
    const glass = new THREE.MeshPhysicalMaterial({color:0xffffff,metalness:0,roughness:.025,transmission:.96,thickness:1.35,ior:1.5,envMapIntensity:1.2,clearcoat:.35,clearcoatRoughness:.025,attenuationColor:new THREE.Color(0x829bc7),attenuationDistance:2.8});
    // Fine polishing undulations bend highlights without deforming the solid silhouette.
    glass.onBeforeCompile = shader => {
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
vec3 glassPoint=vViewPosition;
normal=normalize(normal+vec3(
  .008*sin(glassPoint.y*17.+sin(glassPoint.x*9.)),
  .008*sin(glassPoint.x*19.+sin(glassPoint.y*7.)),0.));
`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
// Approximate the longer optical path at grazing angles for the fixed-thickness mesh.
float grazingPath = 1. / max(abs(dot(normal,geometryViewDir)),.12) - 1.;
outgoingLight *= exp(-vec3(.32,.18,.065) * grazingPath * .52);
float shoulder=1.-abs(dot(normal,geometryViewDir));
float internalFold=.5+.5*sin(normal.x*6.+normal.y*4.+sin(normal.y*9.)*.2);
float foldedPath=pow(internalFold,5.)*(.35+.40*sqrt(shoulder));
outgoingLight*=mix(vec3(1.),vec3(.12,.25,.50),foldedPath);

\n#include <opaque_fragment>`);
    };
    const meshes: Array<{mesh:THREE.Mesh;home:THREE.Vector3;velocity:THREE.Vector2;mass:number;position:THREE.Vector3;width:number;height:number;originalHome:THREE.Vector3;originalScale:THREE.Vector3;originalWidth:number;originalHeight:number;liftVelocity:number;tiltVelocity:THREE.Vector2}> = [];
    const geometries=new Set<THREE.BufferGeometry>();
    gltf.scene.traverse(node=>{
      if(!(node instanceof THREE.Mesh))return;
      geometries.add(node.geometry);
      (Array.isArray(node.material)?node.material:[node.material]).forEach(m=>m.dispose());
      node.material=glass;
      const shadowCopy=new THREE.Mesh(node.geometry,shadowMaterial);shadowCopy.matrixAutoUpdate=false;shadowCopy.frustumCulled=false;
      shadowScene.add(shadowCopy);shadowCopies.push({source:node,copy:shadowCopy});
      const size=new THREE.Box3().setFromObject(node).getSize(new THREE.Vector3());
      meshes.push({position:node.position,width:size.x,height:size.y,originalHome:node.position.clone(),originalScale:node.scale.clone(),originalWidth:size.x,originalHeight:size.y,liftVelocity:0,tiltVelocity:new THREE.Vector2(),mesh:node,home:node.position.clone(),velocity:new THREE.Vector2(),mass:Math.max(.75,size.x*2.8)});
    });
    gltf.scene.position.set(0,.25,-.48);
    gltf.scene.rotation.z=0;
    gltf.scene.scale.set(1.70,1.78,1.25);
    scene.add(gltf.scene);
    const sun=new THREE.DirectionalLight(0xf4f7ff,2.2);
    sun.position.set(-2,2,10);scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xf5f8ff,0x7186ab,.35));
    const waterMaterial=new THREE.ShaderMaterial({vertexShader:waterVertex,fragmentShader:waterFragment,uniforms:{...common,caustics:{value:caustics.texture},glassShadow:{value:shadowTarget.texture},submerged:{value:submerged.texture},viewProjection:{value:new THREE.Matrix4()},inverseViewProjection:{value:new THREE.Matrix4()},submergedDepth:{value:submerged.depthTexture},viewMode:{value:debug&&new URLSearchParams(location.search).get('view')==='submerged'?1:0}}});
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
    const previous=new THREE.Vector3(100,100,0);
    let held: typeof meshes[number] | undefined;
    let pointerId:number|undefined;
    let touchPlay=false;
    let offscreen=false;
    let paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
    let previousTime=0;
    let time=0;
    let lastInput=0;
    let orbitX=0;
    let orbitY=0;
    let viewX=0, viewY=0;
    let lastActivity=performance.now();
    let mode:RenderMode='active';
    const budget=new RenderBudget();
    const bodyPosition=new THREE.Vector3();
    let lastPresentation=0;
    let lastResponseReport=0;
    const corner=new THREE.Vector3();
    const floorBounds=new THREE.Box2();
    const floorPoint=new THREE.Vector2();
    const render=()=>{
      renderer.info.reset();
      diagnostics?.beginGpu(mode);
      camera.updateMatrixWorld();
      gltf.scene.updateMatrixWorld(true);
      floorBounds.makeEmpty();
      for(let i=0;i<4;i++){
        corner.set(i&1?1:-1,i&2?1:-1,1).unproject(camera).sub(camera.position);
        corner.multiplyScalar((-2.1-camera.position.z)/corner.z).add(camera.position);
        floorBounds.expandByPoint(floorPoint.set(corner.x,corner.y));
      }
      common.causticArea.value.set((floorBounds.min.x+floorBounds.max.x)*.5,(floorBounds.min.y+floorBounds.max.y)*.5,floorBounds.max.x-floorBounds.min.x+.8,floorBounds.max.y-floorBounds.min.y+.8);
      common.backdropProjection.value.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
      waterMaterial.uniforms.viewProjection.value.copy(common.backdropProjection.value);
      waterMaterial.uniforms.inverseViewProjection.value.copy(waterMaterial.uniforms.viewProjection.value).invert();
      let shadowChanged=!shadowArea.equals(common.causticArea.value);
      for(const item of shadowCopies){
        if(!item.copy.matrix.equals(item.source.matrixWorld))shadowChanged=true;
        item.copy.matrix.copy(item.source.matrixWorld);
      }
      // Resting glass casts the same shadow; ambient surface waves do not require another geometry pass.
      if(shadowChanged){
        shadowArea.copy(common.causticArea.value);
        renderer.setRenderTarget(shadowTarget);renderer.setClearColor(0x000000);renderer.clear();renderer.render(shadowScene,camera);
      }
      renderer.setRenderTarget(caustics);
      renderer.setClearColor(0x000000);renderer.clear();
      renderer.render(lightScene,camera);
      water.visible=false;
      renderer.setRenderTarget(submerged);
      renderer.setClearColor(0xb9cadf);renderer.clear();
      renderer.render(scene,camera);
      water.visible=true;
      // Only draw the water for the final image: its refraction target contains the floor and glass.
      floor.visible=false;gltf.scene.visible=false;
      renderer.setRenderTarget(refracted);renderer.render(scene,camera);
      renderer.setRenderTarget(null);renderer.render(resolveScene,camera);
      floor.visible=true;gltf.scene.visible=true;
      diagnostics?.endGpu();
      diagnostics?.rendered(renderer.info.render,renderer.getPixelRatio());
    };
    const positionCamera=()=>{
      const depth=Math.min(1,scrollY/Math.max(1,innerHeight*.6));
      const fitDistance=Math.max(6.6,4.2/(Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*camera.aspect));
      camera.position.set(viewX*.05,-.55+viewY*.04-depth*.8,fitDistance-depth*.3);
      camera.lookAt(0,.1+depth*1.6,-.4);
    };
    let compactLayout:boolean|undefined;
    const resize=()=>{
      const compact=host.clientWidth<600;
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

      renderer.setPixelRatio(Math.min(devicePixelRatio,2,Math.sqrt(3200000/(host.clientWidth*host.clientHeight))));
      renderer.setSize(host.clientWidth,host.clientHeight);
      camera.aspect=host.clientWidth/host.clientHeight;
      common.backdropCrop.value.set(Math.min(1,camera.aspect/(1672/941)),Math.min(1,(1672/941)/camera.aspect));
      camera.fov=host.clientWidth<600?49:39;
      camera.updateProjectionMatrix();
      const size=renderer.getDrawingBufferSize(new THREE.Vector2());
      submerged.setSize(size.x,size.y);
      refracted.setSize(size.x,size.y);resolveUniforms.resolution.value.set(1/size.x,1/size.y);
      positionCamera();render();
    };
    const frameLoop=(now:number)=>{
      frame=0;
      if(dead||paused||offscreen||document.hidden)return;
      mode=held||now-lastActivity<2200||meshes.some(item=>item.velocity.lengthSq()>.0004)?'active':'idle';
      const interval=1000/(mode==='active'?60:30);
      if(now-lastPresentation<interval-.8){frame=requestAnimationFrame(frameLoop);return;}
      const frameMs=now-(previousTime||now);
      const dt=Math.min(frameMs/1000,.04);previousTime=now;lastPresentation=now;
      // Preserve letter/refraction resolution. Reduce only the out-of-focus caustic pass under load.
      if(budget.sample(mode,frameMs)&&caustics.width>384){const side=Math.max(384,Math.round(caustics.width*.8));caustics.setSize(side,side);}
      const cpuStart=performance.now();
      time+=dt;common.time.value=time;
      for(const item of meshes){
        const p=item.mesh.getWorldPosition(bodyPosition);
        const response=waveResponse(field,p.x,p.y,item.mass);
        if(item!==held){item.velocity.x+=response.ax*dt;item.velocity.y+=response.ay*dt;}
        const desired=item===held?target:item.home;
        for(const axis of ['x','y'] as const){
          const next=advanceSpring(item.mesh.position[axis],item.velocity[axis],desired[axis],dt,(item===held?48:7)/item.mass,(item===held?13:4.2)/Math.sqrt(item.mass));
          item.mesh.position[axis]=next.position;item.velocity[axis]=next.velocity;
        }
        item.mesh.getWorldPosition(p);
        addWake(field,p.x,p.y,item.velocity.x*1.65,item.velocity.y*1.65,dt);
        const lift=advanceSpring(item.mesh.position.z,item.liftVelocity,item.home.z+response.lift,dt,38,10);
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
      if(field.advance(dt))updateField();
      const follow=1-Math.exp(-dt*3.5);
      viewX+=(orbitX-viewX)*follow;viewY+=(orbitY-viewY)*follow;
      positionCamera();render();
      diagnostics?.frame(mode,now,performance.now()-cpuStart);
      if(debug&&now-lastResponseReport>250){
        renderer.domElement.dataset.waterResponse=JSON.stringify({
          displacement:Math.max(...meshes.map(item=>item.mesh.position.distanceTo(item.home))),
          tilt:Math.max(...meshes.map(item=>Math.hypot(item.mesh.rotation.x,item.mesh.rotation.y))),
          mode,
        });
        lastResponseReport=now;
      }
      frame=requestAnimationFrame(frameLoop);
    };
    const start=()=>{if(!frame&&!paused&&!offscreen&&!dead&&!document.hidden){previousTime=0;lastPresentation=0;budget.reset();frame=requestAnimationFrame(frameLoop);}};
    const locate=(event:PointerEvent)=>{
      const bounds=renderer.domElement.getBoundingClientRect();
      cursor.set((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);
      ray.setFromCamera(cursor,camera);
      return ray.ray.intersectPlane(plane,hit);
    };
    const move=(event:PointerEvent)=>{
      if(paused||(event.pointerType==='touch'&&!touchPlay)||!locate(event))return;
      lastActivity=performance.now();
      orbitX=cursor.x;orbitY=cursor.y;
      if(held){target.copy(hit);gltf.scene.worldToLocal(target);target.add(offset);target.x=THREE.MathUtils.clamp(target.x,-2.6,2.6);target.y=THREE.MathUtils.clamp(target.y,-1.5,1.5);}
      const now=performance.now();
      if(now-lastInput>22&&previous.distanceTo(hit)>.018){field.disturb(hit.x,hit.y,-.055,.32);lastInput=now;previous.copy(hit);}
    };
    const down=(event:PointerEvent)=>{
      if(paused||(event.pointerType==='touch'&&!touchPlay)||!locate(event))return;
      lastActivity=performance.now();
      const e=.025;
      const n=new THREE.Vector3(surfaceHeight(field,hit.x-e,hit.y,time)-surfaceHeight(field,hit.x+e,hit.y,time),surfaceHeight(field,hit.x,hit.y-e,time)-surfaceHeight(field,hit.x,hit.y+e,time),2*e).normalize();
      const bent=refractDirection(ray.ray.direction.toArray(),n.toArray());
      if(bent)ray.set(new THREE.Vector3(hit.x,hit.y,surfaceHeight(field,hit.x,hit.y,time)),new THREE.Vector3(...bent));
      const picked=ray.intersectObjects(meshes.map(x=>x.mesh),false)[0];
      held=meshes.find(x=>x.mesh===picked?.object);
      if(held){target.copy(hit);gltf.scene.worldToLocal(target);offset.copy(held.mesh.position).sub(target);target.copy(held.mesh.position);}
      pointerId=event.pointerId;
      renderer.domElement.setPointerCapture(event.pointerId);
      renderer.domElement.style.cursor=held?'grabbing':'crosshair';
      if(debug)renderer.domElement.dataset.held=held?.mesh.name??'';
      field.disturb(hit.x,hit.y,-.30,.48);
    };
    const release=()=>{
      if(pointerId!==undefined&&renderer.domElement.hasPointerCapture(pointerId))renderer.domElement.releasePointerCapture(pointerId);
      pointerId=undefined;held=undefined;delete renderer.domElement.dataset.held;renderer.domElement.style.cursor='crosshair';
    };
    const visibility=()=>{release();cancelAnimationFrame(frame);frame=0;start();};
    const scroll=()=>{
      lastActivity=performance.now();
      const hidden=host.getBoundingClientRect().bottom<=0;
      if(hidden!==offscreen){offscreen=hidden;cancelAnimationFrame(frame);frame=0;if(hidden){release();diagnostics?.stopped('offscreen');}else start();}
      positionCamera();if(paused&&!offscreen)render();
    };
    let selected=0;
    const key=(event:KeyboardEvent)=>{
      if(event.key==='['||event.key===']'){
        selected=(selected+(event.key===']'?1:meshes.length-1))%meshes.length;
      }else if(event.key.startsWith('Arrow')){
        event.preventDefault();if(paused)return;
        const item=meshes[selected];
        item.velocity.x+=event.key==='ArrowLeft'?-.7:event.key==='ArrowRight'?.7:0;
        item.velocity.y+=event.key==='ArrowDown'?-.7:event.key==='ArrowUp'?.7:0;
        lastActivity=performance.now();
      }
    };
    const lost=(event:Event)=>{event.preventDefault();dispose();unavailable();};
    const dispose=()=>{
      if(dead)return;dead=true;release();resizeObserver.disconnect();
      window.removeEventListener('scroll',scroll);window.removeEventListener('blur',release);
      document.removeEventListener('visibilitychange',visibility);
      renderer.domElement.removeEventListener('pointermove',move);renderer.domElement.removeEventListener('pointerdown',down);
      renderer.domElement.removeEventListener('pointerup',release);renderer.domElement.removeEventListener('pointercancel',release);
      renderer.domElement.removeEventListener('webglcontextlost',lost);renderer.domElement.removeEventListener('keydown',key);cleanup();
    };
    const resizeObserver=new ResizeObserver(resize);
    renderer.domElement.style.touchAction='pan-y';
    renderer.domElement.style.cursor='crosshair';
    renderer.domElement.tabIndex=0;
    renderer.domElement.setAttribute('role','img');
    renderer.domElement.setAttribute('aria-label','Interactive glass lettering. Arrow keys move a letter. Left and right brackets select another letter. Motion controls follow.');
    host.appendChild(renderer.domElement);
    renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerdown',down);
    renderer.domElement.addEventListener('pointerup',release);renderer.domElement.addEventListener('pointercancel',release);
    renderer.domElement.addEventListener('webglcontextlost',lost);renderer.domElement.addEventListener('keydown',key);
    document.addEventListener('visibilitychange',visibility);window.addEventListener('blur',release);window.addEventListener('scroll',scroll,{passive:true});
    resizeObserver.observe(host);resize();scroll();start();
    return {
      dispose,
      pause(value:boolean){paused=value;release();cancelAnimationFrame(frame);frame=0;if(value)diagnostics?.stopped('paused');start();},
      wave(){if(paused)return;lastActivity=performance.now();field.disturb(0,-.7,-.45,.55);},
      touch(value:boolean){touchPlay=value;release();renderer.domElement.style.touchAction=value?'none':'pan-y';},
      reset(){release();orbitX=0;orbitY=0;viewX=0;viewY=0;positionCamera();time=0;common.time.value=0;field.reset();updateField();for(const item of meshes){item.mesh.position.copy(item.home);item.mesh.rotation.set(0,0,0);item.velocity.set(0,0);item.liftVelocity=0;item.tiltVelocity.set(0,0);}render();},
      capture(){render();return renderer.domElement.toDataURL('image/png');},
    };
  } catch(error) {cleanup();throw error;}
}
