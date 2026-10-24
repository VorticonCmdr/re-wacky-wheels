import { counting, starterPoint, stepStart } from '../game/start.js';
import { MODEL } from '../game/car-model.js';
import { TRACK_CAMERA } from './kart-scale.js';
import { voxelMesh } from './mesh.js';
import project from './assets/starter-lion.json' with { type: 'json' };

const CHASE_DISTANCE=TRACK_CAMERA.distance;

// The game's fly-in moves cx/cy around a parked kart. Its final camera is
// cameraBehind units back; translate forward to the 3D chase distance so the
// interpolated final fly-in sample and the countdown share exactly one camera.
export function startPresentation(P, fine, headingVectorAt) {
  const seat=fine.seats[0], intro=Boolean(P.intro||fine.intro);
  const waiting=intro||Boolean(P.start&&counting(P.start));
  const forward=headingVectorAt(P.world,seat.heading);
  const startForward=P.world.start ? headingVectorAt(P.world,P.world.start.heading) : forward;
  // The legacy camera rounds its TRIG displacement to whole world units.
  // Cancel that sub-unit rounding offset at the chase-camera handoff.
  const correction=startForward.map(v=>Math.floor(v*MODEL().cameraBehind+.5)-v*MODEL().cameraBehind);
  const useCamera=waiting&&Number.isFinite(seat.cx)&&Number.isFinite(seat.cy);
  const camera=useCamera
    ? [seat.cx+forward[0]*(MODEL().cameraBehind-CHASE_DISTANCE)+correction[0],TRACK_CAMERA.height,seat.cy+forward[1]*(MODEL().cameraBehind-CHASE_DISTANCE)+correction[1]]
    : [seat.px-forward[0]*CHASE_DISTANCE,TRACK_CAMERA.height,seat.py-forward[1]*CHASE_DISTANCE];
  return {camera,forward,kartHeading:intro ? P.world.start.heading : seat.dir,
    starter:P.start&&P.world.start&&P.lionShown!==false
      ? {...starterPoint(P.world.start),light:stepStart(P.start).start.lion,yaw:Math.atan2(...headingVectorAt(P.world,P.world.start.heading))+Math.PI}
      : null};
}

export function starterMeshes() {
  return [0,1,2].map(active=>{
    const lit=[[255,42,30],[255,220,35],[40,255,75]], dark=[[77,16,15],[83,62,14],[15,65,28]];
    const voxels=project.voxels.map(v=>{
      const [x,y,z]=v;
      if(x>=24&&z>=20) {const bulb=y>=22?0:y>=14?1:2;return [...v.slice(0,3),...(bulb===active?lit[bulb]:dark[bulb])];}
      return v;
    });
    const mesh=voxelMesh({...project,voxels}),body=[],light=[];
    for(let i=0;i<mesh.vertices.length;i+=10) {
      const on=lit[active].every((v,a)=>Math.abs(mesh.vertices[i+6+a]-v/255)<1e-6);
      const target=on?light:body;for(let a=0;a<10;a++)target.push(mesh.vertices[i+a]);
    }
    mesh.vertices=new Float32Array([...body,...light]);
    mesh.parts=[{first:0,count:body.length/10,pivot:[0,0,0]},
      {first:body.length/10,count:light.length/10,pivot:[0,0,0],emission:1}];
    return mesh;
  });
}
