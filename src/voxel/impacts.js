const LIFE=700;
const point = car => ({x:car?.px,y:car?.py});
const snapshot = state => ({
  objects:(state.player?.objects??[]).map(o=>o.consumed),
  racers:(state.ai?.racers??[]).map(r=>({hit:r.hit,stamp:r.hitStamp,crashed:r.crashed})),
  shots:(state.shots??[]).map(s=>({active:s.active,code:s.code})),
  car:{spark:state.car?.spark,count:state.car?.sparkCount,crashed:state.car?.crashed},
  touch:state.player?.racerTouch,
});

// Observe collision transitions; never infer damage from proximity or from a
// disappearing projectile. Persistent stun/crash states do not emit every frame.
export function createImpacts() {
  let world=null,tick=-1,lastTime=-1,previous=null,events=[];
  return {
    reset(){world=null;tick=-1;lastTime=-1;previous=null;events=[];},
    tick(state,time){
      const current=snapshot(state);
      if(world!==state.world||state.tick<tick||time<lastTime){previous=null;events=[];}
      else if(state.tick===tick)return;
      world=state.world;tick=state.tick;lastTime=time;
      events=events.filter(e=>time-e.time<LIFE);
      const emit=(p,material='metal',strength=1)=>{
        if(!Number.isFinite(p?.x)||!Number.isFinite(p?.y))return;
        // Several collision reports can describe the same contact, including a
        // head-on's bump, wreck and projectile hit. Coalesce nearby reports.
        const nearby=events.find(e=>time-e.time<160&&Math.hypot(e.x-p.x,e.y-p.y)<22);
        if(nearby){nearby.strength=Math.max(nearby.strength,strength);return;}
        events.push({x:p.x,y:p.y,time,material,strength,seed:(Math.round(p.x)*31+Math.round(p.y)*17+tick)%97});
      };
      if(previous){
        (state.player?.objects??[]).forEach((o,i)=>{
          if(o.consumed===1&&previous.objects[i]!==1) emit(o,state.world.sprites?.[o.id]?.kind===0?'wood':'metal',state.player.pending?3:1);
        });
        const n=state.player?.racerTouch;
        if(n>=0&&n!==previous.touch){const r=state.ai?.racers[n],p=point(state.car);if(r)emit({x:(r.x+p.x)/2,y:(r.y+p.y)/2});}
        (state.ai?.racers??[]).forEach((r,i)=>{
          const old=previous.racers[i];
          if(old&&((r.hit&&(!old.hit||r.hitStamp!==old.stamp))||(r.crashed&&!old.crashed)))emit(r,'metal',r.crashed?3:1);
        });
        (state.shots??[]).forEach((s,i)=>{
          const old=previous.shots[i];
          if(s.active&&s.code>0&&(!old?.active||!old.code))emit(s,s.code===2?'wood':'metal');
        });
        // AI-initiated bumps finish after player.racerTouch is recorded. The
        // game's spark reset is their presentation signal (also wall bumps).
        const c=state.car;
        if(c&&((c.crashed&&!previous.car.crashed)||(c.spark&&c.sparkCount===0&&(!previous.car.spark||previous.car.count!==0))))emit(point(c),'metal',c.crashed?3:1);
      }
      previous=current;events=events.slice(-24);
    },
    frame(time){return events.filter(e=>time>=e.time&&time-e.time<LIFE).map(e=>({...e,age:(time-e.time)/1000}));},
  };
}

export function impactFragments(event){
  const parts=[];
  for(let i=0;i<10;i++){
    const spark=i<6,life=spark?.36:.7,t=event.age;
    if(t<0||t>=life)continue;
    const angle=i*2.399+event.seed*.37,speed=spark?48+(i%3)*12:16+(i%3)*5;
    const radius=speed*t,up=spark?22:16;
    parts.push({spark,position:[event.x+Math.cos(angle)*radius,Math.max(.2,3+up*t-48*t*t),event.y+Math.sin(angle)*radius],
      yaw:angle+t*(spark?5:11),units:(spark?.85:1.6)*(1-t/life),material:event.material});
  }
  return parts;
}
