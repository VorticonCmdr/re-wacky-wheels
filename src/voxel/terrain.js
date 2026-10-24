import { classifyLiquids } from '../liquids.js';
import { routeEntries } from '../game/ai.js';
import { terrainAt } from '../game/surface.js';
import { tileSurfaces } from '../game/surface.js';

const cache=new WeakMap(),N=256,STEP=8,ORIGIN=1024;
export function trackTerrain(world) {
  if(!world.route?.length||!world.tiles||!world.sin?.length||!world.maskSheets?.length)return null;
  if(cache.has(world))return cache.get(world);
  const surfaces=tileSurfaces(world);
  const surface=(wx,wz)=>{
    const x=wx-ORIGIN,z=wz-ORIGIN,id=world.tiles[(z>>5)*64+(x>>5)];
    const mask=world.maskSheets[Math.floor(id/54)][(id%54)*1024+(z&31)*32+(x&31)];
    return surfaces[id][mask?1:0];
  };
  const liquid=classifyLiquids(world),roads=new Set([0,2]),routeCells=new Set();
  for(const entry of routeEntries(world.route??[]))for(const [x,z] of entry.points) {
    const kind=terrainAt(world,x,z);
    if(!liquid.kinds.has(kind)) {
      if(kind!==3&&kind!==10)roads.add(kind);
      if(x>=1024&&x<3072&&z>=1024&&z<3072)routeCells.add(Math.floor((z-ORIGIN)/STEP)*N+Math.floor((x-ORIGIN)/STEP));
    }
  }
  const wet=new Uint8Array(N*N),waterDistance=new Float32Array(N*N).fill(1000),shoreDistance=new Float32Array(N*N).fill(1000);
  const originalWater=(wx,wz)=>{
    const x=Math.floor(wx)-ORIGIN,z=Math.floor(wz)-ORIGIN;
    if(x<0||z<0||x>=2048||z>=2048||!liquid.any)return 0;
    const id=world.tiles[(z>>5)*64+(x>>5)];return liquid.texels[id*1024+(z&31)*32+(x&31)];
  };
  const heights=new Float32Array(N*N),types=new Uint8Array(N*N),distance=new Float32Array(N*N).fill(1000);
  for(let z=0;z<N;z++)for(let x=0;x<N;x++) {
    const i=z*N+x,wx=ORIGIN+x*STEP,wz=ORIGIN+z*STEP;
    let kind=surface(wx+4,wz+4),road=false;
    // Preserve every road texel: mixed cells stay level, including painted edges.
    for(let dz=0;dz<STEP;dz++)for(let dx=0;dx<STEP;dx++)if(roads.has(surface(wx+dx,wz+dz)))road=true;
    road ||= routeCells.has(i);
    types[i]=kind;if(road)distance[i]=0;
    wet[i]=road?0:originalWater(wx+4,wz+4);
    if(wet[i])waterDistance[i]=0;else shoreDistance[i]=0;
  }
  for(const field of [distance,waterDistance,shoreDistance]) {
    for(let z=0;z<N;z++)for(let x=0;x<N;x++){const i=z*N+x;field[i]=Math.min(field[i],x?field[i-1]+1:1000,z?field[i-N]+1:1000);}
    for(let z=N-1;z>=0;z--)for(let x=N-1;x>=0;x--){const i=z*N+x;field[i]=Math.min(field[i],x<N-1?field[i+1]+1:1000,z<N-1?field[i+N]+1:1000);}
  }
  for(let z=0;z<N;z++)for(let x=0;x<N;x++) {
    const i=z*N+x,t=types[i],d=distance[i];
    let h=d===0||t===10?0:t===3?12:t===19?6+Math.min(6,Math.floor(d/3)*2):Math.min(6,d<=1?1.5:Math.floor(d/2)*2);
    if(wet[i])h=wet[i]===1&&t!==6&&t!==15?-2:-8-Math.min(10,shoreDistance[i]*2);
    else if(d>0&&t!==3)h=Math.min(h,waterDistance[i]*4-8);
    // Track 1 has no gameplay water. This decorative basin is wholly inside
    // its existing infield barrier, away from the road and driving route.
    const r=Math.hypot((ORIGIN+x*STEP+4-1860)/210,(ORIGIN+z*STEP+4-2110)/260);
    if(String(world.name)==='1'&&t===19&&d>0&&r<1.5)h=Math.min(h,Math.floor((-18+Math.max(0,r-.7)*52)/2)*2);
    heights[i]=h;
  }
  const heightAt=(x,z)=>heights[Math.max(0,Math.min(N-1,Math.floor((z-ORIGIN)/STEP)))*N+Math.max(0,Math.min(N-1,Math.floor((x-ORIGIN)/STEP)))];
  const waterAt=(x,z)=>{
    if(x<1024||x>=3072||z<1024||z>=3072||heightAt(x,z)>=0)return 0;
    return originalWater(x,z)||(String(world.name)==='1'&&heightAt(x,z)<-8?1:0);
  };
  const waterLevelAt=(x,z)=>heightAt(x,z)>=-2?-.6:-8;
  const vertices=[];
  const face=(points,normal)=>{for(const j of [0,1,2,0,2,3]){const [x,y,z]=points[j];vertices.push(x,y,z,...normal,(x-ORIGIN)/2048,(z-ORIGIN)/2048,0,1);}};
  // Merge horizontal runs; emit only exposed walls between height steps.
  for(let z=0;z<N;z++)for(let x=0;x<N;) {
    const h=heights[z*N+x];let end=x+1;while(end<N&&heights[z*N+end]===h)end++;
    const x0=ORIGIN+x*STEP,x1=ORIGIN+end*STEP,z0=ORIGIN+z*STEP,z1=z0+STEP;
    face([[x0,h,z0],[x1,h,z0],[x1,h,z1],[x0,h,z1]],[0,1,0]);x=end;
  }
  for(let z=0;z<N;z++)for(let x=0;x<N;x++) {
    const h=heights[z*N+x],x0=ORIGIN+x*STEP,x1=x0+STEP,z0=ORIGIN+z*STEP,z1=z0+STEP;
    for(const [dx,dz,n] of [[-1,0,[-1,0,0]],[1,0,[1,0,0]],[0,-1,[0,0,-1]],[0,1,[0,0,1]]]) {
      const nx=x+dx,nz=z+dz,low=nx<0||nz<0||nx>=N||nz>=N?-20:heights[nz*N+nx];
      if(low>=h)continue;
      if(dx){const xx=dx<0?x0:x1;face([[xx,low,z0],[xx,h,z0],[xx,h,z1],[xx,low,z1]],n);}
      else {const zz=dz<0?z0:z1;face([[x0,low,zz],[x1,low,zz],[x1,h,zz],[x0,h,zz]],n);}
    }
  }
  const mesh={vertices:new Float32Array(vertices),count:vertices.length/10,parts:[{first:0,count:vertices.length/10,pivot:[0,0,0]}]};
  const result={mesh,heightAt,waterAt,waterLevel:-8,waterLevelAt,heights,types,roads,roadCells:distance.map(d=>d===0?1:0)};cache.set(world,result);return result;
}
