import { atmosphereLight } from '../time-of-day.js';
import { kartProjection, KART_PITCH, sunShadowSlope } from './shadows.js';
import { lightingPreset } from './lighting.js';
// Live surface meshes composed into the display's world texture before HUD/CRT.
// CPU scenery depth is in game units; the GPU depth attachment resolves mesh faces.
const VERT = `#version 300 es
precision highp float;
layout(location=0) in vec3 position;
layout(location=1) in vec3 normal;
layout(location=2) in vec3 color;
layout(location=3) in float occlusion;
uniform vec2 resolution, anchor;
uniform float yaw, pixels, distance, units, groundOffset;
uniform bool shadowMode;
uniform vec2 shadowSlope;
uniform float lift, waterOffset;
out float waterHeight;
uniform vec3 wheelPivot;
uniform vec2 wheelAngles, kartTilt;
out vec3 vColor;
out vec3 vNormal;
out float vAO;
out float vDistance;
void main() {
  float c=cos(yaw), s=sin(yaw);
  mat3 turn=mat3(c,0.,-s, 0.,1.,0., s,0.,c);
  float rc=cos(wheelAngles.x), rs=sin(wheelAngles.x);
  float sc=cos(wheelAngles.y), ss=sin(wheelAngles.y);
  mat3 roll=mat3(1.,0.,0., 0.,rc,rs, 0.,-rs,rc);
  mat3 steer=mat3(sc,0.,-ss, 0.,1.,0., ss,0.,sc);
  mat3 wheel=steer*roll;
  float pc=cos(kartTilt.x),ps=sin(kartTilt.x),bc=cos(kartTilt.y),bs=sin(kartTilt.y);
  mat3 body=mat3(bc,bs,0.,-bs,bc,0.,0.,0.,1.)*mat3(1.,0.,0.,0.,pc,ps,0.,-ps,pc);
  vec3 p=turn*body*(wheel*(position-wheelPivot)+wheelPivot), n=turn*body*wheel*normal;
  p.y+=waterOffset;waterHeight=p.y;
  float pitch=${KART_PITCH};
  if(shadowMode) { p.xz-=shadowSlope*(p.y+lift); p.y=0.; }
  float z=p.z*cos(pitch)-p.y*sin(pitch);
  vDistance=max(1.,distance+z*units);
  float perspective=distance/vDistance;
  vec2 screen=anchor+vec2(p.x, -p.y*cos(pitch)-p.z*sin(pitch)-groundOffset)*pixels*perspective;
  gl_Position=vec4(screen/resolution*2.-1., shadowMode?0.:vDistance/4096.*2.-1.,1.);
  vColor=color; vNormal=n; vAO=occlusion;
}`;
const FRAG = `#version 300 es
precision highp float;
uniform sampler2D scenery;
uniform float cap, fogAmount;
uniform bool shadowMode;
uniform float shadowOpacity;
uniform bool waterClip;
in float waterHeight;
uniform vec3 fogColor;
uniform vec3 atmosphereTint;
in vec3 vColor;
in vec3 vNormal;
in float vAO;
uniform vec3 sunVector;
uniform vec4 lighting;
uniform float exposure;
in float vDistance;
out vec4 result;
vec3 toLinear(vec3 c) {
  return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));
}
vec3 toDisplay(vec3 c) {
  c=max(c,vec3(0.));
  return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));
}
void main() {
  if(waterClip && waterHeight<0.)discard;
  if(shadowMode) { result=vec4(shadowOpacity); return; }
  float scene=texelFetch(scenery,ivec2(gl_FragCoord.xy),0).r;
  if(scene>0. && scene<vDistance-1.) discard;
  vec3 n=normalize(vNormal), sun=normalize(sunVector);
  float ao=mix(1.,vAO,lighting.z);
  vec3 fill=mix(vec3(.42,.36,.30),vec3(.64,.80,1.),n.y*.5+.5)*lighting.y*ao;
  vec3 direct=vec3(1.,.88,.70)*lighting.x*max(dot(n,sun),0.);
  vec3 halfVector=normalize(sun+normalize(vec3(0.,.34,-1.)));
  float highlight=pow(max(dot(n,halfVector),0.),24.)*lighting.w*max(dot(n,sun),0.)*ao;
  vec3 lit=(toLinear(vColor)*(fill+direct)+vec3(1.,.92,.80)*highlight)*exposure;
  // Gentle shoulder preserves bright paint detail without dimming midtones.
  lit=mix(lit,vec3(1.)-exp(-(lit-.8)*5.)*.2,step(vec3(.8),lit));
  vec3 displayColor=toDisplay(lit)*atmosphereTint;
  result=vec4(mix(min(displayColor,vec3(cap)),min(fogColor,vec3(cap)),fogAmount),1.);
}`;
// One union mask for all projected faces: overdraw never compounds darkness.
const QUAD = `#version 300 es
void main() {
  vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
  gl_Position=vec4(p*2.-1.,0.,1.);
}`;
const SHADOW_COMPOSITE = `#version 300 es
precision highp float;
uniform sampler2D mask, scenery;
uniform vec2 resolution;
uniform float radius;
out vec4 result;
void main() {
  // Sky, billboards and effects never receive a ground shadow.
  if(texelFetch(scenery,ivec2(gl_FragCoord.xy),0).r>=0.) discard;
  float coverage=0.;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++) {
    float weight=float((x==0?2:1)*(y==0?2:1));
    coverage+=texture(mask,(gl_FragCoord.xy+vec2(x,y)*radius)/resolution).r*weight;
  }
  result=vec4(0.,0.,0.,coverage/16.);
}`;
export function createVoxelPass(gl) {
  function shader(type, source) {
    const s=gl.createShader(type); gl.shaderSource(s,source); gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) { const message=gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(message); }
    return s;
  }
  function program(vertex, fragment) {
    const p=gl.createProgram(), vs=shader(gl.VERTEX_SHADER,vertex), fs=shader(gl.FRAGMENT_SHADER,fragment);
    gl.attachShader(p,vs); gl.attachShader(p,fs); gl.linkProgram(p); gl.deleteShader(vs); gl.deleteShader(fs);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  const p=program(VERT,FRAG), shadowProgram=program(QUAD,SHADOW_COMPOSITE);
  const shadowUniforms=Object.fromEntries(['mask','scenery','resolution','radius'].map(n=>[n,gl.getUniformLocation(shadowProgram,n)]));
  const shadowFbo=gl.createFramebuffer(), shadowTexture=gl.createTexture(), quad=gl.createVertexArray();
  gl.bindTexture(gl.TEXTURE_2D,shadowTexture);
  for(const k of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D,k,gl.LINEAR);
  for(const k of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D,k,gl.CLAMP_TO_EDGE);
  const names=['waterClip','waterOffset','atmosphereTint','resolution','anchor','yaw','pixels','distance','units','groundOffset','scenery','cap','fogAmount','fogColor','sunVector','lighting','exposure','shadowMode','shadowSlope','lift','shadowOpacity','wheelPivot','wheelAngles','kartTilt'];
  const u=Object.fromEntries(names.map(n=>[n,gl.getUniformLocation(p,n)]));
  const fbo=gl.createFramebuffer(), depth=gl.createRenderbuffer(), scenery=gl.createTexture(), cache=new Map();
  let width=0,height=0, values=null;
  gl.bindTexture(gl.TEXTURE_2D,scenery);
  for(const k of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D,k,gl.NEAREST);
  for(const k of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D,k,gl.CLAMP_TO_EDGE);
  return {
    draw(target,w,h,frame) {
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D,scenery);
      if(w!==width||h!==height) {
        width=w; height=h; values=new Float32Array(w*h);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.R32F,w,h,0,gl.RED,gl.FLOAT,null);
        gl.bindTexture(gl.TEXTURE_2D,shadowTexture);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,w,h,0,gl.RED,gl.UNSIGNED_BYTE,null);
        gl.bindTexture(gl.TEXTURE_2D,scenery);
        gl.bindRenderbuffer(gl.RENDERBUFFER,depth); gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,w,h);
      }
      // Negative marks floor receivers; positive is billboard occlusion depth.
      for(let i=0;i<values.length;i++) values[i]=frame.kind[i]===3?frame.depth[i]:frame.kind[i]===2?-1:0;
      gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,w,h,gl.RED,gl.FLOAT,values);
      gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target,0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);
      gl.viewport(0,0,w,h); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true); gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(p); gl.uniform2f(u.resolution,w,h); gl.uniform1i(u.scenery,3); gl.uniform1f(u.cap,frame.cap/255);
      const look=lightingPreset(frame.lighting), atmosphere=atmosphereLight(frame.atmosphere);
      gl.uniform3fv(u.atmosphereTint,atmosphere.tint);
      gl.uniform4f(u.lighting,look.sun*atmosphere.sun,look.sky*atmosphere.sky,look.ao,look.gloss); gl.uniform1f(u.exposure,look.exposure);
      const replacements=new Set(frame.items.map(item=>item.mesh));
      for(const [mesh,g] of cache) if(!replacements.has(mesh)) { gl.deleteVertexArray(g.vao); gl.deleteBuffer(g.buffer); cache.delete(mesh); }
      const drawMeshes = shadow => {
        gl.useProgram(p); gl.uniform1i(u.shadowMode,shadow?1:0);
        for(const item of frame.items) {
          const {mesh}=item;
          gl.uniform1i(u.waterClip,item.waterClip?1:0);gl.uniform1f(u.waterOffset,item.waterOffset??0);
          gl.uniform2fv(u.kartTilt,item.tilt??[0,0]);
          let g=cache.get(mesh);
          if(!g) {
            g={vao:gl.createVertexArray(),buffer:gl.createBuffer(),slot:item.slot}; cache.set(mesh,g);
            gl.bindVertexArray(g.vao); gl.bindBuffer(gl.ARRAY_BUFFER,g.buffer); gl.bufferData(gl.ARRAY_BUFFER,mesh.vertices,gl.STATIC_DRAW);
            for(let a=0;a<3;a++) { gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a,3,gl.FLOAT,false,40,a*12); }
            gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3,1,gl.FLOAT,false,40,36);
          } else gl.bindVertexArray(g.vao);
          const {pixels,groundOffset,units}=kartProjection(item);
          const fog=frame.fog, amount=fog?fog.ramp[Math.min(Math.max(Math.round(item.distance),0),fog.ramp.length-1)]:0;
          gl.uniform1f(u.fogAmount,amount); gl.uniform3fv(u.fogColor,fog?fog.color.map(v=>v/255):[0,0,0]);
          gl.uniform3fv(u.sunVector,item.sunVector ?? [-.5,1.,-.7]);
          gl.uniform2fv(u.shadowSlope,sunShadowSlope(item.sunVector ?? [-.5,1.,-.7]));
          gl.uniform1f(u.lift,Math.max(0,item.groundY-item.y)/(pixels*Math.cos(KART_PITCH)));
          gl.uniform1f(u.shadowOpacity,look.shadow*(1-amount));
          gl.uniform2f(u.anchor,item.x,shadow?item.groundY:item.y); gl.uniform1f(u.yaw,item.yaw); gl.uniform1f(u.pixels,pixels);
          gl.uniform1f(u.distance,item.distance); gl.uniform1f(u.units,units);
          gl.uniform1f(u.groundOffset,groundOffset);
          for(const part of mesh.parts) {
            gl.uniform3fv(u.wheelPivot,part.pivot);
            gl.uniform2f(u.wheelAngles,part.wheel ? item.wheels?.spin ?? 0 : 0,part.head ? item.head ?? 0 : part.front ? item.wheels?.steer ?? 0 : 0);
            gl.drawArrays(gl.TRIANGLES,part.first,part.count);
          }
        }
      };
      gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
      gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,shadowTexture,0);
      gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.blendEquation(gl.MAX); gl.blendFunc(gl.ONE,gl.ONE);
      drawMeshes(true);
      gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);
      gl.blendEquation(gl.FUNC_ADD); gl.blendFuncSeparate(gl.ZERO,gl.ONE_MINUS_SRC_ALPHA,gl.ZERO,gl.ONE);
      gl.useProgram(shadowProgram); gl.bindVertexArray(quad);
      gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D,shadowTexture);
      gl.uniform1i(shadowUniforms.mask,4); gl.uniform1i(shadowUniforms.scenery,3);
      gl.uniform2f(shadowUniforms.resolution,w,h);
      gl.uniform1f(shadowUniforms.radius,look.penumbra*(frame.items[0]?.scale??1));
      gl.drawArrays(gl.TRIANGLES,0,3);
      gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
      drawMeshes(false);
      gl.disable(gl.DEPTH_TEST); gl.bindVertexArray(null); gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.activeTexture(gl.TEXTURE0);
    },
  };
}
