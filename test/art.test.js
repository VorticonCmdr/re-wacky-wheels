// The artwork packs in the race (src/enhance/art.js, png.js, the pack paths of blit.js, sky-hd.js and composite.js) on synthetic data only: the
// PNG reader and writer (the bytes as saved, a palette PNG's indices), the provider's keys (a picture by where its bytes lie in the archive, the
// later pack winning), the tile hook (alpha 0 falls back to the archive's texel, the sub-texel place picks the pack pixel), the composite's
// direct colours (the fade's cap, partial alpha, an overlay over them, the strip's own sky flag), the picture blit (an identity pack is the
// archive's picture, the RGBA one keeps the archive's index, art pictures sort with indexed ones, art overhanging its box), and the strip's
// 'sky here'.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodePng, encodePng, deflate } from '../src/enhance/png.js';
import { toArt, createArtCache, createArtProvider, tileHook, createArtLayers, lumaOf, decodeArt, wantedFor } from '../src/enhance/art.js';
import { normalizeArtEntry } from '../src/enhance/pack-format.js';
import { blitAt, blitFlatAt, shapeOf, classMap } from '../src/enhance/blit.js';
import { compositeAt } from '../src/enhance/composite.js';
import { drawStripAt, drawSkyAt } from '../src/enhance/sky-hd.js';
import { createLayers } from '../src/enhance/scene.js';
import { paletteLuma } from '../src/enhance/relief.js';
import { stripSkyIndices } from '../src/enhance/clouds.js';
import { geometryOf, IDENTITY } from '../src/enhance/geometry.js';
import { KIND } from '../src/enhance/project.js';
import { models } from '../src/enhance/models.js';
import { clipPicture } from '../src/game/objects.js';
import { crc32 } from '../src/evidence/crc32.js';

const F = models().floor, S = models().sky, SIZE = F.width * F.height;

// ---- PNG
// A PNG of raw rows given with their filter bytes (for the reader's filters), the IDAT deflated by the platform.
async function rawPng(width, height, color, depth, rows, chunks = [], interlace = 0) {
  const chunk = (type, body) => { const out = new Uint8Array(body.length + 12), v = new DataView(out.buffer); v.setUint32(0, body.length); for (let k = 0; k < 4; k++) out[4 + k] = type.charCodeAt(k); out.set(body, 8); v.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length))); return out; }; // @math a chunk's length, type and CRC words
  const head = new Uint8Array(13), hv = new DataView(head.buffer); hv.setUint32(0, width); hv.setUint32(4, height); head[8] = depth; head[9] = color; head[12] = interlace; // @math the header's fields
  const parts = [Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), chunk('IHDR', head), ...chunks.map(([t, b]) => chunk(t, b)), chunk('IDAT', await deflate(Uint8Array.from(rows.flat()))), chunk('IEND', new Uint8Array(0))]; // @math the signature
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let at = 0; for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

test('PNG: an RGBA and a palette picture written and read back exactly, a palette PNG\'s indices and tRNS kept', async () => {
  const rgba = Uint8ClampedArray.from({ length: 5 * 3 * 4 }, (_, i) => (i * 37) & 0xff); // @math 5 x 3 pixels, a byte pattern
  const a = await decodePng(await encodePng({ width: 5, height: 3, rgba })); // @math the size
  assert.deepEqual([a.width, a.height, a.indices], [5, 3, null]); assert.deepEqual(a.rgba, rgba); // @math the size
  const palette = Uint8Array.from({ length: 768 }, (_, i) => (i * 11) & 0xff), alpha = new Uint8Array(256).fill(255); alpha[0] = 0; // @math a palette pattern; index 0 transparent
  const indices = Uint8Array.from({ length: 24 }, (_, i) => i % 7); // @math 6 x 4 pixels of seven indices
  const b = await decodePng(await encodePng({ width: 6, height: 4, indices, palette, alpha })); // @math the size
  assert.deepEqual(b.indices, indices); assert.deepEqual(b.palette, palette); assert.equal(b.alpha[0], 0); assert.equal(b.alpha[3], 255); // @math an opaque entry
  assert.deepEqual([...b.rgba.subarray(4, 8)], [33, 44, 55, 255], 'index 1 through its palette'); // @math the second pixel: index 1's colour (entries 3 to 5 of the pattern)
  assert.equal(b.rgba[3], 0, 'index 0 transparent');
});

test('PNG: the five filters, palettes of fewer bits, grey with alpha, 16 bits; refusals with the reason', async () => {
  // RGB 2 x 3, rows filtered None, Sub, Up; then Average and Paeth rows of a 1-row picture each.
  const rows = [[0, 10, 20, 30, 40, 50, 60], [1, 5, 5, 5, 1, 1, 1], [2, 1, 2, 3, 4, 5, 6]]; // @math filter 0: (10,20,30)(40,50,60); filter 1: (5,5,5)(6,6,6); filter 2: row 0's plus (1..6)
  const rgb = await decodePng(await rawPng(2, 3, 2, 8, rows)); // @math RGB, 8 bits
  assert.deepEqual([...rgb.rgba], [10, 20, 30, 255, 40, 50, 60, 255, 5, 5, 5, 255, 6, 6, 6, 255, 6, 7, 8, 255, 10, 11, 12, 255]); // @math the rows as unfiltered
  const avg = await decodePng(await rawPng(2, 2, 0, 8, [[0, 100, 50], [3, 10, 20]])); // @math grey; Average: (left + up) / 2 added
  assert.deepEqual([avg.rgba[8], avg.rgba[12]], [60, 20 + ((60 + 50) >> 1)]); // @math 10 + 100/2; 20 + (60 + 50)/2
  const paeth = await decodePng(await rawPng(2, 2, 0, 8, [[0, 100, 50], [4, 1, 2]])); // @math grey; Paeth
  assert.deepEqual([paeth.rgba[8], paeth.rgba[12]], [101, 52]); // @math up 100 for the first (no left), then the predictor of (101, 50, 100): 50
  const two = await decodePng(await rawPng(4, 1, 3, 2, [[0, 0b00011011]], [['PLTE', Uint8Array.from({ length: 12 }, (_, i) => i * 20)]])); // @math a 2-bit palette: indices 0, 1, 2, 3
  assert.deepEqual([...two.indices], [0, 1, 2, 3]); // @math the four indices
  const ga = await decodePng(await rawPng(1, 1, 4, 8, [[0, 77, 128]])); // @math grey and alpha
  assert.deepEqual([...ga.rgba], [77, 77, 77, 128]); // @math the grey, its alpha
  const wide = await decodePng(await rawPng(1, 1, 6, 16, [[0, 1, 2, 3, 4, 5, 6, 7, 8]])); // @math RGBA of 16 bits: the high bytes
  assert.deepEqual([...wide.rgba], [1, 3, 5, 7]); // @math the high byte of each sample
  await assert.rejects(decodePng(new Uint8Array(20)), /not a PNG/); // @math no signature
  await assert.rejects(decodePng(await rawPng(1, 1, 0, 8, [[0, 9]], [], 1)), /interlaced/); // @math Adam7 interlacing, its header's CRC right
  const bad = await encodePng({ width: 1, height: 1, rgba: new Uint8ClampedArray(4) }); bad[bad.length - 20] ^= 0xff; // @math a byte of the IDAT
  await assert.rejects(decodePng(bad), /damaged/);
});

test('PNG: a picture larger than a pack\'s refused from its header, before its data is inflated; data past the rows never read', async () => {
  const row = [[0, 1]]; // @math one row's filter byte and pixel (the data is short: only the header can refuse it)
  await assert.rejects(decodePng(await rawPng(20000, 1, 0, 8, row)), /20000 x 1: a pack's pictures are at most 16384 pixels a side/); // @math past ART.maxSide
  await assert.rejects(decodePng(await rawPng(9000, 9000, 0, 8, row)), /9000 x 9000: .* 16000000 pixels in all/); // @math past ART.maxImagePixels
  await assert.rejects(decodePng(await rawPng(3, 3, 0, 8, row), { maxSide: 2 }), /at most 2 pixels a side/); // @math a cap of the caller's
  const bomb = await rawPng(2, 1, 0, 8, [[0, 5, 6], ...Array.from({ length: 4000 }, () => new Array(1000).fill(0))]); // @math one row of 2 grey pixels, then 4 MB of zeros past it
  assert.ok(bomb.length < 20000, 'the zeros deflate to little'); // @math a few kilobytes
  assert.deepEqual([...(await decodePng(bomb)).rgba], [5, 5, 5, 255, 6, 6, 6, 255], 'the picture\'s row, the rest not inflated'); // @math the two pixels
});

test('the brightness of an RGBA copy of the palette is paletteLuma\'s, bit for bit', () => {
  const palette = Uint8Array.from({ length: 768 }, (_, i) => (i * 13) % 64), luma = paletteLuma({ palette }), w = v => (v << 2) | (v >> 4); // @math 6-bit entries; widened to 8
  for (let i = 0; i < 256; i++) assert.equal(lumaOf(w(palette[i * 3]), w(palette[i * 3 + 1]), w(palette[i * 3 + 2])), luma[i], `entry ${i}`); // @math three components an entry
});

// ---- the provider
const tilesEntry = (member, o = {}) => normalizeArtEntry({ kind: 'tiles', member, memberCrc: 1, image: 't.png', scale: 1, color: 'rgba', ...o }).entry;
const framesEntry = (member, offset, count, o = {}) => normalizeArtEntry({ kind: 'frames', member, memberCrc: 1, image: 'f.png', scale: 1, color: 'indexed', palette: 'A_F1.PCX', offset, width: 4, height: 2, count, stride: 8, columns: count, ...o }).entry; // @math frames of 4 x 2
const indexedImage = (w, h, fill) => ({ width: w, height: h, indices: new Uint8Array(w * h).fill(fill), palette: new Uint8Array(768), alpha: null, rgba: new Uint8ClampedArray(w * h * 4) });
// A synthetic archive (a WACKY.DAT of two members) the provider keys frames by.
function archiveOf(sizes) {
  const names = Object.keys(sizes), dir = 2 + names.length * 22, total = dir + Object.values(sizes).reduce((n, s) => n + s, 0), dat = new Uint8Array(total), v = new DataView(dat.buffer); // @math the count word and 22-byte entries
  v.setUint16(0, names.length, true);
  let at = dir;
  names.forEach((n, i) => { const e = 2 + i * 22; for (let k = 0; k < n.length; k++) dat[e + k] = n.charCodeAt(k); v.setUint32(e + 14, sizes[n], true); v.setUint32(e + 18, at - 2, true); at += sizes[n]; }); // @math the name, then the size word and the offset word (less its bias of 2)
  return dat;
}

test('the provider: pictures by where their bytes lie in the archive, other bytes refused, a later pack winning, members in any case', async () => {
  const dat = archiveOf({ 'GENEF.SP': 100, 'OTHER.SP': 40 }), { archiveMembers } = await import('../src/game/track-data.js'), m = archiveMembers(dat), genef = m.get('GENEF.SP'); // @math two members
  const lion = toArt(framesEntry('GENEF.SP', 13, 3), indexedImage(12, 2, 5)), later = toArt(framesEntry('GENEF.SP', 21, 1), indexedImage(4, 2, 9)); // @math three frames from byte 13 (no grid of 8 reaches 13); the second of them again
  const p = createArtProvider(() => dat).set([lion, later, toArt(tilesEntry('a_f1.pcx'), { width: 320, height: 200, rgba: new Uint8ClampedArray(256000) })]); // @math the sheet's size, four bytes a colour
  assert.deepEqual(p.frame(genef.subarray(13, 21)), { art: lion, k: 0, length: 8 }); // @math the first frame
  assert.equal(p.frame(genef.subarray(21, 29)).art, later, 'the later entry wins its frame'); // @math the second
  assert.deepEqual([p.frame(genef.subarray(29, 37)).art, p.frame(genef.subarray(29, 37)).k], [lion, 2]); // @math the third
  assert.equal(p.frame(genef.subarray(14, 22)), null, 'a byte off'); // @math one byte later
  assert.equal(p.frame(genef.subarray(13, 20)), null, 'another length'); // @math seven bytes
  assert.equal(p.frame(Uint8Array.from(genef.subarray(13, 21))), null, 'a copy of the bytes is not the archive\'s');
  assert.equal(p.tiles('A_F1.PCX').entry.member, 'A_F1.PCX'); assert.equal(p.tiles('A_F2.PCX'), null); assert.equal(p.angles(3), null); assert.equal(p.size, 3); // @math a slot; the three arts
  const world = { name: '1', gam: { tilesets: ['F1.PCX', 'F9.PCX'], sky: 'BACK1.PCX' }, sky: new Uint8Array(SIZE) }; // @math a track's names
  assert.deepEqual(p.forWorld(world).tiles.map(a => a?.entry.member ?? null), ['A_F1.PCX', null]); assert.equal(p.active(world), true);
  assert.equal(createArtProvider(() => dat).set([]).active(world), false);
  // load(): the store's records decoded (a broken one dropped), through a cache.
  const png = await encodePng({ width: 4, height: 2, indices: new Uint8Array(8).fill(3), palette: new Uint8Array(768), alpha: null }), cache = createArtCache(); // @math a frame's picture
  const loaded = createArtProvider(() => dat);
  assert.equal(await loaded.load([{ id: 'x', saved: 1, meta: framesEntry('OTHER.SP', 0, 1), png }, { id: 'y', saved: 1, meta: framesEntry('OTHER.SP', 8, 1), png: new Uint8Array([1, 2, 3]) }], cache), true); // @math a frame, and a broken picture
  assert.equal(loaded.size, 1); assert.equal(cache.size, 1); assert.equal(loaded.frame(m.get('OTHER.SP').subarray(0, 8)).art.ix[0], 3); // @math the frame's index
  // Overlapping loads: an older load still decoding (another track's pictures) never replaces the newer list, which a cached load sets first.
  const png2 = await encodePng({ width: 4, height: 2, indices: new Uint8Array(8).fill(6), palette: new Uint8Array(768), alpha: null }), racing = createArtProvider(() => dat); // @math a frame's picture of index 6
  const older = racing.load([{ id: 'old', saved: 2, meta: framesEntry('OTHER.SP', 8, 1), png: png2 }], cache), newer = racing.load([{ id: 'x', saved: 1, meta: framesEntry('OTHER.SP', 0, 1), png }], cache); // @math the older one decodes, the newer one is in the cache
  assert.deepEqual([await newer, await older], [true, false], 'the newer load set its list, the older one nothing');
  assert.equal(racing.size, 1); assert.equal(racing.frame(m.get('OTHER.SP').subarray(0, 8)).art.ix[0], 3); assert.equal(racing.frame(m.get('OTHER.SP').subarray(8, 16)), null, 'the older load\'s picture is not set'); // @math the newer load's frame; the older one's
  const pending = racing.load([{ id: 'old', saved: 3, meta: framesEntry('OTHER.SP', 8, 1), png: png2 }], cache); racing.set([]); // @math a load not in the cache, then a set
  assert.equal(await pending, false, 'a set replaces a load still running'); assert.equal(racing.size, 0);
  assert.equal((await decodeArt(framesEntry('OTHER.SP', 0, 1), new Blob([png]))).width, 4, 'a Blob too'); // @math the frame's width
  // A race decodes what it may draw: every picture, its own sheets, sky (and the split screen's background) and strip.
  const want = wantedFor(world), strip = members => ({ kind: 'strip', members, member: members[0] });
  assert.deepEqual([want({ kind: 'frames' }), want({ kind: 'tiles', member: 'A_F1.PCX' }), want({ kind: 'tiles', member: 'A_F2.PCX' }), want({ kind: 'sky', member: 'BACK1.PCX' }), want({ kind: 'sky', member: 'BLANK.PCX' }), want({ kind: 'sky', member: 'BACK2.PCX' }), want(strip(['8.PAR', '1.PAR'])), want(strip(['2.PAR']))], [true, true, false, true, true, false, true, false]);
});

test('the cache keeps the most recently used pictures within its bytes', () => {
  const c = createArtCache(100), art = bytes => ({ bytes }); // @math 100 bytes
  c.put('a', art(40)); c.put('b', art(40)); c.get('a'); c.put('c', art(40)); // @math three of 40: one must go
  assert.deepEqual([Boolean(c.get('a')), Boolean(c.get('b')), Boolean(c.get('c'))], [true, false, true], 'the least recently used went');
  c.put('d', art(500)); assert.equal(c.size, 1, 'a picture larger than the cache stays alone'); // @math larger than the limit
});

test('the tile hook: alpha 0 and a transparent index fall back to the archive\'s texel, RGBA goes to the art layers, the sub-texel place picks the pack pixel', () => {
  const p = 2, W = F.width * p, H = F.height * p, rgba = new Uint8ClampedArray(W * H * 4); // @math a sheet at p = 2; four bytes a colour
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 4; rgba.set([x & 0xff, y & 0xff, 7, x === 2 && y === 0 ? 0 : 255], o); } // @math a colour from the place, one pixel at alpha 0
  const art = toArt(tilesEntry('A_F1.PCX', { scale: p }), { width: W, height: H, rgba }), provider = createArtProvider(() => null).set([art]), A = createArtLayers(SIZE);
  const world = { name: '1', gam: { tilesets: ['F1.PCX', 'F2.PCX'] }, sin: new Uint8Array(108) }, hook = tileHook(world, provider, A); // @math two sheets of 54 tiles
  const tile = 11, texel = (3 << F.tileShift) + 5; // @math tile 11 (column 1, row 1 of the sheet), texel 5, 3
  assert.equal(hook(tile, texel, 0.7, 0.2, 100, 42), -1); // @math a pixel's place; the archive's index 42
  const x = (1 * 32 + 5) * p + 1, y = (1 * 32 + 3) * p + 0, word = new Uint32Array(rgba.buffer)[y * W + x]; // @math the sub-texel place: floor(0.7 p), floor(0.2 p)
  assert.deepEqual([A.direct[100], A.beneath[100], A.px[100]], [1, 42, word]); // @math the pixel, its archive index
  assert.equal(hook(0, 1, 0, 0, 101, 9), -1); assert.equal(A.direct[101], 0, 'alpha 0: the archive\'s texel'); // @math tile 0, texel 1, its pack pixel at alpha 0
  assert.equal(hook(54 + 3, 0, 0, 0, 102, 9), -1); assert.equal(A.direct[102], 0, 'a tile of the second sheet, which has no art'); // @math the second sheet
  const ix = new Uint8Array(F.width * F.height).fill(77); ix[0] = 5; // @math a sheet of index 77, index 5 at the first texel
  const alpha = new Uint8Array(256).fill(255); alpha[5] = 0; // @math index 5 transparent
  const indexed = toArt(tilesEntry('A_F1.PCX', { color: 'indexed', palette: 'A_F1.PCX' }), { width: F.width, height: F.height, indices: ix, palette: new Uint8Array(768), alpha });
  const ihook = tileHook(world, createArtProvider(() => null).set([indexed]), A);
  assert.equal(ihook(1, 1, 0.5, 0.5, 0, 9), 77); assert.equal(ihook(0, 0, 0.5, 0.5, 0, 9), -1, 'a transparent index: the archive\'s texel'); // @math an indexed pixel; the archive's index
  assert.equal(tileHook(world, createArtProvider(() => null).set([]), A), null);
});

// ---- the composite's direct colours
const frameOf = () => { const L = createLayers(SIZE), fb = new Uint8Array(SIZE).fill(3), palette = new Uint8ClampedArray(1024); for (let i = 0; i < 256; i++) palette.set([i, 255 - i, (i * 3) & 0xff, 255], i * 4); L.kind.fill(KIND.floor); L.depth.fill(300); L.relief.fill(1); return { L, fb, palette }; }; // @math a palette pattern; a floor at 300
const effectsOf = (cap = 255, sky = null) => ({ shadow: 0, fog: null, sky, water: null, relief: false, grade: null, cap }); // @math the brightest component

test('the composite: an RGBA copy of the palette fades as the palette does (min with the cap), partial alpha over the index beneath, overlays over the art', () => {
  const { L, fb, palette } = frameOf(), level = 40, cap = (level << 2) | (level >> 4); // @math a 6-bit fade level, widened
  const vga = Uint8Array.from({ length: 768 }, (_, i) => (i * 5) % 64), widen = v => (v << 2) | (v >> 4), faded = new Uint8ClampedArray(1024); // @math a 6-bit palette
  for (let i = 0; i < 256; i++) faded.set([widen(Math.min(vga[i * 3], level)), widen(Math.min(vga[i * 3 + 1], level)), widen(Math.min(vga[i * 3 + 2], level)), 255], i * 4); // @math the page's faded palette
  L.art = createArtLayers(SIZE);
  for (let o = 0; o < SIZE; o++) { fb[o] = o & 0xff; L.art.direct[o] = o % 3 === 0 ? 1 : 0; const v = fb[o]; L.art.rgba.set([widen(vga[v * 3]), widen(vga[v * 3 + 1]), widen(vga[v * 3 + 2]), 255], o * 4); } // @math a third of the pixels RGBA copies of their palette entry
  const a = new Uint8ClampedArray(SIZE * 4), b = new Uint8ClampedArray(SIZE * 4); // @math four bytes a colour
  compositeAt(a, { fb, L, G: IDENTITY, palette: faded, effects: effectsOf(cap) });
  const plain = { ...L, art: null }; compositeAt(b, { fb, L: plain, G: IDENTITY, palette: faded, effects: effectsOf(cap) });
  assert.deepEqual(a, b, 'the RGBA copies are the faded palette\'s colours');
  // Partial alpha: half over the index beneath; an overlay pixel over an RGBA one shows the overlay.
  L.art.direct.fill(0); L.art.direct[10] = 1; L.art.rgba.set([200, 100, 0, 128], 40); L.art.beneath[10] = 2; // @math the pixel 10: half alpha over index 2
  L.art.direct[11] = 1; L.art.rgba.set([1, 2, 3, 255], 44); const mask = new Uint8Array(SIZE); mask[11] = 1; // @math the pixel 11, under an overlay
  compositeAt(a, { fb, mask, L, G: IDENTITY, palette, effects: effectsOf() });
  const t = 128 / 255, q = 2 * 4; // @math the alpha; index 2's colour
  assert.deepEqual([...a.subarray(40, 43)], [palette[q] + (200 - palette[q]) * t, palette[q + 1] + (100 - palette[q + 1]) * t, palette[q + 2] + (0 - palette[q + 2]) * t].map(v => Math.round(v)), 'partial alpha over the colour beneath'); // @math the three components
  assert.deepEqual([...a.subarray(44, 47)], [...palette.subarray(fb[11] * 4, fb[11] * 4 + 3)], 'the overlay\'s own colour'); // @math four bytes a colour
});

test('the composite: the strip\'s sky flag of each pixel while a pack strip is drawn, the per-index flags otherwise', () => {
  const { L, fb, palette } = frameOf(), flags = new Uint8Array(20 * 256), tint = { colours: new Float32Array(130 * 3).fill(255), amount: 1 }, sky = { rows: 110, stripRows: 20, strip: flags, tint, range: null, clouds: [] }; // @math the strip's rows; a white tint
  const o = 115 * F.width + 7; L.kind[o] = KIND.horizon; fb[o] = 9; // @math a strip pixel of index 9 (no sky index)
  L.art = createArtLayers(SIZE); L.art.through[o] = 1;
  const out = new Uint8ClampedArray(SIZE * 4); // @math four bytes a colour
  compositeAt(out, { fb, L, G: IDENTITY, palette, effects: effectsOf(255, sky) });
  assert.deepEqual([...out.subarray(o * 4, o * 4 + 3)], [...palette.subarray(36, 39)], 'without a pack strip the per-index flags: not sky'); // @math index 9's colour
  L.art.strip = true; compositeAt(out, { fb, L, G: IDENTITY, palette, effects: effectsOf(255, sky) });
  assert.deepEqual([...out.subarray(o * 4, o * 4 + 3)], [255, 255, 255], 'a pack strip\'s \'sky here\': the tint goes on over it'); // @math white
});

// ---- the picture blit
const shapeOfSize = (W0, H0) => Array.from({ length: 10 }, (_, k) => { const w = Math.max(W0 - 3 * k, 2), h = Math.max(H0 - 2 * k, 2), deltas = new Int32Array((h + 1) * w), src = (i, j) => Math.floor((i * W0) / w) * H0 + Math.floor((j * H0) / h); for (let i = 0; i < w; i++) { deltas[i * (h + 1)] = src(i, 0); for (let j = 0; j < h; j++) deltas[i * (h + 1) + 1 + j] = j + 1 < h ? src(i, j + 1) - src(i, j) : 0; } return { w, h, deltas }; }); // @math ten classes of shrinking pictures (the general paths' synthetic shape)
const pictureArt = (frame, W0, H0, p, color, palette8 = null, cell = null, box = null) => { // a pack of one frame: the archive frame enlarged p times nearest (an identity pack), indexed or RGBA
  const e = normalizeArtEntry({ kind: 'frames', member: 'CARS.SP', memberCrc: 1, image: 'f.png', scale: p, color, palette: 'A_F1.PCX', offset: 0, width: W0, height: H0, count: 1, columns: 1, ...(cell ? { cell, box } : {}) }).entry;
  const cw = e.cell[0], ch = e.cell[1], [bx, by] = e.box;
  if (color === 'indexed') { const ix = new Uint8Array(cw * ch); for (let y = 0; y < H0 * p; y++) for (let x = 0; x < W0 * p; x++) ix[(by + y) * cw + bx + x] = frame[Math.floor(x / p) * H0 + Math.floor(y / p)]; return toArt(e, { width: cw, height: ch, indices: ix, palette: new Uint8Array(768), alpha: null }); }
  const rgba = new Uint8ClampedArray(cw * ch * 4); // @math four bytes a colour
  for (let y = 0; y < H0 * p; y++) for (let x = 0; x < W0 * p; x++) { const v = frame[Math.floor(x / p) * H0 + Math.floor(y / p)]; if (v) rgba.set([palette8[v * 4], palette8[v * 4 + 1], palette8[v * 4 + 2], 255], ((by + y) * cw + bx + x) * 4); } // @math four bytes a colour
  return toArt(e, { width: cw, height: ch, rgba });
};

test('the blit: an identity pack draws the archive\'s picture (the archive texel the class map reads, at every size class, 1x to 3x)', () => {
  const W0 = 38, H0 = 28, shape = shapeOfSize(W0, H0), world = { carShape: shape }, frame = Uint8Array.from({ length: W0 * H0 }, (_, i) => (i % 5 === 0 ? 0 : 1 + (i % 200))); // @math a frame with holes
  for (const [s, p] of [[1, 1], [2, 1], [3, 1], [1, 2], [2, 3]]) for (const k of [0, 4, 9]) { // @math scales and pack scales; classes
    const G = geometryOf({ s, m: 0 }), picture = shape[k], rec = { ...clipPicture({ column: 160, bottom: 150 }, picture), picture, frame, distance: 400 }; // @math a place on the screen; a distance
    const a = createLayers(G.W * G.H), b = createLayers(G.W * G.H), fa = new Uint8Array(G.W * G.H), fbb = new Uint8Array(G.W * G.H);
    b.art = createArtLayers(G.W * G.H);
    const ra = blitAt(fa, a, rec, 0.25, G, { world }), rb = blitAt(fbb, b, rec, 0.25, G, { world, art: { art: pictureArt(frame, W0, H0, p, 'indexed'), k: 0 } }); // @math the footprint's band
    assert.deepEqual(fbb, fa, `s ${s} p ${p} class ${k}: the picture`); assert.deepEqual(b.kind, a.kind); assert.deepEqual(b.depth, a.depth);
    assert.deepEqual(rb, ra, `s ${s} p ${p} class ${k}: the footprint and the silhouette`);
  }
  // The plan's place of a classes' pixel, U(i) + (r + 1/2)(U(i+1) - U(i)) / s, is a texel off where the class skips texels: the blit keeps it in
  // the class map's own texel (the 9th class skips about three texels a column).
  const map = classMap(shape[9], 1, shapeOf(world, shape[9])), U = i => map.cols[i] / H0;
  assert.ok(Math.floor(U(0) + (U(1) - U(0)) / 2) !== U(0), 'the plan\'s formula would read another texel at p = 1');
});

test('the blit: an RGBA pack keeps the archive\'s index under its colours; art pictures sort with indexed ones; art overhanging its box', () => {
  const W0 = 4, H0 = 3, shape = shapeOfSize(W0, H0), world = { carShape: shape }, frame = Uint8Array.of(1, 2, 0, 3, 4, 5, 6, 7, 8, 9, 10, 11), palette8 = Uint8ClampedArray.from({ length: 1024 }, (_, i) => (i * 3) & 0xff), G = IDENTITY; // @math a 4 x 3 frame with one hole; a palette pattern
  const rec = (column, distance) => ({ ...clipPicture({ column, bottom: 100 }, shape[0]), picture: shape[0], frame, distance }); // @math the picture's bottom row
  const L = createLayers(SIZE), fb = new Uint8Array(SIZE).fill(200); L.art = createArtLayers(SIZE); // @math an index under the pictures
  blitAt(fb, L, rec(50, 300), 0.25, G, { world, art: { art: pictureArt(frame, W0, H0, 2, 'rgba', palette8), k: 0 } }); // @math the farther picture, RGBA at p = 2
  const at = (x, y) => y * F.width + x, left = 50 - (W0 >> 1), top = 100 - H0; // @math the picture's top left
  assert.deepEqual([fb[at(left, top)], L.art.direct[at(left, top)], L.art.beneath[at(left, top)]], [1, 1, 200], 'the archive\'s index, the colour direct, the index beneath'); // @math the first texel's index, direct, the index before
  assert.deepEqual([fb[at(left, top + 2)], L.art.direct[at(left, top + 2)]], [200, 0], 'a transparent pixel draws nothing'); // @math the hole
  blitAt(fb, L, rec(51, 100), 0.25, G, { world }); // @math the nearer archive picture, one column right
  assert.deepEqual([fb[at(left + 1, top)], L.art.direct[at(left + 1, top)]], [1, 0], 'an indexed picture over an RGBA one clears its colour'); // @math the archive's first texel there
  const L2 = createLayers(SIZE), fb2 = new Uint8Array(SIZE).fill(200); L2.art = createArtLayers(SIZE); // @math the other order
  blitAt(fb2, L2, rec(51, 300), 0.25, G, { world }); blitAt(fb2, L2, rec(50, 100), 0.25, G, { world, art: { art: pictureArt(frame, W0, H0, 1, 'rgba', palette8), k: 0 } }); // @math far archive, near RGBA
  assert.deepEqual([L2.art.direct[at(left + 1, top)], L2.art.beneath[at(left + 1, top)]], [1, 1], 'an RGBA picture over an indexed one: its colour, the index beneath'); // @math the far picture's first texel index
  // Overhang: a cell two pixels wider each side and one taller at the top, with art there; it is drawn outside the box.
  const over = pictureArt(frame, W0, H0, 1, 'rgba', palette8, [W0 + 4, H0 + 1], [2, 1]); // @math the cell and the box's place
  over.rgba.set([9, 9, 9, 255], 0); // @math the cell's top-left pixel: two left of the box and one above
  const L3 = createLayers(SIZE), fb3 = new Uint8Array(SIZE); L3.art = createArtLayers(SIZE);
  const drawn = blitAt(fb3, L3, rec(50, 300), 0.25, G, { world, art: { art: over, k: 0 } }); // @math a distance
  assert.deepEqual([L3.art.direct[at(left - 2, top - 1)], L3.kind[at(left - 2, top - 1)]], [1, KIND.sprite], 'the overhang is drawn'); // @math two left, one above
  assert.equal(drawn.cols.top.length, W0, 'the silhouette is the box\'s');
  // blitFlatAt with a pack: an effect's picture as s x s blocks of the pack's.
  const d = { bytes: frame, width: W0, height: H0, x: 10, y: 10 }, L4 = createLayers(SIZE), fb4 = new Uint8Array(SIZE); L4.art = createArtLayers(SIZE); // @math an effect's place
  blitFlatAt(fb4, L4, d, 124, G, true, null, 0, { art: pictureArt(frame, W0, H0, 1, 'indexed'), k: 0 }); // @math the own car's distance
  const plainFb = new Uint8Array(SIZE), L5 = createLayers(SIZE); blitFlatAt(plainFb, L5, d, 124, G, true);
  assert.deepEqual(fb4, plainFb, 'an identity pack of an effect draws the effect');
});

test('the strip: a pack strip\'s \'sky here\' keeps the archive\'s sky pixels and takes the sky picture\'s row elsewhere; its scenery is not sky', () => {
  const par = new Uint8Array(S.parBytes), sky = new Uint8Array(SIZE); // the strip and its sky picture
  for (let j = 0; j < S.horizonRows; j++) for (let x = 0; x < S.parRowPixels; x++) par[j * S.parRowPixels + x] = (x % 640) < 320 ? 50 : 60; // @math the panorama twice: its first half scenery (50), its second sky-coloured (60)
  for (let y = 0; y < 130; y++) sky.fill(y < 110 ? 1 : 60, y * F.width, (y + 1) * F.width); // @math the sky; the strip's background rows in index 60
  for (let x = 0; x < F.width; x++) sky[(S.horizonRow + 2) * F.width + x] = 61; // @math the strip's third row's background in index 61
  const flags = stripSkyIndices({ sky }), period = 640, w = period, rgba = new Uint8ClampedArray(w * 20 * 4); // @math one panorama
  for (let y = 0; y < 20; y++) for (let x = 0; x < w; x++) rgba.set([1, 2, 3, x < 10 || (x >= 320 && x < 330) ? 0 : 255], (y * w + x) * 4); // @math 'sky here' over the first ten pixels of each half, opaque scenery elsewhere
  const art = toArt(normalizeArtEntry({ kind: 'strip', members: ['1.PAR'], memberCrc: 1, image: 's.png', scale: 1, color: 'rgba', period }).entry, { width: w, height: 20, rgba }); // @math the strip's rows
  const fb = new Uint8Array(SIZE), A = createArtLayers(SIZE);
  drawStripAt(par, 0, fb, IDENTITY, { strip: art, sky: null, A, flags, back: sky, rows: null });
  const o = (x, j) => (S.horizonRow + j) * F.width + x;
  assert.deepEqual([fb[o(3, 0)], A.direct[o(3, 0)], A.through[o(3, 0)]], [60, 0, 1], 'not there: the archive\'s scenery gives way to the sky picture\'s row, sky'); // @math index 60 under 'sky here' over scenery 50
  assert.deepEqual([fb[o(3, 2)], A.through[o(3, 2)]], [61, 1], 'the row\'s own background'); // @math the third row
  assert.deepEqual([fb[o(20, 0)], A.direct[o(20, 0)], A.through[o(20, 0)]], [50, 1, 0], 'scenery: the colour over the archive\'s index, not sky'); // @math an opaque pack pixel
  const fb2 = new Uint8Array(SIZE), A2 = createArtLayers(SIZE);
  drawStripAt(par, 80, fb2, IDENTITY, { strip: art, sky: null, A: A2, flags, back: sky, rows: null }); // @math offset 80: the window from pixel 320, sky-coloured
  assert.deepEqual([fb2[o(5, 0)], A2.direct[o(5, 0)], A2.through[o(5, 0)]], [60, 0, 1], 'an archive sky pixel under \'sky here\' stays'); // @math pixel 5 of the window, the panorama's 325
  // A pack sky: its pixels over the archive's, alpha 0 the archive's, p > 1 flagging its rows.
  const sp = 2, srgba = new Uint8ClampedArray(F.width * sp * 130 * sp * 4).fill(255); srgba[3] = 0; // @math a sky at p = 2; its first pixel at alpha 0
  const skyArt = toArt(normalizeArtEntry({ kind: 'sky', member: 'BACK1.PCX', memberCrc: 1, image: 'k.png', scale: sp, color: 'rgba' }).entry, { width: F.width * sp, height: 130 * sp, rgba: srgba }); // @math the sky's rows
  const fb3 = new Uint8Array(SIZE), A3 = createArtLayers(SIZE), rows = new Uint8Array(F.height);
  drawSkyAt(sky, fb3, IDENTITY, 0, { sky: skyArt, A: A3, rows });
  assert.deepEqual([A3.direct[0], A3.direct[1], A3.beneath[1], rows[0], rows[109], rows[110]], [0, 1, 1, 1, 1, 0], 'alpha 0 keeps the archive\'s pixel; the rows flagged at p > 1'); // @math the first pixels; the first and last sky rows and the strip's first
});
