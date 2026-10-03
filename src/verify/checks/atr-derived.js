import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseAtrWith } from '../../formats/atr.js';
import { view } from '../../binary.js';
import { expected } from '../expect.js';

const values = () => ({ d: expected('atr.derived-words'), layout: expected('atr.layout') });

// Catalogue words that follow from others: +2 is one constant, +8 and +0x0a repeat the dimensions, +0x0c is a function of the dimensions; +0 takes a small range of kinds.
function validate(dat, V) {
  const D = V.d, L = V.layout, atr = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])).get('SPRITE.ATR');
  const records = parseAtrWith(atr, L), kinds = new Set();
  assert.equal(records.length, D.records, 'the catalogue holds this many records');
  for (const r of records) {
    const dv = view(r.raw), word = at => dv.getUint16(at, true);
    assert.equal(word(D.constantAt), D.constant, `${r.id}: the word at +${D.constantAt} is the constant`);
    assert.equal(word(D.widthRepeatAt), r.width, `${r.id}: +${D.widthRepeatAt} repeats the width`);
    assert.equal(word(D.heightRepeatAt), r.height, `${r.id}: +${D.heightRepeatAt} repeats the height`);
    const shape = D.shapes.find(([w, h]) => w === r.width && h === r.height);
    assert.ok(shape, `${r.id}: ${r.width} x ${r.height} is one of the known shapes`);
    const [, , code] = shape;
    assert.equal(word(D.selectorAt), code, `${r.id}: the selector word follows the shape`);
    kinds.add(word(D.kindAt));
  }
  assert.deepEqual([...kinds].sort((a, b) => a - b), D.kinds, 'the kind words that occur');
  assert.equal(new Set(D.shapes.map(([, , code]) => code)).size, D.shapes.length, 'each selector value names one shape');
}

export default {
  id: 'atr-derived',
  claims: ['atr.derived-words'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), V = values(), d = patch => () => validate(dat, { ...V, d: { ...V.d, ...patch } });
    return [
      { label: 'constant 11', fn: d({ constant: V.d.constant + 1 }) },
      { label: 'constant 9', fn: d({ constant: V.d.constant - 1 }) },
      { label: 'repeat at +6', fn: d({ widthRepeatAt: V.d.heightAt ?? 0x06 }) }, // @math the height word instead
      { label: 'selector at +0x0e', fn: d({ selectorAt: V.layout.framesAt }) },
      { label: 'selectors rotated', fn: d({ shapes: V.d.shapes.map(([w, h], i, all) => { const [, , next] = all[(i + 1) % all.length]; return [w, h, next]; }) }) },
      { label: 'kinds 0 to 8', fn: d({ kinds: [...V.d.kinds, V.d.kinds.length] }) },
      { label: 'one shape missing', fn: d({ shapes: V.d.shapes.slice(1) }) },
    ];
  },
};
