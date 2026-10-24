import { createTrackAntialias } from './antialias.js';
import { outsideTerrain } from './terrain-outside.js';
import { createVoxelSky } from './sky.js';
import { PARTICLE_SURFACES } from './particle-surface.js';
import { trackTerrain } from './terrain.js';
import { bubbleMesh, diveFragments } from './dive-effects.js';
import { kartLampGlows } from './lamp-glow.js';
import { kartTaillights } from './taillights.js';
import { createHeadlightShadowTarget, inHeadlightRange, HEADLIGHT_TILE, HEADLIGHT_COLUMNS } from './headlight-shadows.js';
import { MAX_WAKES, wakeUniforms, wakeField } from './wakes.js';
import { TRACK_CAMERA } from './kart-scale.js';
import { atmosphereLight } from '../time-of-day.js';
import { kartHeadlights, MAX_HEADLIGHTS } from './headlights.js';
import { createReflectionTarget, REFLECTION_HEIGHT } from './reflections.js';
import { waterSurface, splashFragments, wakeSprays } from './water.js';
import { starterMeshes } from './start.js';
import { weaponMeshes, weaponVisuals, fireballGlows } from './weapons.js';
import { impactFragments } from './impacts.js';
import { collectionPose } from './collection.js';
import { pickupPose } from './pickup-motion.js';
import { trackTexture, spritePixels } from './track.js';
import { sceneryMesh, SCENERY_NAMES } from './scenery.js';
import { voxelMesh } from './mesh.js';
import { lightingPreset } from './lighting.js';

const WAKE_GLSL = `
// Shared uniforms must match precision across vertex and fragment stages.
uniform highp int wakeCount;
uniform vec4 wakeCenters[${MAX_WAKES}], wakeDirections[${MAX_WAKES}];
float wakeHeight(vec2 point,float kind) {
 float height=0.;
 for(int i=0;i<${MAX_WAKES};i++) {
  if(i>=wakeCount)break;
  vec4 e=wakeCenters[i], dir=wakeDirections[i];
  if(abs(dir.z-kind)>.5)continue;
  vec2 delta=point-e.xy;
  float along=dot(delta,dir.xy),side=dot(delta,vec2(-dir.y,dir.x));
  float age=e.z*(kind>1.5?.65:1.),radius=1.+age*10.;
  if(abs(side)>radius+2.4 || abs(along)*.8>radius+2.4)continue;
  float ring=length(vec2(side,along*.8))-radius;
  float packet=max(0.,1.-abs(ring)/2.4);
  float trailing=1.-e.w*clamp((along+1.)/4.,0.,1.);
  height+=sin(ring*1.3)*packet*packet*trailing*e.w*.5*max(0.,1.-e.z/1.8);
 }
 return clamp(height,-.6,.6);
}`;

const VERT = `#version 300 es
precision highp float;
${WAKE_GLSL}
layout(location=0) in vec3 position;
layout(location=1) in vec3 normal;
layout(location=2) in vec3 color;
layout(location=3) in float ao;
uniform vec3 camera, origin, pivot, sun, partOffset, partTint, partStretch;
uniform float partScale, waterTime;
uniform bool waterPass, reflectionPass;
uniform float waterLevel, waveAmount;
uniform bool headlightDepthPass;
uniform vec3 shadowLight;
uniform vec2 shadowForward;
uniform vec2 forward, angles, screen, kartTilt;
uniform float yaw, units, shadowGround;
uniform bool shadow, groundMesh;
out vec3 tint, norm;
out float ambient, distance;
out vec2 uv;
out vec4 reflectionClip;
out float sourceHeight;
out vec3 worldPoint;
vec4 projectPoint(vec3 point) {
 vec3 d=point-camera;
 float right=dot(d.xz,vec2(-forward.y,forward.x)), ahead=dot(d.xz,forward);
 float pitch=${TRACK_CAMERA.pitch.toFixed(8)};
 float z=ahead*cos(pitch)-d.y*sin(pitch), up=d.y*cos(pitch)+ahead*sin(pitch);
 float near=1., far=4096.;
 return vec4(right*554./screen.x,-up*554./screen.y,(far+near)/(far-near)*z-2.*far*near/(far-near),z);
}
void main() {
 float c=cos(yaw),s=sin(yaw),rc=cos(angles.x),rs=sin(angles.x),sc=cos(angles.y),ss=sin(angles.y);
 mat3 turn=groundMesh?mat3(1.):mat3(-c,0.,s,0.,1.,0.,s,0.,c);
 mat3 wheel=mat3(sc,0.,-ss,0.,1.,0.,ss,0.,sc)*mat3(1.,0.,0.,0.,rc,rs,0.,-rs,rc);
 float pc=cos(kartTilt.x),ps=sin(kartTilt.x),bc=cos(kartTilt.y),bs=sin(kartTilt.y);
  mat3 body=mat3(bc,bs,0.,-bs,bc,0.,0.,0.,1.)*mat3(1.,0.,0.,0.,pc,ps,0.,-ps,pc);
 vec3 p=origin+turn*body*(wheel*((position-pivot)*partScale*partStretch)+pivot+partOffset)*units;
 norm=turn*body*wheel*normal; tint=color*partTint; ambient=ao; uv=color.xy;
 if(waterPass) {
  float t=waterTime*(color.z>1.5?.45:1.);
  float a=p.x*.09+p.z*.045+t*1.7, b=p.z*.13-p.x*.035-t*1.25;
  p.y=.12+ao*(.7+.35*sin(a)+.22*cos(b));
  norm=normalize(vec3(-ao*(.0315*cos(a)+.0077*sin(b)),1.,-ao*(.01575*cos(a)-.0286*sin(b))));
  float wake=wakeHeight(p.xz,color.z);
  p.y=max(.12,p.y+ao*wake);
  norm=normalize(norm+vec3(-ao*(wakeHeight(p.xz+vec2(1.,0.),color.z)-wake),0.,-ao*(wakeHeight(p.xz+vec2(0.,1.),color.z)-wake)));
  p.y=position.y+mix(.12,p.y,waveAmount);
  ambient=1.;
 }
 if(shadow) { p.xz-=sun.xz/max(sun.y,.05)*(p.y-shadowGround); p.y=shadowGround+.06; }
 sourceHeight=p.y;
 worldPoint=p;
 reflectionClip=projectPoint(vec3(p.x,(${REFLECTION_HEIGHT}+waterLevel),p.z));
 if(reflectionPass)p.y=2.*(${REFLECTION_HEIGHT}+waterLevel)-p.y;
 gl_Position=projectPoint(p);
 if(headlightDepthPass) {
  vec3 d=p-shadowLight; float z=dot(d.xz,shadowForward);
  gl_Position=vec4(dot(d.xz,vec2(-shadowForward.y,shadowForward.x))/.5,d.y/.7,561./559.*z-560./559.,z);
 }
 distance=gl_Position.w;
}`;
const FRAG = `#version 300 es
precision highp float;
${WAKE_GLSL}
in vec3 tint,norm;
in float ambient,distance;
in vec2 uv;
in vec4 reflectionClip;
in float sourceHeight;
in vec3 worldPoint;
uniform highp int headlightCount;
uniform bool headlightDepthPass, headlightShadowsOn;
uniform bool lampGlowPass;
uniform vec3 lampGlowColor;
uniform sampler2D headlightDepth;
uniform vec4 headlightOrigins[${MAX_HEADLIGHTS}], headlightDirections[${MAX_HEADLIGHTS}];
uniform sampler2D image, liquidMask, reflectionImage;
uniform vec3 atmosphereTint, skyColor;
uniform bool waterPass, reflectionPass, reflectionsOn;
uniform float waterLevel;
uniform vec2 forward;
uniform vec3 camera;
uniform int material;
uniform bool shadow;
uniform vec3 sun;
uniform vec4 light;
uniform float cap,exposure,shadowStrength,emission,opacity;
out vec4 result;
float headlightVisibility(int i,vec3 point,float ahead) {
 if(!headlightShadowsOn)return 1.;
 vec4 lamp=headlightOrigins[i],beam=headlightDirections[i];
 vec3 d=point-lamp.xyz;
 vec2 uv=vec2(dot(d.xz,vec2(-beam.y,beam.x))/.5,d.y/.7)/ahead*.5+.5;
 if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return 1.;
 float depth=(561./559.-560./559./ahead)*.5+.5;
 ivec2 tile=ivec2(i%4,i/4)*256;
 ivec2 at=ivec2(uv*256.); float visible=0.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++) {
  float stored=texelFetch(headlightDepth,tile+clamp(at+ivec2(x,y),ivec2(0),ivec2(255)),0).r;
  visible+=depth-.00008<=stored?1.:0.;
 }
 return visible/9.;
}
vec3 headlights(vec3 point,vec3 normal) {
 float energy=0.;
 for(int i=0;i<${MAX_HEADLIGHTS};i++) {
  if(i>=headlightCount)break;
  vec4 lamp=headlightOrigins[i],beam=headlightDirections[i];
  vec2 delta=point.xz-lamp.xz;
  float ahead=dot(delta,beam.xy);
  if(ahead<=0. || ahead>=beam.z || point.y>lamp.y+4.)continue;
  float side=abs(dot(delta,vec2(-beam.y,beam.x))),width=4.+ahead*beam.w;
  float cone=1.-smoothstep(width*.55,width,side);
  float reach=1.-smoothstep(beam.z*.4,beam.z,ahead);
  float surface=max(0.,dot(normal,normalize(lamp.xyz-point)));
  if(cone>0.)energy+=headlightVisibility(i,point,ahead)*lamp.w*cone*reach*smoothstep(0.,5.,ahead)*(.35+.65*surface);
 }
 return vec3(1.,.91,.72)*min(energy,1.5);
}
void main() {
 if(headlightDepthPass) { result=vec4(0.);return; }
 if(reflectionPass && sourceHeight<(${REFLECTION_HEIGHT}+waterLevel))discard;
 if(lampGlowPass) {
  float radius=length(uv*2.-1.);
  float face=smoothstep(0.,.35,dot(normalize(norm),normalize(camera-worldPoint)));
  float halo=pow(max(0.,1.-radius*radius),3.);
  result=vec4(lampGlowColor*cap,halo*opacity*face);return;
 }
 if(shadow) { result=vec4(.10,.13,.18,shadowStrength); return; }
 vec4 base=material==0?vec4(tint,1.):texture(image,uv);
 if(base.a<.5) discard;
 vec4 liquidData=texture(liquidMask,uv);
 float liquid=liquidData.r*255.;
 float waterDepth=liquidData.g*32.;
 float surfaceAlpha=opacity;
 if(waterPass&&liquid<1.5&&waterDepth>0.)base.rgb=mix(vec3(.20,.53,.64),vec3(.045,.17,.29),smoothstep(2.,12.,waterDepth));
 if(waterPass && liquid<.5) discard;
 vec3 n=normalize(norm), l=normalize(sun);
 vec3 fill=mix(vec3(.42,.36,.30),vec3(.64,.80,1.),n.y*.5+.5)*light.y*mix(1.,ambient,light.z);
 vec3 direct=vec3(1.,.88,.70)*light.x*max(dot(n,l),0.);
 vec3 color=pow(max(pow(base.rgb,vec3(2.2))*(fill+direct)*exposure,vec3(0.)),vec3(1./2.2));
 color=mix(color*atmosphereTint,base.rgb,emission);
 color+=base.rgb*headlights(worldPoint,n)*(1.-emission);
 if(waterPass) {
  vec3 point=vec3(1024.+uv.x*2048.,worldPoint.y,1024.+uv.y*2048.);
  vec3 eye=normalize(camera-point), halfLight=normalize(eye+l);
  float fresnel=pow(1.-max(dot(n,eye),0.),3.);
  if(liquid<1.5&&waterDepth>0.)surfaceAlpha=clamp(.28+.65*smoothstep(2.,12.,waterDepth)+.28*fresnel,0.,1.);
  vec3 reflected=liquid>1.5?vec3(.73,.29,.12)*atmosphereTint:skyColor;
  if(reflectionsOn && reflectionClip.w>0.) {
   vec2 refUV=reflectionClip.xy/reflectionClip.w*.5+.5;
   refUV+=vec2(dot(n.xz,vec2(-forward.y,forward.x)),dot(n.xz,forward))*.035;
   float edge=smoothstep(0.,.025,min(min(refUV.x,refUV.y),min(1.-refUV.x,1.-refUV.y)));
   if(edge>0.) {
    vec4 object=texture(reflectionImage,refUV);
    // Linear filtering against transparent clear premultiplies edge colours.
    vec3 objectColor=object.rgb/max(object.a,.001);
    reflected=mix(reflected,objectColor,object.a*edge);
   }
  }
  color=mix(color,reflected,reflectionsOn?.22+.42*fresnel:.16+.28*fresnel);
  color+=vec3(1.,.89,.70)*pow(max(dot(n,halfLight),0.),75.)*light.x*.65;
  float wakeFoam=clamp(abs(wakeHeight(point.xz,liquid))*2.2,0.,.55);
  color=mix(color,liquid>1.5?vec3(1.,.68,.30):vec3(.82,.94,.98),wakeFoam);
  float shore=min(min(texture(liquidMask,uv+vec2(.001,0)).r,texture(liquidMask,uv-vec2(.001,0)).r),
                  min(texture(liquidMask,uv+vec2(0,.001)).r,texture(liquidMask,uv-vec2(0,.001)).r));
  if(shore<.002)color=mix(color,liquid>1.5?vec3(.95,.60,.25):vec3(.78,.88,.88),.28);
 }
 float haze=smoothstep(700.,2400.,distance);
 result=vec4(min(mix(color,skyColor,haze),vec3(cap)),surfaceAlpha);
}`;

// One depth buffer and camera for ground, moving articulated karts, props and
// temporary billboards. Resources are rebuilt only when the loaded track changes.
export function createTrackPass(gl) {
 let skyPass=null;
 const antialias=createTrackAntialias(gl);
 const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s));return s;};
 const p=gl.createProgram(), vs=shader(gl.VERTEX_SHADER,VERT), fs=shader(gl.FRAGMENT_SHADER,FRAG);
 gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);gl.deleteShader(vs);gl.deleteShader(fs);
 if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(p));
 const u=Object.fromEntries(['shadowGround','waterLevel','waveAmount','lampGlowPass','lampGlowColor','headlightDepthPass','headlightShadowsOn','headlightDepth','shadowLight','shadowForward','headlightCount','headlightOrigins[0]','headlightDirections[0]','atmosphereTint','skyColor','wakeCount','wakeCenters[0]','wakeDirections[0]','reflectionPass','reflectionsOn','reflectionImage','waterPass','waterTime','liquidMask','kartTilt','opacity','partStretch','partOffset','partTint','partScale','emission','groundMesh','camera','origin','pivot','sun','forward','angles','screen','yaw','units','shadow','image','material','light','cap','exposure','shadowStrength'].map(n=>[n,gl.getUniformLocation(p,n)]));
 const reflectionTarget=createReflectionTarget(gl), headlightTarget=createHeadlightShadowTarget(gl);
 const fbo=gl.createFramebuffer(), depth=gl.createRenderbuffer(), meshes=new Map(), textures=new Map();
 let world=null, ground=null, water=null, props=new Map(), scenerySource=null, terrainSource=undefined, width=0,height=0;
 const texture=(key,w,h,pixels)=>{
  if(textures.has(key)) return textures.get(key);
  const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  for(const k of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D,k,gl.NEAREST);
  for(const k of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D,k,gl.CLAMP_TO_EDGE);
  if(key==='ground')gl.generateMipmap(gl.TEXTURE_2D);
  textures.set(key,t);return t;
 };
 const quad=(points,normal)=>{
  const vertices=[];
  for(const i of [0,1,2,0,2,3]) vertices.push(...points[i].slice(0,3),...normal,...points[i].slice(3),0,1);
  return {vertices:new Float32Array(vertices),count:6,parts:[{first:0,count:6,pivot:[0,0,0]}]};
 };
 const skidQuad={vertices:new Float32Array([-1,-1,1,-1,1,1,-1,-1,1,1,-1,1].flatMap((_,i,a)=>i%2?[]:[a[i]/2,0,a[i+1]/2,0,1,0,.08,.085,.09,1])),count:6,parts:[{first:0,count:6,pivot:[0,0,0]}]};
 const puffCells=[];for(let x=0;x<3;x++)for(let y=0;y<3;y++)for(let z=0;z<3;z++)if((x-1)**2+(y-1)**2+(z-1)**2<=2)puffCells.push([x,y,z,177,181,185]);
 const dirtMeshes=Object.fromEntries(Object.entries(PARTICLE_SURFACES).map(([key,style])=>[key,{
  dust:voxelMesh({size:3,voxels:puffCells.map(v=>[...v.slice(0,3),...style.dust])}),
  chunk:voxelMesh({size:1,voxels:[[0,0,0,...style.chunk]]}),
 }]));
 const smokeMesh=voxelMesh({size:3,voxels:puffCells});
 const waterDrop=voxelMesh({size:1,voxels:[[0,0,0,150,217,244]]});
 const redDrop=voxelMesh({size:1,voxels:[[0,0,0,240,136,62]]});
 const foamCube=voxelMesh({size:1,voxels:[[0,0,0,219,240,245]]});
 const sparkCube=voxelMesh({size:1,voxels:[[0,0,0,255,230,120]]});
 const woodCube=voxelMesh({size:1,voxels:[[0,0,0,151,99,51]]});
 const bubble=bubbleMesh();
 const metalCube=voxelMesh({size:1,voxels:[[0,0,0,110,130,148]]});
 const collectionCube=voxelMesh({size:1,voxels:[[0,0,0,255,205,70]]});
 const starters=starterMeshes();
 const weaponSets={studio:weaponMeshes('studio'),procedural:weaponMeshes('procedural')};
 const billboard=quad([[-.5,1,0,0,0],[.5,1,0,1,0],[.5,0,0,1,1],[-.5,0,0,0,1]],[0,0,-1]);
 const bind=mesh=>{
  let g=meshes.get(mesh);
  if(!g){g={vao:gl.createVertexArray(),buffer:gl.createBuffer()};meshes.set(mesh,g);gl.bindVertexArray(g.vao);gl.bindBuffer(gl.ARRAY_BUFFER,g.buffer);gl.bufferData(gl.ARRAY_BUFFER,mesh.vertices,gl.STATIC_DRAW);
   for(let a=0;a<3;a++){gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,40,a*12);}gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,1,gl.FLOAT,false,40,36);
  } else gl.bindVertexArray(g.vao);
 };
 const draw=(mesh,position,yaw,units,wheels=null,animation=null)=>{
  gl.uniform1f(u.shadowGround,terrainSource?(terrainSource.waterAt(position[0],position[2])?(terrainSource.waterLevelAt?.(position[0],position[2])??terrainSource.waterLevel):terrainSource.heightAt(position[0],position[2])):0);
  bind(mesh);gl.uniform2fv(u.kartTilt,animation?.tilt??[0,0]);gl.uniform3fv(u.origin,position);gl.uniform1f(u.yaw,yaw);gl.uniform1f(u.units,units);
  for(const part of mesh.parts){
   const pose=pickupPose(part.animation,animation?.time??0,animation?.phase??0);
   gl.uniform1f(u.opacity,animation?.opacity??1);gl.uniform3fv(u.partStretch,animation?.stretch??[1,1,1]);
   gl.uniform3fv(u.pivot,part.pivot);gl.uniform3fv(u.partOffset,pose.offset);gl.uniform3fv(u.partTint,pose.tint);
   gl.uniform1f(u.partScale,pose.scale);gl.uniform1f(u.emission,Math.max(pose.emission,animation?.emission??0,part.emission??0));
   gl.uniform2f(u.angles,part.wheel?wheels?.spin??0:pose.angles[0],part.head?animation?.head??0:part.front?wheels?.steer??0:pose.angles[1]);
   gl.drawArrays(gl.TRIANGLES,part.first,part.count);
  }
 };
 return {draw(target,w,h,frame){
  const scene=frame.scene, weapons=weaponSets[scene.weapons??'studio'], look=lightingPreset(frame.lighting);
  gl.activeTexture(gl.TEXTURE0);
  if(world!==scene.world){
   for(const t of textures.values()) gl.deleteTexture(t);textures.clear();
   for(const g of meshes.values()){gl.deleteBuffer(g.buffer);gl.deleteVertexArray(g.vao);}meshes.clear();
   world=scene.world;props=new Map();scenerySource=null;terrainSource=undefined;
  }
  const terrain=scene.terrain!==false?trackTerrain(world):null;
  const exterior=outsideTerrain(world,terrain);
  if(terrainSource!==terrain) {
   terrainSource=terrain;
   for(const key of ['ground','liquid']){if(textures.has(key))gl.deleteTexture(textures.get(key));textures.delete(key);}
   ground=terrain?.mesh??quad([[1024,0,1024,0,0],[3072,0,1024,1,0],[3072,0,3072,1,1],[1024,0,3072,0,1]],[0,1,0]);
   const pixels=trackTexture(world);
   if(terrain)for(let z=0;z<2048;z++)for(let x=0;x<2048;x++) {
    const h=terrain.heightAt(x+1024,z+1024),i=(z*2048+x)*4;
    if(terrain.waterAt(x+1024,z+1024)===1&&(terrain.waterLevelAt?.(x+1024,z+1024)??-8)>-1){
      const grain=((x*73+z*151+(x^z)*31)%17)-8;
      pixels.set([192+grain,163+grain,108+grain,255],i);
    }
    else if(h<-8&&String(world.name)==='1')pixels.set([32,91,115,255],i);
    else if(h<0&&h>=-8&&String(world.name)==='1')pixels.set([110,97,65,255],i);
    else if(h===1.5){const c=((x>>3)+(z>>3))%2?204:54;pixels.set([c,c,c,255],i);}
   }
   texture('ground',2048,2048,pixels);
   water=waterSurface(world,terrain);texture('liquid',2048,2048,water.pixels);
  }
  const surfaceAt=(x,z)=>terrain?(terrain.waterAt(x,z)?(terrain.waterLevelAt?.(x,z)??terrain.waterLevel):terrain.heightAt(x,z)):0;
  if(scenerySource!==(scene.scenery??'procedural')) {
   scenerySource=scene.scenery??'procedural';
   for(const id of new Set(world.objects.map(o=>o.id))) {
    const sprite=world.sprites[id];
    if(SCENERY_NAMES.includes(sprite.name.toUpperCase())) {
     const mesh=sceneryMesh(world,sprite,scenerySource);
     if(mesh) props.set(id,mesh); else props.delete(id); // Procedural comparison retains the original pickup billboards.
    }
   }
  }
  const beams=kartHeadlights(scene.racers,frame.atmosphere,scene.headlights!==false);
  const glows=[...kartLampGlows(scene.racers,frame.atmosphere,scene),...fireballGlows(scene.shots,scene.time??0,scene.forward)];
  const rearLights=kartTaillights(scene.racers,scene.taillights!==false);
  // Retire replaced kart uploads without discarding reusable track meshes.
  const live=new Set([exterior,bubble,ground,water.mesh,waterDrop,redDrop,foamCube,billboard,skidQuad,smokeMesh,...Object.values(dirtMeshes).flatMap(m=>[m.dust,m.chunk]),...Object.values(weaponSets).flatMap(Object.values),...starters,collectionCube,sparkCube,woodCube,metalCube,...props.values(),...scene.racers.map(r=>r.mesh),...(scene.accessories??[]).map(r=>r.mesh),...beams.solids.map(r=>r.mesh),...rearLights.map(r=>r.mesh),...glows.map(r=>r.mesh)]);
  for(const [mesh,g] of meshes) if(!live.has(mesh)){gl.deleteBuffer(g.buffer);gl.deleteVertexArray(g.vao);meshes.delete(mesh);}
  if(w!==width||h!==height){width=w;height=h;gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,w,h);}
  gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);
  const multisample=scene.reduceShimmer!==false?antialias.ensure(w,h):null,mainFbo=multisample??fbo;
  gl.bindFramebuffer(gl.FRAMEBUFFER,mainFbo);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,textures.get('ground'));
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,scene.reduceShimmer!==false?gl.NEAREST_MIPMAP_LINEAR:gl.NEAREST);
  gl.viewport(0,0,w,h);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.depthMask(true);gl.clearDepth(1);
  const atmosphere=atmosphereLight(frame.atmosphere);
  gl.clearColor(...atmosphere.skyColor.map(v=>v*frame.cap/255),1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  if(scene.richSky!==false){skyPass??=createVoxelSky(gl);skyPass.draw(scene,frame,w,h);}
  gl.useProgram(p);
  gl.uniform1i(u.lampGlowPass,0);
  gl.uniform1i(u.headlightDepthPass,0);gl.uniform1i(u.headlightShadowsOn,0);gl.uniform1i(u.headlightDepth,4);
  gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,textures.get('ground'));gl.activeTexture(gl.TEXTURE0);
  const wakeEvents=scene.water!=='flat'?(scene.wakes??[]):[], wakeData=wakeUniforms(wakeEvents);
  gl.uniform1i(u.wakeCount,wakeData.count);gl.uniform4fv(u['wakeCenters[0]'],wakeData.centers);gl.uniform4fv(u['wakeDirections[0]'],wakeData.directions);
  gl.uniform1f(u.waterLevel,water.level??0);gl.uniform1f(u.waveAmount,scene.water==='flat'?0:1);
  gl.uniform1i(u.reflectionPass,0);gl.uniform1i(u.reflectionsOn,0);gl.uniform1i(u.reflectionImage,2);gl.uniform1i(u.waterPass,0);gl.uniform1f(u.waterTime,(scene.time??0)/1000);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,textures.get('liquid'));gl.uniform1i(u.liquidMask,1);gl.activeTexture(gl.TEXTURE0);
  gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,textures.get('ground'));gl.activeTexture(gl.TEXTURE0);
  gl.uniform3fv(u.camera,scene.camera);gl.uniform2fv(u.forward,scene.forward);gl.uniform2f(u.screen,w/(h/200),200);
  gl.uniform3fv(u.atmosphereTint,atmosphere.tint);gl.uniform3fv(u.skyColor,atmosphere.skyColor);
  gl.uniform3fv(u.sun,scene.sun);gl.uniform4f(u.light,look.sun*atmosphere.sun,look.sky*atmosphere.sky,look.ao,look.gloss);gl.uniform1f(u.exposure,look.exposure);gl.uniform1f(u.shadowStrength,look.shadow);gl.uniform1f(u.cap,frame.cap/255);gl.uniform1i(u.image,0);gl.uniform1i(u.shadow,0);
  const solids=[...scene.racers,...(scene.accessories??[]), ...weaponVisuals(scene.shots,scene.time??0,weapons)];
  gl.uniform1i(u.headlightCount,beams.count);gl.uniform4fv(u['headlightOrigins[0]'],beams.origins);gl.uniform4fv(u['headlightDirections[0]'],beams.directions);
  solids.push(...beams.solids,...rearLights);
  if(scene.starter) {
   const s=scene.starter, mesh=starters[s.light];
   // Face the starting grid, in the same physical envelope as the original lion.
   const yaw=s.yaw;
   solids.push({mesh,position:[s.x,0,s.y],yaw,units:124/277*Math.min(38/mesh.bounds[0],28/mesh.bounds[1])});
  }
  for(const o of scene.objects){
   if(o.consumed===65535||o.consumed===-1) continue;
   const mesh=props.get(o.id);
   if(mesh) {
    const sprite=world.sprites[o.id];
    const fit=Math.min(sprite.width/mesh.bounds[0],sprite.height/mesh.bounds[1]);
    solids.push({mesh,position:[o.x,surfaceAt(o.x,o.y),o.y],yaw:0,units:124/277*fit,animation:{time:scene.time??0,phase:(o.x+o.y)*.017}});
   }
  }
  for(const event of scene.collections??[]) {
   const mesh=props.get(event.id);
   if(!mesh) continue; // Original pickup billboards retain their comparison behavior.
   const sprite=world.sprites[event.id], pose=collectionPose(event.progress);
   const fit=Math.min(sprite.width/mesh.bounds[0],sprite.height/mesh.bounds[1]);
   solids.push({mesh,position:[event.x,pose.height,event.y],yaw:pose.yaw,units:124/277*fit*pose.scale,
    animation:{time:event.time,phase:(event.x+event.y)*.017}});
   for(let n=0;n<8;n++) {
    const angle=n*Math.PI/4, t=event.progress, radius=3+14*t;
    solids.push({mesh:collectionCube,position:[event.x+Math.cos(angle)*radius,2+18*t-14*t*t,event.y+Math.sin(angle)*radius],
     yaw:angle+t*4,units:1.8*(1-t)});
   }
  }
  for(const event of scene.impacts??[]) for(const fragment of impactFragments(event)) {
   solids.push({...fragment,mesh:fragment.spark?sparkCube:fragment.material==='wood'?woodCube:metalCube,
    noShadow:fragment.spark,animation:{emission:fragment.spark?1:0}});
  }
  if(scene.water!=='flat')for(const event of [...(scene.splashes??[]),...wakeSprays(wakeEvents)])for(const part of splashFragments(event)) {
   if(part.foam&&!water.at(part.position[0],part.position[2]))continue;
   if(!part.foam)part.position[1]+=water.heightAt(event.x,event.y,scene.time??0);
   if(part.foam)part.position[1]=water.heightAt(part.position[0],part.position[2],scene.time??0,(x,z,kind)=>wakeField(wakeEvents,x,z,kind))+.035;
   solids.push({...part,mesh:event.kind===2?redDrop:part.foam?foamCube:waterDrop,noShadow:true,animation:{stretch:part.stretch}});
  }
  if(beams.count && scene.headlightShadows!==false) {
   const target=headlightTarget.ensure();
   // Never leave the attached depth texture bound to a sampler while writing it.
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,textures.get('ground'));
   if(target) {
    gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.uniform1i(u.headlightDepthPass,1);gl.uniform1i(u.groundMesh,0);gl.uniform1i(u.material,0);
    for(let i=0;i<beams.count;i++) {
     const origin=beams.origins.subarray(i*4,i*4+3),direction=beams.directions.subarray(i*4,i*4+4);
     gl.viewport((i%HEADLIGHT_COLUMNS)*HEADLIGHT_TILE,Math.floor(i/HEADLIGHT_COLUMNS)*HEADLIGHT_TILE,HEADLIGHT_TILE,HEADLIGHT_TILE);
     gl.uniform3fv(u.shadowLight,origin);gl.uniform2fv(u.shadowForward,direction.subarray(0,2));
     if(terrain){gl.uniform1i(u.groundMesh,1);draw(ground,[0,0,0],0,1);gl.uniform1i(u.groundMesh,0);}
     for(const object of solids)if(inHeadlightRange(object,origin,direction))draw(object.mesh,object.position,object.yaw,object.units,object.wheels,object.animation);
    }
    gl.uniform1i(u.headlightDepthPass,0);gl.uniform1i(u.headlightShadowsOn,1);
    gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,target.texture);gl.activeTexture(gl.TEXTURE0);
   }
   gl.bindFramebuffer(gl.FRAMEBUFFER,mainFbo);gl.viewport(0,0,w,h);
  }
  // A separate depth-tested image of mirrored, fully articulated geometry.
  // Neither water nor this texture is drawn into itself.
  if(scene.water!=='flat' && scene.reflections!==false && water.mesh.count) {
   const target=reflectionTarget.ensure(w,h);
   gl.bindTexture(gl.TEXTURE_2D,textures.get('ground'));
   if(target) {
    gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);gl.viewport(0,0,target.width,target.height);
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    if(scene.richSky!==false){
     skyPass??=createVoxelSky(gl);skyPass.draw(scene,frame,target.width,target.height,true);
     gl.useProgram(p);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,textures.get('ground'));
    }
    gl.uniform1i(u.reflectionPass,1);gl.uniform1i(u.groundMesh,0);gl.uniform1i(u.material,0);
    if(terrain){gl.uniform1i(u.groundMesh,1);gl.uniform1i(u.material,1);draw(ground,[0,0,0],0,1);gl.uniform1i(u.groundMesh,0);gl.uniform1i(u.material,0);}
    if(exterior){gl.uniform1i(u.groundMesh,1);draw(exterior,[0,0,0],0,1);gl.uniform1i(u.groundMesh,0);}
    for(const o of solids)draw(o.mesh,o.position,o.yaw,o.units,o.wheels,o.animation);
    gl.uniform1i(u.reflectionPass,0);
    gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,target.texture);gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(u.reflectionsOn,1);
   }
   gl.bindFramebuffer(gl.FRAMEBUFFER,mainFbo);gl.viewport(0,0,w,h);
  }
  gl.uniform1i(u.groundMesh,1);gl.uniform1i(u.material,1);gl.bindTexture(gl.TEXTURE_2D,textures.get('ground'));draw(ground,[0,0,0],0,1);
  if(exterior){gl.uniform1i(u.material,0);draw(exterior,[0,0,0],0,1);gl.uniform1i(u.material,1);}
  if((terrain||scene.water!=='flat') && water.mesh.count) {
   gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
   gl.uniform1i(u.waterPass,1);draw(water.mesh,[0,0,0],0,1);gl.uniform1i(u.waterPass,0);
   gl.disable(gl.BLEND);
  }
  gl.uniform1i(u.groundMesh,0);
  gl.uniform1i(u.material,0);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
  for(const mark of scene.tyres?.marks??[]) {
   const dx=mark.b[0]-mark.a[0],dz=mark.b[1]-mark.a[1];
   draw(skidQuad,[(mark.a[0]+mark.b[0])/2,.035,(mark.a[1]+mark.b[1])/2],Math.atan2(dx,dz),1,null,
    {opacity:mark.alpha,stretch:[mark.width,1,Math.hypot(dx,dz)+.1]});
  }
  gl.disable(gl.BLEND);gl.depthMask(true);
  gl.uniform1i(u.material,0);
  // Planar silhouettes use the same articulated geometry and world-space sun.
  // Depth-writing prevents repeated faces from accumulating shadow opacity.
  gl.uniform1i(u.shadow,1);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  for(const o of solids) if(!o.noShadow) draw(o.mesh,o.position,o.yaw,o.units,o.wheels,o.animation);
  gl.disable(gl.BLEND);gl.uniform1i(u.shadow,0);
  for(const o of solids) draw(o.mesh,o.position,o.yaw,o.units,o.wheels,o.animation);
  gl.uniform1i(u.material,1);
  const facing=Math.atan2(scene.forward[0],scene.forward[1]);
  for(const o of scene.objects){
   if(o.consumed===65535||o.consumed===-1||props.has(o.id)) continue;
   const sprite=world.sprites[o.id], key=`${o.id}:${o.frame}`;
   gl.bindTexture(gl.TEXTURE_2D,texture(key,sprite.width,sprite.height,spritePixels(world,sprite,o.frame)));
   // Preserve the source aspect ratio in the billboard's mesh.
   const keyMesh=`billboard:${o.id}`;
   if(!props.has(keyMesh)) {const vertices=billboard.vertices.slice();for(let i=0;i<vertices.length;i+=10){vertices[i]*=sprite.width;vertices[i+1]*=sprite.height;}props.set(keyMesh,{...billboard,vertices});}
   draw(props.get(keyMesh),[o.x,surfaceAt(o.x,o.y),o.y],facing,124/277);
  }
  gl.uniform1i(u.material,0);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
  const diveParts=(scene.water==='flat'?[]:(scene.diveEffects??[]).flatMap(diveFragments))
    .filter(p=>water.at(p.position[0],p.position[2])===1)
    .sort((a,b)=>(b.position[0]-a.position[0])*scene.forward[0]+(b.position[2]-a.position[2])*scene.forward[1]);
  for(const part of diveParts) {
   const [x,y,z]=part.position;
   const surface=water.heightAt(x,z,scene.time??0,(wx,wz,kind)=>wakeField(wakeEvents,wx,wz,kind));
   draw(part.bubble?bubble:part.foam?foamCube:waterDrop,[x,surface+y,z],part.yaw,part.units,null,
     {opacity:part.opacity,stretch:part.stretch});
  }
  const dirt=[...(scene.dirt??[])].sort((a,b)=>(b.x-a.x)*scene.forward[0]+(b.z-a.z)*scene.forward[1]);
  for(const p of dirt) {
   const material=p.material??'dirt',style=PARTICLE_SURFACES[material],meshes=dirtMeshes[material];
   const seconds=p.age*1.1,x=p.x+p.vx*seconds*style.drift,z=p.z+p.vz*seconds*style.drift;
   const floor=surfaceAt(x,z);
   if(water.at(x,z))continue;
   draw(meshes.dust,[x,Math.max(floor+.2,p.height+.3+seconds*style.rise),z],p.seed,
     (.35+p.age*(.8+p.strength*.5))*style.size,null,{opacity:.23*(1-p.age)});
   if(seconds<.55) {
    const lift=(5+p.strength*5)*seconds-style.gravity*seconds*seconds;
    draw(material==='grass'&&p.seed%2===0?dirtMeshes.dirt.chunk:meshes.chunk,[x,Math.max(floor+.15,p.height+.2+lift),z],p.seed+seconds*7,
      (.35+p.strength*.3)*style.size,null,{stretch:material==='grass'&&p.seed%2?[.6,.3,1.5]:[1,1,1],opacity:Math.min(1,(.55-seconds)*8),tilt:[seconds*5,seconds*3]});
   }
  }
  const smoke=[...(scene.tyres?.smoke??[])].sort((a,b)=>(b.x-a.x)*scene.forward[0]+(b.y-a.y)*scene.forward[1]);
  for(const puff of smoke){const t=puff.age;draw(smokeMesh,[puff.x+Math.sin(puff.phase)*t*2,.4+5*t,puff.y+Math.cos(puff.phase)*t*2],puff.phase,.5+t*1.1,null,{opacity:.24*(1-t)});}
  // Soft additive lamp halos use the same poses and physical scale as lenses.
  // Depth testing keeps obstacles in front; no depth writes or shadow casting.
  gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.uniform1i(u.lampGlowPass,1);
  for(const glow of glows) {
   gl.uniform3fv(u.lampGlowColor,glow.color);
   draw(glow.mesh,glow.position,glow.yaw,glow.units,null,glow.animation);
  }
  gl.uniform1i(u.lampGlowPass,0);
  gl.depthMask(true);gl.disable(gl.BLEND);
  if(multisample)antialias.resolve(fbo);
  gl.disable(gl.DEPTH_TEST);gl.bindVertexArray(null);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.activeTexture(gl.TEXTURE0);
 }};
}
