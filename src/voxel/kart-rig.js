import { voxelMesh } from './mesh.js';

// The known kart construction has separate wheels. Split its upper driver into
// a rigid part too, closing the joint faces before meshing rather than bending
// disconnected vertices in the shader. Unrecognized imported models stay rigid.
export function kartMesh(project) {
  const whole=voxelMesh(project);
  if(!whole.wheelRadius)return whole;
  const originOf=cells=>{const lo=[0,1,2].map(a=>Math.min(...cells.map(v=>v[a]))),hi=[0,1,2].map(a=>Math.max(...cells.map(v=>v[a]))+1);return [(lo[0]+hi[0])/2,lo[1],(lo[2]+hi[2])/2];};
  const origin=originOf(project.voxels),cut=origin[1]+Math.round(whole.bounds[1]*.65);
  const head=project.voxels.filter(v=>v[1]>=cut),base=project.voxels.filter(v=>v[1]<cut);
  if(!head.length||!base.length)return whole;
  const pieces=[voxelMesh({...project,voxels:base}),voxelMesh({...project,voxels:head})];
  const vertices=new Float32Array(pieces.reduce((n,m)=>n+m.vertices.length,0)),parts=[];let count=0;
  pieces.forEach((mesh,i)=>{
    const local=originOf(i?head:base),delta=local.map((n,a)=>n-origin[a]);
    for(let k=0;k<mesh.vertices.length;k+=10)for(let a=0;a<3;a++)mesh.vertices[k+a]+=delta[a];
    vertices.set(mesh.vertices,count*10);
    for(const part of mesh.parts)parts.push({...part,first:part.first+count,pivot:i?[0,cut-origin[1],0]:part.pivot.map((n,a)=>n+delta[a]),head:Boolean(i)});
    count+=mesh.count;
  });
  return {...whole,vertices,count,parts};
}
