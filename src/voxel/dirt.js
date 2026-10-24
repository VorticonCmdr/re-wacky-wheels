import { particleSurfaceAt } from './particle-surface.js';

// Short, bounded trails from moving rear tyres, independent of render rate.
export function createDirtEffects() {
  let world=null,lastTime=-Infinity,particles=[],serial=0;
  const previous=new Map();
  const reset=()=>{previous.clear();particles=[];world=null;lastTime=-Infinity;serial=0;};
  return {
    reset,
    begin(next,time) {
      if(world!==next||time<lastTime)reset();
      world=next;lastTime=time;
      particles=particles.filter(p=>time-p.time<1100);
    },
    sample(id,{x,z,yaw,time,terrain,contacts,grounded}) {
      const old=previous.get(id);
      if(!terrain||!grounded){previous.delete(id);return;}
      previous.set(id,{x,z,time,distance:old?.distance??0});
      if(!old)return;
      const distance=Math.hypot(x-old.x,z-old.z),dt=(time-old.time)/1000;
      if(dt<=0||dt>.25||distance>96){previous.get(id).distance=0;return;}
      const speed=distance/dt;
      if(speed<3){previous.get(id).distance=0;return;}
      // Emit by travelled distance, not frame count. Cap burst work on stalls.
      const spacing=4,total=old.distance+distance,count=Math.min(4,Math.floor(total/spacing));
      previous.get(id).distance=total%spacing;
      const c=Math.cos(yaw),s=Math.sin(yaw);
      for(let i=0;i<count;i++)for(const [localX,localZ] of contacts) {
        const f=Math.max(0,1-(i*spacing+total%spacing)/distance);
        const px=old.x+(x-old.x)*f-c*localX+s*localZ,pz=old.z+(z-old.z)*f+s*localX+c*localZ;
        if(px<1024||pz<1024||px>=3072||pz>=3072)continue;
        const cell=Math.floor((pz-1024)/8)*256+Math.floor((px-1024)/8),kind=terrain.types[cell];
        if(terrain.roadCells[cell]||kind===3||kind===10||terrain.waterAt(px,pz))continue;
        const height=terrain.heightAt(px,pz),seed=++serial,side=Math.sin(seed*2.399),strength=Math.min(1,speed/100);
        particles.push({x:px,z:pz,height,time,seed,strength,material:particleSurfaceAt(world,px,pz),
          vx:-s*(3+strength*6)+c*side*5,vz:-c*(3+strength*6)-s*side*5});
      }
      particles=particles.slice(-128);
    },
    frame(time) {
      return particles.filter(p=>time>=p.time&&time-p.time<1100).map(p=>({...p,age:(time-p.time)/1100}));
    },
  };
}
