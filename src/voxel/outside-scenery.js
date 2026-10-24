import { voxelMesh } from './mesh.js';

const models=new Map();
export function outsideSceneryModels(theme) {
  if(models.has(theme))return models.get(theme);
  const snow=theme==='snow',dry=theme==='sand'||theme==='dirt';
  const make=kind=>{
    const voxels=[];
    for(let y=0;y<20;y++)for(let z=0;z<12;z++)for(let x=0;x<12;x++) {
      const dx=x-5.5,dz=z-5.5,r=Math.hypot(dx,dz);let color=null;
      if(kind==='tree') {
        if(Math.abs(dx)<1.1&&Math.abs(dz)<1.1&&y<13)color=[112,77,43];
        const radius=snow?Math.max(0,(20-y)*.36):dry?(y>=13&&y<=16?5:0):Math.sqrt(Math.max(0,1-((y-13)/6)**2))*5;
        if(y>=7&&r<radius)color=dry?[113,137,48]:[43,106,45];
        if(snow&&y>=8&&r<radius&&((y+1)%4===0||r>radius-.9))color=[221,235,240];
      } else if(kind==='bush') {
        if((dx/4.8)**2+(dz/4.2)**2+((y-2)/3.5)**2<1)color=snow&&y>=4?[217,232,239]:dry?[139,132,65]:[65,125,36];
      } else if((dx/4.5)**2+(dz/3.8)**2+((y-1)/4)**2<1)color=snow&&y>=3?[224,234,242]:dry?[151,119,80]:[114,120,111];
      if(color){const shade=((x*7+y*3+z*11)%5-2)*3;voxels.push([x,y,z,...color.map(c=>Math.max(0,Math.min(255,c+shade)))]);}
    }
    return voxelMesh({size:24,voxels});
  };
  const result={tree:make('tree'),rock:make('rock'),bush:make('bush')};models.set(theme,result);return result;
}

// Stable spatial variation without touching the simulation's random generator.
const random=(x,z,salt)=>{const n=Math.sin(x*127.1+z*311.7+salt*74.7)*43758.5453;return n-Math.floor(n);};
export function outsideScenery(theme,heightAt) {
  const meshes=outsideSceneryModels(theme),objects=[];
  for(let z=-224;z<4320;z+=192)for(let x=-224;x<4320;x+=192) {
    // Whole footprints remain well outside the track and its boundary wall.
    if(x>928&&x<3168&&z>928&&z<3168)continue;
    if(random(x,z,1)>.32)continue;
    const pick=random(x,z,2),kind=pick<.4?'tree':pick<.7?'rock':'bush';
    const px=Math.floor((x+random(x,z,3)*24)/64)*64+32,pz=Math.floor((z+random(x,z,4)*24)/64)*64+32;
    objects.push({kind,mesh:meshes[kind],position:[px,heightAt(px,pz),pz],yaw:random(x,z,5)*Math.PI*2,
      units:(kind==='tree'?2.6:kind==='rock'?2:2.2)*(.8+random(x,z,6)*.4)});
  }
  return objects;
}
