import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseDatDirectory } from '../../formats/dat.js';
import { decodePcxMember } from '../../formats/pcx.js';
import { locateLe } from '../../formats/le.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { crossingArchive, ZERO_EVERY, ZERO_VALUE } from '../pcxrle.js';
import { expected } from '../expect.js';

const values = () => ({ vga: expected('pcx.rle-rule-vga'), rule: expected('pcx.rle-rule'), layout: expected('pcx.layout') });
const IDS = ['bootpcx-2', 'bootpcx-3'];

// A model of the game's VGA decoder over the member's stream: a run of count copies of the next byte (count 0 taken as `zeroCopies`), literals otherwise, one linear picture; `rows` clips a run at the end of its row.
function decode(member, V, { zeroCopies = V.vga.zeroCopies, rows = false, width = V.vga.width, height = V.vga.height } = {}) {
  const L = V.layout, end = member.length - L.palette - 1, total = width * height, out = new Uint8Array(total); // @math the marker byte before the palette
  let at = L.header, o = 0;
  while (o < total && at < end) {
    const code = member[at++];
    if ((code & L.runMask) === L.runMask) {
      let n = code & L.countMask; const v = member[at++];
      if (n === 0) n = zeroCopies;
      if (rows) n = Math.min(n, width - (o % width));
      for (let k = 0; k < n && o < total; k++) out[o++] = v;
    } else out[o++] = code;
  }
  return out;
}

// The calls to a routine of obj1 by the byte scan: E8 followed by the displacement that lands on it.
function callSites(obj1, target) {
  const dv = new DataView(obj1.buffer, obj1.byteOffset, obj1.byteLength); let n = 0;
  for (let i = 0; i + 5 <= obj1.length; i++) if (obj1[i] === 0xe8 && ((i + 5 + dv.getInt32(i + 1, true)) >>> 0) === target) n++; // @math call rel32: the opcode, then a 4 byte displacement from the next instruction
  return n;
}

function validate(dat, exe, records, V, { zeroCopies = V.vga.zeroCopies, rows = false } = {}) {
  const K = V.vga, members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])), member = members.get(K.member);
  assert.deepEqual([K.runMask, K.countMask, K.width, K.height], [V.rule.runMask, V.rule.countMask, V.rule.width, V.rule.height], 'the rule of the linear decoder');
  assert.equal(crc(decodePcxMember(member).indices), K.plainCrc, 'the original picture');
  assert.equal(crc(new Uint8Array(K.width * K.height).fill(K.zeroValue)), K.zeroFillCrc, 'the CRC of a picture of the zero value');
  assert.deepEqual([K.zeroEvery, K.zeroValue], [ZERO_EVERY, ZERO_VALUE], 'the zero runs the test inputs contain');
  assert.equal(K.zeroCopies, 1 << 16, 'a 16-bit counter counts a zero through 65536'); // @math 2 to the power 16
  assert.ok(K.zeroCopies >= K.width * K.height, 'which fills the picture'); // @math at least the 64000 pixels
  const [zero, plain] = records.map((r, i) => ({ r, build: { zero: i === 0 } })).map(x => x); // the first record has the zero runs
  for (const { r, build } of [zero, plain]) {
    assertArchive(r, dat);
    assert.deepEqual(r.build, { member: K.member, zero: build.zero }, 'what was built');
    const run = crossingArchive(dat, K.member, member, { zero: build.zero });
    assert.equal(run.length, r.modified.size, 'the rebuilt run copy has the recorded size');
    assert.equal(createHash('sha1').update(run).digest('hex'), r.modified.sha1, 'the rebuilt run copy is the one the game ran from');
    const crafted = new Map(parseDatDirectory(run).map(e => [e.name, e.data])).get(K.member), shown = new Set(r.samples.map(s => s[r.columns.indexOf('frameCrc')]));
    const model = crc(decode(crafted, V, { zeroCopies, rows }));
    assert.ok(shown.has(model), `${r.id}: the screen shows the picture the model decodes (${model})`);
    const other = build.zero ? K.plainCrc : K.zeroFillCrc;
    assert.ok(!shown.has(other), `${r.id}: and not the other picture (${other})`);
  }
  assert.equal(crc(decode(crossingArchiveMember(dat, member, false), V)), K.plainCrc, 'runs that cross rows decode to the original in the model');
  assert.equal(crc(decode(crossingArchiveMember(dat, member, true), V)), K.zeroFillCrc, 'and the zero run fills the picture in the model');
  const { le } = locateLe(exe), obj1 = le.objects[0].data;
  assert.equal(callSites(obj1, K.vgaAt), K.vgaCallSites, 'the call sites of the decoder that writes the video planes');
  assert.equal(callSites(obj1, K.linearAt), K.linearCallSites, 'the call sites of the linear decoder');
}

const crossingArchiveMember = (dat, member, zero) => { const run = crossingArchive(dat, 'APOG1.PCX', member, { zero }); return new Map(parseDatDirectory(run).map(e => [e.name, e.data])).get('APOG1.PCX'); }; // @math the member of the claim

export default {
  id: 'obs-pcxvga',
  claims: ['pcx.rle-rule-vga'],
  obs: IDS,
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), await ctx.open('WW.EXE'), IDS.map(id => ctx.obs(id)), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), exe = await ctx.open('WW.EXE'), records = IDS.map(id => ctx.obs(id)), V = values();
    return [
      { label: 'a zero count of no copies', fn: () => validate(dat, exe, records, V, { zeroCopies: 0 }) },
      { label: 'a zero count of 64 copies', fn: () => validate(dat, exe, records, V, { zeroCopies: 64 }) }, // @math a 6-bit count with the zero read as 64
      { label: 'runs clipped at the row end', fn: () => validate(dat, exe, records, V, { rows: true }) },
      { label: 'a record altered', fn: () => validate(dat, exe, records.map((r, i) => (i === 1 ? { ...r, samples: r.samples.map(s => s.map((x, k) => (k === r.columns.indexOf('frameCrc') && x === V.vga.plainCrc ? '00000000' : x))) } : r)), V) }, // @math the second record, the one without zero runs
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), exe, records, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
