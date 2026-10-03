import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ menu: expected('text.menu-observed'), glyphs: expected('text.glyphs-observed') });

// The CRC-32 of a tile's own non-zero pixels in row order, the value a record holds when the screen shows the tile there.
function ownCrc(data, tileBytes, k, [w, h]) {
  const picked = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const v = data[tileBytes * k + i * h + j]; if (v !== 0) picked.push(v); }
  return [picked.length, crc(Uint8Array.from(picked))];
}

function validate(dat, r, V, { step = V.menu.step, base = V.menu.letterBase, space = V.menu.spaceTile, lineStep = V.menu.lineStep } = {}) {
  const M = V.menu, font = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])).get(M.member), tileBytes = M.tile[0] * M.tile[1];
  assertArchive(r, dat);
  assert.equal(font.length, M.fileBytes, 'the file size');
  assert.equal(M.tiles * tileBytes, M.fileBytes, 'the file is 42 tiles of 15 x 13 pixels');
  assert.equal(r.tiles.length, 1, 'one tile font');
  const tf = r.tiles[0];
  assert.deepEqual([tf.member, tf.w, tf.h, tf.count], [M.member, ...M.tile, M.tiles], 'what the tool read');
  assert.equal(M.letterBase, V.glyphs.letterBase, 'the letters count from A as in text.glyphs-observed');
  const own = Array.from({ length: M.tiles }, (_, k) => ownCrc(font, tileBytes, k, M.tile));
  assert.equal(tf.positions.length, M.positions, 'the positions');
  assert.equal(M.lines.reduce((n, t) => n + t.length, 0), M.positions, 'the characters of the four items');
  let position = 0;
  M.lines.forEach((text, m) => [...text].forEach((ch, k) => {
    const pos = tf.positions[position++];
    assert.deepEqual([pos.x, pos.y, pos.tag], [M.x0 + step * k, M.y0 + lineStep * m, `${m}:${k}`], 'the place of the character');
    const hits = []; pos.c.forEach(([pixels, c], t) => { if (pixels === own[t][0] && c === own[t][1]) hits.push([t, pixels]); });
    assert.ok(hits.length >= 1, `a tile fits item ${m} character ${k}`);
    const most = Math.max(...hits.map(h => h[1])), best = hits.filter(h => h[1] === most);
    assert.equal(best.length, 1, 'one fitting tile has the most pixels');
    assert.equal(best[0][0], ch === ' ' ? space : ch.charCodeAt(0) - base, `item ${m} character ${k} (${ch}) is that tile`);
  }));
  assert.equal(M.step, M.tile[0] - 4, 'the tiles overlap by 4 columns'); // @math two transparent columns at each side of the bar piece
}

export default {
  id: 'obs-menutext',
  claims: ['text.menu-observed'],
  obs: ['menu-1'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('menu-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('menu-1'), V = values(), M = V.menu;
    return [
      { label: 'a step of 12', fn: () => validate(dat, r, V, { step: M.step + 1 }) },
      { label: 'letters from 0x40', fn: () => validate(dat, r, V, { base: M.letterBase - 1 }) },
      { label: 'the space as tile 35', fn: () => validate(dat, r, V, { space: M.spaceTile - 1 }) },
      { label: 'lines 13 apart', fn: () => validate(dat, r, V, { lineStep: M.lineStep + 1 }) },
      { label: 'a tile crc altered', fn: () => validate(dat, { ...r, tiles: [{ ...r.tiles[0], positions: r.tiles[0].positions.map((p, i) => (i === 3 ? { ...p, c: p.c.map((e, t) => (t === 10 ? [e[0], '00000000'] : e)) } : p)) }] }, V) }, // @math the fourth position, K is tile 10
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
