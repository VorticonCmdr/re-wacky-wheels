import assert from 'node:assert/strict';
import { archiveMembers } from '../../game/track-data.js';
// the picture is not compared: every pixel under a tile's non-zero pixels is the tile's (the bar covers the picture), so the picture itself is boot.pictures-observed's
import { renderMenu, loadMenuArt } from '../../render/menu.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ main: expected('menu.main-observed'), boot: expected('boot.pictures-observed') });
const SCREEN = { width: 320, height: 200 }; // @math the mode 13h screen: boot.pictures-observed reads the same 320 x 200

// The port's main menu frame against the recorded one: for every character position and every tile of the font, the pixels of the port's frame under the
// tile's non-zero pixels (their count and CRC-32 in row order) equal what the game's screen held there.
function replay(dat, r, V, { swapTiles = false } = {}) {
  const M = V.main, members = archiveMembers(dat);
  assertArchive(r, dat);
  assert.deepEqual(V.boot.order.at(-1), 'WINTRO.PCX', 'the menu is drawn over the last intro picture');
  const art = loadMenuArt(members), tiles = art.tiles, fb = new Uint8Array(SCREEN.width * SCREEN.height);
  if (swapTiles) [tiles[0], tiles[1]] = [tiles[1], tiles[0]]; // @math swap the first two tiles of the font
  renderMenu(fb, art, { lionTop: 69, lionFrame: 0, pair: 1, size: 0, frame: 0 }); // @math any state: the icons and cars do not cover the characters' tile pixels
  const positions = r.tiles[0].positions;
  assert.equal(positions.length, M.positions, 'every character position is in the record');
  let compared = 0;
  positions.forEach(pos => tiles.forEach((tile, k) => {
    const picked = [];
    for (let j = 0; j < M.tile[1]; j++) for (let i = 0; i < M.tile[0]; i++) if (tile[i * M.tile[1] + j] !== 0) picked.push(fb[(pos.y + j) * SCREEN.width + pos.x + i]);
    assert.deepEqual([picked.length, crc(Uint8Array.from(picked))], pos.c[k], `position ${pos.tag}, tile ${k}`);
    compared++;
  }));
  return compared;
}

export default {
  id: 'port-menu',
  claims: ['menu.main-observed'],
  obs: ['menu-2'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const V = values(), compared = replay(await ctx.open('WACKY.DAT'), ctx.obs('menu-2'), V);
    assert.equal(compared, V.main.positions * V.main.tiles, 'every position against every tile');
  },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('menu-2'), V = values();
    return [
      { label: 'the first two tiles of the font swapped', fn: () => replay(dat, r, V, { swapTiles: true }) },
      { label: 'one recorded CRC altered', fn: () => replay(dat, { ...r, tiles: [{ ...r.tiles[0], positions: r.tiles[0].positions.map((p, i) => (i === 0 ? { ...p, c: p.c.map((e, t) => (t === 0 ? [e[0], '00000000'] : e)) } : p)) }] }, V) },
      { label: 'one archive byte changed', fn: () => replay(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
