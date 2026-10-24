import { classifyLiquids } from '../liquids.js';

const SIZE=2048, ORIGIN=1024, STEP=8;
const cache=new WeakMap();
// Reuse the game's tile/mask liquid classification, including warm red liquids.
// Exact texel clipping in the fragment shader keeps the coarse wave grid off roads.
export function waterSurface(world,terrain=null) {
  const key=terrain??world,level=terrain?.waterLevel??0;
  if(cache.has(key))return cache.get(key);
  const liquid=classifyLiquids(world), mask=new Uint8Array(SIZE*SIZE);
  if(liquid.any)for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++) {
    const id=world.tiles[(z>>5)*64+(x>>5)];
    mask[z*SIZE+x]=liquid.texels[id*1024+(z&31)*32+(x&31)];
  }
  if(terrain)for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++)mask[z*SIZE+x]=terrain.waterAt(x+ORIGIN,z+ORIGIN);
  const at=(x,z)=>x<0||z<0||x>=SIZE||z>=SIZE?0:mask[z*SIZE+x];
  const vertices=[],pixels=new Uint8Array(SIZE*SIZE*4);
  for(let i=0;i<mask.length;i++){
    pixels[i*4]=mask[i];pixels[i*4+3]=255;
    if(mask[i]&&terrain){const x=ORIGIN+i%SIZE,z=ORIGIN+Math.floor(i/SIZE);
      const depth=(terrain.waterLevelAt?.(x,z)??level)-terrain.heightAt(x,z);
      pixels[i*4+1]=Math.round(Math.max(0,Math.min(32,depth))*255/32);
    }
  }
  for(let z=0;z<SIZE;z+=STEP)for(let x=0;x<SIZE;x+=STEP) {
    let kind=0;
    for(let dz=0;dz<STEP&&!kind;dz++)for(let dx=0;dx<STEP&&!kind;dx++)kind=at(x+dx,z+dz);
    if(!kind)continue;
    for(const [dx,dz] of [[0,0],[STEP,0],[STEP,STEP],[0,0],[STEP,STEP],[0,STEP]]) {
      const px=x+dx,pz=z+dz;
      const interior=[[-8,0],[8,0],[0,-8],[0,8],[0,0]].every(([a,b])=>at(px+a,pz+b)===kind)?1:0;
      vertices.push(ORIGIN+px,terrain?.waterLevelAt?.(ORIGIN+x+4,ORIGIN+z+4)??level,ORIGIN+pz,0,1,0,px/SIZE,pz/SIZE,kind,interior*((terrain?.waterLevelAt?.(ORIGIN+x+4,ORIGIN+z+4)??level)>-1&&terrain?.waterLevelAt ? .15 : 1));
    }
  }
  const mesh={vertices:new Float32Array(vertices),count:vertices.length/10,
    parts:[{first:0,count:vertices.length/10,pivot:[0,0,0]}]};
  const heightAt=(wx,wz,time,disturbance=null)=>{
    const x=Math.floor((wx-ORIGIN)/STEP)*STEP,z=Math.floor((wz-ORIGIN)/STEP)*STEP;
    let kind=0;
    for(let dz=0;dz<STEP&&!kind;dz++)for(let dx=0;dx<STEP&&!kind;dx++)kind=at(x+dx,z+dz);
    const h=(dx,dz)=>{
      const px=x+dx,pz=z+dz,interior=[[-8,0],[8,0],[0,-8],[0,8],[0,0]].every(([a,b])=>at(px+a,pz+b)===kind)?1:0;
      const base=terrain?.waterLevelAt?.(x+ORIGIN+4,z+ORIGIN+4)??level;
      const weight=interior*(base>-1&&terrain?.waterLevelAt ? .15 : 1);
      return base+Math.max(.12,waveHeight(px+ORIGIN,pz+ORIGIN,time,kind,weight)+weight*(disturbance?.(px+ORIGIN,pz+ORIGIN,kind)??0));
    };
    const fx=(wx-ORIGIN-x)/STEP,fz=(wz-ORIGIN-z)/STEP;
    return (fz<=fx?h(0,0)*(1-fx)+h(STEP,0)*(fx-fz)+h(STEP,STEP)*fz
      :h(0,0)*(1-fz)+h(STEP,STEP)*fx+h(0,STEP)*(fz-fx));
  };
  const result={mesh,pixels,mask,heightAt,level,at:(x,z)=>at(Math.floor(x)-ORIGIN,Math.floor(z)-ORIGIN)};
  cache.set(key,result);return result;
}

// Same displacement as the vertex shader, in world units and presentation ms.
export function waveHeight(x,z,time,kind=1,weight=1) {
  const t=time/1000*(kind===2?.45:1);
  return .12+weight*(.7+.35*Math.sin(x*.09+z*.045+t*1.7)+.22*Math.cos(z*.13-x*.035-t*1.25));
}

// Shared contact rules for initial splashes and sustained movement trails.
export function waterRacers(state) {
  const c=state.car;
  return [{x:c.px,y:c.py,air:!!(c.jump||state.fx?.crash)&&!c.special&&!state.fx?.pit,hidden:!!state.fx?.hidden},
    ...(state.ai?.racers??[]).slice(1).map(r=>({x:r.x,y:r.y,air:!!(r.airborne||r.crashed),hidden:!!r.crashGone}))];
}

// Track wet/dry transitions independently for the player and each AI kart.
// Loading, restarting, teleporting or staying submerged cannot create a burst.
export function createSplashes(sample=(world,x,z)=>waterSurface(world).at(x,z)) {
  let world=null,tick=-1,lastTime=-1,previous=new Map(),events=[];
  return {
    reset(){world=null;tick=-1;lastTime=-1;previous=new Map();events=[];},
    tick(state,time){
      if(world!==state.world||state.tick<tick||time<lastTime){previous.clear();events=[];}
      else if(state.tick===tick)return;
      world=state.world;tick=state.tick;lastTime=time;
      events=events.filter(e=>time-e.time<1200);
      const racers=waterRacers(state);
      const next=new Map();
      racers.forEach((r,id)=>{
        const kind=sample(world,r.x,r.y),wet=!!kind&&!r.air&&!r.hidden,old=previous.get(id);
        if(wet&&old&&!old.wet&&Math.hypot(r.x-old.x,r.y-old.y)<96)
          events.push({x:r.x,y:r.y,kind,time,seed:id*1.7+r.x*.01});
        next.set(id,{...r,wet});
      });
      previous=next;events=events.slice(-12);
    },
    frame(time){return events.filter(e=>time>=e.time&&time-e.time<1200).map(e=>({...e,age:(time-e.time)/1000}));},
  };
}

export function splashFragments(event) {
  const out=[],t=event.age;
  for(let i=0;i<(event.spray?8:24);i++) {
    const angle=i*2.399+event.seed, speed=(event.spray?5:8)+i%5*3, y=.4+((event.spray?10:15)+i%4*3)*t-24*t*t;
    if(y<.15)continue;
    out.push({position:[event.x+Math.cos(angle)*speed*t,y,event.y+Math.sin(angle)*speed*t],
      yaw:angle+t*3,units:(.7+i%3*.25)*(1-t/1.2),stretch:[1,1.7,1]});
  }
  if(event.spray)return out;
  // A low, expanding foam crown. It is clipped back to liquid in the renderer.
  for(let i=0;i<16;i++) {
    const angle=i*Math.PI/8,radius=2+t*18;
    out.push({position:[event.x+Math.cos(angle)*radius,.25,event.y+Math.sin(angle)*radius],
      yaw:angle,units:1.8*(1-t/1.2),stretch:[1.8,.15,1],foam:true});
  }
  return out;
}

// Small repeated sprays beside the rear tyres make shallow crossings readable
// even when the initial centre splash is hidden by the kart body.
export function wakeSprays(events) {
  return events.filter(e=>e.kind===1&&e.age<.45&&e.strength>.25).flatMap(e=>[-1,1].map(side=>({
    ...e,x:e.x-e.dz*side*6,y:e.y+e.dx*side*6,seed:side+e.x*.01,spray:true,
  })));
}
