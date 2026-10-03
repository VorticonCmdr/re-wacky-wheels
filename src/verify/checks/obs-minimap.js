import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { locateLe, objectBytes } from '../../formats/le.js';
import { view } from '../../binary.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ map: expected('hud.minimap-observed') });
// The constants as the routine carries them: the immediates of the instructions the claim cites.
const SITES = {
  bias: { at: 0x1a57e, skip: 2, width: 4 }, // @math sub eax,imm32
  limit: { at: 0x1a59e, skip: 2, width: 2 }, // @math cmp ax,imm16
  rowOrigin: { at: 0x1a5e5, skip: 2, width: 1 }, // @math add esi,imm8
};
function codeImmediates(exe, M) {
  const { le } = locateLe(exe);
  for (const [name, site] of Object.entries(SITES)) {
    const b = objectBytes(le, 1, site.at, site.skip + site.width), dv = view(b), at = site.skip;
    assert.equal(site.width === 4 ? dv.getUint32(at, true) : site.width === 2 ? dv.getUint16(at, true) : dv.getUint8(at), M[name], `${name}: the immediate in the code`); // @math one, two or four byte immediates
  }
}
const COLOUR = 2; // @math a dot is [column, row, colour]
const TOOL = { racerWords: [0xaaa6, 0xaaa8], countWord: 0x28c40, racerBytes: 0x68, rect: [0, 60, 78, 50], samples: 2 }; // @math the words observe.mjs reads for the minimap: each racer's x and y (racer 0 first, 0x68 apart) and the count word

function validate(dat, r1, r2, V, { bias = V.map.bias, rowOrigin = V.map.rowOrigin, yAt = V.map.tableBytes, order = 'xy', exe } = {}) {
  const M = V.map, xy = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])).get('MAP.XY');
  assertArchive(r1, dat); assertArchive(r2, dat);
  if (exe) codeImmediates(exe, { ...M, bias, rowOrigin });
  assert.equal(xy.length, M.tableBytes + M.tableBytes, 'MAP.XY is two tables');
  assert.deepEqual(TOOL.racerWords, [M.racerBase + M.xWord, M.racerBase + M.yWord], 'the racer words the tool read');
  assert.equal(TOOL.countWord, M.countWord, 'the count word the tool read');
  assert.equal(TOOL.racerBytes, M.racerBytes, 'the racer record size the tool used');
  assert.deepEqual(TOOL.rect, M.rect, 'the rectangle the tool compared');
  assert.equal(M.rect[1], M.rowOrigin, 'the rectangle starts at the row origin');
  assert.equal(TOOL.samples, M.samples, 'the two records');
  const clamp = v => { const d = v - bias; return d <= 0 ? 0 : Math.min(d, M.limit); };
  const dotOf = ([x, y]) => (order === 'xy' ? [xy[clamp(x)], rowOrigin + xy[yAt + clamp(y)]] : [xy[clamp(y)], rowOrigin + xy[yAt + clamp(x)]]);
  const sameDot = (a, b) => a[0] === b[0] && a[1] === b[1];
  for (const r of [r1, r2]) {
    const m = r.minimap;
    assert.equal(m.count, M.countValue, 'the count word');
    assert.equal(m.dots.length, M.racers, 'one differing pixel for each racer');
    assert.equal(m.racers.length, M.racers);
    assert.equal(m.dots.filter(d => d[COLOUR] === M.playerColour).length, M.exact.length, 'one dot in the player\'s colour');
    assert.equal(m.dots.filter(d => d[COLOUR] === M.otherColour).length, M.racers - 1, 'the others in the other colour');
    // the two tables as they were loaded: the halves of MAP.XY
    assert.deepEqual(m.tables.x, [M.xTableAt, crc(xy.subarray(0, M.tableBytes))], 'the column table is the first half');
    assert.deepEqual(m.tables.y, [M.yTableAt, crc(xy.subarray(M.tableBytes))], 'the row table is the second half');
  }
  // the player's dot, exact in both records
  for (const r of [r1, r2]) {
    const player = dotOf(r.minimap.racers[0]).map((v, i) => v - [0, M.rowOrigin][i]);
    const dot = r.minimap.dots.find(d => d[COLOUR] === M.playerColour);
    assert.deepEqual([dot[0], dot[1]], [dotOf(r.minimap.racers[0])[0], dotOf(r.minimap.racers[0])[1] - M.rowOrigin], 'the player\'s dot is where the table says');
    void player;
  }
  assert.deepEqual(r1.minimap.dots.filter(d => d[COLOUR] === M.playerColour).map(d => [d[0], d[1]]), M.exact, 'the player\'s dot at the paused start');
  // the second record: all dots, exactly
  const predicted = r2.minimap.racers.map(dotOf).map(([c, row]) => [c, row - M.rowOrigin, null]);
  const actual = r2.minimap.dots.map(d => [d[0], d[1]]);
  r2.minimap.racers.forEach((p, n) => {
    const [c, row] = dotOf(p), dot = r2.minimap.dots.find(d => d[0] === c && d[1] === row - M.rowOrigin);
    assert.ok(dot, `racer ${n}'s dot is among the differing pixels`);
    assert.equal(dot[COLOUR], n === 0 ? M.playerColour : M.otherColour, `its colour`);
  });
  assert.equal(new Set(predicted.map(p => `${p[0]},${p[1]}`)).size, M.racers, 'eight distinct dots');
  void actual;
}

export default {
  id: 'obs-minimap',
  claims: ['hud.minimap-observed'],
  obs: ['minimap-1', 'minimap-2'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('minimap-1'), ctx.obs('minimap-2'), values(), { exe: await ctx.open('WW.EXE') }); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), exe = await ctx.open('WW.EXE'), r1 = ctx.obs('minimap-1'), r2 = ctx.obs('minimap-2'), V = values(), M = V.map, m = patch => ({ map: { ...M, ...patch } });
    const edit = fn => ({ ...r2, minimap: fn(r2.minimap) });
    return [
      { label: 'a bias of 0x3ff (the dots cannot tell, the code can)', fn: () => validate(dat, r1, r2, V, { bias: M.bias - 1, exe }) },
      { label: 'a row origin of 59', fn: () => validate(dat, r1, r2, V, { rowOrigin: M.rowOrigin - 1 }) },
      { label: 'a limit of 0x7fe', fn: () => validate(dat, r1, r2, m({ limit: M.limit - 1 }), { exe }) },
      { label: 'the tables swapped', fn: () => validate(dat, r1, r2, V, { order: 'yx' }) },
      { label: 'the row table at 2050', fn: () => validate(dat, r1, r2, V, { yAt: M.tableBytes + 2 }) }, // @math the wiki's offset
      { label: 'a dot of the wrong colour', fn: () => validate(dat, r1, edit(mm => ({ ...mm, dots: mm.dots.map((d, i) => (i === 1 ? [d[0], d[1], M.playerColour] : d)) })), V) },
      { label: 'a dot one pixel off', fn: () => validate(dat, r1, edit(mm => ({ ...mm, dots: mm.dots.map((d, i) => (i === 3 ? [d[0] + 1, d[1], d[COLOUR]] : d)) })), V) }, // @math a dot in the middle of the list
      { label: 'seven racers counted', fn: () => validate(dat, r1, r2, m({ countValue: M.countValue + 1 })) },
      { label: 'a player colour of 254', fn: () => validate(dat, r1, r2, m({ playerColour: M.playerColour - 1 })) },
      { label: 'another exact dot', fn: () => validate(dat, r1, r2, m({ exact: [[M.exact[0][0] + 1, M.exact[0][1]]] })) },
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r1, r2, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
