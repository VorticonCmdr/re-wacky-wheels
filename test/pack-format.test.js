// The artwork packs' format (src/enhance/pack-format.js) and the region registry (src/enhance/regions.js), on synthetic members only (no game
// file): the manifest's normalization (unknown keys dropped, the format, the version, the licence, the source), every kind's size rule and the
// frame order, the entries' refusals and warnings against an archive's facts and a picture, and the registry of a synthetic archive's pictures
// (the cars a slot a row, the lion's and the explosions' frames at their byte offsets, the sparks and the tyre strips from the routines that
// draw them).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeManifest, normalizeArtEntry, expectedSize, frameCell, parseCrc, crcHex, isLocalOnly, LOCAL_ONLY, KINDS } from '../src/enhance/pack-format.js';
import { worldRegions } from '../src/enhance/regions.js';
import { ART } from '../src/enhance/config.js';
import { driverFile, driverCount } from '../src/game/drivers.js';
import { crc32 } from '../src/evidence/crc32.js';

const manifest = (extra = {}) => ({ format: 'wackywheels-artpack', version: 1, name: 'Karts', author: 'me', licence: 'CC BY 4.0, my own drawings', entries: [{ kind: 'tiles' }], ...extra });

test('the manifest: its format, version, name, licence and entries checked, unknown keys dropped, a LOCAL ONLY licence warned of, the source parsed', () => {
  const m = normalizeManifest(manifest({ extra: 'dropped', source: { size: 123, crc32: 'deadbeef' } }));
  assert.equal(m.reason, null); assert.equal(m.manifest.extra, undefined); assert.deepEqual(m.manifest.source, { size: 123, crc32: 0xdeadbeef }); assert.deepEqual(m.warnings, []); // @math the CRC in hex
  for (const [bad, why] of [[{ format: 'zip' }, /format/], [{ version: 2 }, /version 2/], [{ name: ' ' }, /no name/], [{ licence: '' }, /no licence/], [{ licence: undefined }, /no licence/], [{ entries: [] }, /no entries/], [{ source: { size: 0, crc32: 1 } }, /source/]]) { // @math a version this page does not read
    const r = normalizeManifest(manifest(bad));
    assert.equal(r.manifest, null); assert.match(r.reason, why);
  }
  assert.equal(normalizeManifest(null).manifest, null); assert.equal(normalizeManifest([]).manifest, null);
  const local = normalizeManifest(manifest({ licence: LOCAL_ONLY }));
  assert.ok(local.manifest && local.warnings.some(w => /local only/.test(w)), 'a template\'s licence is taken with a warning');
  assert.ok(isLocalOnly('local only: mine') && !isLocalOnly('CC0'));
  assert.equal(parseCrc('0000000A'), 10); assert.equal(parseCrc(-1), null); assert.equal(parseCrc('xyz'), null); assert.equal(crcHex(10), '0000000a'); // @math ten in hex
});

const tiles = (o = {}) => ({ kind: 'tiles', member: 'A_F1.PCX', memberCrc: 'deadbeef', image: 'tiles/A_F1.png', scale: 2, color: 'rgba', ...o });
const frames = (o = {}) => ({ kind: 'frames', member: 'CARS.SP', memberCrc: 1, image: 'f.png', scale: 2, color: 'rgba', offset: 0, width: 38, height: 28, count: 5, columns: 2, ...o });

test('every kind\'s size rule, and the frame order', () => {
  const p = 3; // @math a scale
  assert.deepEqual(expectedSize(normalizeArtEntry(tiles({ scale: p })).entry), { width: 320 * p, height: 200 * p }); // @math the sheet's layout
  assert.deepEqual(expectedSize(normalizeArtEntry({ ...tiles({ scale: p }), kind: 'sky', member: 'BACK1.PCX', margin: 53 }).entry), { width: (320 + 2 * 53) * p, height: 130 * p }); // @math the sky's rows and the strip's background rows, a margin either side
  assert.deepEqual(expectedSize(normalizeArtEntry({ kind: 'strip', members: ['1.par', '8.PAR'], memberCrc: 7, image: 's.png', scale: p, color: 'rgba', period: 640 }).entry), { width: 640 * p, height: 20 * p }); // @math one panorama, the strip's rows
  const f = normalizeArtEntry(frames()).entry;
  assert.deepEqual(f.cell, [76, 56]); assert.deepEqual(f.box, [0, 0]); assert.equal(f.stride, 38 * 28); // @math the defaults: w p by h p, the box at the top left, the frame's bytes
  assert.deepEqual(expectedSize(f), { width: 2 * 76, height: 3 * 56 }); // @math two columns, three rows of five frames
  assert.deepEqual([0, 1, 2, 3, 4].map(k => frameCell(f, k)), [{ x: 0, y: 0 }, { x: 76, y: 0 }, { x: 0, y: 56 }, { x: 76, y: 56 }, { x: 0, y: 112 }]); // @math frame k at (k mod columns, floor(k / columns))
  const a = normalizeArtEntry({ kind: 'angles', member: 'CARS.SP', memberCrc: 1, image: 'a.png', scale: 1, color: 'rgba', slot: 3, directions: 32, width: 38, height: 28, columns: 8 }).entry; // @math a set of 32 directions, 8 a row
  assert.deepEqual(expectedSize(a), { width: 8 * 38, height: 4 * 28 }); assert.equal(a.anchor, 27); // @math the default ground row: the last
  const boxed = normalizeArtEntry(frames({ cell: [100, 80], box: [10, 20] })).entry; // @math art overhanging its box in a larger cell
  assert.deepEqual(expectedSize(boxed), { width: 200, height: 240 }); // @math two cells across, three down
  assert.deepEqual(KINDS, ['tiles', 'sky', 'strip', 'frames', 'angles']);
});

test('an entry\'s own fields: each refusal with its reason', () => {
  for (const [raw, why] of [
    [{ ...tiles(), kind: 'sprites' }, /kind "sprites"/], [tiles({ image: '' }), /without its image/], [tiles({ scale: 0 }), /scale 0/], [tiles({ scale: ART.maxScale + 1 }), /whole number from 1 to 8/], [tiles({ scale: 1.5 }), /scale 1.5/],
    [tiles({ color: 'cmyk' }), /'rgba' or 'indexed'/], [tiles({ color: 'indexed' }), /palette/], [tiles({ memberCrc: 'nope' }), /memberCrc/], [tiles({ member: 'BACK1.PCX' }), /not a tile sheet/],
    [{ kind: 'strip', members: ['1.PCX'], memberCrc: 1, image: 's.png', scale: 1, color: 'rgba' }, /N.PAR/], [{ kind: 'strip', members: ['1.PAR'], memberCrc: 1, image: 's.png', scale: 1, color: 'rgba' }, /period/],
    [frames({ width: 0 }), /width and height/], [frames({ count: 0 }), /count/], [frames({ columnMajor: false }), /column-major/], [frames({ box: [40, 0] }), /does not fit its cell/], [frames({ cell: [10] }), /pairs/],
    [frames({ anchors: [1, 2] }), /anchors/], [frames({ anchors: [0, 1, 2, 3, 28] }), /anchors/], // @math a row past the frame
    [{ kind: 'angles', member: 'CARS.SP', memberCrc: 1, image: 'a.png', scale: 1, color: 'rgba', slot: 0, directions: 12, width: 38, height: 28 }, /multiple of 8/], // @math not a multiple of 8
    [{ kind: 'angles', member: 'CARS.SP', memberCrc: 1, image: 'a.png', scale: 1, color: 'rgba', slot: 0, directions: 72, width: 38, height: 28 }, /up to 64/], // @math past the most
    [{ kind: 'angles', member: 'DIGGER.SP', memberCrc: 1, image: 'a.png', scale: 1, color: 'rgba', slot: 0, directions: 8, width: 38, height: 28 }, /CARS.SP/], // @math eight directions
  ]) { const r = normalizeArtEntry(raw); assert.equal(r.entry, null, why.source); assert.match(r.reason, why); }
  assert.equal(normalizeArtEntry(frames({ anchors: null })).entry.anchors, null, 'a stored entry without anchors is taken again');
});

// An archive's facts as packContext gives them, synthetic: two members and a registry of three frames of CARS.SP.
const cars = new Uint8Array(38 * 28 * 3).fill(7), sheetPal = Uint8Array.from({ length: 768 }, (_, i) => (i * 5) & 0xff); // @math three frames; a palette pattern
const ctx = {
  member: n => ({ 'CARS.SP': cars, 'A_F1.PCX': new Uint8Array(9), '1.PAR': new Uint8Array(4), '2.PAR': new Uint8Array(4) })[n] ?? null, // @math stand-ins for the members' bytes
  crc: n => ({ 'CARS.SP': crc32(cars), 'A_F1.PCX': 0xdeadbeef, '1.PAR': 7, '2.PAR': 7 })[n] ?? null, // @math the members' CRCs
  picture: n => (n === 'A_F1.PCX' ? { width: 320, height: 200 } : null), palette: n => (n === 'A_F1.PCX' ? sheetPal : null), period: n => (n === '2.PAR' ? 1280 : 640), // @math a sheet's size; a strip that repeats and one that does not
  regions: { has: (m, offset, w, h) => m === 'CARS.SP' && w === 38 && h === 28 && offset % (38 * 28) === 0 && offset < cars.length }, car: { w: 38, h: 28 }, slots: 8, archive: null, // @math the cars' frames; eight slots
};

test('an entry against the archive: its member, CRC, frames and period', () => {
  assert.equal(normalizeArtEntry(tiles(), ctx).reason, null);
  assert.match(normalizeArtEntry(tiles({ member: 'A_F2.PCX' }), ctx).reason, /A_F2.PCX is not in this archive/);
  assert.match(normalizeArtEntry(tiles({ memberCrc: 'deadbeee' }), ctx).reason, /made for another A_F1.PCX/);
  assert.equal(normalizeArtEntry(frames({ memberCrc: crc32(cars), count: 3 }), ctx).reason, null);
  assert.match(normalizeArtEntry(frames({ memberCrc: crc32(cars), count: 4 }), ctx).reason, /past the end of CARS.SP/); // @math one frame too many
  assert.match(normalizeArtEntry(frames({ memberCrc: crc32(cars), count: 1, offset: 100 }), ctx).reason, /no picture the race draws/); // @math a byte offset of no frame
  const strip = { kind: 'strip', members: ['1.PAR'], memberCrc: 7, image: 's.png', scale: 1, color: 'rgba' }; // @math the strips' CRC
  assert.equal(normalizeArtEntry(strip, ctx).entry.period, 640, 'the period of the archive\'s strip'); // @math the validated period
  assert.match(normalizeArtEntry({ ...strip, period: 1280 }, ctx).reason, /repeats every 640/); // @math a period not the validated one
  assert.match(normalizeArtEntry({ ...strip, members: ['1.PAR', '2.PAR'] }, ctx).reason, /share one period/);
  assert.match(normalizeArtEntry({ kind: 'angles', member: 'CARS.SP', memberCrc: crc32(cars), image: 'a.png', scale: 1, color: 'rgba', slot: 8, directions: 8, width: 38, height: 28 }, ctx).reason, /8 slots/); // @math a slot past the last
});

test('an entry against its picture: the exact size, the caps, the indexed palette, the ground row', () => {
  const p = 2, rgba = (w, h, fill = 0xff) => ({ width: w, height: h, rgba: new Uint8ClampedArray(w * h * 4).fill(fill) }); // @math a scale; four bytes a colour
  assert.equal(normalizeArtEntry(tiles(), ctx, rgba(640, 400)).reason, null); // @math 320 x 200 at p = 2
  assert.equal(normalizeArtEntry(tiles(), ctx, rgba(638, 400)).reason, 'tiles/A_F1.png: image 638 x 400, expected 640 x 400'); // @math two columns short
  assert.match(normalizeArtEntry(tiles(), ctx, { width: ART.maxSide + 1, height: 1 }).reason, /a side is at most/);
  assert.match(normalizeArtEntry(tiles(), ctx, { width: 5000, height: 4000 }).reason, /at most 16000000 pixels/); // @math 20 million pixels
  const indexed = tiles({ color: 'indexed', palette: 'A_F1.PCX', scale: 1 }), image = { width: 320, height: 200, indices: new Uint8Array(64000).fill(3), palette: Uint8Array.from(sheetPal), alpha: null, rgba: new Uint8ClampedArray(256000) }; // @math the sheet's size and RGBA bytes
  assert.equal(normalizeArtEntry(indexed, ctx, image).reason, null, 'the palette\'s own colours at the index used');
  image.palette[3 * 3 + 1] ^= 1; // @math entry 3's green
  assert.match(normalizeArtEntry(indexed, ctx, image).reason, /entry 3 is .*the game's palette/);
  assert.match(normalizeArtEntry(indexed, ctx, rgba(320, 200)).reason, /palette PNG/);
  // The ground row: the archive's lowest opaque row (all of these synthetic frames are opaque to row 27), the pack's art two rows higher warns.
  const e = frames({ memberCrc: crc32(cars), count: 1, scale: p, columns: 1 }), pic = { width: 76, height: 56, rgba: new Uint8ClampedArray(76 * 56 * 4) }; // @math one frame at p = 2; four bytes a colour
  const fill = rows => { pic.rgba.fill(0); for (let y = 0; y < rows; y++) for (let x = 0; x < 76; x++) pic.rgba[(y * 76 + x) * 4 + 3] = 0xff; }; // @math the frame's pack columns; the alpha of four bytes
  fill(56); assert.deepEqual(normalizeArtEntry(e, ctx, pic).warnings, []); // @math standing on the frame's last row
  fill(52); assert.match(normalizeArtEntry(e, ctx, pic).warnings[0], /more than a row off/); // @math two rows higher
  fill(52); assert.deepEqual(normalizeArtEntry({ ...e, anchors: [25] }, ctx, pic).warnings, [], 'a declared anchor the art stands on'); // @math the row it stands on
});

test('the region registry of a synthetic archive: every frame of the cars a slot a row, the lion and the explosions at their byte offsets, the sparks and the tyre strips', () => {
  const frame = 38 * 28, members = new Map([['CARS.SP', new Uint8Array(frame * 24)], ['DIGGER.SP', new Uint8Array(frame * 16)], ['GENEF.SP', new Uint8Array(14692)], ['HOGMIS.SP', new Uint8Array(234 * 26)], ['SPARK.SP', new Uint8Array(360)], ['EFFECTS.SP', new Uint8Array(1000)], ['H1.SP', new Uint8Array(32 * 24 * 3)]]); // @math the members' sizes
  for (let n = 0; n < driverCount(); n++) members.set(driverFile(n).toUpperCase(), new Uint8Array(frame * 2)); // @math two frames each
  const world = { carShape: [{ w: 38, h: 28 }], shotShape: [{ w: 18, h: 13 }], sprites: [{ name: 'h1.sp', width: 32, height: 24, frames: 3 }], sdx: { records: [] }, spark: members.get('SPARK.SP'), effects: members.get('EFFECTS.SP'), hogmis: members.get('HOGMIS.SP') }; // @math the shapes' class 0 sizes; three frames; the effects' members as loadTrack hands them
  const r = worldRegions(members, world), group = (m, what) => r.groups.find(g => g.member === m && (!what || g.what.includes(what)));
  assert.deepEqual([group('CARS.SP').count, group('CARS.SP').columns, group('CARS.SP').stride], [24, 12, frame]); // @math every whole frame, the twelve of a slot a row
  assert.deepEqual([group('GENEF.SP', 'lion').offset, group('GENEF.SP', 'lion').count], [4449, 3]); // @math the lion's three frames after the lights and the tiles
  assert.deepEqual([group('GENEF.SP', 'explosions').offset, group('GENEF.SP', 'explosions').count], [7641, 4]); // @math the four explosions
  assert.deepEqual([group('SPARK.SP').width, group('SPARK.SP').height, group('SPARK.SP').count], [10, 9, 4]); // @math the sparks' four frames
  assert.deepEqual(r.groups.filter(g => g.what.includes('tyre')).map(g => [g.offset, g.width, g.height]).sort((a, b) => a[0] - b[0]), [[12961, 28, 11], [13269, 28, 11]]); // @math the cut and the full tyre strip
  assert.deepEqual([group('H1.SP').count, group('HOGMIS.SP').count], [3, 26]); // @math the object's frames; the shots' sheet
  assert.ok(r.has('GENEF.SP', 4449, 38, 28) && r.has('GENEF.SP', 4449 + frame, 38, 28) && !r.has('GENEF.SP', 4448, 38, 28) && !r.has('GENEF.SP', 4449, 28, 38)); // @math the lion's frames, a byte off, the size swapped
  assert.ok(r.hasAt(members.get('CARS.SP').byteOffset + frame * 23, 38, 28) && !r.hasAt(members.get('CARS.SP').byteOffset + frame * 24, 38, 28)); // @math the last frame and one past it
});
