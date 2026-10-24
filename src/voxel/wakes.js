import { waterSurface, waterRacers } from './water.js';

export const MAX_WAKES=24;
const LIFE=1800, SPACING=4, INTERVAL=100;

// Distance and time limits keep trails stable at different race update rates.
// Store world positions: old wakes stay behind instead of following the kart.
export function createWakes(sample=(world,x,z)=>waterSurface(world).at(x,z)) {
  let world=null,tick=-1,lastTime=-1,previous=new Map(),events=[];
  return {
    reset(){world=null;tick=-1;lastTime=-1;previous.clear();events=[];},
    tick(state,time){
      if(world!==state.world||state.tick<tick||time<lastTime){previous.clear();events=[];}
      else if(state.tick===tick)return;
      const dt=time-lastTime;
      world=state.world;tick=state.tick;lastTime=time;
      events=events.filter(e=>time-e.time<LIFE);
      const next=new Map();
      waterRacers(state).forEach((r,id)=>{
        const kind=sample(world,r.x,r.y),old=previous.get(id),wet=!!kind&&!r.air&&!r.hidden;
        let distance=0,emitted=time;
        if(old&&wet&&old.wet&&kind===old.kind&&dt>0&&dt<=250) {
          const dx=r.x-old.x,dz=r.y-old.y,travel=Math.hypot(dx,dz);
          const steps=Math.ceil(travel/4);
          const continuous=travel<96&&Array.from({length:steps},(_,i)=>sample(world,old.x+dx*(i+1)/steps,old.y+dz*(i+1)/steps)).every(k=>k===kind);
          if(continuous&&travel>.01) {
            distance=old.distance+travel;emitted=old.emitted;
            if(distance>=SPACING&&time-emitted>=INTERVAL) {
              events.push({x:r.x,y:r.y,dx:dx/travel,dz:dz/travel,kind,time,
                strength:Math.min(1,Math.max(.15,travel/dt*12))});
              distance%=SPACING;emitted=time;
            }
          }
        }
        next.set(id,{...r,wet,kind,distance,emitted});
      });
      previous=next;events=events.slice(-MAX_WAKES);
    },
    frame(time){return events.filter(e=>time>=e.time&&time-e.time<LIFE).map(e=>({...e,age:(time-e.time)/1000}));},
  };
}

// Keep this displacement identical to wakeHeight in the track vertex shader.
// Low speed makes rings; faster movement suppresses the front into a trailing V.
export function wakeHeight(x,z,event) {
  const dx=x-event.x,dz=z-event.y,along=dx*event.dx+dz*event.dz,side=dx*-event.dz+dz*event.dx;
  const age=event.age*(event.kind===2?.65:1),radius=1+age*10;
  const ring=Math.hypot(side,along*.8)-radius;
  const packet=Math.max(0,1-Math.abs(ring)/2.4);
  const trailing=1-event.strength*Math.max(0,Math.min(1,(along+1)/4));
  return Math.sin(ring*1.3)*packet*packet*trailing*event.strength*.5*Math.max(0,1-event.age/1.8);
}

// Overlapping racers cannot build an unbounded wall of water.
export function wakeField(events,x,z,kind) {
  return Math.max(-.6,Math.min(.6,events.reduce((h,e)=>h+(e.kind===kind?wakeHeight(x,z,e):0),0)));
}

export function wakeUniforms(events) {
  const centers=new Float32Array(MAX_WAKES*4),directions=new Float32Array(MAX_WAKES*4);
  events.slice(-MAX_WAKES).forEach((e,i)=>{
    centers.set([e.x,e.y,e.age,e.strength],i*4);directions.set([e.dx,e.dz,e.kind,0],i*4);
  });
  return {centers,directions,count:Math.min(MAX_WAKES,events.length)};
}
