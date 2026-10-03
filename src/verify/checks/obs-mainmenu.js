import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ main: expected('menu.main-observed'), menu: expected('text.menu-observed') });

// The CRC-32 of a tile's own non-zero pixels in row order, the value a record holds when the screen shows the tile there.
function ownCrc(data, tileBytes, k, [w, h]) {
  const picked = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const v = data[tileBytes * k + i * h + j]; if (v !== 0) picked.push(v); }
  return [picked.length, crc(Uint8Array.from(picked))];
}

function validate(dat, r, V, { x0 = V.main.x0, y0 = V.main.y0, hyphen = V.main.hyphenTile, trade = V.main.tradeMarkTile } = {}) {
  const M = V.main, font = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])).get(M.member), tileBytes = M.tile[0] * M.tile[1];
  assertArchive(r, dat);
  assert.deepEqual([M.member, M.tile, M.tiles, M.step, M.lineStep, M.letterBase, M.spaceTile], [V.menu.member, V.menu.tile, V.menu.tiles, V.menu.step, V.menu.lineStep, V.menu.letterBase, V.menu.spaceTile], 'the same tile font as text.menu-observed');
  const tf = r.tiles[0];
  assert.equal(r.tiles.length, 1);
  assert.deepEqual([tf.member, tf.w, tf.h, tf.count], [M.member, ...M.tile, M.tiles], 'what the tool read');
  assert.equal(M.items.reduce((n, t) => n + [...t].length, 0), M.positions, 'the characters of the nine items');
  assert.equal(tf.positions.length, M.positions);
  const own = Array.from({ length: M.tiles }, (_, k) => ownCrc(font, tileBytes, k, M.tile));
  const tileOf = ch => (ch === ' ' ? M.spaceTile : ch === '-' ? hyphen : ch === '™' ? trade : ch.charCodeAt(0) - M.letterBase);
  let position = 0;
  M.items.forEach((text, m) => [...text].forEach((ch, k) => {
    const pos = tf.positions[position++];
    assert.deepEqual([pos.x, pos.y, pos.tag], [x0 + M.step * k, y0 + M.lineStep * m, `${m}:${k}`], 'the place of the character');
    const hits = []; pos.c.forEach(([pixels, c], t) => { if (pixels === own[t][0] && c === own[t][1]) hits.push([t, pixels]); });
    assert.ok(hits.length >= 1, `a tile fits item ${m} character ${k}`);
    const most = Math.max(...hits.map(h => h[1])), best = hits.filter(h => h[1] === most);
    assert.equal(best.length, 1, 'one fitting tile has the most pixels');
    assert.equal(best[0][0], tileOf(ch), `item ${m} character ${k} is that tile`);
  }));
}

export default {
  id: 'obs-mainmenu',
  claims: ['menu.main-observed'],
  obs: ['menu-2'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('menu-2'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('menu-2'), V = values(), M = V.main;
    return [
      { label: 'items from x 51', fn: () => validate(dat, r, V, { x0: M.x0 + 1 }) },
      { label: 'items from y 77', fn: () => validate(dat, r, V, { y0: M.y0 + 1 }) },
      { label: 'the hyphen as tile 40', fn: () => validate(dat, r, V, { hyphen: M.hyphenTile + 1 }) },
      { label: 'the trade mark as tile 40', fn: () => validate(dat, r, V, { trade: M.tradeMarkTile - 1 }) },
      { label: 'a tile crc altered', fn: () => validate(dat, { ...r, tiles: [{ ...r.tiles[0], positions: r.tiles[0].positions.map((p, i) => (i === 20 ? { ...p, c: p.c.map((e, t) => (t === 19 ? [e[0], '00000000'] : e)) } : p)) }] }, V) }, // @math the twenty-first position, the T of TWO PLAYER RACE, T is tile 19
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
