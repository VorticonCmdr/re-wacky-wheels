import { voxelMesh } from './mesh.js';

// Split the exported Studio cells before meshing, so moving joints have closing
// faces and AO is not baked across parts that separate during animation.
export function rigPickup(project, name) {
  const reader = name === 'H2.SP', brush = name === 'H4.SP', bomb = name === 'H12.SP';
  const hedgehog = /^H\d+\.SP$/.test(name) && !['H1.SP','H12.SP','H15.SP','H16.SP'].includes(name);
  if (!reader && !brush && !bomb && !hedgehog) return voxelMesh(project);
  const groups = new Map();
  for (const v of project.voxels) {
    const [x,y,z,r,g] = v;
    let part = 'body';
    if (bomb && y >= 23 && r > 200 && g > 100) part = 'spark';
    if (reader && z >= 23 && y >= 5 && y <= 15) part = 'paper';
    else if ((reader || brush || hedgehog) && y >= (reader || brush ? 17 : 18)) part = 'head';
    if (brush && ((x <= 11 && z >= 23 && y <= 12) || (x <= 11 && z >= 20 && y >= 9 && y <= 13))) part = 'brush';
    if (!groups.has(part)) groups.set(part, []);
    groups.get(part).push(v);
  }
  const boundsOf = cells => [0,1,2].map(a => [Math.min(...cells.map(v=>v[a])), Math.max(...cells.map(v=>v[a])) + 1]);
  const bounds = boundsOf(project.voxels), origin = [(bounds[0][0]+bounds[0][1])/2,bounds[1][0],(bounds[2][0]+bounds[2][1])/2];
  const pivots = {head:[15,17,17],paper:[15,10,24],brush:[9,11,21],spark:[19,25,15],body:origin};
  const chunks=[],parts=[]; let count=0;
  for (const [name,cells] of groups) {
    const mesh=voxelMesh({...project,voxels:cells}), b=boundsOf(cells);
    const local=[(b[0][0]+b[0][1])/2,b[1][0],(b[2][0]+b[2][1])/2];
    for(let i=0;i<mesh.vertices.length;i+=10) for(let a=0;a<3;a++) mesh.vertices[i+a]+=local[a]-origin[a];
    chunks.push(mesh.vertices);
    parts.push({first:count,count:mesh.count,pivot:pivots[name].map((n,a)=>n-origin[a]),animation:name});
    count+=mesh.count;
  }
  const vertices=new Float32Array(count*10);let offset=0;
  for(const chunk of chunks){vertices.set(chunk,offset);offset+=chunk.length;}
  return {vertices,count,parts,bounds:bounds.map(([lo,hi])=>hi-lo),voxels:project.voxels.length};
}

// Presentation time only: pause freezes every part, and a replay at the same
// time produces the same pose. No wall clock or random numbers enter the draw.
export function pickupPose(part, time, phase = 0) {
  const t=time/1000, a=t*3+phase;
  const pose={angles:[0,0],offset:[0,0,0],scale:1,tint:[1,1,1],emission:0};
  if(part==='head') pose.angles=[.12*Math.sin(a),.18*Math.sin(a*.7)];
  if(part==='paper') {pose.angles=[-.12+.16*Math.sin(a),0];pose.offset[1]=.35*Math.sin(a);}
  if(part==='brush') pose.angles=[.38*Math.sin(a*1.4),.22*Math.cos(a*1.4)];
  if(part==='spark') {
    const flicker=(Math.sin(t*37+phase)+Math.sin(t*61+phase*.7)+2)/4;
    pose.scale=.55+.7*flicker;
    pose.tint=[1,.65+.35*flicker,.6+.4*flicker];
    pose.emission=.65+.35*flicker;
  }
  return pose;
}
