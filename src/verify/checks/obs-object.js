import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseAtr } from '../../formats/atr.js';
import { view } from '../../binary.js';
import { assertArchive } from '../obs-helpers.js';
import { replaceSpwRecord } from '../strip.js';
import { createHash } from 'node:crypto';
import { expected } from '../expect.js';

const values = () => ({ object: expected('car.object-observed'), collision: expected('car.collision-test'), move: expected('car.move-step'), spw: expected('spw.layout'), spwRead: expected('spw.read'), model: expected('car.speed-model'), kinds: expected('atr.kind-effects') });

const COLUMNS = ['throttle', 'speed', 'column', 'row', 'heading', 'collision', 'carWordA', 'carWord7c', 'terrain', 'state0x44', 'state0x5a', 'word0xc', 'word0xe', 'word0x10', 'word0x18', 'word0x1a', 'objectHit', 'objectX', 'objectY', 'carWord7e'];
const C = Object.fromEntries(COLUMNS.map((n, i) => [n, i]));

function validate(dat, r, V) {
  const O = V.object, S = r.samples, bias = V.spwRead.coordBias;
  assertArchive(r, dat);
  assert.deepEqual(r.columns, COLUMNS, 'the columns');
  assert.deepEqual(r.build, { track: O.track, spw: { index: O.index, x: O.x, y: O.y } }, 'the experiment moved one object and nothing else');
  const run = replaceSpwRecord(dat, { track: O.track, index: O.index, x: O.x, y: O.y });
  assert.equal(run.length, r.modified.size, 'the rebuilt run copy has the recorded size');
  assert.equal(createHash('sha1').update(run).digest('hex'), r.modified.sha1, 'the rebuilt run copy is the one the game ran from');
  // The moved object: sprite 30 of the catalogue kind 0 (an obstacle), at the biased position in the live table.
  const members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])), spw = members.get(`${O.track}.SPW`), at = V.spw.countBytes + O.index * V.spw.recordBytes;
  assert.equal(view(spw).getUint16(at, true), O.spriteId, 'the record is sprite 30');
  assert.equal(view(parseAtr(members.get('SPRITE.ATR')).find(e => e.id === O.spriteId).raw).getUint16(V.kinds.kindAt, true), O.kind, 'of kind 0');
  assert.ok(S.every(s => s[C.objectX] === O.x + bias && s[C.objectY] === O.y + bias), 'the live table holds the biased position in every sample');
  // The call that reaches the object.
  const hit = S.findIndex(s => s[C.collision] !== 0), h = S[hit], after = S[hit + 1];
  assert.equal(h[C.collision], V.collision.codes.object, 'the object code');
  assert.deepEqual([h[C.row], h[C.column]], [O.hitRow, O.x + bias], 'at the row and column of the hit');
  assert.equal(Math.abs(h[C.row] - h[C.objectY]) + Math.abs(h[C.column] - h[C.objectX]), O.hitDistance, 'the sum of the absolute differences');
  assert.ok(O.hitDistance < V.collision.touchDistance, 'is below the touch distance');
  assert.deepEqual([h[C.carWord7c], h[C.objectHit], h[C.throttle], h[C.carWord7e]], [1, 1, O.throttle, 0], 'the car word +0x7c and the record word +2 are 1, the throttle still full, no crash yet'); // @math the flags are set to 1
  assert.equal(O.throttle, V.model.throttleCap, 'full throttle');
  assert.deepEqual([after[C.carWord7c], after[C.objectHit], after[C.throttle], after[C.carWord7e]], [0, 0, 0, 1], 'both words cleared, the throttle 0, the crash word 1 in the next sample'); // @math the flags are 0 and 1
  assert.equal(after[C.heading] - h[C.heading], O.headingTurn, 'the heading turns by 18');
  assert.equal(O.headingTurn, V.move.wallTurn, 'the turn of the side probes');
  assert.equal(Math.max(...S.map(s => s[C.row])), O.hitRow, 'the car never reaches the object');
  // Driven backwards, then at rest.
  for (let i = hit + 1 + 1; i < S.length; i++) { // @math the sample after the one after the hit
    const d = S[i - 1][C.row] - S[i][C.row];
    assert.ok(d === 0 || O.backStep.includes(d), `the row falls by 0, 63 or 64 (${d})`);
  }
  assert.equal(S.at(-1)[C.row], O.finalRow, 'the car rests at its final row');
  assert.equal(S.filter(s => s[C.collision] === V.collision.codes.object).length, O.collisionSamples, 'the samples with the object code');
  assert.equal(S.filter(s => s[C.carWord7e] === 1).length, O.crashSamples, 'the samples with the crash word'); // @math the flag is 1
  assert.ok(S.slice(0, hit).every(s => s[C.collision] === 0 && s[C.carWord7e] === 0 && s[C.objectHit] === 0), 'nothing before the hit');
}

export default {
  id: 'obs-object',
  claims: ['car.object-observed'],
  obs: ['object-1'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('object-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('object-1'), V = values();
    const hit = r.samples.findIndex(s => s[C.collision] !== 0);
    const edit = (i, patch) => ({ ...r, samples: r.samples.map((s, k) => (k === i ? s.map((v, j) => (j in patch ? patch[j] : v)) : s)) });
    const o = patch => ({ ...V, object: { ...V.object, ...patch } });
    return [
      { label: 'the record word +2 not set', fn: () => validate(dat, edit(hit, { [C.objectHit]: 0 }), V) },
      { label: 'the car word +0x7c not set', fn: () => validate(dat, edit(hit, { [C.carWord7c]: 0 }), V) },
      { label: 'a heading turn of 17', fn: () => validate(dat, edit(hit + 1, { [C.heading]: r.samples[hit][C.heading] + V.object.headingTurn - 1 }), V) },
      { label: 'the throttle not cleared', fn: () => validate(dat, edit(hit + 1, { [C.throttle]: 10 }), V) }, // @math a throttle step
      { label: 'a wall code at the hit', fn: () => validate(dat, edit(hit, { [C.collision]: V.collision.codes.wall }), V) },
      { label: 'an object at 14 units', fn: () => validate(dat, edit(hit, { [C.row]: V.object.hitRow - 1 }), V) },
      { label: 'another sprite', fn: () => validate(dat, r, o({ spriteId: V.object.spriteId - 1 })) },
      { label: 'another kind', fn: () => validate(dat, r, o({ kind: V.object.kind + 1 })) },
      { label: 'another final row', fn: () => validate(dat, r, o({ finalRow: V.object.finalRow + 1 })) },
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
