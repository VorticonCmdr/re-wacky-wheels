// node [--env-file=.env] tools/dosbox/jev-drive.mjs --policy local|jev|stepped [--seconds 30] [--track 1]
// Drives the player's car in a played race through the DOSBox bridge (the race running and paused at its start, as for strip-run.mjs): the car is steered along the track's .RD route by one
// of three policies and the progress is reported. `local` is a proportional controller in this script (no latency, the baseline); `jev` asks the jev model (jev/, TypeSafe's System One API)
// for the steering choice while the game keeps running, so its latency (about 250 ms, a few calls of the game) is the reaction time; `stepped` asks jev with the game paused, so the
// latency costs nothing but time. jev gets only numbers (angles, speed, surface). The accelerate key is held throughout; steering uses the left and right keys.
import { parseArgs } from 'node:util';
import { openGameFolder } from '../../src/vfs/node.js';
import { parseDatDirectory } from '../../src/formats/dat.js';
import { parseRoute } from '../../src/tracks.js';
import { readMemory } from './live.mjs';
const { values } = parseArgs({ options: { policy: { type: 'string', default: 'local' }, seconds: { type: 'string', default: '30' }, track: { type: 'string', default: '1' } } });
const API = 'http://127.0.0.1:8386/api/v1', sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (path, body) => { const r = await fetch(API + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) }); return r.status === 200 ? r.json() : { error: r.status }; };
const BASE = 0x239000, TURN = 1920, BIAS = 1024, LOOK = 140, NEAR = 70; // @math obj2's live base in this build; a turn is the TRIG table's 1920; the map origin in pixels; waypoint distances in world units
const i16 = async a => Buffer.from(await readMemory(a, 2)).readInt16LE(0), i32 = async a => Buffer.from(await readMemory(a, 4)).readInt32LE(0);
const dat = await (await openGameFolder()).open('WACKY.DAT'), rd = parseDatDirectory(dat).find(e => e.name === `${values.track}.RD`);
const way = parseRoute(rd.data).map(r => [r.x2 + BIAS, r.y2 + BIAS]);
const norm = d => ((d % TURN) + TURN + TURN / 2) % TURN - TURN / 2;
const car = await i32(BASE + 0x1d5b0);
const read = async () => ({ col: await i16(BASE + 0xaa90 + 0x16), row: await i16(BASE + 0xaa90 + 0x18), heading: await i32(BASE + 0x1d5d4), speed: await i16(car + 0x26), terrain: await i32(BASE + 0x1e568), collision: await i16(BASE + 0x28bae) });
let target = 0, laps = 0, bumps = 0, offroad = 0, samples = 0, decisions = 0, waited = 0;
const aim = s => { // the angle error to the waypoint LOOK units on
  while (Math.hypot(way[target][0] - s.col, way[target][1] - s.row) < NEAR) { target = (target + 1) % way.length; if (target === 0) laps++; }
  const [x, y] = way[(target + 1) % way.length], d1 = Math.hypot(way[target][0] - s.col, way[target][1] - s.row), [tx, ty] = d1 > LOOK ? way[target] : [x, y];
  return { error: Math.round(norm(Math.atan2(ty - s.row, tx - s.col) / (2 * Math.PI) * TURN - s.heading)), distance: Math.round(Math.hypot(tx - s.col, ty - s.row)) }; // @math radians to turn units
};
const local = e => (e > 40 ? 'right' : e < -40 ? 'left' : 'straight'); // @math the dead band, about 7 degrees
async function jev(a, s) {
  if (!process.env.TYPESAFE_API_KEY) throw new Error('TYPESAFE_API_KEY is not set (node --env-file=.env ...)');
  const body = { state: { angleErrorToTarget: a.error, note: 'positive means the target is to the right; one turn is 1920, so 40 is about 7 degrees', distanceToTarget: a.distance, speed: s.speed, onRoad: s.terrain === 0 },
    model: 'jev-latest', questions: { steer: { type: 'choice', instructions: 'Which steering input should the car use now to head for the target?', criteria: { left: 'the target is to the left by more than 40', straight: 'the angle error is within 40 either way', right: 'the target is to the right by more than 40' } } } };
  const res = await fetch('https://api.typesafe.ai/v1/systemone', { method: 'POST', headers: { authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return (await res.json()).answers.steer.choice;
}
let held = {}, steer = 'straight';
async function keys(choice) {
  const want = { KBD_leftalt: true, KBD_left: choice === 'left', KBD_right: choice === 'right' }, events = [];
  for (const k of Object.keys(want)) if (!!held[k] !== want[k]) events.push({ type: 'key', key: k, pressed: want[k], frame: 1 });
  if (events.length) { const r = await post('/input/sequence', { events }); if (!r.error) held = { ...want }; }
  steer = choice;
}
const t0 = Date.now(), end = t0 + Number(values.seconds) * 1000, first = await read();
const start = { ...first };
await post('/debug/pause'); await keys('straight');
if (values.policy === 'stepped') { while (Date.now() < end) { const s = await read(), a = aim(s); const w0 = Date.now(); await keys(await jev(a, s)); waited += Date.now() - w0; decisions++; await post('/debug/continue'); await sleep(120); await post('/debug/pause'); samples++; if (s.terrain !== 0) offroad++; if (s.collision) bumps++; } }
else {
  await post('/debug/continue');
  let pending = null;
  while (Date.now() < end) {
    const s = await read(), a = aim(s); samples++; if (s.terrain !== 0) offroad++; if (s.collision) bumps++;
    if (values.policy === 'local') { await keys(local(a.error)); decisions++; await sleep(15); }
    else if (!pending) pending = jev(a, s).then(c => { pending = null; decisions++; return keys(c); }).catch(e => { pending = null; console.error(e.message); });
    else await sleep(15);
  }
  await post('/debug/pause');
}
await keys('straight'); const last = await read();
console.log(JSON.stringify({ policy: values.policy, seconds: Number(values.seconds), samples, decisions, segmentsReached: laps * way.length + target, laps, offroadSamples: offroad, collisionSamples: bumps, start: [start.col, start.row], end: [last.col, last.row], msPerJevDecisionPaused: values.policy === 'stepped' && decisions ? Math.round(waited / decisions) : undefined }));
