import { outsideScenery } from './outside-scenery.js';
import { particleSurfaceAt } from './particle-surface.js';

const cache=new WeakMap();
// Decorative terrain only: never extends the collision, route or liquid maps.
export function outsideTerrain(world,terrain) {
  if(!terrain)return null;
  if(cache.has(world))return cache.get(world);
  const step=64,origin=-3072,n=160,heights=new Float32Array(n*n),active=new Uint8Array(n*n);
  const votes={grass:0,sand:0,snow:0,dirt:0};
  for(let z=1056;z<3072;z+=128)for(let x=1056;x<3072;x+=128)votes[particleSurfaceAt(world,x,z)]++;
  const theme=votes.snow>20?'snow':votes.grass>20?'grass':votes.sand>votes.dirt?'sand':'dirt';
  const colors={grass:[.24,.43,.12],sand:[.64,.49,.27],snow:[.78,.85,.9],dirt:[.40,.35,.27]},color=colors[theme];
  const edge=(x,z)=>terrain.heightAt(Math.max(1024,Math.min(3071,x)),Math.max(1024,Math.min(3071,z)));
  for(let z=0;z<n;z++)for(let x=0;x<n;x++) {
    const wx=origin+x*step,wz=origin+z*step,i=z*n+x;
    if(wx>=1024&&wx<3072&&wz>=1024&&wz<3072)continue;
    active[i]=1;
    const d=Math.max(1024-wx,wx+step-3072,1024-wz,wz+step-3072,0);
    const blend=Math.min(1,d/512);
    const hill=12+24*(Math.sin(wx*.004)+Math.cos(wz*.003)+Math.sin((wx+wz)*.002));
    heights[i]=Math.round((edge(wx+32,wz+32)*(1-blend)+hill*blend)/4)*4;
  }
  const vertices=[];
  const face=(points,normal,shade)=>{
    for(const j of [0,1,2,0,2,3])vertices.push(...points[j],...normal,...color.map(c=>c*shade),1);
  };
  for(let z=0;z<n;z++)for(let x=0;x<n;x++) {
    const i=z*n+x;if(!active[i])continue;
    const x0=origin+x*step,x1=x0+step,z0=origin+z*step,z1=z0+step,h=heights[i];
    const shade=.92+.08*Math.sin(x*13+z*7);
    face([[x0,h,z0],[x1,h,z0],[x1,h,z1],[x0,h,z1]],[0,1,0],shade);
    for(const [dx,dz,normal] of [[-1,0,[-1,0,0]],[1,0,[1,0,0]],[0,-1,[0,0,-1]],[0,1,[0,0,1]]]) {
      const nx=x+dx,nz=z+dz,j=nz*n+nx;
      // Track already supplies the inner boundary walls; outside walls close
      // gaps when the coarse decorative ground sits higher than the map edge.
      const low=nx<0||nz<0||nx>=n||nz>=n?-80:active[j]?heights[j]:edge(x0+32+dx*step,z0+32+dz*step);
      if(low>=h)continue;
      if(dx){const xx=dx<0?x0:x1;face([[xx,low,z0],[xx,h,z0],[xx,h,z1],[xx,low,z1]],normal,shade*.85);}
      else{const zz=dz<0?z0:z1;face([[x0,low,zz],[x1,low,zz],[x1,h,zz],[x0,h,zz]],normal,shade*.85);}
    }
  }
  const decorations=outsideScenery(theme,(x,z)=>heights[Math.floor((z-origin)/step)*n+Math.floor((x-origin)/step)]);
  // Bake static props into the exterior batch: one upload and draw, sharing
  // terrain lighting, depth occlusion and fog without per-object draw overhead.
  for(const object of decorations) {
    const c=Math.cos(object.yaw),s=Math.sin(object.yaw),v=object.mesh.vertices;
    for(let i=0;i<v.length;i+=10)vertices.push(
      object.position[0]+(v[i]*c-v[i+2]*s)*object.units,object.position[1]+v[i+1]*object.units,
      object.position[2]+(v[i]*s+v[i+2]*c)*object.units,
      v[i+3]*c-v[i+5]*s,v[i+4],v[i+3]*s+v[i+5]*c,...v.slice(i+6,i+10));
  }
  const mesh={vertices:new Float32Array(vertices),count:vertices.length/10,parts:[{first:0,count:vertices.length/10,pivot:[0,0,0]}]};
  cache.set(world,mesh);return mesh;
}
