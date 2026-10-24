import { voxelMesh } from './mesh.js';

let mesh;
export function periscopeMesh() {
  if(mesh)return mesh;
  const cells=new Map();
  const box=(x0,y0,z0,x1,y1,z1,color)=>{
    for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++)cells.set(`${x},${y},${z}`,[x,y,z,...color]);
  };
  // A submerged foot, upright tube, forward elbow and inset glass lens.
  box(5,0,5,10,2,10,[64,78,82]);
  box(7,1,7,8,12,8,[159,176,175]);
  box(6,3,6,9,4,9,[83,102,109]);
  box(6,11,7,9,14,12,[170,185,179]);
  box(6,11,12,9,14,13,[43,56,63]);
  box(7,12,13,8,13,13,[73,181,206]);
  box(7,13,13,7,13,13,[180,229,229]);
  mesh=voxelMesh({size:16,voxels:[...cells.values()]});return mesh;
}

export function underwaterKart(car,fx,kind) {
  // Only the swimming/pit picture in water, never lava, a crash or a jump.
  return kind===1 && Boolean(car.special||fx?.pit) && !car.crashed && !car.wrecked && !fx?.crash && !car.jump;
}

export function periscopeVisual(car,fx,point,yaw,units,time) {
  // The original's first splash rows hide the replacement picture too.
  if(fx?.hidden)return null;
  const phase=time/720*Math.PI*2;
  return {mesh:periscopeMesh(),position:[point.x,-.8+Math.sin(phase)*.35,point.y],
    yaw:yaw+Math.sin(phase*.5)*.22,units,
    animation:{tilt:[Math.sin(phase)*.025,Math.cos(phase)*.025]}};
}

const ease=t=>t*t*(3-2*t);
export function createDiveMotion() {
  let last=null,from=0,to=0,start=0;
  const value=time=>from+(to-from)*ease(Math.max(0,Math.min(1,(time-start)/650)));
  return {
    reset(){last=null;},
    sample(state,time,underwater) {
      const car=state.car, target=underwater?1:0;
      const interrupted=car.crashed||car.wrecked||car.jump||state.fx?.crash;
      const discontinuity=!last||last.world!==state.world||state.tick<last.tick||time<last.time||Math.hypot(car.px-last.x,car.py-last.y)>160;
      // Leaving the swimming state places the kart back on its ground anchor
      // immediately. Easing upward here would move it through the solid bank.
      if(!underwater||discontinuity||interrupted){from=to=interrupted?0:target;start=time;}
      else if(target!==to){from=value(time);to=target;start=time;}
      last={world:state.world,tick:state.tick,time,x:car.px,y:car.py};
      const amount=value(time),scope=ease(Math.max(0,Math.min(1,(amount-.2)/.8)));
      return {amount,scope,active:amount>0||to>0};
    },
  };
}
