import assert from 'node:assert/strict';
import { loadTrack, archiveMembers } from '../../game/track-data.js';
import { lionBytes } from '../../game/start.js';
import { parseMov } from '../../game/figure.js';
import { startRace, stepRace } from '../../game/race.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const IDS = ['shot-1', 'shot-2', 'shot-3'];
const values = () => ({ rules: expected('item.shot-rules'), hit: expected('item.racer-hit-observed') });
const SHOWN = 3; // @math the records keep the first three shots of the list
const HOLD = 30000; // @math the counter value the records wrote into racer 1 to hold it in its first state (obj2+0xaafe), with its advance (obj2+0xab04) 0
const SPEC = { 'shot-1': { held: 3, counter: 0 }, 'shot-2': { held: 8, counter: 0 }, 'shot-3': { held: 0, counter: 5 } }; // @math the held item word and the counter each record set (their moments)

// The port's race from the countdown with the car standing at the records' place (the position words written, car.camera 1300, 1376, i.e. the car point (1300, 1500)), racer 1 held
// still and the fire key down from the start; the state after every frame counter value, in the columns of the records.
function run(dat, id, V, { items = SPEC[id], fireFrom = 1, fireUntil = Infinity, holdRacer = true } = {}) {
  const members = archiveMembers(dat), world = { ...loadTrack(dat, '1'), lion: lionBytes(members) }, state = { mov: parseMov(members.get('GIG.MOV')), unproven: new Set(), hud: null };
  startRace(state, world, 6); // @math a six lap race
  const [x, y] = V.hit.carPos;
  const car = state.player.car, cam = { x: V.hit.cameraWrites[0], y: V.hit.cameraWrites[1] };
  state.player.car = { ...car, cx: cam.x, cy: cam.y, px: x, py: y, held: items.held, counter: items.counter };
  state.car = state.player.car;
  state.ai = { ...state.ai, racers: state.ai.racers.map((r, n) => (n === 1 && holdRacer ? { ...r, first: HOLD, slow: 0, x: V.hit.racerPos[0], y: V.hit.racerPos[1] } : r)) };
  const out = [{ tick: 0, held: items.held, shots: 0, list: [], hits: state.ai.racers.slice(1).map(r => r.hit) }]; // the state before the first frame
  for (let t = 1; t <= V.hit.endTicks[1] + 20; t++) { // @math frames enough to cover the longest stun and the records' last samples
    stepRace(state, { accelerate: false, brake: false, left: false, right: false, spin: false, fire: t >= fireFrom && t < fireUntil });
    const live = state.shots.filter(s => s.active);
    out.push({ tick: t, held: state.car.held, shots: live.length, list: live.slice(0, SHOWN).map(s => [s.x, s.y, s.travel]), hits: state.ai.racers.slice(1).map(r => r.hit) });
  }
  return out;
}

// Every sample is the port's state after the frame of its counter value or after the one before (the pauses fall between frames and now and then inside one, before the shot update).
function replay(dat, records, V, options = {}) {
  let compared = 0;
  for (const r of records) {
    assertArchive(r, dat);
    const c = Object.fromEntries(r.columns.map((n, i) => [n, i])), states = run(dat, r.id, V, options);
    for (const s of r.samples) {
      if (s[c.tick] < V.hit.quietUntil - 20 || s[c.tick] >= states.length) continue; // @math the first samples show the countdown's start frames
      const shown = [s[c.held], s[c.shots], ...[[s[c.sAx], s[c.sAy], s[c.sAtravel]], [s[c.sBx], s[c.sBy], s[c.sBtravel]], [s[c.sCx], s[c.sCy], s[c.sCtravel]]].slice(0, s[c.shots]).flat(), '|', s[c.h1], s[c.h2], s[c.h3], s[c.h4], s[c.h5], s[c.h6], s[c.h7]].join();
      const seen = k => { const g = states[k]; return [g.held, g.shots, ...g.list.flat(), '|', ...g.hits].join(); };
      assert.ok([seen(s[c.tick] - 1), seen(s[c.tick])].includes(shown), `${r.id} tick ${s[c.tick]}: ${shown} is neither ${seen(s[c.tick] - 1)} nor ${seen(s[c.tick])}`);
      compared++;
    }
  }
  return compared;
}

// The switching of the ice word the records show (the 2 and 3 alternate, the sound of each ending before the next begins) gives the sound lengths of item.shot-rules.
function soundLengths(V) {
  const t = V.hit.toggles, gaps = t.slice(0, -1).map((e, i) => t[i + 1][0] - e[0]);
  const [first, second, third, fourth] = gaps; // @math the four intervals between the five switches the records show
  return { ice2: first, ice3: second, again: [third, fourth] };
}

export default {
  id: 'port-shots',
  claims: ['item.shot-rules'],
  obs: IDS,
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT');
    const lengths = soundLengths(V);
    assert.deepEqual([lengths.ice2, lengths.ice3, ...lengths.again], [V.rules.iceSounds.ice2, V.rules.iceSounds.ice3, V.rules.iceSounds.ice2, V.rules.iceSounds.ice3], 'the sound lengths are the switching intervals');
    const compared = replay(dat, IDS.map(id => ctx.obs(id)), V);
    assert.ok(compared >= 300, `enough samples compared (${compared})`); // @math 150 + 170 + 100 samples, less the countdown's first
  },
  async discriminate(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT'), recs = IDS.map(id => ctx.obs(id));
    const start = V.hit.spawnTick;
    return [
      { label: 'the key down one frame later', fn: () => replay(dat, recs, V, { fireFrom: start + 1 }) },
      { label: 'the key up after the shot', fn: () => replay(dat, recs, V, { fireUntil: start + 5 }) }, // @math a few frames after the first call: no hold, so no ice at tick 55
      { label: 'the racer not held still', fn: () => replay(dat, recs, V, { holdRacer: false }) },
      { label: 'a held item of the wrong kind', fn: () => replay(dat, [recs[0]], V, { items: { held: 4, counter: 0 } }) }, // @math the devils instead of the fan
    ];
  },
};
