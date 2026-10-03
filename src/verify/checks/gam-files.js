import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseGamWith } from '../../formats/gam.js';
import { decodePcxMember } from '../../formats/pcx.js';
import { expected } from '../expect.js';

function archive(dat) {
  const members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])), gams = [...members.keys()].filter(n => n.endsWith('.GAM')).sort();
  assert.ok(gams.length > 0, 'no .GAM members');
  return { members, gams };
}
// The game prefixes lines 1-4 and looks names up case-insensitively (the in-place upper-casing is dat.entry-compare).
const resolve = (members, name, prefix) => { const d = members.get((prefix + name).toUpperCase()); assert.ok(d, `${prefix}${name} is not a member`); return d; };

// A mask sheet holds only `values` in the used tile slots and only `filler` everywhere else.
function maskSheet(image, S, V) {
  const seen = new Set();
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    const slot = Math.floor(y / S.size) * S.columns + Math.floor(x / S.size), v = image.indices[y * image.width + x];
    if (slot < S.count) { assert.ok(V.values.includes(v), `used slot ${slot} holds ${v}`); seen.add(v); } else assert.equal(v, V.filler, `slot ${slot} outside the used tiles holds ${v}`);
  }
  return seen;
}

function checkAll(dat, { layout, prefix, swap = false, tileCount, text = d => d }) {
  const { members, gams } = archive(dat), S = { ...expected('tiles.sheet-split') }, V = expected('tiles.mask-values'), seen = new Set(), masks = new Set();
  if (tileCount !== undefined) S.count = tileCount;
  for (const name of gams) {
    const g = parseGamWith(text(members.get(name)), layout);
    const [tiles, maskNames] = swap ? [g.masks, g.tilesets] : [g.tilesets, g.masks];
    for (const n of tiles) decodePcxMember(resolve(members, n, prefix));
    for (const n of maskNames) {
      if (masks.has(n.toUpperCase())) continue;
      masks.add(n.toUpperCase());
      maskSheet(decodePcxMember(resolve(members, n, prefix)), S, V).forEach(v => seen.add(v));
    }
    decodePcxMember(members.get(g.sky.toUpperCase()) ?? assert.fail(`sky ${g.sky} is not a member`));
    assert.ok(g.flag === 0 || g.flag === 1, `flag ${g.flag}`);
  }
  assert.deepEqual([...seen].sort(), [...V.values].sort(), 'both mask values occur');
  return { gams: gams.length, masks: masks.size };
}

export default {
  id: 'gam-files',
  claims: ['gam.layout', 'tiles.mask-values'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) {
    const dat = await ctx.open('WACKY.DAT'), L = expected('gam.layout'), read = expected('gam.read'), S = expected('tiles.sheet-split'), V = expected('tiles.mask-values');
    const result = checkAll(dat, { layout: L, prefix: read.prefix });
    assert.ok(result.masks > 1, 'several distinct mask sheets');
    // The layout agrees with what the executable does (STATIC claims from disassembly).
    assert.equal(L.tilesets, read.tilesetSlots);
    assert.equal(L.masks, read.maskSlots);
    assert.equal(L.startPairs, expected('gam.read-rest').startPairs);
    assert.equal(L.extraLines, read.extraLines);
    assert.equal(S.count, expected('tiles.buffer').totalBytes / expected('tiles.buffer').sheetDivisor / expected('tiles.buffer').tileBytes);
    assert.ok(!V.values.includes(V.filler), 'the filler is distinguishable from the mask values');
  },
  // Wrong prefixes, swapped roles, other pair counts, other separators and other tile counts must fail.
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), L = expected('gam.layout'), read = expected('gam.read'), S = expected('tiles.sheet-split');
    const wrong = (label, patch, extra = {}) => ({ label, fn: () => checkAll(dat, { layout: { ...L, ...patch }, prefix: read.prefix, ...extra }) });
    return [
      { label: 'no "A_" prefix', fn: () => checkAll(dat, { layout: L, prefix: '' }) },
      { label: 'tilesets and masks swapped', fn: () => checkAll(dat, { layout: L, prefix: read.prefix, swap: true }) },
      wrong(`${L.startPairs - 1} coordinate pairs`, { startPairs: L.startPairs - 1 }),
      wrong(`${L.startPairs + 1} coordinate pairs`, { startPairs: L.startPairs + 1 }),
      wrong('bare LF separator', { separator: '\n' }),
      { label: `${S.count - 1} used tile slots`, fn: () => checkAll(dat, { layout: L, prefix: read.prefix, tileCount: S.count - 1 }) },
      { label: `${S.count + 1} used tile slots`, fn: () => checkAll(dat, { layout: L, prefix: read.prefix, tileCount: S.count + 1 }) },
    ];
  },
};
