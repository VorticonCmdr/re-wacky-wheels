import { specialSurfaces } from '../game/surface.js';
import { trackKartUnits } from './kart-scale.js';

// Ground contacts are derived from the same rear-wheel pivots and physical
// scale as the kart mesh. Snapshot skid includes drift and the brake skid sound.
export function createTyreEffects(headingVector) {
  let marks=[],smoke=[],lastTick=-1,world=null,lastSmoke=-Infinity;
  const clear=()=>{marks=[];smoke=[];lastTick=-1;world=null;lastSmoke=-Infinity;};
  return {
    reset:clear,
    emit(prev,cur,mesh) {
      if(world!==cur.world||cur.tick<lastTick){clear();world=cur.world;}
      if(cur.tick===lastTick)return;
      lastTick=cur.tick;
      marks=marks.filter(m=>cur.time-m.time<8000);smoke=smoke.filter(p=>cur.time-p.time<800);
      const p=prev?.seats[0],c=cur.seats[0],S=specialSurfaces();
      if(!mesh||!p||!c||prev.world!==cur.world||!c.skid||c.crashed||p.crashed||c.jump||p.jump||c.special||p.special||[S.wall,S.stopped,S.fall,...S.pit].includes(c.surface))return;
      const distance=Math.hypot(c.px-p.px,c.py-p.py);
      if(distance<.3||distance>96)return; // idle wheels and teleports leave no trail
      const units=trackKartUnits(mesh);
      const rear=mesh.parts.filter(part=>part.wheel&&!part.front);
      if(rear.length!==2)return;
      const contact=(seat,part)=>{
        const [fx,fy]=headingVector(cur.world,seat.dir),[x,,z]=part.pivot;
        return [seat.px+(-fy*x+fx*z)*units,seat.py+(fx*x+fy*z)*units];
      };
      const puff=cur.time-lastSmoke>=75;
      for(const part of rear){
        const a=contact(p,part),b=contact(c,part);
        marks.push({a,b,time:cur.time,width:2.1});
        if(puff)smoke.push({x:b[0],y:b[1],time:cur.time,phase:smoke.length*.7});
      }
      if(puff)lastSmoke=cur.time;
      marks=marks.slice(-256);smoke=smoke.slice(-48);
    },
    frame(time){return {
      marks:marks.filter(m=>time>=m.time&&time-m.time<8000).map(m=>({...m,alpha:.32*Math.min(1,(8000-(time-m.time))/2500)})),
      smoke:smoke.filter(p=>time>=p.time&&time-p.time<800).map(p=>({...p,age:(time-p.time)/800})),
    };},
  };
}
