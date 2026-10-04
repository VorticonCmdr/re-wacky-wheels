import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ x: expected('exit.screen-observed') });
const TOOL = { textAt: 0xb8000, cells: 4000 }; // @math what observe.mjs exit reads: the colour text segment and 80 x 25 cells of 2 bytes

function validate(dat, r, V, { member = V.x.member } = {}) {
  const X = V.x, members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data]));
  assertArchive(r, dat);
  assert.deepEqual([r.textAt, r.cells], [TOOL.textAt, TOOL.cells], 'what the tool read');
  assert.deepEqual([X.textAt, X.cells, X.crtcStart], [r.textAt, r.cells, r.crtcStart], 'the screen and the start address');
  assert.equal(members.get(member).length, X.cells, 'the member is one screen of cells');
  assert.equal(members.get(X.other).length, X.cells, 'the other member too');
  assert.equal(r.textCrc, crc(members.get(member)), `the text screen is ${member}`);
  assert.equal(crc(members.get(X.member)), X.crc, 'the CRC of the member');
  assert.equal(crc(members.get(X.other)), X.otherCrc, 'the CRC of the other member');
  assert.notEqual(r.textCrc, X.otherCrc, 'not the other member');
  assert.notEqual(r.nextCrc, r.textCrc, 'the next 4000 bytes are another thing');
}

export default {
  id: 'obs-exit',
  claims: ['exit.screen-observed'],
  obs: ['exit-1'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('exit-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('exit-1'), V = values();
    return [
      { label: 'the shareware member', fn: () => validate(dat, r, V, { member: V.x.other }) },
      { label: 'the text altered', fn: () => validate(dat, { ...r, textCrc: '00000000' }, V) },
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
