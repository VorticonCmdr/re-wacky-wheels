import { voxelMesh } from './mesh.js';

// Fixed emission intervals and analytic trajectories keep the result independent
// of display frame rate. All time is the same presentation clock as the dive.
export function createDiveEffects() {
  let last=null,events=[],nextBubble=0,serial=0,surfaced=false,wetPoint=null;
  const reset=()=>{last=null;events=[];nextBubble=0;serial=0;surfaced=false;wetPoint=null;};
  return {
    reset,
    sample(state,time,amount,point,wet) {
      const c=state.car;
      const discontinuity=!last||last.world!==state.world||state.tick<last.tick||time<last.time||time-last.time>1000||Math.hypot(point.x-last.x,point.y-last.y)>160;
      if(discontinuity||c.crashed||c.wrecked||c.jump||state.fx?.crash)reset();
      events=events.filter(e=>time-e.time<1100);
      if(wet)wetPoint={...point};
      if(last && time>last.time) {
        if(amount>last.amount) {
          surfaced=false;
          if(wet) {
            if(nextBubble<last.time)nextBubble=last.time;
            for(let n=0;n<8&&nextBubble<=time;n++,nextBubble+=85) {
              const t=Math.max(0,Math.min(1,(nextBubble-last.time)/(time-last.time)));
              events.push({kind:'bubble',x:last.x+(point.x-last.x)*t,y:last.y+(point.y-last.y)*t,time:nextBubble,seed:serial++});
            }
          }
        } else if(amount<last.amount && amount<.65 && !surfaced && wetPoint) {
          events.push({kind:'surface',...wetPoint,time,seed:serial++});surfaced=true;
        }
      }
      events=events.slice(-24);
      last={world:state.world,tick:state.tick,time,amount,x:point.x,y:point.y};
    },
    frame(time){return events.filter(e=>time>=e.time&&time-e.time<1100).map(e=>({...e,age:(time-e.time)/1000}));},
  };
}

let bubble;
export function bubbleMesh() {
  if(bubble)return bubble;
  const voxels=[];
  // Two intersecting rings give a tiny hollow, faceted bubble from every view.
  for(let x=0;x<3;x++)for(let y=0;y<3;y++)for(let z=0;z<3;z++) {
    const edges=Number(x!==1)+Number(y!==1)+Number(z!==1);
    if(edges===2)voxels.push([x,y,z,...(y===2?[221,250,255]:[108,190,223])]);
  }
  bubble=voxelMesh({size:3,voxels});return bubble;
}

export function diveFragments(event) {
  const t=event.age;
  if(event.kind==='bubble') {
    const angle=event.seed*2.399,r=2+event.seed%4;
    return [{bubble:true,position:[event.x+Math.cos(angle)*r,.08+t*2.8,event.y+Math.sin(angle)*r],
      units:(.35+(event.seed%3)*.08)*(1+t*.4),yaw:angle+t*.4,opacity:.65*Math.max(0,1-t/1.1),stretch:[1,1,1]}];
  }
  const out=[];
  for(let i=0;i<12;i++) {
    const angle=i*Math.PI/6+event.seed,speed=4+i%3*2,h=.2+8*t-16*t*t;
    if(h>0)out.push({position:[event.x+Math.cos(angle)*speed*t,h,event.y+Math.sin(angle)*speed*t],
      units:.55*(1-t/1.1),yaw:angle,opacity:Math.max(0,1-t/1.1),stretch:[1,1.5,1]});
    if(t<.8)out.push({foam:true,position:[event.x+Math.cos(angle)*(2+9*t),.04,event.y+Math.sin(angle)*(2+9*t)],
      units:.9, yaw:angle,opacity:.55*(1-t/.8),stretch:[1.5,.15,1]});
  }
  return out;
}
