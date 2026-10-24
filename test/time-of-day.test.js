import test from 'node:test';
import assert from 'node:assert/strict';
import { timeAtmosphere, atmosphereLight, loadTime, saveTime } from '../src/time-of-day.js';
import { createEnhancer } from '../src/enhance/index.js';

test('time choices preserve saved track settings and Now follows local clock boundaries', () => {
  const base={grade:'overcast',gradeStrength:.6,fog:.7,water:.8,sunAngle:.2};
  assert.equal(timeAtmosphere(base,'track'),base);
  for(const [hour,minute,grade] of [[5,59,'night'],[6,0,'dawn'],[7,59,'dawn'],[8,0,'none'],[17,59,'none'],[18,0,'dusk'],[19,59,'dusk'],[20,0,'night']]) {
    const a=timeAtmosphere(base,'now',new Date(2026,9,24,hour,minute));
    assert.equal(a.grade,grade);assert.equal(a.fog,base.fog);assert.equal(a.water,base.water);
  }
  assert.equal(base.grade,'overcast');
  assert.equal(timeAtmosphere(base,'day').grade,'none');
  const day=atmosphereLight(timeAtmosphere(base,'day')),night=atmosphereLight(timeAtmosphere(base,'night'));
  assert(night.sun<day.sun);assert(night.sky<day.sky);
  assert(night.skyColor.every((v,i)=>v<day.skyColor[i]));
  assert.deepEqual(atmosphereLight({grade:'night',gradeStrength:0}),day);
});

test('race time selection persists without replacing track atmosphere data; blocked storage is optional', () => {
  const values=new Map(), storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  const enh=createEnhancer({storage});
  assert.equal(enh.timeOfDay,'random');
  enh.beginRace();
  const raceAtmosphere=enh.atmosphereOf({name:'1'});
  assert(['none','dusk','night'].includes(raceAtmosphere.grade));
  enh.reset();
  assert.deepEqual(enh.atmosphereOf({name:'1'}),raceAtmosphere);
  enh.timeOfDay='night';
  assert.equal(enh.atmosphereOf({name:'1'}).grade,'night');
  assert.equal(createEnhancer({storage}).timeOfDay,'night');
  enh.timeOfDay='track';assert.equal(enh.atmosphereOf({name:'1'}).grade,'none');
  saveTime('__proto__',storage);assert.equal(loadTime(storage),'random');
  const broken={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  assert.equal(loadTime(broken),'random');assert.doesNotThrow(()=>saveTime('night',broken));
});
