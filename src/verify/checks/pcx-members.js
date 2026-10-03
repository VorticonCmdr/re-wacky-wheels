import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { decodePcxWith } from '../../formats/pcx.js';
import { view } from '../../binary.js';
import { expected } from '../expect.js';

const pcxMembers = dat => {
  const members = parseDatDirectory(dat).filter(e => e.name.endsWith('.PCX'));
  assert.ok(members.length > 0, 'no PCX members');
  return members;
};
const decodeAll = (members, layout) => members.map(m => decodePcxWith(m.data, layout));

export default {
  id: 'pcx-members',
  claims: ['pcx.layout', 'pcx.header-observed'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) {
    const members = pcxMembers(await ctx.open('WACKY.DAT')), L = expected('pcx.layout'), H = expected('pcx.header-observed');
    // Exact consumption: decodePcxWith throws unless the stream fills the picture and leaves only the marker.
    for (const [i, image] of decodeAll(members, L).entries()) {
      assert.equal(image.indices.length, L.width * L.height, members[i].name);
      assert.equal(image.palette.length, L.palette, members[i].name);
    }
    // No run crosses a row boundary and none is empty (so the game's tolerance for either never mattered here).
    for (const m of members) {
      let col = 0, at = L.header;
      while (at < m.size - L.palette - 1) {
        const code = m.data[at++], run = (code & L.runMask) === L.runMask;
        const n = run ? code & L.countMask : 1;
        if (run) at++;
        assert.ok(n > 0 && col + n <= L.width, `${m.name} run at ${at} crosses a row or is empty`);
        col = (col + n) % L.width;
      }
    }
    for (const m of members) {
      const dv = view(m.data);
      assert.equal(m.data[H.manufacturerAt], H.manufacturer, m.name);
      assert.equal(m.data[H.versionAt], H.version, m.name);
      assert.equal(m.data[H.encodingAt], H.encoding, m.name);
      assert.equal(m.data[H.bitsAt], H.bits, m.name);
      assert.equal(m.data[H.planesAt], H.planes, m.name);
      assert.equal(dv.getUint16(H.strideAt, true), H.stride, m.name);
      const [x0, y0, x1, y1] = [0, 1, 2, 3].map(k => dv.getUint16(H.boxAt + 2 * k, true)); // @math four uint16 box fields, 2 bytes each
      assert.deepEqual([x1 - x0 + 1, y1 - y0 + 1], [L.width, L.height], m.name);
    }
    // The layout agrees with what the executable does (STATIC claims from disassembly).
    const rule = expected('pcx.rle-rule'), split = expected('pcx.member-split');
    assert.deepEqual([rule.runMask, rule.countMask, rule.width, rule.height], [L.runMask, L.countMask, L.width, L.height]);
    assert.equal(split.header, L.header);
    assert.equal(split.palette, L.palette);
    assert.equal(split.headerAndPalette, L.header + L.palette);
  },
  // Other run encodings, other split points and another marker must not decode the archive.
  async discriminate(ctx) {
    const members = pcxMembers(await ctx.open('WACKY.DAT')), L = expected('pcx.layout'), wrong = (label, patch) => ({ label, fn: () => decodeAll(members, { ...L, ...patch }) });
    return [
      wrong('run flag 0x80 only', { runMask: 0x80 }), // @math alternative: any byte with the top bit is a run
      wrong('run flag 0xE0', { runMask: 0xe0 }), // @math alternative: three-bit run flag
      wrong('count mask 0x1F', { countMask: 0x1f }), // @math alternative: five-bit run count
      wrong('count mask 0x7F', { countMask: 0x7f }), // @math alternative: seven-bit run count
      wrong(`header ${L.header - 1}`, { header: L.header - 1 }),
      wrong(`header ${L.header + 1}`, { header: L.header + 1 }),
      wrong(`palette ${L.palette - 1}`, { palette: L.palette - 1 }),
      wrong(`palette ${L.palette + 1}`, { palette: L.palette + 1 }),
      wrong('marker 0x0B', { marker: L.marker - 1 }),
      wrong(`width ${L.width - 1}`, { width: L.width - 1 }),
      wrong(`height ${L.height + 1}`, { height: L.height + 1 }),
    ];
  },
};
