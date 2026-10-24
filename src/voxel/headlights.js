import { voxelMesh } from './mesh.js';
import { atmosphereLight } from '../time-of-day.js';

export const MAX_HEADLIGHTS = 8;
const lamps = new WeakMap();
function lampMesh(mesh) {
  if (lamps.has(mesh)) return lamps.get(mesh);
  const cube=voxelMesh({size:1,voxels:[[0,0,0,255,242,205]]});
  const vertices=new Float32Array(cube.vertices.length*2), width=mesh.bounds[0];
  for(let side=0;side<2;side++) {
    const offset=side*cube.vertices.length;
    vertices.set(cube.vertices,offset);
    for(let i=0;i<cube.vertices.length;i+=10) {
      vertices[offset+i]=cube.vertices[i]*width*.065+(side?1:-1)*width*.28;
      vertices[offset+i+1]=cube.vertices[i+1]*width*.05+(mesh.wheelRadius||mesh.bounds[1]*.15)*1.2;
      vertices[offset+i+2]=cube.vertices[i+2]*width*.035+mesh.bounds[2]/2+.2;
    }
  }
  const out={vertices,count:vertices.length/10,parts:[{first:0,count:vertices.length/10,pivot:[0,0,0],emission:1}]};
  lamps.set(mesh,out);return out;
}

export function kartHeadlights(racers, atmosphere, enabled=true) {
  const origins=new Float32Array(MAX_HEADLIGHTS*4),directions=new Float32Array(MAX_HEADLIGHTS*4),solids=[];
  let count=0;
  const strength=.12+.88*(1-atmosphereLight(atmosphere).sun)/.85;
  if(enabled) for(const racer of racers.slice(0,MAX_HEADLIGHTS)) {
    const {mesh,position,yaw,units,animation}=racer;
    solids.push({mesh:lampMesh(mesh),position,yaw,units,animation,noShadow:true});
    // Hidden karts are absent from the scene. Submerged, jumping or tumbling
    // karts retain their lamps but do not project a floating road beam.
    if(Math.abs(position[1])>3 || (animation?.tilt??[]).some(v=>Math.abs(v)>.35))continue;
    const dx=Math.sin(yaw),dz=Math.cos(yaw),nose=(mesh.bounds[2]/2+1)*units;
    origins.set([position[0]+dx*nose,position[1]+(mesh.wheelRadius||4)*units,position[2]+dz*nose,strength],count*4);
    directions.set([dx,dz,280, .22],count*4);count++;
  }
  return {count,origins,directions,solids};
}
