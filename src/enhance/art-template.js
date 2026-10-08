// The artwork packs' templates (Stage 4: docs/artpacks.md): the archive's own art laid out as a pack, the start of an author's work. Built in
// memory from the visitor's archive and exported by the asset garage as a zip (src/viewer.js); never committed, never shared: its licence is
// LOCAL_ONLY and its NOTICE.txt says why. The checks build the same pictures to prove the registry and the packs' draw (scripts/check-enhance.js
// sections 5 and 7). Pure: { manifest, images: [{ path, width, height, rgba | indices, palette, alpha }], notice }, each picture enlarged p
// times nearest.
// - tiles: every tile sheet a track's .GAM names, in the sheet's own layout; in RGBA the palette cycle's entries (the beach tracks'), which an
//   RGBA picture could not cycle, at alpha 0 (the archive's texel, which cycles).
// - sky: every sky a track's .GAM names, its rows 0..129, with the widest margin the wide view asks for (the invented pixels of the wide view's
//   own margins, sky-hd.js skyMargins, for the author to replace).
// - strips: every N.PAR, one a CRC (the tracks that share a strip listed together), one panorama of its period; in RGBA the pixels in the
//   strip's sky indices (the sky picture's colours, clouds.js stripSkyIndices) at alpha 0: 'sky here'.
// - frames: every group of the region registry (regions.js), a cell a frame; in RGBA index 0 at alpha 0 (transparent, as in the game); with
//   each frame's ground row (its lowest opaque row) as its anchor.
// An indexed template is palette PNGs of the game's palette: the pixels are the archive's indices themselves.
import { ART, DISPLAY } from './config.js';
import { models } from './models.js';
import { stripPeriod, stripRepeats, viewMargin } from './geometry.js';
import { skyMargins } from './sky-hd.js';
import { stripSkyIndices } from './clouds.js';
import { worldRegions } from './regions.js';
import { PACK, LOCAL_ONLY, crcHex } from './pack-format.js';
import { crc32 } from '../evidence/crc32.js';
import { decodePcxMember } from '../formats/pcx.js';
import { parseGam } from '../formats/gam.js';
import { createCycle, stepCycle, cycleName } from '../game/palette-cycle.js';

export const NOTICE = [
  `${LOCAL_ONLY}.`,
  '',
  'This template holds the original art of Wacky Wheels, taken from your own copy of the game (WACKY.DAT) by the asset garage.',
  'Keep it on your computer: it is for making your own art, not for sharing.',
  '',
  'A pack you share may hold only art you made yourself (or may otherwise share). Replace every picture you keep in it, remove the',
  'entries you do not replace, set "licence" in pack.json to the terms you share your art under, and remove this notice.',
  'pack.json, the pictures\' sizes and the colour rules are described in docs/artpacks.md of the port.',
].join('\n');

// The tracks of an archive with their .GAM (the numbered ones), and what each uses.
function tracksOf(members) {
  const F = models().floor, out = [];
  for (const name of members.keys()) {
    const m = /^(\d+)\.GAM$/.exec(name);
    if (!m) continue;
    try { const gam = parseGam(members.get(name)); out.push({ stem: m[1], gam, tiles: gam.tilesets.map(n => `${F.gamPrefix}${n}`.toUpperCase()), sky: String(gam.sky).toUpperCase(), par: `${m[1]}.PAR` }); } catch { /* not a track's */ }
  }
  return out.sort((a, b) => Number(a.stem) - Number(b.stem));
}

// The DAC entries a track's palette cycle rewrites (palette-cycle.js, run until every group has gone round), or none.
const CYCLE_CALLS = 2 ** 12; // @math enough calls of the cycler for each of its groups to go round
export function cycledEntries(members, gam) {
  const beach = members.get(cycleName().toUpperCase());
  if (!gam.flag || !beach) return new Set();
  let cycle = createCycle(gam.flag, gam.extra, decodePcxMember(beach).vga);
  for (let n = 0; n < CYCLE_CALLS && cycle; n++) cycle = stepCycle(cycle);
  return new Set(cycle ? cycle.entries.keys() : []);
}

// What a template can hold for an archive: the tile sheets, skies and strips the tracks use (each with the tracks that use it), and the region
// registry's groups. Kept per members map.
const usesCache = new WeakMap();
export function templateParts(members, world) {
  const known = usesCache.get(members);
  if (known) return known;
  const tracks = tracksOf(members), tiles = new Map(), skies = new Map(), strips = new Map();
  for (const t of tracks) {
    for (const name of t.tiles) if (members.get(name)) { if (!tiles.has(name)) tiles.set(name, []); tiles.get(name).push(t); }
    if (members.get(t.sky)) { if (!skies.has(t.sky)) skies.set(t.sky, []); skies.get(t.sky).push(t); }
    const par = members.get(t.par);
    if (par) { const crc = crc32(par); if (!strips.has(crc)) strips.set(crc, []); strips.get(crc).push(t); }
  }
  const out = { tracks, tiles, skies, strips, regions: worldRegions(members, world) };
  usesCache.set(members, out);
  return out;
}

// The members a template can be made of, for the garage's choice: [{ member, kind, label }].
export function templateChoices(members, world) {
  const parts = templateParts(members, world), out = [];
  for (const name of new Set(parts.regions.groups.map(g => g.member))) out.push({ member: name, kind: 'frames', label: `${name} (pictures)` });
  for (const [name, users] of parts.tiles) out.push({ member: name, kind: 'tiles', label: `${name} (tile sheet of track${users.length > 1 ? 's' : ''} ${users.map(t => t.stem).join(', ')})` });
  for (const [name, users] of parts.skies) out.push({ member: name, kind: 'sky', label: `${name} (sky of ${users.length} track${users.length > 1 ? 's' : ''})` });
  for (const users of parts.strips.values()) out.push({ member: users[0].par, kind: 'strip', label: `${users.map(t => t.par).join(', ')} (horizon strip)` });
  return out;
}

const widen = v => (v << 2) | (v >> 4); // @math 6 bits widened to 8

// A picture of `w` x `h` original pixels (`at(x, y)` its palette index, `clear(index, x, y)` whether the RGBA template leaves it at alpha 0)
// enlarged p times nearest, as RGBA through `pal` (768 6-bit bytes) or as indices.
function picture(path, w, h, p, color, pal, at, clear, transparentZero = false) {
  const W = w * p, H = h * p;
  if (color === 'indexed') {
    const indices = new Uint8Array(W * H);
    for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) indices[Y * W + X] = at(Math.floor(X / p), Math.floor(Y / p));
    const alpha = transparentZero ? new Uint8Array(256).fill(0xff) : null; // @math a tRNS entry a palette entry
    if (alpha) alpha[0] = 0;
    return { path, width: W, height: H, indices, palette: Uint8Array.from(pal.subarray(0, 256 * 3), widen), alpha }; // @math 256 entries of three components
  }
  const rgba = new Uint8ClampedArray(W * H * 4); // @math four bytes a colour
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    const x = Math.floor(X / p), y = Math.floor(Y / p), v = at(x, y), o = (Y * W + X) * 4; // @math four bytes a colour
    rgba[o] = widen(pal[v * 3]); rgba[o + 1] = widen(pal[v * 3 + 1]); rgba[o + 2] = widen(pal[v * 3 + 2]); rgba[o + 3] = clear(v, x, y) ? 0 : 0xff; // @math three components an entry, the alpha last
  }
  return { path, width: W, height: H, rgba };
}

// The template of `select` ('all', or one member's name) at scale `scale` in `color` ('rgba' or 'indexed'). `palette` names the PCX whose
// palette the pictures are drawn with (an indexed picture's PLTE); by default each member's first track's (a track's palette is its first tile
// sheet's), else A_F1.PCX's. `track` (a stem) takes that track's palette, its sky's strip indices and its palette cycle for every picture
// (the checks' identity packs of a scenario). `archive` (the WACKY.DAT bytes) gives the manifest its `source`.
export function buildTemplate(members, world, { select = 'all', scale = 1, color = 'rgba', palette = null, track = null, archive = null } = {}) {
  if (!ART.templateScales.includes(scale) && !(Number.isInteger(scale) && scale >= 1 && scale <= ART.maxScale)) throw new Error(`no template at scale ${scale}`);
  const parts = templateParts(members, world), F = models().floor, S = models().sky, p = scale, want = name => select === 'all' || select === name;
  const fixed = track ? parts.tracks.find(t => t.stem === String(track)) : null;
  if (track && !fixed) throw new Error(`no track ${track} in the archive`);
  const fallback = members.get('A_F1.PCX') ? 'A_F1.PCX' : [...parts.tiles.keys()][0];
  const paletteName = users => palette ?? (fixed ?? users?.[0])?.tiles[0] ?? fallback, palettes = new Map();
  const pal = name => { if (!palettes.has(name)) palettes.set(name, decodePcxMember(members.get(name)).vga); return palettes.get(name); };
  const entries = [], images = [], base = { scale: p, color };
  const entry = (e, users, image) => { const name = paletteName(users); entries.push({ ...e, ...base, ...(color === 'indexed' ? { palette: name } : {}), image: image.path }); images.push(image); };
  for (const [name, users] of parts.tiles) {
    if (!want(name)) continue;
    const sheet = decodePcxMember(members.get(name)), cycled = new Set((fixed ? [fixed] : users).flatMap(t => [...cycledEntries(members, t.gam)]));
    entry({ kind: 'tiles', member: name, memberCrc: crcHex(crc32(members.get(name))) }, users, picture(`tiles/${name.replace(/\.PCX$/, '')}.png`, F.width, F.height, p, color, pal(paletteName(users)), (x, y) => sheet.indices[y * sheet.width + x], v => cycled.has(v)));
  }
  const margin = Math.max(0, ...Object.keys(DISPLAY.aspects).map(a => viewMargin('wide', a))); // the widest margin the wide view asks for
  for (const [name, users] of parts.skies) {
    if (!want(name)) continue;
    const sky = decodePcxMember(members.get(name)).indices, ext = skyMargins(sky, margin);
    entry({ kind: 'sky', member: name, memberCrc: crcHex(crc32(members.get(name))), margin }, users, picture(`sky/${name.replace(/\.PCX$/, '')}.png`, ext.refW, ext.rows, p, color, pal(paletteName(users)), (x, y) => ext.pixels[y * ext.refW + x], () => false));
  }
  for (const [crc, users] of parts.strips) {
    const names = users.map(t => t.par), first = fixed && users.some(t => t.stem === fixed.stem) ? fixed : users[0];
    if (!names.some(want)) continue;
    const par = members.get(first.par), P = stripRepeats(par) ? stripPeriod() : S.parRowPixels, flags = stripSkyIndices({ sky: decodePcxMember(members.get(first.sky)).indices });
    entry({ kind: 'strip', members: names, memberCrc: crcHex(crc), period: P }, [first], picture(`strips/${first.par.replace(/\.PAR$/, '')}.png`, P, S.horizonRows, p, color, pal(paletteName([first])), (x, y) => par[S.parRowPixels * y + x], (v, x, y) => flags[y * 256 + v] === 1)); // @math a flag for each palette index
  }
  for (const g of parts.regions.groups) {
    if (!want(g.member)) continue;
    const data = members.get(g.member), anchors = [];
    for (let k = 0; k < g.count; k++) { let low = 0; const at = g.offset + k * g.stride; for (let x = 0; x < g.width; x++) for (let y = g.height - 1; y > low; y--) if (data[at + x * g.height + y] !== 0) { low = y; break; } anchors.push(low); } // each frame's lowest opaque row
    const columns = g.columns, rows = Math.ceil(g.count / columns), w = columns * g.width, h = rows * g.height;
    const at = (x, y) => { const k = Math.floor(y / g.height) * columns + Math.floor(x / g.width); return k < g.count ? data[g.offset + k * g.stride + (x % g.width) * g.height + (y % g.height)] : 0; };
    entry({ kind: 'frames', member: g.member, memberCrc: crcHex(crc32(data)), offset: g.offset, width: g.width, height: g.height, count: g.count, stride: g.stride, columnMajor: true, columns, cell: [g.width * p, g.height * p], box: [0, 0], anchors }, null, picture(`frames/${g.member.replace(/\.SP$/, '')}-${g.offset}-${g.width}x${g.height}.png`, w, h, p, color, pal(paletteName(null)), at, v => v === 0, true));
  }
  const manifest = { format: PACK.format, version: PACK.version, name: select === 'all' ? 'Template of the race world' : `Template of ${select}`, author: '', licence: LOCAL_ONLY, ...(archive ? { source: { size: archive.length, crc32: crcHex(crc32(archive)) } } : {}), entries };
  return { manifest, images, notice: NOTICE };
}
