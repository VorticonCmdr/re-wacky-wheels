import { atmosphereLight } from '../time-of-day.js';

export function panoramaPixels(world) {
  const pixels=new Uint8Array(1280*20*4);
  for(let i=0;i<Math.min(world.par?.length??0,1280*20);i++) {
    const index=world.par[i];
    for(let c=0;c<3;c++)pixels[i*4+c]=world.palette[index*3+c]*255/63;
    // The archive reserves the upper palette ramp for sky behind the skyline.
    pixels[i*4+3]=index>=230?0:255;
  }
  return pixels;
}

export function createVoxelSky(gl) {
  const vertex=`#version 300 es
  out vec2 uv;
  void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
  const fragment=`#version 300 es
  precision highp float;
  in vec2 uv;out vec4 result;
  uniform sampler2D panorama;
  uniform bool mirrored;
  uniform vec2 forward,screen;
  uniform vec3 sky,tint;
  uniform float night,dusk,time,cap;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
  void main(){
   vec2 viewUV=vec2(uv.x,mirrored?1.-uv.y:uv.y);
   float side=(viewUV.x-.5)*screen.x/277.;
   vec2 ray=normalize(forward+vec2(-forward.y,forward.x)*side);
   float angle=atan(ray.x,ray.y)/6.2831853;
   float elevation=(.5-viewUV.y)*200./277.;
   float high=clamp(elevation*3.,0.,1.);
   vec3 color=mix(sky*1.16,sky*vec3(.46,.62,.85),high);
   color+=vec3(.22,.075,.025)*dusk*exp(-abs(elevation)*12.);
   // Stars live in angular sky coordinates: turning moves them continuously.
   vec2 star=vec2(angle*420.,elevation*300.);
   vec2 cell=floor(star),local=fract(star)-vec2(.2+.6*hash(cell+2.),.2+.6*hash(cell+7.));
   float light=1.-smoothstep(.025,.12,length(local));
   float visible=step(.985,hash(cell))*smoothstep(.02,.16,elevation)*night;
   color+=vec3(.78,.86,1.)*light*visible*(.75+.25*sin(time*.65+hash(cell)*30.));
   vec2 clouds=vec2(angle*18.,elevation*10.);
   float cloud=noise(clouds+vec2(time*.006,0.))*.65+noise(clouds*2.7)*.35;
   float veil=smoothstep(.57,.77,cloud)*smoothstep(.01,.09,elevation);
   color=mix(color,mix(vec3(.92,.95,1.),vec3(.09,.115,.19),night),veil*.55);
   // Panorama repeats with heading, remains at infinity, and sits behind geometry.
   float row=(viewUV.y-.40)/.10;
   if(row>=0.){
    vec4 ridge=texture(panorama,vec2(fract(angle+.5),min(row,1.)));
    vec3 horizon=ridge.rgb*tint*mix(.85,.30,night);
    color=mix(color,horizon,ridge.a*(1.-smoothstep(.82,1.,row)));
   }
   result=vec4(min(color,vec3(cap)),1.);
  }`;
  const program=gl.createProgram();
  for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]) {
    const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(`Voxel sky: ${gl.getShaderInfoLog(shader)}`);
    gl.attachShader(program,shader);gl.deleteShader(shader);
  }
  gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(`Voxel sky: ${gl.getProgramInfoLog(program)}`);
  const uniforms=Object.fromEntries(['mirrored','panorama','forward','screen','sky','tint','night','dusk','time','cap'].map(n=>[n,gl.getUniformLocation(program,n)]));
  const texture=gl.createTexture(),vao=gl.createVertexArray();let current=null;
  return {draw(scene,frame,w,h,mirrored=false){
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
    if(current!==scene.world){
      current=scene.world;gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,1280,20,0,gl.RGBA,gl.UNSIGNED_BYTE,panoramaPixels(current));
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    }
    const look=atmosphereLight(frame.atmosphere),grade=frame.atmosphere?.grade,strength=frame.atmosphere?.gradeStrength??1;
    gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.useProgram(program);gl.bindVertexArray(vao);
    gl.uniform1i(uniforms.mirrored,mirrored?1:0);gl.uniform1i(uniforms.panorama,0);gl.uniform2fv(uniforms.forward,scene.forward);gl.uniform2f(uniforms.screen,w/(h/200),200);
    gl.uniform3fv(uniforms.sky,look.skyColor);gl.uniform3fv(uniforms.tint,look.tint);
    gl.uniform1f(uniforms.night,(grade==='night'?1:grade==='dusk'?.25:0)*strength);
    gl.uniform1f(uniforms.dusk,['dawn','dusk','sunset'].includes(grade)?strength:0);
    gl.uniform1f(uniforms.time,(scene.time??0)/1000);gl.uniform1f(uniforms.cap,frame.cap/255);
    gl.drawArrays(gl.TRIANGLES,0,3);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);
  }};
}
