import { createDirtEffects } from './dirt.js';
import { createTerrainSuspension } from './suspension.js';
import { trackTerrain } from './terrain.js';
import { createDiveEffects } from './dive-effects.js';
import { classifyLiquids } from '../liquids.js';
import { underwaterKart, periscopeVisual, createDiveMotion } from './periscope.js';
import { createWakes } from './wakes.js';
import { trackKartUnits } from './kart-scale.js';
import { createSplashes, waterSurface } from './water.js';
import { headingOf } from '../game/shots.js';
import { kartMesh } from './kart-rig.js';
import { kartPose } from './kart-pose.js';
import { createTyreEffects } from './tyre-effects.js';
import { shakenCamera } from './camera-shake.js';
import { createImpacts } from './impacts.js';
import { createCollections } from './collection.js';
import { crashGone } from '../game/headon.js';
import { hopOf } from '../game/effects.js';
import { playerGeometry } from '../game/player-car.js';
import { startPresentation } from './start.js';
import { stampKartShadow } from './shadows.js';
import { LIGHTING_PRESETS } from './lighting.js';
import { carFrame } from '../game/control.js';
import { createWheelMotion } from './wheels.js';
import { kartProjection } from './shadows.js';
import { LEAN, MODEL } from '../game/car-model.js';
import { KART_NAMES } from './mesh.js';

// A presentation-only adapter: records retain the original game's anchors and scale.
// Geometry is rotated and shaded live; no directional images or readback are used.
export function createVoxelKarts({ mapping, racerOf, headingVectorAt, projectAt = null }) {
  const meshes = new Map(), rearWidths = new WeakMap();
  // Use the opaque rear sprite width, excluding padding, as a stable scale for
  // all headings. A tall driver's head must not shrink the wheels and chassis.
  function rearWidth(world, slot, rear) {
    const shape = world.carShape?.[0], cars = world.carFrames?.cars;
    if (!shape || !cars || !Number.isInteger(rear)) return 1;
    let widths = rearWidths.get(world);
    if (!widths) { widths = new Map(); rearWidths.set(world, widths); }
    if (!widths.has(slot)) {
      const start = carFrame(slot, rear) * shape.w * shape.h;
      let lo = shape.w, hi = -1;
      for (let x = 0; x < shape.w; x++) for (let y = 0; y < shape.h; y++) {
        if (cars[start + x * shape.h + y]) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
      }
      widths.set(slot, hi >= lo ? (hi - lo + 1) / shape.w : 1);
    }
    return widths.get(slot);
  }
  const suspension=createTerrainSuspension(), dirt=createDirtEffects();
  let offroadDust=true,richSky=true,reduceShimmer=true;
  const splashes=createSplashes(), wakes=createWakes(), dive=createDiveMotion(), diveEffects=createDiveEffects();
  const diving=(P,fine)=>{
    const underwater=(P.car.special||P.fx?.pit) && Number.isFinite(P.car.specialValue) && underwaterKart(P.car,P.fx,classifyLiquids(P.world).kinds.get(P.car.specialValue));
    return dive.sample(P,fine.time??0,underwater);
  };
  const wheelMotion = createWheelMotion(), collections = createCollections(), impacts = createImpacts(), tyres = createTyreEffects(headingVectorAt);
  let rawState = null;
  let cameraShake = true, reflections = true, wakeEffects = true, headlights = true, taillights = true, lampGlow = true, headlightShadows = true, smooth = true, terrain = true, diveWaterEffects = true;
  let lighting = 'toy', scenery = 'studio', weapons = 'studio', water = 'waves', track = true, scene = null;
  let enabled = false, available = false, drawing = false, items = [];
  return {
    resetCollections() { dirt.reset(); suspension.reset(); diveEffects.reset(); dive.reset(); collections.reset(); impacts.reset(); tyres.reset(); splashes.reset(); wakes.reset(); },
    afterTick(state,time,prev,cur) { if(this.active && track) { collections.tick(state,time); impacts.tick(state,time); if(water==='waves'){splashes.tick(state,time);if(wakeEffects)wakes.tick(state,time);else wakes.reset();}else{splashes.reset();wakes.reset();} if(cur) tyres.emit(prev,cur,meshes.get(state.humanSlot ?? state.slots?.[0] ?? 7)); } else { collections.reset(); impacts.reset(); tyres.reset(); splashes.reset(); wakes.reset(); } },
    get diveWaterEffects() { return diveWaterEffects; }, set diveWaterEffects(value) { diveWaterEffects=Boolean(value);diveEffects.reset(); },
    get reduceShimmer() { return reduceShimmer; }, set reduceShimmer(value) { reduceShimmer=Boolean(value); },
    get richSky() { return richSky; }, set richSky(value) { richSky=Boolean(value); },
    get offroadDust() { return offroadDust; }, set offroadDust(value) { offroadDust=Boolean(value); dirt.reset(); },
    get terrain() { return terrain; }, set terrain(value) { terrain=Boolean(value); suspension.reset(); dirt.reset(); },
    get smooth() { return smooth; }, set smooth(value) { smooth = Boolean(value); },
    get headlightShadows() { return headlightShadows; }, set headlightShadows(value) { headlightShadows = Boolean(value); },
    get lampGlow() { return lampGlow; }, set lampGlow(value) { lampGlow = Boolean(value); },
    get taillights() { return taillights; }, set taillights(value) { taillights = Boolean(value); },
    get headlights() { return headlights; }, set headlights(value) { headlights = Boolean(value); },
    get cameraShake() { return cameraShake; }, set cameraShake(value) { cameraShake = Boolean(value); },
    get reflections() { return reflections; }, set reflections(value) { reflections = Boolean(value); },
    get wakes() { return wakeEffects; }, set wakes(value) { wakeEffects = Boolean(value); wakes.reset(); },
    get water() { return water; }, set water(value) { water = value === 'flat' ? 'flat' : 'waves'; splashes.reset(); wakes.reset(); diveEffects.reset(); },
    get weapons() { return weapons; }, set weapons(value) { weapons = value === 'procedural' ? 'procedural' : 'studio'; },
    get scenery() { return scenery; }, set scenery(value) { scenery = value === 'studio' ? 'studio' : 'procedural'; },
    get track() { return track; }, set track(value) { track = Boolean(value); },
    get lighting() { return lighting; },
    set lighting(name) { lighting = Object.hasOwn(LIGHTING_PRESETS, name) ? name : 'toy'; },
    get enabled() { return enabled; }, set enabled(v) { enabled = Boolean(v); },
    get available() { return available; }, set available(v) { available = Boolean(v); },
    get active() { return enabled && available && meshes.size > 0; },
    get count() { return meshes.size; },
    install(slot, project) {
      if (!Number.isInteger(slot) || slot < 0 || slot >= KART_NAMES.length) throw new Error('Unknown kart slot.');
      meshes.set(slot, kartMesh(project));
    },
    begin(state, ready, alpha = 1) { rawState = state; scene = null; wheelMotion.begin(state.world, state.tick ?? 0, alpha); items = []; drawing = this.active && ready && !state.duck && !(state.versus && !state.linkPlay); },
    frame(depth, kind, cap = 255, fog = null) { return drawing && (items.length || scene) ? { items: items.slice(), depth, kind, cap, fog, lighting, atmosphere: this.atmosphere, scene } : null; },
    trackScene(P, fine, sun) {
      if (!drawing || meshes.size !== 8 || !track || P.versus) return;
      const seat = fine.seats[0], opening = startPresentation(P, fine, headingVectorAt), forward = opening.forward;
      const sunDirection = headingVectorAt(P.world, sun.angle * (mapping().turn ?? 1920));
      const terrainModel=terrain?trackTerrain(P.world):null;
      if(offroadDust&&terrainModel)dirt.begin(P.world,fine.time);else dirt.reset();
      const waterLevelAt=(x,z)=>terrainModel?.waterLevelAt?.(x,z)??terrainModel?.waterLevel??0;
      const groundAt=(x,z)=>terrainModel?(terrainModel.waterAt(x,z)?0:terrainModel.heightAt(x,z)):0;
      const racers = [], accessories = [];
      let cameraGround=groundAt(seat.px,seat.py);
      const immersion=diving(P,fine);
      if(diveWaterEffects && water==='waves')diveEffects.sample(P,fine.time,immersion.amount,{x:seat.px,y:seat.py},immersion.active && waterSurface(P.world).at(seat.px,seat.py)===1);
      else diveEffects.reset();
      const ownMesh=meshes.get(P.humanSlot ?? P.slots[0]),ownUnits=trackKartUnits(ownMesh);
      if(immersion.scope>0) {
        const direction=headingVectorAt(P.world,opening.kartHeading);
        const scope=periscopeVisual(P.car,{}, {x:seat.px,y:seat.py},Math.atan2(direction[0],direction[1]),ownUnits,fine.time);
        scope.position[1]+=waterLevelAt(seat.px,seat.py);
        scope.position[1]-=(scope.mesh.bounds[1]+3)*ownUnits*(1-immersion.scope);
        accessories.push(scope);
      }
      const add = (slot, point, heading, id, raw, steering = null, pose = {}) => {
        const mesh = meshes.get(slot);
        if (!mesh || !point || pose.hidden) return;
        const direction = headingVectorAt(P.world, heading);
        const units = trackKartUnits(mesh);
        const wheels = mesh.wheelRadius ? wheelMotion.pose(id, raw, direction, mesh.wheelRadius * units, mesh.wheelbase * units, steering) : null;
        const yaw=Math.atan2(direction[0],direction[1])+(pose.spin??0);
        const ride=suspension.sample(id,{world:P.world,tick:P.tick,time:fine.time,x:point.x,z:point.y,yaw,
          width:mesh.bounds[0]*units*.8,length:(mesh.wheelbase||mesh.bounds[2]*.7)*units,
          terrain:terrainModel,grounded:pose.grounded!==false&&!pose.pit});
        if(id==='seat:0')cameraGround=ride.cameraHeight;
        if(offroadDust)dirt.sample(id,{x:point.x,z:point.y,yaw,time:fine.time,terrain:terrainModel,
          grounded:pose.grounded!==false&&!pose.pit,
          contacts:mesh.parts.filter(part=>part.wheel&&!part.front).map(part=>[part.pivot[0]*units,part.pivot[2]*units])});
        const tilt=(pose.tilt??[0,0]).map((angle,i)=>angle+ride.tilt[i]);
        racers.push({mesh, braking: Boolean(pose.braking), position: [point.x, (id!=='seat:0'&&terrainModel?.waterAt(point.x,point.y)?waterLevelAt(point.x,point.y):ride.height)+(pose.height ?? (pose.pit ? -mesh.bounds[1] * units * .25 : 0)), point.y], yaw, units, wheels, animation:{tilt,head:pose.head??0}});
      };
      // Read the simulation's animation state; neither the camera nor the renderer
      // changes when a kart is hit, airborne, submerged, hidden or respawned.
      const crash = P.fx?.crash;
      const height = crash ? (playerGeometry(P.world).top - crash.top) * MODEL().cameraBehind / 277 : hopOf(P.car) * MODEL().cameraBehind / 277;
      const motionPose=kartPose({...P.car,lean:seat.lean??P.car.lean},P.fx??{},P.tick);
      const pose = {...motionPose, hidden: Boolean(P.fx?.hidden || (P.car.wrecked && P.car.wreckShown >= 4)),
        grounded: !crash&&!P.car.crashed&&!P.car.wrecked&&!P.car.jump&&!height&&!immersion.active,
        height: crash || height ? height+motionPose.lift : motionPose.lift || undefined, pit: Boolean(P.fx?.pit || P.car.special),
        spin: motionPose.spin, braking: P.car.braking && !P.car.crashed && !P.car.wrecked};
      if(immersion.active) {
        pose.hidden=false;pose.pit=false;
        pose.height=(-(ownMesh.bounds[1]+3)*ownUnits+waterLevelAt(seat.px,seat.py))*immersion.amount;
        pose.tilt=[.12*Math.sin(immersion.amount*Math.PI),0];
      }
      if(immersion.amount<1)add(P.humanSlot ?? P.slots[0], {x: seat.px, y: seat.py}, opening.kartHeading, 'seat:0', {x: rawState.car.px, y: rawState.car.py}, ((seat.lean ?? P.car.lean ?? 2) - 2) * .225, pose);
      for (let n = 1; n < (P.ai?.racers.length ?? 0); n++) {
        const who = racerOf({racer: n}, P, P.world, mapping());
        if (who) {
          const racer = P.ai.racers[n];
          add(who.slot, fine.racers[n], fine.racers[n]?.direction ?? who.direction, `racer:${n}`, rawState.ai.racers[n], null,
            {...kartPose(racer,{},P.tick,true),grounded:!racer.hit&&!racer.crashed&&!racer.jump&&!racer.special,hidden: crashGone(racer), braking: !racer.hit && !racer.crashed && P.tick < (racer.visualBrakeUntil ?? 0)});
        }
      }
      const hits = impacts.frame(fine.time);
      const camera = shakenCamera(opening.camera, forward, {x:seat.px,y:seat.py}, hits, cameraShake);
      camera[1]+=cameraGround+waterLevelAt(seat.px,seat.py)*immersion.amount;
      scene = {world: P.world, reduceShimmer, richSky, terrain, dirt:dirt.frame(fine.time), diveEffects:diveEffects.frame(fine.time), headlights, taillights, lampGlow, headlightShadows, scenery, weapons, water, reflections, wakes: wakes.frame(fine.time), splashes: splashes.frame(fine.time), time: fine.time, collections: collections.frame(fine.time), impacts: hits, tyres: tyres.frame(fine.time), camera, forward, racers, accessories, starter: opening.starter,
        objects: (P.player?.objects ?? P.world.objects).map(o => ({...o})),
        shots: fine.shots.flatMap((point, index) => {
          const shot = P.shots?.[index];
          if (!point || !shot?.active) return [];
          const direction = headingVectorAt(P.world, headingOf(shot, P.car.heading, MODEL().turn));
          return [{...shot, ...point, index, yaw: Math.atan2(direction[0], direction[1])}];
        }),
        sun: [-sunDirection[0], 1 / Math.max(sun.length, .1), -sunDirection[1]]};
    },
    stampShadows(shade, width, height, gridScale = 1) {
      if (drawing) for (const item of items) stampKartShadow(shade, width, height, item, gridScale);
    },
    capture(r, P, fine, seat, camera, G, sun = {}) {
      const immersion=drawing && r.type===0?diving(P,fine):{amount:0,scope:0,active:false};
      if (!drawing || (r.skip&&!immersion.active) || (r.type !== 0 && r.type !== 1)) return false;
      const own = r.type === 0 || (P.intro && r.racer === 0), M = mapping(), who = own ? null : racerOf(r, P, P.world, M);
      if (!own && !who) return false;
      const slot = own ? P.humanSlot ?? P.slots?.[0] ?? 7 : who.slot, mesh = meshes.get(slot);
      if (!mesh) return false;
      const direction = own ? fine.seats[seat]?.dir ?? P.car.heading : who.direction;
      if (!Number.isFinite(direction)) return false;
      const f = headingVectorAt(P.world, camera.heading), d = headingVectorAt(P.world, direction);
      // Camera's right vector is (-forward.y, forward.x), matching project.js.
      let yaw = Math.atan2(d[1] * f[0] - d[0] * f[1], d[0] * f[0] + d[1] * f[1]);
      const pose=kartPose(own?P.car:P.ai?.racers?.[r.racer],own?P.fx??{}:{},P.tick??0,!own);
      yaw += pose.spin;
      const w = r.smooth?.w ?? G.s * r.picture.w, h = r.smooth?.h ?? G.s * r.picture.h;
      const x = r.place ? r.place.x + w / 2 : r.left - r.firstColumn + r.picture.w / 2;
      const y = r.place ? r.place.y + h : r.top + r.picture.h;
      const light = headingVectorAt(P.world, (sun.angle ?? .4) * (M.turn ?? 1920));
      // The track angle points along cast shadows; illumination comes from the opposite direction.
      const sunVector = [light[0] * f[1] - light[1] * f[0], 1 / Math.max(sun.length ?? 1, .1), -(light[0] * f[0] + light[1] * f[1])];
      const groundY = own && Number.isFinite(sun.ground) ? sun.ground * G.s : y;
      const referenceWidth = (P.world.carShape?.[0]?.w ?? r.picture.w) * rearWidth(P.world, slot, M.rear);
      const referenceDistance = MODEL().cameraBehind;
      // Use the unrounded distance of the same point/camera used to place the
      // racer, including the intro human and the other network player. Preserve
      // the port's ground anchors and wide-view depth convention.
      const human = P.intro && r.racer === 0 ? fine.seats[seat] : P.versus && r.racer === 1 ? fine.seats[1 - seat] : null;
      const point = human ? { x: human.px, y: human.py } : fine.racers?.[r.racer] ?? P.ai?.racers?.[r.racer];
      const projected = !own && point && projectAt ? projectAt(P.world, camera, point.x, point.y, G.m ?? 0) : null;
      const distance = projected?.distance > 0 ? projected.distance : r.distance;
      const item = { sunVector, mesh, slot, x, y, groundY, w, h, referenceWidth, referenceDistance, yaw, distance, scale: G.s, tilt:pose.tilt, head:pose.head };
      if(immersion.active) {
        item.waterClip=true;item.waterOffset=-(mesh.bounds[1]+3)*immersion.amount;
        if(immersion.scope>0) {
          const scope=periscopeVisual(P.car,{}, {x:0,y:0},yaw,1,fine.time);
          const scopeItem={...item,mesh:scope.mesh,referenceWidth:referenceWidth*scope.mesh.bounds[0]/mesh.bounds[0],
            yaw:scope.yaw,tilt:scope.animation.tilt,head:0,
            waterOffset:scope.position[1]-(scope.mesh.bounds[1]+3)*(1-immersion.scope)};
          items.push(scopeItem);
        }
      }
      if (mesh.wheelRadius) {
        const car = rawState.car, racer = rawState.ai?.racers?.[r.racer];
        const point = own ? { x: car.px, y: car.py } : racer;
        const wheelDirection = own ? car.heading : direction;
        const forward = headingVectorAt(P.world, wheelDirection);
        const { units } = kartProjection(item);
        const steering = own ? ((car.lean ?? LEAN().straight) - LEAN().straight) / (LEAN().right - LEAN().straight) * .45 : null;
        item.wheels = wheelMotion.pose(own ? `seat:${seat}` : `racer:${r.racer}`, point, forward, mesh.wheelRadius * units, mesh.wheelbase * units, steering);
      }
      if(immersion.amount<1)items.push(item);
      return true;
    },
  };
}
