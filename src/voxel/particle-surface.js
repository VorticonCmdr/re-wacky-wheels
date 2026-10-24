// Classify the artwork under each tyre, rather than assigning a material to
// an entire track. Average each tile's mask region so texture speckles cannot
// make a trail flicker between materials.
const cache=new WeakMap();
export function particleMaterial([r,g,b]) {
  if(Math.min(r,g,b)>155&&Math.max(r,g,b)-Math.min(r,g,b)<48)return 'snow';
  if(g>r*1.15&&g>b*1.2)return 'grass';
  if(r>b*1.3&&g>b*1.2&&r>135&&g>105)return 'sand';
  return 'dirt';
}

export function particleSurfaceAt(world,x,z) {
  if(!world.sheets||!world.palette||!world.maskSheets)return 'dirt';
  const tx=Math.floor(x)-1024,tz=Math.floor(z)-1024;
  if(tx<0||tz<0||tx>=2048||tz>=2048)return 'dirt';
  const id=world.tiles[(tz>>5)*64+(tx>>5)],sheet=world.sheets[Math.floor(id/54)],mask=world.maskSheets[Math.floor(id/54)],base=id%54*1024;
  const region=mask[base+(tz&31)*32+(tx&31)]?1:0,key=id*2+region;
  let materials=cache.get(world);if(!materials){materials=new Map();cache.set(world,materials);}
  if(!materials.has(key)) {
    const rgb=[0,0,0];let count=0;
    for(let i=0;i<1024;i++)if((mask[base+i]?1:0)===region) {
      const p=sheet[base+i]*3;
      for(let c=0;c<3;c++)rgb[c]+=world.palette[p+c]*255/63;
      count++;
    }
    materials.set(key,particleMaterial(rgb.map(v=>v/Math.max(1,count))));
  }
  return materials.get(key);
}

export const PARTICLE_SURFACES={
  sand:{dust:[219,187,124],chunk:[181,139,72],rise:2.7,drift:1,gravity:22,size:.8},
  grass:{dust:[151,128,86],chunk:[88,151,43],rise:2.3,drift:.8,gravity:18,size:1},
  dirt:{dust:[166,132,89],chunk:[111,77,40],rise:3,drift:1,gravity:18,size:1},
  snow:{dust:[230,240,249],chunk:[199,221,239],rise:4,drift:1.5,gravity:10,size:1.15},
};
