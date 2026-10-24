const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

// Presentation only: four tyre contacts support the chassis. No artificial
// periodic bob on flat roads; bumps come from changes in the terrain itself.
export function createTerrainSuspension() {
  const states=new Map();
  return {
    reset(){states.clear();},
    sample(id,{world,tick,time,x,z,yaw,width,length,terrain,grounded=true}) {
      const base=terrain?(terrain.waterAt(x,z)?0:terrain.heightAt(x,z)):0;
      if(!terrain||!grounded||terrain.waterAt(x,z)) {
        states.delete(id);return {height:base,tilt:[0,0],cameraHeight:base};
      }
      const c=Math.cos(yaw),s=Math.sin(yaw),w=Math.max(2,width/2),l=Math.max(2,length/2);
      const contacts=[];
      for(const a of [-1,1])for(const b of [-1,1]) {
        const px=x-c*a*w+s*b*l,pz=z+s*a*w+c*b*l;
        // A tyre footprint softens the eight-unit voxel step without changing
        // the visible mesh or ever sampling the bottom of a water basin.
        let h=0;
        for(const dx of [-1,1])for(const dz of [-1,1])h+=terrain.waterAt(px+dx,pz+dz)?base:terrain.heightAt(px+dx,pz+dz);
        contacts.push({a,b,h:h/4});
      }
      const mean=contacts.reduce((n,p)=>n+p.h,0)/4;
      const pitch=clamp(-Math.atan2(contacts.reduce((n,p)=>n+p.b*p.h,0)/2,2*l),-.32,.32);
      const roll=clamp(Math.atan2(contacts.reduce((n,p)=>n+p.a*p.h,0)/2,2*w),-.32,.32);
      const target=[mean,pitch||0,roll||0];
      let state=states.get(id);
      if(!state||state.world!==world||tick<state.tick||time<state.time||time-state.time>250||Math.hypot(x-state.x,z-state.z)>120) {
        state={world,value:target.slice(),velocity:[0,0,0],camera:mean,time};states.set(id,state);
      }
      let dt=Math.max(0,(time-state.time)/1000);
      // Bounded integration steps make damping stable at varying frame rates.
      while(dt>0) {
        const step=Math.min(dt,1/120);dt-=step;
        for(let i=0;i<3;i++) {
          const frequency=i?18:22,damping=i?.85:.68;
          state.velocity[i]+=(frequency*frequency*(target[i]-state.value[i])-2*damping*frequency*state.velocity[i])*step;
          state.value[i]+=state.velocity[i]*step;
        }
        state.camera+=(mean-state.camera)*(1-Math.exp(-8*step));
      }
      // Prevent deep clipping when climbing a sharp curb, while allowing a
      // short suspension compression and damped rebound on landing.
      const [h,p,r]=state.value;
      const support=Math.max(...contacts.map(q=>q.h-(Math.sin(r)*q.a*w-Math.cos(r)*Math.sin(p)*q.b*l)));
      state.value[0]=Math.max(h,support-.6);
      if(state.value[0]>h)state.velocity[0]=Math.max(0,state.velocity[0]);
      Object.assign(state,{tick,time,x,z});
      return {height:state.value[0],tilt:[state.value[1],state.value[2]],cameraHeight:state.camera};
    },
  };
}
