import studioHog from './assets/weapon-hog.json' with { type: 'json' };
import studioFire from './assets/weapon-fire.json' with { type: 'json' };
import studioDevil from './assets/weapon-devil.json' with { type: 'json' };
import studioBomb from './assets/weapon-bomb.json' with { type: 'json' };
import studioOil from './assets/weapon-oil.json' with { type: 'json' };
import studioInverted from './assets/weapon-inverted.json' with { type: 'json' };
import studioIce from './assets/weapon-ice.json' with { type: 'json' };
import { voxelMesh } from './mesh.js';

// Small, genuinely volumetric weapon models. +Z is the direction of travel.
// Rendering is presentation-only: shot slots, hit tests and lifetimes stay in shots.js.
export function weaponKind(shot) {
  return shot.type === 0 ? ((shot.sourceBlock ?? shot.block) === 0x57c ? 'fire' : 'hog') :
    ['hog', 'devil', 'bomb', 'oil', 'inverted', 'ice'][shot.type] ?? 'hog';
}

const studioProjects = {hog:studioHog,fire:studioFire,devil:studioDevil,bomb:studioBomb,oil:studioOil,inverted:studioInverted,ice:studioIce};

export function weaponMeshes(source = 'procedural') {
  const models = {};
  for (const kind of ['hog', 'fire', 'devil', 'bomb', 'oil', 'inverted', 'ice']) {
    const cells = [];
    for (let x=0;x<16;x++) for(let y=0;y<16;y++) for(let z=0;z<16;z++) {
      const dx=x-7.5, dy=y-6, dz=z-7;
      let color=null;
      if(kind==='hog'||kind==='inverted') {
        if(dx*dx/23+dy*dy/16+dz*dz/30<1) color=y>6?[106,65,35]:[186,133,77];
        if(y>=8&&y<=11&&Math.abs(dx)<5&&Math.abs(dz)<5&&(x+z)%3===0) color=[76,46,28];
        if(Math.abs(dx)<3&&y>=4&&y<=7&&z>=11&&z<=14) color=z===14?[38,30,29]:[217,169,108];
        if(Math.abs(dx)===2.5&&y===7&&z===11) color=[18,21,24];
        if(y<4&&y>=2&&Math.abs(dx)>2&&Math.abs(dx)<4&&Math.abs(dz)>2&&Math.abs(dz)<5) color=[104,65,40];
      } else if(kind==='bomb') {
        if(dx*dx+dy*dy+dz*dz<25) color=x<6?[76,83,96]:[33,39,49];
        if(x===8&&z===7&&y>=11&&y<15) color=[176,129,65];
      } else if(kind==='oil') {
        if(y<=1&&dx*dx/45+dz*dz/36<1) color=(x+z)%4===0?[49,47,69]:[25,29,38];
      } else if(kind==='ice') {
        if(Math.abs(dx)+Math.abs(dy)*.8+Math.abs(dz)*.65<6) color=x<8?[173,243,255]:[58,161,233];
      } else if(kind==='fire') {
        if(dx*dx+dy*dy+dz*dz<20||z<7&&Math.abs(dx)+Math.abs(dy)<z*.7) color=dx*dx+dy*dy<4?[255,244,137]:[255,112,25];
      } else {
        if(dx*dx/20+dy*dy/23+dz*dz/14<1) color=[197,38,46];
        if(y>=10&&y<14&&Math.abs(dx)>2&&Math.abs(dx)<5&&Math.abs(dz)<2) color=[249,213,157];
        if(y===7&&z===11&&Math.abs(dx)>1&&Math.abs(dx)<4) color=[255,228,105];
        if(y>=4&&y<=8&&Math.abs(dx)>4&&Math.abs(dx)<7&&Math.abs(dz)<2) color=[124,25,39];
      }
      if(color) cells.push([x,kind==='inverted'?15-y:y,z,...color]);
    }
    models[kind]=voxelMesh({size:16,voxels:cells});
    if(source==='studio') {
      const project=studioProjects[kind], mesh=voxelMesh(project);
      // Match the original weapon's maximum physical extent, preserving the
      // authored proportions. More cells add detail, not a larger hit target.
      const scale=Math.max(...models[kind].bounds)/Math.max(...mesh.bounds);
      for(let i=0;i<mesh.vertices.length;i+=10) for(let a=0;a<3;a++) mesh.vertices[i+a]*=scale;
      for(const part of mesh.parts) part.pivot=part.pivot.map(v=>v*scale);
      if(kind==='bomb') {
        const lo=[0,1,2].map(a=>Math.min(...project.voxels.map(v=>v[a])));
        const hi=[0,1,2].map(a=>Math.max(...project.voxels.map(v=>v[a]))+1);
        const tip=project.voxels.filter(v=>v[1]===hi[1]-1);
        mesh.fuse=[(tip.reduce((n,v)=>n+v[0]+.5,0)/tip.length-(lo[0]+hi[0])/2)*scale,
          (hi[1]-lo[1])*scale,(tip.reduce((n,v)=>n+v[2]+.5,0)/tip.length-(lo[2]+hi[2])/2)*scale];
      }
      mesh.bounds=mesh.bounds.map(v=>v*scale);models[kind]=mesh;
    }
    if(kind==='hog') for(let i=1;i<models[kind].vertices.length;i+=10) models[kind].vertices[i]-=models[kind].bounds[1]/2;
  }
  for(const [name,color] of Object.entries({hot:[255,249,192],flame:[255,91,12],ember:[255,159,39],frost:[153,232,255],soot:[70,64,61],drop:[38,32,51]}))
    models[name]=voxelMesh({size:1,voxels:[[0,0,0,...color]]});
  return models;
}

// Pure snapshot evaluation keeps paused frames and replayed frames identical.
export function weaponVisuals(shots, time, meshes) {
  const solids=[];
  const add=(kind,position,yaw,units,emission=0,noShadow=false,tilt=[0,0])=>
    solids.push({mesh:meshes[kind],position,yaw,units,noShadow,animation:{emission,tilt}});
  for(const shot of shots) {
    const kind=weaponKind(shot), yaw=shot.yaw??0, phase=time*.012+(shot.index??0)*2.4;
    const stationary=['bomb','oil','inverted'].includes(kind), height=stationary ? .12 : 2.2;
    if(shot.state===255) {
      const t=(Math.min(2,shot.frame??0)+.5)/3;
      if(kind==='fire')for(let n=0;n<12;n++) {
        const angle=n*Math.PI/6,radius=5+14*t;
        add(n%3?'flame':'hot',[shot.x+Math.cos(angle)*radius,1.5+Math.sin(n*2.4)**2*7*t,shot.y+Math.sin(angle)*radius],angle,
          (1-t)*2.3+.2,1,true,[t*4,angle]);
      }
      const particle=kind==='ice'?'frost':kind==='oil'?'drop':'ember';
      for(let n=0;n<14;n++) {
        const a=n*2.39996, radius=(3+8*t)*(n%3+1)/3;
        add(n%4===0&&particle==='ember'?'soot':particle,
          [shot.x+Math.cos(a)*radius,.5+Math.sin((n+1)*1.7)**2*10*t,shot.y+Math.sin(a)*radius],a+t*3,(1-t)*2+.3,particle==='ember'?1:.25,true);
      }
      continue;
    }
    const tumbling=kind==='hog';
    // Lift the rolling model around its centre so its bottom never clips the road.
    add(kind,[shot.x,tumbling?5:height,shot.y],yaw,.65,
      kind==='fire'?1:kind==='ice'?.35:0,kind==='fire',tumbling?[phase,0]:[0,0]);
    if(kind==='fire') {
      const fx=Math.sin(yaw),fz=Math.cos(yaw);
      // Layers flow backwards along travel; seeded phases keep paused frames stable.
      for(let n=0;n<9;n++) {
        const age=((phase*.19+n/9)%1+1)%1,angle=n*2.399+phase*.8;
        const distance=3+age*19,radius=(1-age)*2.4;
        add(n%3?'flame':'hot',[shot.x-fx*distance+Math.cos(angle)*radius,3+age*4+Math.sin(angle)*radius*.5,shot.y-fz*distance+Math.sin(angle)*radius],
          yaw+angle,1.8*(1-age)+.2,1,true,[phase+n,angle]);
      }
      for(let n=0;n<8;n++) {
        const age=((phase*.11+n/8)%1+1)%1,side=Math.sin(n*8.3)*age*6;
        add('ember',[shot.x-fx*(8+age*25)+fz*side,3+age*8,shot.y-fz*(8+age*25)-fx*side],phase+n,.65*(1-age)+.12,1,true);
      }
    }
    if(kind==='bomb') {
      const fuse=meshes.bomb.fuse??[0,(9.3-height)/.65,0], c=Math.cos(yaw),s=Math.sin(yaw);
      add('ember',[shot.x+(-c*fuse[0]+s*fuse[2])*.65,height+fuse[1]*.65,shot.y+(s*fuse[0]+c*fuse[2])*.65],phase,.7+.3*Math.sin(phase*3),1,true);
    }
    if(!stationary&&kind!=='fire') for(let n=1;n<=4;n++) {
      const distance=n*2.1, jitter=Math.sin(phase+n*2)*.6;
      const particle=kind==='ice'?'frost':kind==='fire'||kind==='devil'?'ember':'soot';
      add(particle,[shot.x-Math.sin(yaw)*distance+jitter,2.6+n*.25,shot.y-Math.cos(yaw)*distance],phase+n,
        (5-n)*.22,particle==='ember'?1:particle==='frost'?.5:0,true);
    }
  }
  return solids;
}

let fireHalo;
export function fireballGlows(shots,time,forward) {
  if(!fireHalo){
    const vertices=[];
    for(const [u,v] of [[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]])vertices.push((u-.5)*2,(v-.5)*2,0,0,0,1,u,v,0,1);
    fireHalo={vertices:new Float32Array(vertices),count:6,parts:[{first:0,count:6,pivot:[0,0,0]}]};
  }
  return shots.filter(s=>weaponKind(s)==='fire').map(shot=>{
    const burst=shot.state===255,t=(Math.min(2,shot.frame??0)+.5)/3;
    return {mesh:fireHalo,position:[shot.x,5,shot.y],yaw:Math.atan2(-forward[0],-forward[1]),
      units:burst?9+t*13:9+Math.sin(time*.025+(shot.index??0))*1.2,color:[1,.29,.035],
      animation:{opacity:burst?.5*(1-t):.27}};
  });
}
