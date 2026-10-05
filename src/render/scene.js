// The picture of the world for the state's current viewer, as the race screen and the headless checks draw it: the sky and the horizon strip, the floor, then the draw list of the objects,
// the starter, the shots, the racers and the player's car (everything of the race frame except the HUD and the menus).
import { renderFloor } from './floor.js';
import { renderSky, renderHorizon } from './sky.js';
import { drawList } from './draw-list.js';
import { viewSetup } from '../game/view.js';
import { objectRecords, objectFrame } from '../game/objects.js';
import { playerRecord } from '../game/player-car.js';
import { shotRecords } from '../game/shots.js';
import { racerRecords, racerRecord, racerFrame, frameTable } from '../game/racers.js';
import { idleFrame, idleRef, starterRecord, stepStart } from '../game/start.js';
import { crashGone } from '../game/headon.js';
import { createStart } from '../game/start.js';
import { duckPicture, gone, skipped } from '../game/duck.js';
import { viewRacers, viewSlots } from '../game/versus.js';
import { SHOOT } from '../game/versus-rules.js';
import { duckPictures } from '../game/duck-rules.js';

// The pictures of the ducks for a draw (duck.pictures): the DIGGER.SP frame of the compass word (the spin frame while the duck is stunned) or the crash picture, as picture bytes.
function duckFrames(state) {
  const heading = state.car.heading;
  return state.ai.racers.map((r, n) => (n === 0 ? null : { bytes: duckPicture(state.world.duckArt, r, r.hit === 1 ? r.hitSpin : racerFrame(heading, r.compass)) }));
}

// The crash picture of a wrecked human (the GENEF.SP frames the ducks' explosions use), as picture bytes.
function crashBytes(world, pic) {
  const P = duckPictures(), at = P.explosion.at + pic * P.frameBytes;
  return world.duckArt.genef.subarray(at, at + P.frameBytes);
}

// A single player frame the page shows after the step of tick t is the frame the game draws at the head of its pass t + 1: the waiting pictures follow that counter (grabs of the running game of three races).
const COUNTDOWN = createStart().mode; // the mode of the countdown
const SHOWN_AHEAD = 1; // @math the draw of a pass shows the state after the step before it

// The racers of the draw: the computer racers, the ducks, or in a split game the other human. Returns the list of draw records.
function racerList(state, view, camera) {
  if (state.versus) {
    const racers = viewRacers(state), frames = racers.map((r, n) => (r.human ? (r.crashed && !r.gone ? { bytes: crashBytes(state.world, r.crashPic) } : (r.blink?.shown ?? (idleFrame(state.tick, r.mode) ?? null))) : n === 0 ? null : (r.blink?.shown ?? (r.hit === 1 ? r.hitSpin : idleFrame(state.tick, r.mode))))); // the computer racers of a two player race wait with the idle pictures of the start
    return racerRecords(state.world, view, camera, racers, camera.heading, viewSlots(state), frames, r => r.gone === true);
  }
  if (!state.ai) return [];
  const counting = state.start.mode === COUNTDOWN; // the countdown's images show the next pass's glance picture (SHOWN_AHEAD), the racing frames this pass's
  const waiting = state.ai.racers.map((r, n) => (n === 0 ? null : r.crashed && r.crashShown !== false ? { bytes: crashBytes(state.world, r.crashPic) } : state.intro ? null : (counting ? r.blink?.ahead : r.blink?.shown) ?? (r.hit === 1 ? r.hitSpin : null))); // the waiting pictures are the racers' glances (blink.js), none in the intro; a racer wrecked by a head-on shows its crash pictures (race.head-on)
  return racerRecords(state.world, view, camera, state.ai.racers, camera.heading, state.slots, state.duck ? duckFrames(state) : waiting, state.duck ? (r => gone(r) || skipped(r)) : crashGone);
}

// The human in the intro (race.intro): the camera is not on its car, so it is the racer 0 of the draw list at its place in the world, with the frame its compass word 0 picks for the camera's sector
// (a grab of the running game: the list has the racers 0 to 7 and no record of the own car).
function introHuman(state, view, camera) {
  const r = racerRecord(state.world, view, camera, { x: state.car.px, y: state.car.py, compass: 0, n: 0 }, camera.heading, state.slots[0], frameTable()); // @math the human's compass word is 0 at the start
  return r ? [r] : [];
}

// The player's own record: its car's picture, or the crash picture of a wrecked human (nothing once the picture word is above 3).
function ownRecord(state) {
  const record = playerRecord(state.world, state.car, idleRef(state, state.humanSlot ?? null, state.versus || state.start.mode !== COUNTDOWN ? 0 : SHOWN_AHEAD), state.humanSlot ?? undefined, state.fx);
  if (!state.car.wrecked) return record;
  return state.car.wreckShown < SHOOT().wreck.pictures ? { ...record, frame: crashBytes(state.world, state.car.wreckShown), after: [] } : { ...record, skip: true, after: [] };
}

// `sky(fb)` draws the sky and the horizon (the demo's own pictures); the default is the track's.
export function renderScene(state, fb, mode, sky = null) {
  const pre = state.beforeAnswer; // a frame that ends with the answer to a touch is drawn from the car as the move left it (a grab of the running game at a touch: the camera before the answer)
  const camera = { x: pre?.cx ?? state.car.cx, y: pre?.cy ?? state.car.cy, heading: pre?.heading ?? state.car.heading };
  fb.fill(0);
  if (sky) sky(fb); else { renderSky(state.world.sky, fb); renderHorizon(state.world.par, state.car.horizon, fb); }
  renderFloor(state.world, camera, mode, fb);
  const objects = state.player.objects.map((o, i) => ({ ...o, consumed: state.player.taken?.includes(i) ? 0 : o.consumed, frame: objectFrame(state.world, o.id, state.tick, state.animOffset) })), view = viewSetup(state.world, camera);
  const starter = state.duck || state.versus?.kind === 'shootout' || state.lionShown === false ? null : starterRecord(state.world, view, camera, state.world.start, stepStart(state.start).start.lion); // no starter in the duck game (duck.race-rules) or the shoot-out; its picture is the one of the next frame, like the waiting pictures (SHOWN_AHEAD)
  // the order the frame routine queues the things in (obj1+0x34e1 to +0x34ff): the racers, the objects, the own car, the starter, the shots; the sort leaves things of one distance in this order
  drawList(fb, [...(state.intro ? introHuman(state, view, camera) : []), ...racerList(state, view, camera), ...objectRecords(state.world, view, camera, objects), ...(state.intro ? [] : [ownRecord(state)]), ...(starter ? [starter] : []), ...shotRecords(state.world, view, camera, state.shots)]);
  return fb;
}
