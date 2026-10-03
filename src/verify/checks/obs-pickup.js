import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseAtr } from '../../formats/atr.js';
import { view } from '../../binary.js';
import { createHash } from 'node:crypto';
import { assertArchive, crc } from '../obs-helpers.js';
import { replaceSpwRecord } from '../strip.js';
import { expected } from '../expect.js';

const values = () => ({ pickup: expected('pickup.kinds-observed'), kinds: expected('atr.kind-effects'), collision: expected('car.collision-test'), spwRead: expected('spw.read') });

const COLUMNS = ['throttle', 'speed', 'column', 'row', 'heading', 'collision', 'carWordA', 'carWord7c', 'terrain', 'state0x44', 'state0x5a', 'word0xc', 'word0xe', 'word0x10', 'word0x18', 'word0x1a', 'objectHit', 'objectX', 'objectY', 'carWord7e', 'carHeld', 'carAmmo'];
const C = Object.fromEntries(COLUMNS.map((n, i) => [n, i]));
const WINDOW = 20; // @math samples after the hit that stay clear of the wall at the end of the road
const PICKUP_WORDS = [0x16, 0x6a]; // @math the car words tools/dosbox/strip-run.mjs reads for --pickup: the held item and the counter

function kindOf(dat, sprite, V) {
  const members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data]));
  return view(parseAtr(members.get('SPRITE.ATR')).find(e => e.id === sprite).raw).getUint16(V.kinds.kindAt, true);
}

function run(dat, r, V, expectation) {
  const P = V.pickup;
  assertArchive(r, dat);
  assert.deepEqual(r.columns, COLUMNS, 'the columns');
  assert.deepEqual(PICKUP_WORDS, [V.kinds.heldWord, V.kinds.counterWord], 'the words the tool reads are the held and counter words of atr.kind-effects');
  assert.deepEqual(r.build, { track: P.track, spw: { index: P.index, x: P.x, y: P.y, sprite: expectation.sprite } }, 'the experiment moved one object and gave it a sprite');
  const built = replaceSpwRecord(dat, { track: P.track, index: P.index, x: P.x, y: P.y, sprite: expectation.sprite });
  assert.equal(built.length, r.modified.size, 'the rebuilt run copy has the recorded size');
  assert.equal(createHash('sha1').update(built).digest('hex'), r.modified.sha1, 'the rebuilt run copy is the one the game ran from');
  assert.equal(kindOf(dat, expectation.sprite, V), expectation.kind, 'the catalogue kind of the sprite');
  const S = r.samples, hit = S.findIndex(s => s[C.collision] !== 0), h = S[hit], before = S[hit - 1];
  assert.equal(h[C.collision], V.collision.codes.object, 'the object code');
  assert.deepEqual([h[C.row], h[C.column]], [P.hitRow, P.x + V.spwRead.coordBias], 'at the row of the hit');
  assert.equal(Math.abs(h[C.row] - (P.y + V.spwRead.coordBias)), P.hitDistance, 'the distance from the object');
  assert.ok(P.hitDistance < V.collision.touchDistance, 'below the touch distance');
  assert.ok(S.slice(0, hit).every(s => s[C.objectHit] === 0), 'the object is untouched before the hit');
  assert.ok(S.slice(hit).every(s => s[C.objectHit] === V.kinds.consumed - 65536), 'consumed from the hit on (0xffff as a signed word)'); // @math a word read as signed
  assert.ok(S.every(s => s[C.throttle] <= P.throttle), 'the throttle never passes its cap');
  const after = S.slice(hit, hit + WINDOW);
  assert.ok(after.every(s => s[C.throttle] === P.throttle && s[C.heading] === P.heading && s[C.carWord7e] === 0), 'the car is not slowed, turned or crashed in the 20 samples from the hit');
  assert.ok(after.at(-1)[C.row] > P.y + V.spwRead.coordBias, 'and goes on past the object');
  assert.deepEqual([before[C.carHeld], before[C.carAmmo]], [0, P.counter.before], 'nothing held and the counter at its start before'); // @math the held word starts at 0
  assert.deepEqual([h[C.carHeld], h[C.carAmmo]], expectation.after, 'the held word and the counter at the hit');
  assert.ok(S.slice(hit).every(s => s[C.carHeld] === expectation.after[0] && s[C.carAmmo] === expectation.after[1]), 'and for the rest of the run'); // @math the held word and the counter
}

function icon(dat, r, V) {
  const I = V.pickup.icon;
  assertArchive(r, dat);
  const data = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])).get(I.member), picked = [];
  for (let j = 0; j < I.size[1]; j++) for (let i = 0; i < I.size[0]; i++) { const v = data[I.at + i * I.size[1] + j]; if (v !== 0) picked.push(v); } // @math frames are stored column by column
  assert.equal(picked.length, I.pixels, 'the non-zero pixels of the frame');
  const [sprite] = r.sprites;
  assert.deepEqual([sprite.member, sprite.at, sprite.w, sprite.h, sprite.x, sprite.y], [I.member, I.at, I.size[0], I.size[1], I.x, I.y], 'the recorded sprite');
  assert.deepEqual([sprite.pixels, sprite.crc], [I.pixels, crc(Uint8Array.from(picked))], 'the screen pixels under the frame are the frame\'s');
  assert.equal(r.hudWords[(V.pickup.itemWord - 0x8426) / 2], I.item, 'the racer HUD item word is 3'); // @math the record's base is obj2+0x8426, words of two bytes
  assert.equal(I.frameBytes, I.size[0] * I.size[1], 'a frame is width x height bytes');
}

export default {
  id: 'obs-pickup',
  claims: ['pickup.kinds-observed'],
  obs: ['pickup-1', 'pickup-2', 'hudicon-1'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) {
    const dat = await ctx.open('WACKY.DAT'), V = values(), P = V.pickup;
    run(dat, ctx.obs('pickup-1'), V, { sprite: P.counter.sprite, kind: P.counter.kind, after: [0, P.counter.after] });
    run(dat, ctx.obs('pickup-2'), V, { sprite: P.held.sprite, kind: P.held.kind, after: [P.held.after, 0] });
    icon(dat, ctx.obs('hudicon-1'), V);
  },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), V = values(), P = V.pickup, r1 = ctx.obs('pickup-1'), r2 = ctx.obs('pickup-2'), ri = ctx.obs('hudicon-1');
    const c = { sprite: P.counter.sprite, kind: P.counter.kind, after: [0, P.counter.after] }, h = { sprite: P.held.sprite, kind: P.held.kind, after: [P.held.after, 0] };
    const hit = r1.samples.findIndex(s => s[C.collision] !== 0);
    const edit = (r, i, patch) => ({ ...r, samples: r.samples.map((s, k) => (k === i ? s.map((v, j) => (j in patch ? patch[j] : v)) : s)) });
    const p = patch => ({ ...V, pickup: { ...P, ...patch } });
    return [
      { label: 'the counter pickup run as a held item', fn: () => run(dat, r1, V, h) },
      { label: 'the held pickup run as a counter', fn: () => run(dat, r2, V, c) },
      { label: 'a counter of 5', fn: () => run(dat, edit(r1, hit, { [C.carAmmo]: P.counter.after + 1 }), V, c) },
      { label: 'a record not consumed', fn: () => run(dat, edit(r1, hit + 1, { [C.objectHit]: 0 }), V, c) },
      { label: 'a throttle cleared by the pickup', fn: () => run(dat, edit(r1, hit + 1, { [C.throttle]: 0 }), V, c) },
      { label: 'a kind 4 for the sprite', fn: () => run(dat, r1, V, { ...c, kind: 4 }) }, // @math a kind the sprite does not have
      { label: 'a hit one row nearer', fn: () => run(dat, r1, p({ hitRow: P.hitRow + 1 }), c) },
      { label: 'the icon of frame 1', fn: () => icon(dat, ri, p({ icon: { ...P.icon, at: P.icon.frameBytes } })) },
      { label: 'the icon placed one pixel right', fn: () => icon(dat, { ...ri, sprites: [{ ...ri.sprites[0], x: ri.sprites[0].x + 1 }] }, V) },
      { label: 'the icon crc changed', fn: () => icon(dat, { ...ri, sprites: [{ ...ri.sprites[0], crc: '00000000' }] }, V) },
      { label: 'one archive byte changed', fn: () => run(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r1, V, c) }, // @math flip the lowest bit of the last byte
    ];
  },
};
