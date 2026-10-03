import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { buildRegistry, claims, weakest } from '../src/evidence/registry.js';
import { K, withSteps, leaves } from '../src/evidence/k.js';
import { UNKNOWN, isUnknown } from '../src/evidence/unknown.js';
import { crc32, hex8, maskedCrc } from '../src/evidence/crc32.js';
import { parseLe, parseFixups, locateLe, objectBytes, toGhidra, fromGhidra, objectFixups, siteMasks } from '../src/formats/le.js';
import { lintSource } from '../tools/lint/constants.mjs';
import { loadChecks, crossValidate } from '../src/verify/run.js';
import { loadObs, validateObs } from '../src/verify/obs.js';

const base = { statement: 's', evidence: {} };
// Whichever claim is UNKNOWN today: the tests need one, not a particular one.
const UNKNOWN_ID = [...claims.values()].find(c => c.tag === 'UNKNOWN').id;

test('registry rejects malformed claims', () => {
  assert.throws(() => buildRegistry([{ ...base, id: 'a.b', tag: 'MAYBE' }]), /invalid tag/);
  assert.throws(() => buildRegistry([{ ...base, id: 'a.b', tag: 'PROVEN', value: 1 }]), /PROVEN needs a check/);
  assert.throws(() => buildRegistry([{ ...base, id: 'a.b', tag: 'STATIC', value: 1 }]), /STATIC needs a citation/);
  assert.throws(() => buildRegistry([{ ...base, id: 'a.b', tag: 'WF', value: 1 }]), /WF needs the workflow run/);
  assert.throws(() => buildRegistry([{ ...base, id: 'UNKNOWN_X', tag: 'UNKNOWN', value: 3 }]), /no value/);
  assert.throws(() => buildRegistry([{ ...base, id: 'a.b', tag: 'UNKNOWN' }]), /go together/);
  assert.throws(() => buildRegistry([{ ...base, id: 'a.b', tag: 'STATIC', evidence: { at: ['WW.EXE:0x10 fp=12345678'] } }]), /citation/);
  assert.throws(() => buildRegistry([{ ...base, id: 'a.b', tag: 'UNKNOWN', guess: 1 }]), /unknown field guess/);
  assert.throws(() => buildRegistry([{ ...base, id: 'x.y', tag: 'STATIC', evidence: { at: ['WW.EXE:obj1+0x10 fp=0000abcd'] } }, { ...base, id: 'x.y', tag: 'STATIC', evidence: { obs: ['o'] } }]), /Duplicate/);
  assert.equal(buildRegistry([{ ...base, id: 'x.y', tag: 'STATIC', value: 2, evidence: { at: ['WW.EXE:obj1+0x10 fp=0000abcd'] } }]).size, 1);
});

test('every claim module is listed in claims/index.js', async () => {
  const files = (await readdir(new URL('../src/evidence/claims/', import.meta.url))).filter(f => f.endsWith('.js') && f !== 'index.js');
  const index = await import('../src/evidence/claims/index.js');
  const listed = new Set(index.default.map(c => c.id));
  for (const f of files) for (const c of (await import(`../src/evidence/claims/${f}`)).default) assert.ok(listed.has(c.id), `${f}: ${c.id} not in index.js`);
});

test('K returns registry values, rejects drift, and honours the mutation hook', () => {
  assert.deepEqual(K({ magic: 'MZ', lfanew: 0x3c }, 'mz.header'), { magic: 'MZ', lfanew: 0x3c });
  assert.throws(() => K({ magic: 'MZ', lfanew: 0x3d }, 'mz.header'), /differs/);
  assert.throws(() => K(1, 'no.such.claim'), /No claim/);
  assert.throws(() => K(1, UNKNOWN_ID), /records no value/);
  globalThis.__DR_MUTATE__ = { id: 'mz.header', path: ['lfanew'], variant: 'inc' };
  try { assert.equal(K({ magic: 'MZ', lfanew: 0x3c }, 'mz.header').lfanew, 0x3d); }
  finally { delete globalThis.__DR_MUTATE__; }
  assert.deepEqual(leaves({ a: 1, b: [2, { c: 3 }] }), [['a'], ['b', '0'], ['b', '1', 'c']]);
});

test('UNKNOWN sentinels label themselves and refuse arithmetic', () => {
  const u = UNKNOWN(UNKNOWN_ID);
  assert.ok(isUnknown(u));
  assert.equal(`${u}`, UNKNOWN_ID);
  assert.throws(() => u + 1, /not established/);
  assert.throws(() => u * 2, /not established/);
  assert.throws(() => UNKNOWN('UNKNOWN_NOT_REGISTERED'), /No claim/);
  assert.throws(() => UNKNOWN('mz.header'), /use K/);
});

test('withSteps badges a decode with its weakest step', () => {
  const proven = withSteps(() => K({ magic: 'MZ', lfanew: 0x3c }, 'mz.header'));
  assert.deepEqual(proven.steps, ['mz.header']);
  assert.equal(proven.tag, 'PROVEN');
  const mixed = withSteps(() => { K({ magic: 'MZ', lfanew: 0x3c }, 'mz.header'); return UNKNOWN(UNKNOWN_ID); });
  assert.equal(mixed.tag, 'UNKNOWN');
  assert.equal(weakest(['PROVEN', 'STATIC', 'WF']), 'WF');
  assert.equal(withSteps(() => 42).tag, 'UNKNOWN', 'a decode that touches no claim must not badge as proven');
  assert.equal(weakest([]), 'UNKNOWN');
});

test('crc32 matches the IEEE check value', () => {
  assert.equal(hex8(crc32(new TextEncoder().encode('123456789'))), 'cbf43926');
});

// A minimal bound LE: a decoy MZ stub, then an inner MZ whose e_lfanew reaches an LE header with
// one 2-page object (the second page short, then bss) and one 32-bit fixup.
function syntheticLe() {
  const stub = 32, inner = stub, le = 0x40, pageSize = 0x20, last = 0x08;
  const objTable = 0xb0, pageMap = 0xc8, fixPages = 0xd0, fixRecs = 0xdc, dataPages = 0x180 - inner;
  const b = new Uint8Array(inner + dataPages + pageSize + last), dv = new DataView(b.buffer);
  b.set([0x4d, 0x5a], 0); dv.setUint32(0x3c, 0x1000, true); // decoy MZ pointing past EOF
  b.set([0x4d, 0x5a], inner); dv.setUint32(inner + 0x3c, le, true);
  const h = inner + le, u32 = (o, v) => dv.setUint32(h + o, v, true);
  b.set([0x4c, 0x45], h); dv.setUint16(h + 8, 2, true); dv.setUint16(h + 0xa, 1, true);
  u32(0x14, 2); u32(0x18, 1); u32(0x1c, 4); u32(0x20, 1); u32(0x24, 0x40); u32(0x28, pageSize); u32(0x2c, last);
  u32(0x40, objTable); u32(0x44, 1); u32(0x48, pageMap); u32(0x68, fixPages); u32(0x6c, fixRecs); u32(0x80, dataPages);
  const o = h + objTable; dv.setUint32(o, 0x40, true); dv.setUint32(o + 4, 0x10000, true); dv.setUint32(o + 8, 0x2045, true); dv.setUint32(o + 12, 1, true); dv.setUint32(o + 16, 2, true);
  b.set([0, 0, 1, 0, 0, 0, 2, 0], h + pageMap);
  dv.setUint32(h + fixPages, 0, true); dv.setUint32(h + fixPages + 4, 9, true); dv.setUint32(h + fixPages + 8, 9, true);
  b.set([0x07, 0x10, 0x04, 0x00, 0x01, 0x20, 0x00, 0x00, 0x00], h + fixRecs);
  for (let i = 0; i < pageSize + last; i++) b[inner + dataPages + i] = i + 1;
  return { b, inner };
}

test('LE loader assembles pre-fixup objects, zero-fills bss, and parses fixups', () => {
  const { b, inner } = syntheticLe(), { le, candidates } = locateLe(b);
  assert.equal(le.mz, inner);
  assert.equal(candidates.length, 2);
  assert.ok(candidates.find(c => c.at === 0).reason);
  const [obj] = le.objects;
  assert.equal(obj.data.length, 0x28);
  assert.deepEqual([...objectBytes(le, 1, 0x26, 4)], [0x27, 0x28, 0, 0]);
  assert.throws(() => objectBytes(le, 1, 0x3e, 4), /outside/);
  assert.deepEqual(parseFixups(b, le), [{ page: 1, source: 4, type: 7, flags: 0x10, object: 1, target: 0x20 }]);
  assert.equal(toGhidra(le, 1, 4), 0x10004);
  assert.deepEqual(fromGhidra(le, 0x10004), { object: 1, offset: 4 });
  b[inner + 0x40 + 0xdc + 1] = 0x40; // 16-bit object numbers: valid LE, but not established for WW.EXE
  assert.throws(() => parseFixups(b, le), /not established/);
  assert.throws(() => parseLe(b, 0), /truncated/);
});

test('constants lint enforces THE RULE on governed directories', async () => {
  const src = [
    "import { K } from '../evidence/k.js';",
    "export const a = K({ magic: 'MZ', lfanew: 0x3c }, 'mz.header');",
    'export const b = 22;',
    'export const c = 7; // @math shift width',
    'export const d = 9; // @spec mz.header',
    'export const e = 9; // @spec ww.exe.layout',
    'export const f = 5; // @math',
    "export const g = K(3, 'no.such');",
    "export const h = 'analysis/x.bin';",
  ].join('\n');
  const problems = await lintSource(src, 'src/formats/fixture.js', claims);
  assert.equal(problems.length, 5, problems.join('\n'));
  assert.match(problems.join('\n'), /literal 22/);
  assert.match(problems.join('\n'), /@spec ww.exe.layout must name a claim with leads/);
  assert.match(problems.join('\n'), /@math needs a reason/);
  assert.match(problems.join('\n'), /no claim no.such/);
  assert.match(problems.join('\n'), /never reads analysis/);
  assert.deepEqual(await lintSource('export const b = 22;', 'src/viewer.js', claims), []);
  const game = await lintSource("import { UNKNOWN } from '../evidence/unknown.js';\nimport x from '../formats/hypotheses/x.js';\nexport const u = UNKNOWN(UNKNOWN_ID);", 'src/game/fixture.js', claims);
  assert.equal(game.length, 2, game.join('\n'));
});

test('claims and checks cite each other', async () => {
  const { records, errors } = await loadObs();
  assert.deepEqual([...errors, ...crossValidate(await loadChecks(), records)], []);
});

test('docs/TODO.md has an unchecked line for every non-PROVEN claim and no ticked line for one', async () => {
  const { readFile } = await import('node:fs/promises');
  const todo = await readFile(new URL('../docs/TODO.md', import.meta.url), 'utf8');
  const listed = new Set([...todo.matchAll(/^- \[ \] `([^`]+)` \[([A-Z]+)\]/gm)].map(m => `${m[1]} ${m[2]}`));
  const open = new Set([...claims.values()].filter(c => c.tag !== 'PROVEN').map(c => `${c.id} ${c.tag}`));
  assert.deepEqual([...listed].sort(), [...open].sort());
  for (const m of todo.matchAll(/^- \[x\] `([^`]+)`/gm)) {
    const c = claims.get(m[1]);
    assert.ok(!c || c.tag === 'PROVEN', `${m[1]} is ticked as done but is ${c?.tag}`);
  }
});

test('lint requires hypotheses modules to mark their decodes as WF or UNKNOWN', async () => {
  const f = 'src/formats/hypotheses/fixture.js', imp = "import { noteStep } from '../../evidence/k.js';\n";
  const ok = await lintSource(imp + "export function parse(b) { noteStep('" + UNKNOWN_ID + "'); return b; }", f, claims);
  assert.deepEqual(ok, []);
  assert.match((await lintSource('export function parse(b) { return b; }', f, claims)).join('\n'), /must call noteStep/);
  assert.match((await lintSource(imp + "export function parse(b) { noteStep('mz.header'); return b; }", f, claims)).join('\n'), /WF or UNKNOWN claim; mz.header is PROVEN/);
  assert.match((await lintSource(imp + "noteStep('" + UNKNOWN_ID + "');", f, claims)).join('\n'), /module level/);
  assert.match((await lintSource(imp + 'export function parse(b, id) { noteStep(id); }', f, claims)).join('\n'), /string-literal/);
  assert.deepEqual(await lintSource('export function parse(b) { return b; }', 'src/formats/other.js', claims), []);
});

function syntheticDat(entries, { count = entries.length, gap = 22, bias = 2 } = {}) {
  const dir = 2 + count * 22, total = dir + gap + entries.reduce((n, e) => n + e.data.length, 0), b = new Uint8Array(total), dv = new DataView(b.buffer);
  dv.setInt16(0, count, true);
  let at = dir + gap;
  entries.forEach((e, i) => {
    const o = 2 + i * 22;
    b.set([...e.name].map(c => c.charCodeAt(0)), o); dv.setUint32(o + 14, e.data.length, true); dv.setUint32(o + 18, at - bias, true);
    b.set(e.data, at); at += e.data.length;
  });
  return b;
}

test('DAT directory parser follows the proven layout and fails loudly', async () => {
  const { parseDatDirectory, parseDatWith, directoryEnd } = await import('../src/formats/dat.js');
  const files = [{ name: 'A.SP', data: [1, 2, 3] }, { name: 'B.PCX', data: [4, 5] }];
  const b = syntheticDat(files), entries = parseDatDirectory(b);
  assert.deepEqual(entries.map(e => [e.name, e.size, e.offset, [...e.data]]), [['A.SP', 3, 2 + 44 + 22, [1, 2, 3]], ['B.PCX', 2, 2 + 44 + 22 + 3, [4, 5]]]);
  assert.equal(directoryEnd(b), 2 + 44);
  b[2 + 5] = 0x58; // stale non-zero bytes after the NUL are ignored, as in the real archive
  b[2 + 6] = 0x59;
  assert.equal(parseDatDirectory(b)[0].name, 'A.SP');
  assert.throws(() => parseDatDirectory(b.subarray(0, 40)), /truncated/);
  const neg = syntheticDat(files); new DataView(neg.buffer).setInt16(0, -1, true);
  assert.throws(() => parseDatDirectory(neg), /negative/);
  const empty = syntheticDat(files); empty[2] = 0;
  assert.throws(() => parseDatDirectory(empty), /empty name/);
  const unterminated = syntheticDat(files); unterminated.fill(0x41, 2, 2 + 14);
  assert.throws(() => parseDatDirectory(unterminated), /NUL-terminated/);
  const beyond = syntheticDat(files); new DataView(beyond.buffer).setUint32(2 + 14, 1 << 20, true);
  assert.throws(() => parseDatDirectory(beyond), /truncated/);
  assert.throws(() => parseDatWith(b, { countAt: 0, countBytes: 2, entrySize: 21, sizeAt: 14, offsetAt: 18, offsetBias: 2 }), /./);
});

function syntheticPcx(stream, { marker = 0x0c, palette = Uint8Array.from({ length: 768 }, (_, i) => i % 256) } = {}) {
  const b = new Uint8Array(128 + stream.length + 1 + 768);
  b.set(stream, 128); b[128 + stream.length] = marker; b.set(palette, 128 + stream.length + 1);
  return b;
}
function fullStream(fill = 7) { // 64000 pixels as runs of 63, ending with a run of 55: runs cross row boundaries
  const s = []; for (let i = 0; i < 1015; i++) s.push(0xc0 | 63, fill); s.push(0xc0 | 55, fill); return s;
}

test('game PCX decoder follows the proven member layout and fails loudly', async () => {
  const { decodePcxMember, splitTiles } = await import('../src/formats/pcx.js');
  const img = decodePcxMember(syntheticPcx(fullStream(7)));
  assert.equal(img.indices.length, 64000);
  assert.ok(img.indices.every(v => v === 7), 'a run crossing a row boundary is accepted, as in the game');
  assert.equal(img.palette[5], 5);
  assert.equal(img.vga[5], 1, 'VGA values are the file values shifted right by 2');
  assert.equal(img.vga[255], 63);
  const lit = [...fullStream(0)]; lit.splice(0, 2, 0x05, 0xc0 | 62, 0); // a literal, then a shorter run: same 64000 pixels
  assert.equal(decodePcxMember(syntheticPcx(lit)).indices[0], 5);
  assert.throws(() => decodePcxMember(syntheticPcx(fullStream().slice(0, -2))), /ends before/);
  assert.throws(() => decodePcxMember(syntheticPcx([...fullStream(), 9])), /leaves 2 bytes/);
  assert.throws(() => decodePcxMember(syntheticPcx(fullStream(), { marker: 0 })), /marker/);
  assert.throws(() => decodePcxMember(syntheticPcx([0xc0, 1, ...fullStream()])), /zero count/);
  assert.throws(() => decodePcxMember(syntheticPcx([...fullStream().slice(0, -2), 0xc0 | 56, 7])), /overshoots/);
  assert.throws(() => decodePcxMember(new Uint8Array(100)), /truncated/);
  // Tile order: left to right, then top to bottom, 32x32 tiles, 10 per row.
  const indices = new Uint8Array(64000);
  for (let y = 0; y < 200; y++) for (let x = 0; x < 320; x++) indices[y * 320 + x] = Math.floor(y / 32) * 10 + Math.floor(x / 32);
  const tiles = splitTiles({ width: 320, height: 200, indices });
  assert.equal(tiles.length, 54);
  assert.ok(tiles.every((t, i) => t.length === 1024 && t.every(v => v === i)));
  assert.throws(() => splitTiles({ width: 320, height: 100, indices: new Uint8Array(32000) }), /too small/);
});

test('track file parsers follow the proven layouts and fail loudly', async () => {
  const { parseMap, parsePos, parsePosWith, parseSin, parseRoute } = await import('../src/formats/track-files.js');
  const map = new Uint8Array(4096).fill(3); map[4095] = 107;
  const parsed = parseMap(map);
  assert.deepEqual([parsed.rows, parsed.columns, parsed.tiles[4095]], [64, 64, 107]);
  map[7] = 108;
  assert.throws(() => parseMap(map), /exceeds 107/);
  assert.throws(() => parseMap(new Uint8Array(4095)), /expected 4096/);

  const pos = new Uint8Array(8194), dv = new DataView(pos.buffer);
  dv.setUint16(10, 5, true); dv.setUint16(20, 3, true); dv.setInt16(8192, 5, true);
  const p = parsePos(pos);
  assert.equal(p.grid[5], 5);
  assert.equal(p.trailer, 5);
  assert.deepEqual(parsePosWith(pos, { gridBytes: 8192, trailerBytes: 2, cellBytes: 2 }, { grid: true, trailer: true }).trailer, 5);
  dv.setInt16(8192, 6, true);
  assert.throws(() => parsePos(pos), /not the grid maximum/);
  dv.setInt16(8192, 5, true);
  assert.throws(() => parsePosWith(pos, { gridBytes: 8192, trailerBytes: 2, cellBytes: 2 }, { grid: false }), /not the grid maximum/); // mixed byte order is caught
  assert.throws(() => parsePos(new Uint8Array(8192)), /expected 8194/);

  const sin = Uint8Array.from({ length: 1296 }, (_, i) => i % 256);
  const recs = parseSin(sin);
  assert.equal(recs.length, 108);
  assert.deepEqual([...recs[1].skipped], [12, 13, 14, 15]);
  assert.deepEqual([...recs[1].kept], [16, 17, 18, 19, 20, 21, 22, 23]);
  assert.throws(() => parseSin(sin.subarray(0, 1295)), /expected 1296/);

  const rd = new Uint8Array(2 + 28), rv = new DataView(rd.buffer);
  rv.setUint16(0, 2, true); for (let i = 0; i < 14; i++) rv.setUint16(2 + i * 2, i + 1, true);
  const route = parseRoute(rd);
  assert.equal(route.length, 2);
  assert.deepEqual([...route[1]], [8, 9, 10, 11, 12, 13, 14]);
  assert.throws(() => parseRoute(rd.subarray(0, 29)), /expected 30/);
  assert.throws(() => parseRoute(new Uint8Array(1)), /truncated/);
});

test('GAM parser follows the proven line layout and fails loudly', async () => {
  const { parseGam } = await import('../src/formats/gam.js');
  const lines = ['f1.pcx', 'f2.pcx', 'ma1.pcx', 'ma2.pcx', 'back1.pcx', '1250', '1500', '1               ', ...Array.from({ length: 16 }, (_, i) => String(100 + i)), '0'];
  const enc = ls => new TextEncoder().encode(ls.join('\r\n') + '\r\n');
  const g = parseGam(enc(lines));
  assert.deepEqual([g.tilesets, g.masks, g.sky, g.values, g.flag, g.extra], [['f1.pcx', 'f2.pcx'], ['ma1.pcx', 'ma2.pcx'], 'back1.pcx', [1250, 1500], 0, []]);
  assert.deepEqual(g.starts[0], { x: 100, y: 101 });
  assert.deepEqual(g.starts[7], { x: 114, y: 115 });
  assert.equal(g.starts.length, 8);
  const set = parseGam(enc([...lines.slice(0, 24), '1', '2', '4', '3', '']));
  assert.deepEqual([set.flag, set.extra], [1, [2, 4, 3]]);
  assert.deepEqual(parseGam(enc([...lines, '', ''])).extra, [], 'blank trailing lines are ignored when the flag is 0');
  assert.throws(() => parseGam(enc(lines.slice(0, 24))), /expected at least 25/);
  assert.throws(() => parseGam(enc([...lines.slice(0, 24), '1', '2'])), /extra line|missing/);
  assert.throws(() => parseGam(enc([...lines.slice(0, 5), 'abc', ...lines.slice(6)])), /not an integer/);
  assert.throws(() => parseGam(new TextEncoder().encode(lines.join('\n'))), /expected at least 25/, 'a bare-LF file is rejected');
});

test('fixup sites map to object offsets and masks, and masked CRCs ignore them', () => {
  const { b } = syntheticLe(), { le } = locateLe(b), sites = objectFixups(le, parseFixups(b, le));
  assert.deepEqual(sites, [{ object: 1, offset: 4, type: 7, flags: 0x10, targetObject: 1, target: 0x20 }]);
  const { masks } = siteMasks(le, b);
  assert.deepEqual([...masks[0].subarray(0, 10)], [0, 0, 0, 0, 1, 1, 1, 1, 0, 0]);
  const a = new Uint8Array(10).fill(9), c = Uint8Array.from(a); c.set([1, 2, 3, 4], 4);
  assert.equal(maskedCrc(a, masks[0].subarray(0, 10)).length, 8);
  assert.notEqual(maskedCrc(a, new Uint8Array(10)), maskedCrc(c, new Uint8Array(10)));
  assert.equal(maskedCrc(new Uint8Array(10).fill(9).fill(0, 4, 8), masks[0].subarray(0, 10)), maskedCrc(new Uint8Array(10).fill(9), masks[0].subarray(0, 10)), 'masked bytes do not matter');
  assert.throws(() => objectFixups(le, [{ page: 9, source: 0, type: 7, flags: 0, object: 1, target: 0 }]), /belongs to no object/);
});

test('observation records are numeric-only and well formed', () => {
  const ok = { id: 'race-9', tool: 't', date: '2026-10-03', exe: { name: 'WW.EXE' }, moment: 'm', bases: { 1: 5 }, crcs: ['0a1b2c3d'], list: [1, 2, 3] };
  assert.deepEqual(validateObs(ok), []);
  assert.match(validateObs({ ...ok, id: 'Bad Id' }).join(), /invalid id/);
  assert.match(validateObs({ ...ok, date: '3 Oct' }).join(), /date must be/);
  assert.match(validateObs({ id: 'x', tool: 't' }).join(), /missing date/);
  assert.match(validateObs({ ...ok, blob: 'x'.repeat(201) }).join(), /longer than 200/);
  assert.match(validateObs({ ...ok, bytes: Array.from({ length: 100 }, (_, i) => i) }).join(), /raw bytes/);
  assert.match(validateObs({ ...ok, odd: undefined, fn: () => 1 }).join(), /unsupported value type/);
});

test('route rasteriser walks the major axis with a Bresenham error term and ends on the end point', async () => {
  const { rasterSegment } = await import('../src/formats/route.js');
  assert.deepEqual(rasterSegment(5, 5, 5, 5), [[5, 5]], 'a single point');
  assert.deepEqual(rasterSegment(0, 0, 4, 0), [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]]);
  assert.deepEqual(rasterSegment(3, 0, 3, -2), [[3, 0], [3, -1], [3, -2]]);
  assert.deepEqual(rasterSegment(0, 0, 4, 2), [[0, 0], [1, 0], [2, 1], [3, 1], [4, 2]]);
  assert.deepEqual(rasterSegment(0, 0, 2, 4), [[0, 0], [0, 1], [1, 2], [1, 3], [2, 4]]);
  assert.deepEqual(rasterSegment(4, 2, 0, 0), [[4, 2], [3, 2], [2, 1], [1, 1], [0, 0]]);
  assert.equal(rasterSegment(0, 0, 10, 3).length, 11, 'one point per step of the major axis, plus the start');
  assert.deepEqual(rasterSegment(2, 2, 0, 0), [[2, 2], [1, 1], [0, 0]], 'a pure diagonal takes the y-major branch, as the game does when dx <= dy');
  assert.throws(() => rasterSegment(0, 0, 40000, 0), /longer than/);
  assert.throws(() => rasterSegment(0, 0, undefined, 0), /must be integers/);
  assert.throws(() => rasterSegment(0, 0, NaN, 0), /must be integers/);
  assert.equal(rasterSegment(0, 0, 4095, 0).length, 4096);
});

test('audio bank parser follows the proven layout and fails loudly', async () => {
  const { parseAudioBank } = await import('../src/formats/audio-bank.js');
  const le32 = n => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff], tag = [0x21, 0x49, 0x44, 0x21];
  // Two banks of 26 sounds: a 6-byte (first) or 23-byte (second) header whose first dword is the payload length, the payload, then a 1-byte or 10-byte trailer.
  const build = ({ lens = i => (i % 3) * 2, lastTag = true } = {}) => {
    const body = [], offsets = [];
    for (let i = 0; i < 52; i++) {
      offsets.push(body.length);
      const header = i < 26 ? 6 : 23, len = lens(i);
      body.push(...le32(len), ...Array(header - 4).fill(9), ...Array(len).fill(i), ...(i < 26 ? [0] : [0, 68, 101, 102, 97, 117, 108, 116, 0, 0]));
      if (lastTag && (i === 25 || i === 51)) body.push(...tag);
    }
    const end = body.length;
    for (let i = 52; i < 78; i++) offsets.push(end);
    offsets.push(end - 4); // the last offset points at the tag ending slot 51
    body.push(...tag);
    return { head: new Uint8Array(offsets.flatMap(le32)), body: new Uint8Array(body) };
  };
  const { head, body } = build(), bank = parseAudioBank(head, body);
  assert.equal(bank.slots.length, 52);
  assert.deepEqual(bank.slots.filter(s => s.tagged).map(s => s.index), [25, 51]);
  assert.equal(bank.slots[1].length, 2);
  assert.deepEqual([...bank.slots[1].payload], [1, 1]);
  assert.equal(bank.slots[26].header.length, 19, 'the raw header after the length dword is kept');
  assert.deepEqual([...bank.slots[0].trailer], [0]);
  assert.equal(bank.slots[26].trailer.length, 10);
  assert.throws(() => parseAudioBank(head.subarray(4), body), /AUDIOHED is/);
  assert.throws(() => parseAudioBank(head, body.subarray(0, body.length - 1)), /must end with one/);
  const untagged = build({ lastTag: false });
  assert.deepEqual(parseAudioBank(untagged.head, untagged.body).slots.filter(s => s.tagged), [], 'the parser reports tags; the audio-bank check asserts where they are');
  assert.throws(() => parseAudioBank(untagged.head, untagged.body.subarray(0, untagged.body.length - 4)), /must end with one/);
  const bad = Uint8Array.from(head); bad[0] = 1;
  assert.throws(() => parseAudioBank(bad, body), /does not start at 0/);
  const shortSlot = Uint8Array.from(body); shortSlot[0] = 200; // the first dword claims more than the slot holds
  assert.throws(() => parseAudioBank(head, shortSlot), /account for/);
  const filled = Uint8Array.from(head); filled[53 * 4] += 1; // slot 53 is no longer empty
  assert.throws(() => parseAudioBank(filled, body), /slot 53 is not empty/);
});

test('VOC parser follows the proven structure and fails loudly', async () => {
  const { parseVoc } = await import('../src/formats/voc.js');
  const le16 = n => [n & 0xff, (n >> 8) & 0xff], name = [...'Creative Voice File'].map(c => c.charCodeAt(0));
  const voc = (blocks, { checksum = (~0x10a + 0x1234) & 0xffff, size = 26, tail = [0] } = {}) => new Uint8Array([...name, 0x1a, ...le16(size), ...le16(0x10a), ...le16(checksum), ...blocks, ...tail]);
  const block = (type, data) => [type, data.length & 0xff, (data.length >> 8) & 0xff, 0, ...data];
  const ok = parseVoc(voc([...block(6, [255, 255]), ...block(1, [156, 0, 1, 2, 3]), ...block(7, [])]));
  assert.deepEqual(ok.blocks.map(b => [b.type, b.length]), [[6, 2], [1, 5], [7, 0]]);
  assert.equal(ok.version, 0x10a);
  assert.deepEqual([...ok.blocks[1].data], [156, 0, 1, 2, 3]);
  assert.throws(() => parseVoc(voc([], { checksum: 1 })), /checksum/);
  assert.throws(() => parseVoc(voc([], { size: 27 })), /header size/);
  assert.throws(() => parseVoc(voc(block(1, [156, 0, 1]), { tail: [0, 0] })), /after its terminator/);
  assert.throws(() => parseVoc(voc(block(1, [156, 0, 1]), { tail: [] })), /truncated|block type/);
  assert.throws(() => parseVoc(voc([1, 9, 0, 0, 1, 2], { tail: [0] })), /truncated|block/, 'a block longer than the file');
  assert.throws(() => parseVoc(new Uint8Array(30)), /Not a Creative Voice file/);
});

test('route and object parsers are exact by default and keep unknown trailing bytes only when asked', async () => {
  const { parseRoute, parseRouteKeepingTail, parseSpw, parseSpwKeepingTail } = await import('../src/formats/track-files.js');
  const rd = new Uint8Array([1, 0, ...Array(14).fill(7)]), spw = new Uint8Array([1, 0, ...Array(12).fill(3)]);
  assert.equal(parseRoute(rd).length, 1);
  assert.equal(parseSpw(spw).length, 1);
  const rdTail = new Uint8Array([...rd, 9, 9, 9]), spwTail = new Uint8Array([...spw, 9]);
  assert.throws(() => parseRoute(rdTail), /expected 16/);
  assert.throws(() => parseSpw(spwTail), /expected 14/);
  assert.equal(parseRouteKeepingTail(rdTail).length, 1);
  assert.equal(parseSpwKeepingTail(spwTail).length, 1);
  assert.throws(() => parseRouteKeepingTail(rd.subarray(0, 10)), /at least 16/, 'a file shorter than its count is still an error');
  assert.throws(() => parseSpwKeepingTail(new Uint8Array(1)), /truncated/);
});

test('the viewer and editor parseGam uses the strict parser for the game\'s shape and falls back for other files', async () => {
  const { parseGam } = await import('../src/tracks.js');
  const lines = ['F1.PCX', 'F2.PCX', 'MA1.PCX', 'MA2.PCX', 'BACK1.PCX', '1250', '1500', '1', ...Array.from({ length: 16 }, (_, i) => String(100 + i)), '1', '4', '4', '3'];
  const crlf = new TextEncoder().encode(lines.join('\r\n') + '\r\n'), g = parseGam(crlf);
  assert.equal(g.strict, true, 'a CRLF file in the game\'s shape is read by the strict parser');
  assert.deepEqual([g.tiles, g.masks, g.sky, g.startX, g.startY, g.cycling], [['a_f1.pcx', 'a_f2.pcx'], ['a_ma1.pcx', 'a_ma2.pcx'], 'back1.pcx', 100, 101, true]);
  assert.deepEqual(g.starts[1], { x: 102, y: 103 });
  const lf = parseGam(new TextEncoder().encode(lines.join('\n') + '\n'));
  assert.equal(lf.strict, false, 'a bare-LF file is not the game\'s shape, so the lenient fallback reads it');
  assert.deepEqual([lf.tiles, lf.startX, lf.startY, lf.cycling], [['a_f1.pcx', 'a_f2.pcx'], 100, 101, true]);
  assert.throws(() => parseGam(new TextEncoder().encode(lines.slice(0, 20).join('\r\n'))), /at least 25/);
});
