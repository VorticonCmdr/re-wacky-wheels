import { voxelMesh } from './mesh.js';

const lamps = new WeakMap();
function rearMesh(mesh, braking) {
  let pair=lamps.get(mesh);
  if(!pair) { pair=[];lamps.set(mesh,pair); }
  const index=Number(braking);
  if(pair[index])return pair[index];
  const cube=voxelMesh({size:1,voxels:[[0,0,0,...(braking?[255,65,28]:[105,5,3])]]});
  const vertices=new Float32Array(cube.vertices.length*2),width=mesh.bounds[0];
  for(let side=0;side<2;side++) {
    const offset=side*cube.vertices.length;vertices.set(cube.vertices,offset);
    for(let i=0;i<cube.vertices.length;i+=10) {
      vertices[offset+i]=cube.vertices[i]*width*.10+(side?1:-1)*width*.28;
      vertices[offset+i+1]=cube.vertices[i+1]*width*.065+(mesh.wheelRadius||mesh.bounds[1]*.15)*1.35;
      vertices[offset+i+2]=cube.vertices[i+2]*width*.035-mesh.bounds[2]/2-.2;
    }
  }
  return pair[index]={vertices,count:vertices.length/10,parts:[{first:0,count:vertices.length/10,pivot:[0,0,0],emission:1}]};
}

// Emissive rear lenses remain red in all lighting presets, depth-tested against
// the kart and scenery. They share body tilt, scale and water reflections.
export function kartTaillights(racers,enabled=true) {
  return enabled?racers.map(({mesh,position,yaw,units,animation,braking})=>({
    mesh:rearMesh(mesh,Boolean(braking)),position,yaw,units,animation,noShadow:true,
  })):[];
}
