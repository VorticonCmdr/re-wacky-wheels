import assert from 'node:assert/strict';
import { openGameFolder } from '../src/vfs/node.js';
import { loadTrack, archiveMembers } from '../src/game/track-data.js';
import { createCar } from '../src/game/car.js';
import { startIntro, stepIntro } from '../src/game/intro.js';
import { createStart, stepStart } from '../src/game/start.js';
import { headingVectorAt } from '../src/enhance/project.js';
import { capture, blend } from '../src/enhance/motion.js';
import { startPresentation } from '../src/voxel/start.js';

const dat=await(await openGameFolder()).open('WACKY.DAT');
const names=[...archiveMembers(dat).keys()].filter(n=>/^\d+\.GAM$/.test(n)).map(n=>n.split('.')[0]);
let samples=0;
for(const name of names) {
  const world=loadTrack(dat,name), initial=createCar(world.start,world);
  let {car,intro}=startIntro(initial),start=createStart(),time=0,last;
  let previous=capture({world,car,intro,tick:0},time);
  for(let guard=0;guard<100&&intro;guard++) {
    const P={world,car,intro,start,lionShown:true,tick:0};
    for(const alpha of [0,.5,1]) {
      const view=startPresentation(P,blend(previous,capture(P,time),alpha),headingVectorAt);
      assert(view.camera.every(Number.isFinite));assert.equal(view.kartHeading,world.start.heading);samples++;
    }
    previous=capture(P,time);({car,intro}=stepIntro(world,car,intro));time+=50;
  }
  assert.equal(intro,null);
  const fine=capture({world,car,intro,tick:0},time), direction=headingVectorAt(world,car.heading);
  const expected=[car.px-direction[0]*124,39.5,car.py-direction[1]*124];
  // The final interpolation frame must finish at the countdown's camera.
  const end=startPresentation({world,car,intro,start},blend(previous,fine,1),headingVectorAt);
  assert(end.camera.every((v,a)=>Math.abs(v-expected[a])<1e-6),`Track ${name}: fly-in handoff`);
  for(let i=0;i<36;i++) {
    const p=startPresentation({world,car,intro,start,lionShown:true},fine,headingVectorAt);
    assert(p.camera.every((v,a)=>Math.abs(v-expected[a])<1e-6),`Track ${name}: countdown camera`);
    if(last)assert(p.camera.every((v,a)=>Math.abs(v-last[a])<1e-6));
    last=p.camera;start=stepStart(start).start;samples++;
  }
}
console.log(`${names.length} layouts: ${samples} fly-in/countdown samples; stable grid headings and continuous camera handoffs.`);
