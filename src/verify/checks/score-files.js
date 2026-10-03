import assert from 'node:assert/strict';
import { locateLe, parseFixups, objectFixups } from '../../formats/le.js';
import { parseDatDirectory } from '../../formats/dat.js';
import { view } from '../../binary.js';
import { expected } from '../expect.js';

const values = () => ({ duck: expected('dtt.layout'), refs: expected('score.references'), def: expected('score.defaults'), tim: expected('tim.layout'), offset32: expected('le.fixup-record').source.offset32 });

const DWORD = 4; // @math bytes in a 32-bit word
const latin1 = bytes => String.fromCharCode(...bytes);
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

function references(exe, V) {
  const { le } = locateLe(exe), all = objectFixups(le, parseFixups(exe, le)).filter(s => s.type === V.offset32), R = V.refs;
  assert.deepEqual([R.tim.size, R.hi.size, R.dtt.size], [V.def.sizes.tim, V.def.sizes.hi, V.def.sizes.dtt], 'the table sizes are the loaders\' sizes');
  for (const [name, T] of [['tim', R.tim], ['hi', R.hi], ['dtt', R.dtt]]) {
    const inside = all.filter(s => s.targetObject === R.dataObject && s.target >= T.base && s.target < T.base + T.size);
    assert.deepEqual([...new Set(inside.map(s => s.target - T.base))].sort((a, b) => a - b), T.words, `${name}: the words of the table that the program names`);
    assert.ok(inside.every(s => s.object === R.codeObject), `${name}: all references are in the code object`);
    assert.equal(inside.length, T.sites, `${name}: the number of references`);
    if (T.siteOffsets) assert.deepEqual(inside.map(s => s.offset).sort((a, b) => a - b), T.siteOffsets, `${name}: where they are`);
  }
}

// A loader loads its size with `mov edx, size` and its buffer with `mov eax, buffer`, at the sites the claim names.
function loaders(exe, D) {
  const code = locateLe(exe).le.objects[0].data, dv = view(code);
  for (const name of ['tim', 'hi', 'dtt']) {
    const at = D.loaders[name];
    assert.equal(code[at.edx], D.movEdx, `${name}: the size load`);
    assert.equal(dv.getUint32(at.edx + 1, true), D.sizes[name], `${name}: the size`);
    assert.equal(code[at.eax], D.movEax, `${name}: the buffer load`);
    assert.equal(dv.getUint32(at.eax + 1, true), D.buffers[name], `${name}: the buffer`);
  }
}

// The table the duck-shoot loader builds when its file is missing.
function defaultDtt(exe, X) {
  const { le } = locateLe(exe), code = le.objects[0].data, data = le.objects[1].data, dv = view(code), scores = [], starts = [];
  assert.equal(X.scoreAt, X.nameBytes, 'the score follows the name field');
  assert.equal(X.entryBytes, X.nameBytes + DWORD, 'an entry is the name field and a dword');
  assert.equal(X.scoreStoreBytes, X.scoreStore.length + DWORD + DWORD, 'the store is its opcode bytes, a displacement and a value');
  const names = le.objects[X.namesObject - 1].data; // @math object numbers count from 1
  assert.equal(latin1(data.subarray(X.padAt, X.padAt + 1)), String.fromCharCode(X.pad), 'the pad string is a space');
  for (let i = X.codeFrom; i < X.codeTo;) {
    if (X.scoreStore.every((b, k) => code[i + k] === b)) { starts.push(i); scores.push({ disp: dv.getUint32(i + X.scoreStore.length, true), value: dv.getUint32(i + X.scoreStore.length + 4, true) }); i += X.scoreStoreBytes; continue; } // @math the displacement and the value dwords
    i++;
  }
  assert.equal(starts[0], X.codeFrom, 'the first score store starts the range'); assert.equal(starts.at(-1) + X.scoreStoreBytes, X.codeTo, 'the last ends it');
  assert.deepEqual(scores.map(s => s.disp), X.scoreDisplacements, 'where the scores are stored');
  assert.deepEqual(scores.map(s => s.value), X.scores, 'the default scores');
  const out = new Uint8Array(X.entries * X.entryBytes), odv = view(out);
  for (let k = 0; k < X.entries; k++) {
    const slot = names.subarray(X.namesAt + k * X.slotBytes, X.namesAt + (k + 1) * X.slotBytes), name = latin1(slot.subarray(0, slot.indexOf(0))).padEnd(X.padTo, String.fromCharCode(X.pad));
    out.set(Uint8Array.from(name, c => c.charCodeAt(0)), k * X.entryBytes);
    odv.setInt32(k * X.entryBytes + X.scoreAt, X.scores[k], true);
  }
  return out;
}

function timRecords(b, T) {
  assert.equal(b.length, T.records * T.recordBytes, 'the size of a time table');
  assert.equal(T.names * T.nameBytes, T.timesAt, 'the times follow the names');
  const dv = view(b), lap = [], overall = [];
  for (let r = 0; r < T.records; r++) {
    const o = r * T.recordBytes, times = Array.from({ length: T.times }, (_, i) => dv.getUint32(o + T.timesAt + i * 4, true)); // @math dwords
    assert.ok(times.every((t, i) => !i || times[i - 1] <= t), 'the lap times of a record do not decrease');
    lap.push(...times); overall.push(dv.getUint32(o + T.overallTimeAt, true));
    for (const at of [...Array.from({ length: T.names }, (_, i) => i * T.nameBytes), T.overallNameAt]) {
      const name = b.subarray(o + at, o + at + T.nameBytes), text = name.subarray(0, T.namePadded);
      assert.ok(text.every(c => c >= 32 && c < 127), 'a name is printable text'); // @math ASCII printable range
      assert.ok(name.subarray(T.namePadded).every(c => c === 0), 'a name is followed by zeros');
    }
  }
  return { lap, overall };
}

function duckEntries(b, U, D) {
  assert.equal(b.length, U.entries * U.entryBytes, 'the size of the duck-shoot table');
  assert.equal(b.length, D.sizes.dtt, 'the loader\'s size');
  assert.equal(U.scoreAt, U.nameBytes, 'the score follows the name field');
  assert.equal(U.entryBytes, U.nameBytes + DWORD, 'an entry is the name field and a dword');
  const dv = view(b), scores = [];
  for (let k = 0; k < U.entries; k++) {
    const o = k * U.entryBytes, name = b.subarray(o, o + U.nameBytes);
    assert.ok(name.subarray(0, U.namePadded).every(c => c >= 32 && c < 127), 'a name is printable text'); // @math ASCII printable range
    assert.ok(name.subarray(U.namePadded).every(c => c === 0), 'a name is followed by zeros');
    scores.push(dv.getInt32(o + U.scoreAt, true));
  }
  assert.ok(scores.every((v, i) => !i || scores[i - 1] >= v), 'the scores do not rise');
}

async function validate(ctx, V) {
  const exe = await ctx.open('WW.EXE'), dat = await ctx.open('WACKY.DAT'), D = V.def, members = new Map(parseDatDirectory(dat).map(e => [e.name.toUpperCase(), e.data]));
  references(exe, V); loaders(exe, D);
  const tim = await ctx.open(D.files.tim), hi = await ctx.open(D.files.hi), dtt = await ctx.open(D.files.dtt);
  assert.equal(tim.length, D.sizes.tim); assert.equal(hi.length, D.sizes.hi); assert.equal(dtt.length, D.sizes.dtt);
  assert.ok(same(tim, members.get(D.members.tim)), 'the installed time table is the archive default');
  assert.ok(!same(tim, members.get(D.members.timOther)), 'and not the other horsepower\'s');
  assert.ok(same(hi, members.get(D.members.hi)), 'the installed high score table is the archive default');
  assert.ok(same(members.get(D.members.hi), members.get(D.members.hiOther)), 'which both horsepowers share');
  assert.ok(same(dtt, defaultDtt(exe, D.dtt)), 'the installed duck-shoot table is the one the loader builds');
  duckEntries(dtt, V.duck, D);
  const stats = [tim, members.get(D.members.tim), members.get(D.members.timOther)].map(b => timRecords(b, V.tim));
  assert.equal(Math.min(...stats.flatMap(s => s.lap)), V.tim.minLap, 'the smallest lap time');
  assert.equal(Math.max(...stats.flatMap(s => s.lap)), V.tim.maxLap, 'the largest lap time');
  assert.equal(Math.min(...stats.flatMap(s => s.overall)), V.tim.minOverall, 'the smallest overall time');
  assert.equal(Math.max(...stats.flatMap(s => s.overall)), V.tim.maxOverall, 'the largest overall time');
}

export default {
  id: 'score-files',
  claims: ['score.references', 'score.defaults', 'tim.layout', 'dtt.layout'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { await validate(ctx, values()); },
  async discriminate(ctx) {
    const V = values(), r = patch => () => validate(ctx, { ...V, refs: { ...V.refs, ...patch } }), d = patch => () => validate(ctx, { ...V, def: { ...V.def, ...patch } }), t = patch => () => validate(ctx, { ...V, tim: { ...V.tim, ...patch } }), u = patch => () => validate(ctx, { ...V, duck: { ...V.duck, ...patch } });
    return [
      { label: 'a time table word dropped', fn: r({ tim: { ...V.refs.tim, words: V.refs.tim.words.slice(1) } }) },
      { label: 'the high score table named once more', fn: r({ hi: { ...V.refs.hi, sites: V.refs.hi.sites + 1 } }) },
      { label: 'a duck-shoot word moved', fn: r({ dtt: { ...V.refs.dtt, words: V.refs.dtt.words.map((w, i) => (i === 1 ? w + 1 : w)) } }) },
      { label: 'time table size 3601', fn: d({ sizes: { ...V.def.sizes, tim: V.def.sizes.tim + 1 } }) },
      { label: 'the other horsepower\'s default', fn: d({ members: { ...V.def.members, tim: V.def.members.timOther } }) },
      { label: 'duck scores 17, 12, 8, 6', fn: d({ dtt: { ...V.def.dtt, scores: [V.def.dtt.scores[0] + 1, ...V.def.dtt.scores.slice(1)] } }) },
      { label: 'names padded to 15', fn: d({ dtt: { ...V.def.dtt, padTo: V.def.dtt.padTo - 1 } }) },
      { label: 'times from +0x4c', fn: t({ timesAt: V.tim.timesAt - 4 }) }, // @math one dword earlier
      { label: 'overall time at +0x70', fn: t({ overallTimeAt: V.tim.overallTimeAt - 4 }) }, // @math one dword earlier
      { label: 'duck entries of 20 bytes', fn: u({ entryBytes: V.duck.entryBytes - 4 }) }, // @math one dword
      { label: 'duck names padded to 17', fn: u({ namePadded: V.duck.namePadded + 1 }) },
      { label: 'duck score at +16', fn: u({ scoreAt: V.duck.scoreAt - 4 }) }, // @math one dword
      { label: 'smallest lap 149', fn: t({ minLap: V.tim.minLap + 1 }) },
    ];
  },
};
