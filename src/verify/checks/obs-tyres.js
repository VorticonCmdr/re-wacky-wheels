import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseAtr } from '../../formats/atr.js';
import { view } from '../../binary.js';
import { assertArchive } from '../obs-helpers.js';
import { replaceSpwRecord } from '../strip.js';
import { expected } from '../expect.js';

const values = () => ({ tyres: expected('pickup.tyres-observed'), kinds: expected('atr.kind-effects'), collision: expected('car.collision-test'), spwRead: expected('spw.read') });

const COLUMNS = ['throttle', 'speed', 'column', 'row', 'heading', 'collision', 'carWordA', 'carWord7c', 'terrain', 'state0x44', 'state0x5a', 'word0xc', 'word0xe', 'word0x10', 'word0x18', 'word0x1a', 'objectHit', 'objectX', 'objectY', 'carWord7e', 'carHeld', 'carAmmo', 'tyreState', 'tyreA', 'tyreB', 'tyreC'];
const C = Object.fromEntries(COLUMNS.map((n, i) => [n, i]));
const TOOL = { stateWord: 0x28c8c, stripsAt: 0x20ae8 }; // @math the words tools/dosbox/strip-run.mjs --tyres reads: the state word and the first of three strip words

function validate(dat, r, V, { sprite } = {}) {
  const T = V.tyres, S = r.samples;
  assertArchive(r, dat);
  assert.deepEqual(r.columns, COLUMNS, 'the columns');
  assert.deepEqual([T.stateWord, T.stripsAt], [TOOL.stateWord, TOOL.stripsAt], 'the words the tool read');
  assert.deepEqual(r.build, { track: T.track, spw: { index: T.index, x: T.x, y: T.y, sprite: sprite ?? T.sprite } }, 'the experiment moved one object');
  const built = replaceSpwRecord(dat, { track: T.track, index: T.index, x: T.x, y: T.y, sprite: sprite ?? T.sprite });
  assert.equal(built.length, r.modified.size, 'the rebuilt run copy has the recorded size');
  assert.equal(createHash('sha1').update(built).digest('hex'), r.modified.sha1, 'the rebuilt run copy is the one the game ran from');
  const kind = view(parseAtr(new Map(parseDatDirectory(dat).map(e => [e.name, e.data])).get('SPRITE.ATR')).find(e => e.id === (sprite ?? T.sprite)).raw).getUint16(V.kinds.kindAt, true);
  assert.equal(kind, T.kind, 'the sprite is a kind-1 object');
  const hit = S.findIndex(s => s[C.collision] !== 0);
  assert.equal(S[hit][C.collision], V.collision.codes.object, 'the object code');
  assert.deepEqual([S[hit][C.row], Math.abs(S[hit][C.row] - (T.y + V.spwRead.coordBias))], [T.hitRow, T.hitDistance], 'at the row of the hit');
  assert.ok(T.hitDistance < V.collision.touchDistance, 'below the touch distance');
  assert.ok(S.slice(0, hit).every(s => s[C.objectHit] === 0 && s[C.tyreState] === 0), 'nothing before the hit'); // @math the record and the state word start at 0
  assert.ok(S.slice(hit).every(s => s[C.objectHit] === V.kinds.consumed - 65536), 'the record is consumed from the hit on'); // @math a word read as signed
  const runs = T.states.map(v => { const idx = S.map((s, i) => [s[C.tyreState], i]).filter(([st]) => st === v).map(([, i]) => i); return [idx[0], idx.at(-1)]; });
  assert.deepEqual(runs, T.stateRuns, 'the samples of each state');
  T.states.forEach((v, k) => S.slice(T.stateRuns[k][0], T.stateRuns[k][1] + 1).forEach(s => assert.equal(s[C.tyreState], v, 'the state is steady over its run')));
  assert.equal(S[T.stateRuns.at(-1)[1] + 1][C.tyreState], 0, 'and 0 after the last'); // @math the sample after the last run
  assert.deepEqual([S[hit][C.tyreA], S[hit][C.tyreB], S[hit][C.tyreC]], T.firstStrips, 'the strip words at the hit');
  assert.deepEqual([S.at(-1)[C.tyreA], S.at(-1)[C.tyreB], S.at(-1)[C.tyreC]], T.finalStrips, 'and where they end');
  assert.ok(S.every(s => s[C.throttle] <= T.throttle && s[C.carWord7c] === 0 && s[C.carWord7e] === 0 && s[C.carHeld] === 0 && s[C.carAmmo] === 0), 'the car is not crashed or flagged and holds nothing'); // @math the flags and the held word are 0
  assert.ok(S.slice(hit, T.stateRuns.at(-1)[1] + 1).every(s => s[C.throttle] === T.throttle && s[C.speed] === T.speed && s[C.heading] === T.heading), 'the car is not slowed or turned while the strips move');
}

export default {
  id: 'obs-tyres',
  claims: ['pickup.tyres-observed'],
  obs: ['tyres-1'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('tyres-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('tyres-1'), V = values(), T = V.tyres, t = patch => ({ ...V, tyres: { ...T, ...patch } });
    const edit = (i, patch) => ({ ...r, samples: r.samples.map((s, k) => (k === i ? s.map((v, j) => (j in patch ? patch[j] : v)) : s)) });
    const mid = T.stateRuns[1][0] + 2; // @math a sample inside the second state
    return [
      { label: 'a state that skips', fn: () => validate(dat, edit(mid, { [C.tyreState]: 3 }), V) }, // @math the third state
      { label: 'a strip that does not end', fn: () => validate(dat, edit(r.samples.length - 1, { [C.tyreC]: 0 }), V) },
      { label: 'a car that slows', fn: () => validate(dat, edit(mid, { [C.speed]: T.speed - 1 }), V) },
      { label: 'a crash word', fn: () => validate(dat, edit(mid, { [C.carWord7e]: 1 }), V) }, // @math the crash flag
      { label: 'a stack of another sprite', fn: () => validate(dat, r, V, { sprite: 1 }) }, // @math the kind-2 hedgehog
      { label: 'a run one sample short', fn: () => validate(dat, r, t({ stateRuns: [T.stateRuns[0], [T.stateRuns[1][0], T.stateRuns[1][1] - 1], T.stateRuns.at(-1)] })) },
      { label: 'first strips one off', fn: () => validate(dat, r, t({ firstStrips: [T.firstStrips[0] + 1, ...T.firstStrips.slice(1)] })) },
      { label: 'a hit row of 1886', fn: () => validate(dat, r, t({ hitRow: T.hitRow - 1 })) },
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
