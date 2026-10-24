const DURATION = 650;

// Authoritative pickup events only: a refused touch, a hidden sprite, or loading
// a race with already-consumed objects must never create a collection effect.
export function createCollections() {
  let world=null, tick=-1, lastTime=-1, events=[];
  return {
    reset() { world=null; tick=-1; lastTime=-1; events=[]; },
    tick(state,time) {
      if(world!==state.world || state.tick<tick || time<lastTime) events=[];
      else if(state.tick===tick) return;
      world=state.world;tick=state.tick;lastTime=time;
      events=events.filter(e=>time-e.time<DURATION);
      for(const index of new Set(state.player?.taken??[])) {
        const o=state.player.objects[index];
        if(!o || (o.consumed!==65535 && o.consumed!==-1)) continue;
        events.push({id:o.id,x:o.x,y:o.y,time});
      }
      events=events.slice(-32);
    },
    frame(time) {
      return events.filter(e=>time>=e.time && time-e.time<DURATION)
        .map(e=>({...e,progress:(time-e.time)/DURATION}));
    },
  };
}

export function collectionPose(progress) {
  const t=Math.min(1,Math.max(0,progress));
  return {height:14*Math.sin(t*Math.PI/2),scale:Math.max(0,(1-t)*(1+.9*Math.sin(t*Math.PI))),yaw:t*Math.PI*2};
}
