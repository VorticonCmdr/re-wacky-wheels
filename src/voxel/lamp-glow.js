import { atmosphereLight } from '../time-of-day.js';

const cache=new WeakMap();
function haloMesh(mesh,rear,braking) {
  let variants=cache.get(mesh);
  if(!variants){variants=new Map();cache.set(mesh,variants);}
  const key=rear?(braking?'brake':'tail'):'head';
  if(variants.has(key))return variants.get(key);
  const width=mesh.bounds[0],radius=width*(rear?(braking?.17:.11):.13),sign=rear?-1:1;
  const height=(mesh.wheelRadius||mesh.bounds[1]*.15)*(rear?1.35:1.2);
  const vertices=[];
  for(const side of [-1,1])for(const [u,v] of [[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]]) {
    vertices.push(side*width*.28+(u-.5)*radius*2,height+(v-.5)*radius*2,
      sign*(mesh.bounds[2]/2+width*.04+.25),0,0,sign,u,v,0,1);
  }
  const out={vertices:new Float32Array(vertices),count:12,parts:[{first:0,count:12,pivot:[0,0,0],emission:1}]};
  variants.set(key,out);return out;
}

export function kartLampGlows(racers,atmosphere,{lampGlow=true,headlights=true,taillights=true}={}) {
  const night=Math.max(0,Math.min(1,(1-atmosphereLight(atmosphere).sun)/.85));
  if(!lampGlow||night===0)return [];
  return racers.flatMap(({mesh,position,yaw,units,animation,braking})=>{
    const make=(rear)=>({mesh:haloMesh(mesh,rear,braking),position,yaw,units,
      color:rear?[1,.055,.015]:[1,.78,.42],
      animation:{...animation,opacity:night*(rear?(braking?.5:.19):.28)}});
    return [...(headlights?[make(false)]:[]),...(taillights?[make(true)]:[])];
  });
}
