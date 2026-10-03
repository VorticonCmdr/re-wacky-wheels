import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseVocWith } from '../../formats/voc.js';
import { view } from '../../binary.js';
import { expected } from '../expect.js';

async function vocs(ctx) {
  const members = parseDatDirectory(await ctx.open('WACKY.DAT')).filter(e => /\.VOC$/i.test(e.name));
  assert.ok(members.length > 0, 'the archive has .VOC members');
  return members;
}

// Every member must parse under the layout and show the structure the claim states; wrong layouts must not.
function validate(members, L) {
  members.forEach(({ name, data }) => {
    const voc = parseVocWith(data, L), dv = view(data);
    assert.equal(L.magic.length, L.markerAt, 'the marker byte follows the 19-byte name');
    assert.equal(voc.version, 0x010a, `${name}: version`); // @math Creative Voice version 1.10, seen in every member
    const sounds = voc.blocks.filter(b => b.type === L.soundBlock);
    assert.equal(sounds.length, 1, `${name}: exactly one sound block`);
    assert.equal(sounds[0].data[1], L.pcm8, `${name}: the codec byte`);
    assert.ok(sounds[0].length > 2, `${name}: the sound block holds samples`); // @math divisor and codec bytes precede the samples
    const others = voc.blocks.filter(b => b.type !== L.soundBlock);
    if (name.toUpperCase() === 'MOTOR.VOC') {
      assert.deepEqual(voc.blocks.map(b => b.type), [L.repeatStart, L.soundBlock, L.repeatEnd], 'MOTOR.VOC: a repeat around the sound');
      assert.equal(voc.blocks[0].length, 2); // @math the repeat count is a 16-bit word
      assert.equal(dv.getUint16(voc.blocks[0].offset + L.blockHeaderBytes, true), L.infiniteRepeat, 'MOTOR.VOC repeats forever');
      assert.equal(voc.blocks.at(-1).length, 0, 'the repeat end has no data');
    } else assert.equal(others.length, 0, `${name}: no other blocks`);
  });
}

export default {
  id: 'voc-members',
  claims: ['voc.layout'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await vocs(ctx), expected('voc.layout')); },
  // A neighbouring header size, checksum position, block header size or length width, and the wrong marker, must all fail.
  async discriminate(ctx) {
    const members = await vocs(ctx), L = expected('voc.layout'), wrong = (label, patch) => ({ label, fn: () => validate(members, { ...L, ...patch }) });
    return [
      wrong(`header ${L.headerBytes - 1} bytes`, { headerBytes: L.headerBytes - 1 }),
      wrong(`header ${L.headerBytes + 1} bytes`, { headerBytes: L.headerBytes + 1 }),
      wrong('header size read at 21', { headerSizeAt: L.headerSizeAt + 1 }),
      wrong('version read at 23', { versionAt: L.versionAt + 1 }),
      wrong('checksum read at 25', { checksumAt: L.checksumAt + 1 }),
      wrong('checksum base 0x1235', { checksumBase: L.checksumBase + 1 }),
      wrong('block header of 3 bytes', { blockHeaderBytes: L.blockHeaderBytes - 1 }),
      wrong('block header of 5 bytes', { blockHeaderBytes: L.blockHeaderBytes + 1 }),
      wrong('marker 0x1b', { marker: L.marker + 1 }),
      wrong('sound block type 2', { soundBlock: L.soundBlock + 1 }),
      wrong('repeat blocks swapped', { repeatStart: L.repeatEnd, repeatEnd: L.repeatStart }),
      wrong('finite repeat 0xfffe', { infiniteRepeat: L.infiniteRepeat - 1 }),
      wrong('codec 1', { pcm8: L.pcm8 + 1 }),
    ];
  },
};
