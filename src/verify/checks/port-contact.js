import assert from 'node:assert/strict';
import { loadTrack } from '../../game/track-data.js';
import { createCar, stepCar } from '../../game/car.js';
import { createStart, stepStart } from '../../game/start.js';
import { createAi } from '../../game/ai.js';
import { createPlayer, stepPlayer } from '../../game/player.js';
import { liveObjects } from '../../game/pickups.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ crash: expected('car.crash-observed'), touch: expected('car.touch-observed'), racer: expected('car.racer-hit-observed'), spw: expected('spw.read') });
const OBJECT_CODE = 2; // @math the collision word of a touched object (car.collision-test)
const CONSUMED_WORD = -1; // @math the consumed marker 0xffff as the record's 16-bit word reads it (atr.kind-effects)
const KEY_TICK = 35; // @math the frame the accelerate key goes down in the port's run: the records start at the throttle 50 and do not pin it, any earlier or later start gives the same states
const HITS_AT = 2; // @math the third entry of an end state: the number of contact calls
const FRAMES = 120; // @math frames enough to cover the 60 samples of a record (about 40 ms a sample at 88 ms a frame, with the start at 35)
const KINDS = ['pickup-1', 'pickup-2', 'tyres-1']; // @math the three pickup records of car.touch-observed, in the order counter, held, tyres

// The port's player from the countdown with the accelerate key down from the frame `keyTick`: the state after every frame counter value, in the columns of the records.
function states(world, spec, V, { keyTick = KEY_TICK, kinds = true } = {}) {
  const objects = liveObjects(world);
  objects[0] = { ...objects[0], id: spec.sprite, x: spec.x + V.spw.coordBias, y: spec.y + V.spw.coordBias };
  const w = kinds ? world : { ...world, sprites: world.sprites.map(s => ({ ...s, kind: 0 })) };
  let player = createPlayer(createCar(world.start, w), objects), start = createStart();
  const read = p => { const c = p.car; return { throttle: c.throttle, speed: c.speed, x: c.px, y: c.py, heading: c.heading, word: p.word, hit: p.touched, object: p.objects[0].consumed === 0xffff ? CONSUMED_WORD : p.objects[0].consumed, crashed: c.crashed ? 1 : 0, held: c.held, counter: c.counter, tyres: c.tyreState === 0 ? 0 : 1 }; }; // @math the consumed marker as 16-bit
  const out = [read(player)];
  for (let t = 1; t <= FRAMES; t++) {
    const next = stepStart(start); start = next.start;
    player = stepPlayer(player, { accelerate: t >= keyTick }, w, { racing: next.racing, racers: [] }).player;
    out.push(read(player));
  }
  return out;
}

// Every sample of a record is one of the port's states, in order (the pauses fall between frames; a state can be seen twice).
function replayObject(dat, record, V, options = {}) {
  assertArchive(record, dat);
  const world = loadTrack(dat, String(record.build.track)), spec = { sprite: record.build.spw.sprite ?? world.objects[0].id, x: record.build.spw.x, y: record.build.spw.y };
  const sequence = states(world, spec, V, options), ix = Object.fromEntries(record.columns.map((c, i) => [c, i]));
  assert.equal(record.samples.length, V.touch.samples, 'the samples');
  let at = 0;
  const kept = [];
  record.samples.forEach((s, n) => {
    const want = { throttle: s[ix.throttle], speed: s[ix.speed], x: s[ix.column], y: s[ix.row], heading: s[ix.heading], word: s[ix.collision], hit: s[ix.carWord7c], object: s[ix.objectHit], crashed: s[ix.carWord7e], held: s[ix.carHeld], counter: s[ix.carAmmo] };
    const fits = state => Object.entries(want).every(([k, v]) => v === undefined || state[k] === v);
    let j = at;
    while (j < sequence.length && !fits(sequence[j])) j++;
    assert.ok(j < sequence.length, `sample ${n} of ${record.id}: no state of the port is ${JSON.stringify(want)} from frame ${at} on`);
    at = j; kept.push(j);
  });
  return { sequence, kept, ix };
}

function facts(records, V) {
  const T = V.touch, C = V.crash;
  const [counter, held, tyres] = KINDS.map(id => records[id]);
  for (const [name, r, kind] of [['counter', counter, T.kinds.counter], ['held', held, T.kinds.held], ['tyres', tyres, T.kinds.tyres]]) {
    const first = r.sequence.findIndex(x => x.word === OBJECT_CODE), state = r.sequence[first];
    assert.equal(state.y, T.hit.row, `${name}: the car stops at the row the walk first touches the object`);
    assert.equal(T.hit.y - state.y, T.hit.distance, `${name}: 13 from the object`);
    assert.equal(state.object, CONSUMED_WORD, `${name}: the object is taken in the call of the contact`);
    assert.equal(r.sequence[first + 1].word, 0, `${name}: the collision word is 0 again in the next call (nothing else touched)`);
    assert.ok(r.sequence[first + 1].y > state.y, `${name}: the car moves on`);
    assert.equal(kind, r.sequence[0] && r.kind, `${name}: the kind of the sprite`);
  }
  assert.equal(counter.sequence.find(x => x.word === OBJECT_CODE).counter, T.counterAfter, 'the counter pickup adds the step');
  assert.equal(held.sequence.find(x => x.word === OBJECT_CODE).held, T.heldAfter, 'the item pickup sets the held word to its kind');
  assert.equal(tyres.sequence.find(x => x.word === OBJECT_CODE).tyres, T.tyresWord, 'the tyre stack starts its screen effect');
  const wreck = records['object-1'], first = wreck.sequence.findIndex(x => x.hit === 1);
  assert.equal(wreck.sequence[first].y, T.hit.row, 'the obstacle: the same contact row');
  const after = wreck.sequence[first + 1];
  assert.deepEqual([after.throttle, after.heading, after.crashed, after.y], [0, 480 + C.turn, 1, T.hit.row], 'the call after: the wreck, nothing moves'); // @math the heading before the hit
  const rolled = wreck.sequence.slice(first + 1 + 1, first + 1 + 1 + C.rollSteps + 1).map(x => x.y);
  assert.deepEqual(rolled.map((y, i) => (i ? rolled[i - 1] - y : T.hit.row - y)), [C.rollFirst, ...Array(C.rollSteps - 1).fill(C.rollBack), 0], 'the roll back: the first call and the eight after it, then it stays');
  assert.equal(after.speed, C.wreckSpeed, 'the speed word stays');
}

// The five racer records: the car in the countdown at the recorded camera writes, the number of contact calls and the end state.
function replayRacers(dat, V, { skip = false } = {}) {
  const R = V.racer, world = loadTrack(dat, '1'), ai = createAi(world), racers = skip ? [] : ai.racers, ends = [];
  for (const write of R.cameraWrites) {
    let car = createCar({ x: write, y: world.start.y, heading: R.startHeading }, world), hits = 0;
    for (let call = 0; call < R.records + 1; call++) { const out = stepCar(car, { accelerate: true }, world, { racing: false, racers }); car = out.car; if (out.touched) hits++; else break; }
    ends.push([car.heading, car.cy, hits]);
  }
  assert.deepEqual(ends.map(e => e[0]), R.finalHeadings, 'the end headings');
  assert.deepEqual(ends.map(e => e[1]), R.finalCameraY, 'the end camera rows');
  assert.deepEqual(ends.map(e => e[HITS_AT] > 0), R.distances.map(d => d < R.limit), 'a contact exactly when the distance is below the limit');
}

export default {
  id: 'port-contact',
  claims: ['car.crash-observed', 'car.touch-observed'],
  obs: ['object-1', 'pickup-1', 'pickup-2', 'tyres-1', 'steps-4', 'steps-5', 'steps-6', 'steps-7', 'steps-8'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT'), records = {};
    for (const id of [V.crash.record, ...KINDS]) {
      const r = ctx.obs(id), out = replayObject(dat, r, V), world = loadTrack(dat, String(r.build.track));
      records[id] = { ...out, kind: world.sprites[r.build.spw.sprite ?? world.objects[0].id].kind };
    }
    facts(records, V);
    replayRacers(dat, V);
  },
  async discriminate(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT'), pick = ctx.obs(KINDS[0]), wreck = ctx.obs(V.crash.record);
    const alter = (rec, n, k, f) => ({ ...rec, samples: rec.samples.map((s, i) => (i === n ? s.map((v, j) => (j === k ? f(v) : v)) : s)) });
    const column = (rec, name) => rec.columns.indexOf(name);
    return [
      { label: 'every object an obstacle', fn: () => replayObject(dat, pick, V, { kinds: false }) },
      { label: 'a recorded counter altered', fn: () => replayObject(dat, alter(pick, 40, column(pick, 'carAmmo'), v => v + 1), V) }, // @math the 40th sample
      { label: 'a recorded wreck row altered', fn: () => replayObject(dat, alter(wreck, 20, column(wreck, 'row'), v => v + 1), V) }, // @math the 20th sample
      { label: 'a recorded heading altered', fn: () => replayObject(dat, alter(wreck, 11, column(wreck, 'heading'), v => v + 1), V) }, // @math the 11th sample, the first after the hit
      { label: 'no computer racers', fn: () => replayRacers(dat, V, { skip: true }) },
    ];
  },
};
