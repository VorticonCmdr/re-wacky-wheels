// The artwork packs' format (Stage 4: docs/artpacks.md, the authors' reference): a pack is pack.json, its PNG pictures and NOTICE.txt, in a zip,
// a folder or a set of files. Everything here is pure: the manifest and every entry are checked and normalized with a reason for what is
// refused and warnings for what is only questionable, against the archive the pack is imported into (packContext) and the decoded picture of the
// entry (png.js decodePng's { width, height, rgba, indices, palette, alpha }) when they are given. Unknown keys are dropped.
// - The manifest: { format: 'wackywheels-artpack', version: 1, name, author, licence, source?: { size, crc32 }, entries }. The licence is the
//   author's statement that the art is theirs to share, and may not be empty; a template's is LOCAL_ONLY, which an import takes with a warning
//   (the template holds the game's own art: it stays in this browser). `source` is the archive the pack was made against: another one only warns.
// - Every entry: kind, member (strip: members), memberCrc (the CRC-32 of the member's bytes, a number or 8 hex digits), image (its path in
//   the pack), scale p (1 to ART.maxScale: p x p pack pixels an original pixel) and color: 'rgba', or 'indexed' with `palette`, the member
//   (a tile sheet's PCX) whose palette the picture's own (a palette PNG's PLTE) must hold at every index it uses: the pixels are the game's
//   palette indices themselves (the game's palettes repeat colours, so colours cannot name them).
// - tiles: a tile sheet (A_*.PCX): a picture of the sheet's layout, 320p x 200p (10 columns of 32p cells, tiles 0 to 53).
// - sky: a sky picture (BACK1/2/3.PCX, BLANK.PCX): (320 + 2 margin)p x 130p, its rows 0..109 the sky and 110..129 the strip's background rows
//   under it; `margin` reference columns a side for the wide view (0 for none).
// - strip: `members`, the N.PAR files of one CRC: P p x 20p, one panorama of the strip's period P (the validated period of the files,
//   geometry.js stripPeriod; 1280 for a file that does not repeat), `period` P.
// - frames: `offset` (bytes into the member), width x height (the logical size), count, stride (default width x height), columnMajor (true:
//   every race frame is), columns, cell [cw, ch] (default [width p, height p]), box [bx, by] (default [0, 0]: where the logical box's top left
//   sits in the cell, so art may overhang it), anchors (optional: the logical ground row of each frame). Frame k is the archive's bytes at
//   offset + k stride, drawn from the cell (k mod columns, floor(k / columns)); each frame must be a picture the race draws (regions.js).
// - angles (kart angles, M4): member CARS.SP, slot (a slot of CARS.SP), directions N (a multiple of ART.directions.step up to its max), width
//   x height (the cars' class 0 size), columns, cell, box, anchor (the logical ground row, default height - 1); index 0 is the view of the
//   original entry 0, indices rising as the original entries rise, and index (N / 8) f is the original entry f.
import { ART } from './config.js';
import { models } from './models.js';
import { stripPeriod, stripRepeats } from './geometry.js';
import { worldRegions } from './regions.js';
import { crc32, hex8 } from '../evidence/crc32.js';
import { decodePcxMember } from '../formats/pcx.js';
import { carFrame } from '../game/control.js';
import { decodePng } from './png.js';

export const PACK = { format: 'wackywheels-artpack', version: 1, manifest: 'pack.json', notice: 'NOTICE.txt' };
export const KINDS = ['tiles', 'sky', 'strip', 'frames', 'angles'];
export const COLORS = ['rgba', 'indexed'];
export const LOCAL_ONLY = 'LOCAL ONLY: contains the original game\'s art';
export const isLocalOnly = licence => typeof licence === 'string' && licence.trim().toUpperCase().startsWith('LOCAL ONLY');
export const crcHex = n => hex8(n >>> 0);

const whole = (v, min = 0) => Number.isInteger(v) && v >= min;
const text = v => (typeof v === 'string' ? v.trim() : '');
const upper = v => text(v).toUpperCase();
// A CRC-32 as a number: a whole number in 32 bits, or 8 hex digits.
export function parseCrc(v) {
  if (Number.isInteger(v) && v >= 0 && v <= 0xffffffff) return v; // @math 32 bits
  if (typeof v === 'string' && /^[0-9a-f]{8}$/i.test(v.trim())) return parseInt(v.trim(), 16); // @math hex digits
  return null;
}
const pair = (v, fallback, min) => (v === undefined ? fallback : Array.isArray(v) && v.length === 2 && v.every(n => whole(n, min)) ? [v[0], v[1]] : null); // @math [x, y]

// The manifest: { manifest, reason (null when taken), warnings }. Its entries are kept as they are (normalizeArtEntry checks each).
export function normalizeManifest(input) {
  const refuse = reason => ({ manifest: null, reason, warnings: [] });
  if (!input || typeof input !== 'object' || Array.isArray(input)) return refuse('pack.json is not an object');
  if (input.format !== PACK.format) return refuse(`pack.json's format is not '${PACK.format}'`);
  if (input.version !== PACK.version) return refuse(`pack.json is of version ${JSON.stringify(input.version)}; this page reads version ${PACK.version}`);
  const name = text(input.name), author = text(input.author), licence = text(input.licence), warnings = [];
  if (!name) return refuse('the pack has no name');
  if (!licence) return refuse('the pack has no licence: its author must say that the art is theirs to share, and how');
  if (!Array.isArray(input.entries) || !input.entries.length) return refuse('the pack has no entries');
  let source = null;
  if (input.source !== undefined) {
    const crc = parseCrc(input.source?.crc32);
    if (!whole(input.source?.size, 1) || crc === null) return refuse('the pack\'s source is not { size, crc32 }');
    source = { size: input.source.size, crc32: crc };
  }
  if (isLocalOnly(licence)) warnings.push('local only: the pack holds the original game\'s art; keep it in this browser and never share it');
  return { manifest: { format: PACK.format, version: PACK.version, name, author, licence, source, entries: input.entries }, reason: null, warnings };
}

// The size of an entry's picture in pixels: { width, height }, or null where its kind's rule lacks a value (a strip without its period).
export function expectedSize(e) {
  const F = models().floor, S = models().sky, p = e.scale, rows = S.skyRows + S.horizonRows;
  if (e.kind === 'tiles') return { width: F.width * p, height: F.height * p };
  if (e.kind === 'sky') return { width: (S.width + 2 * e.margin) * p, height: rows * p }; // @math a margin either side
  if (e.kind === 'strip') return e.period ? { width: e.period * p, height: S.horizonRows * p } : null;
  const count = e.kind === 'angles' ? e.directions : e.count;
  return { width: e.columns * e.cell[0], height: Math.ceil(count / e.columns) * e.cell[1] };
}
// The top left of frame k's cell in the picture, in pixels (frames and angles).
export const frameCell = (e, k) => ({ x: (k % e.columns) * e.cell[0], y: Math.floor(k / e.columns) * e.cell[1] });

// The archive's facts an entry is checked against: its members, their CRCs and pictures, the strips' periods, the region registry (regions.js)
// and the cars' slots and size. `world` is a track of the archive (loadTrack). Lazy: each is worked out when first asked.
export function packContext(members, world, archive = null) {
  const crcs = new Map(), pictures = new Map(), periods = new Map();
  let regions = null, archiveCrc = null;
  const ctx = {
    members,
    // The archive the pack is imported into, { size, crc32 }, when its bytes are given.
    get archive() { return archive ? { size: archive.length, crc32: (archiveCrc ??= crc32(archive)) } : null; },
    member: name => members.get(upper(name)) ?? null,
    crc: name => { const k = upper(name); if (!crcs.has(k)) { const d = members.get(k); crcs.set(k, d ? crc32(d) : null); } return crcs.get(k); },
    picture: name => { const k = upper(name); if (!pictures.has(k)) { let p = null; try { p = members.get(k) ? decodePcxMember(members.get(k)) : null; } catch { p = null; } pictures.set(k, p); } return pictures.get(k); },
    // The palette of a PCX member as the page shows it: its 6-bit entries widened to 8 bits (256 x 3).
    palette: name => { const p = ctx.picture(name); return p ? Uint8Array.from(p.vga, v => (v << 2) | (v >> 4)) : null; }, // @math 6 bits widened to 8
    period: name => { const k = upper(name); if (!periods.has(k)) { const d = members.get(k), S = models().sky; periods.set(k, d ? (stripRepeats(d) ? stripPeriod() : S.parRowPixels) : null); } return periods.get(k); },
    get regions() { return (regions ??= worldRegions(members, world)); },
    car: { w: world.carShape[0].w, h: world.carShape[0].h },
    get slots() { const cars = members.get('CARS.SP'), size = ctx.car.w * ctx.car.h, per = carFrame(1, 0) - carFrame(0, 0); return cars ? Math.floor(cars.length / size / per) : 0; },
  };
  return ctx;
}

// The lowest opaque row of each frame of an entry's picture, in the picture's rows from its box's top, or -1 (none).
function lowestRows(e, image) {
  const out = [], count = e.kind === 'angles' ? e.directions : e.count;
  for (let k = 0; k < count; k++) {
    const { x, y } = frameCell(e, k);
    let low = -1;
    for (let r = e.cell[1] - 1; r >= 0 && low < 0; r--) for (let c = 0; c < e.cell[0]; c++) { const i = (y + r) * image.width + x + c; if (opaque(image, i, e.kind)) { low = r - e.box[1]; break; } }
    out.push(low);
  }
  return out;
}
// Whether a pixel of a decoded picture is drawn: an index other than 0 whose palette alpha is not 0 (a frame's index 0 is transparent, as the
// game's), or an alpha above 0.
export function opaque(image, i, kind = 'frames') {
  if (image.indices) { const v = image.indices[i]; return (v !== 0 || (kind !== 'frames' && kind !== 'angles')) && (image.alpha ? image.alpha[v] !== 0 : true); }
  return image.rgba[i * 4 + 3] !== 0; // @math four bytes a colour, the alpha last
}

// One entry: { entry (normalized), reason (null when taken), warnings }. With `ctx` (packContext) it is checked against the archive, with
// `image` (a decoded picture) its picture too; without them only its own fields are.
export function normalizeArtEntry(raw, ctx = null, image = null) {
  const refuse = reason => ({ entry: null, reason, warnings: [] }), warnings = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return refuse('an entry is not an object');
  const kind = raw.kind;
  if (!KINDS.includes(kind)) return refuse(`an entry of kind ${JSON.stringify(kind)}: the kinds are ${KINDS.join(', ')}`);
  const imagePath = text(raw.image);
  if (!imagePath) return refuse(`a ${kind} entry without its image`);
  if (!whole(raw.scale, 1) || raw.scale > ART.maxScale) return refuse(`${imagePath}: scale ${JSON.stringify(raw.scale)}; a scale is a whole number from 1 to ${ART.maxScale}`);
  if (!COLORS.includes(raw.color)) return refuse(`${imagePath}: color ${JSON.stringify(raw.color)}; it is 'rgba' or 'indexed'`);
  const palette = raw.color === 'indexed' ? upper(raw.palette) : null;
  if (raw.color === 'indexed' && !palette) return refuse(`${imagePath}: an indexed entry names the PCX whose palette its indices are (palette)`);
  const memberCrc = parseCrc(raw.memberCrc);
  if (memberCrc === null) return refuse(`${imagePath}: memberCrc is not a CRC-32 (a number or 8 hex digits)`);
  const e = { kind, image: imagePath, scale: raw.scale, color: raw.color, palette, memberCrc, member: null, members: null };
  const p = e.scale, F = models().floor, S = models().sky;
  if (kind === 'strip') {
    const list = Array.isArray(raw.members) ? [...new Set(raw.members.map(upper))] : [];
    if (!list.length || list.some(n => !/^\d+\.PAR$/.test(n))) return refuse(`${imagePath}: a strip names its N.PAR members (members)`);
    e.members = list; e.member = list[0];
    if (raw.period !== undefined && !whole(raw.period, 1)) return refuse(`${imagePath}: period ${JSON.stringify(raw.period)} is not a whole number of pixels`);
    e.period = raw.period ?? null;
  } else {
    e.member = upper(raw.member);
    if (!e.member) return refuse(`${imagePath}: the entry names no member`);
  }
  if (kind === 'tiles' && !/^A_.+\.PCX$/.test(e.member)) return refuse(`${imagePath}: ${e.member} is not a tile sheet (A_*.PCX)`);
  if (kind === 'sky') {
    if (!/\.PCX$/.test(e.member)) return refuse(`${imagePath}: ${e.member} is not a sky picture (a PCX)`);
    if (raw.margin !== undefined && !whole(raw.margin)) return refuse(`${imagePath}: margin ${JSON.stringify(raw.margin)} is not a whole number of columns`);
    e.margin = raw.margin ?? 0;
  }
  if (kind === 'frames' || kind === 'angles') {
    if (!whole(raw.width, 1) || !whole(raw.height, 1)) return refuse(`${imagePath}: width and height are whole numbers of the original's pixels`);
    e.width = raw.width; e.height = raw.height;
    if (kind === 'frames') {
      if (!whole(raw.offset) || !whole(raw.count, 1)) return refuse(`${imagePath}: offset and count are whole numbers, count at least 1`);
      if (raw.stride !== undefined && !whole(raw.stride, 1)) return refuse(`${imagePath}: stride ${JSON.stringify(raw.stride)} is not a whole number of bytes`);
      if (raw.columnMajor === false) return refuse(`${imagePath}: the race draws its frames column-major (columnMajor true)`);
      e.offset = raw.offset; e.count = raw.count; e.stride = raw.stride ?? e.width * e.height; e.columnMajor = true;
    } else {
      const D = ART.directions;
      if (!whole(raw.slot)) return refuse(`${imagePath}: slot ${JSON.stringify(raw.slot)} is not a slot of CARS.SP`);
      if (!whole(raw.directions, D.step) || raw.directions % D.step !== 0 || raw.directions > D.max) return refuse(`${imagePath}: ${JSON.stringify(raw.directions)} directions; a set has a multiple of ${D.step} up to ${D.max}`);
      if (e.member !== 'CARS.SP') return refuse(`${imagePath}: kart angles are sets of CARS.SP's slots`);
      e.slot = raw.slot; e.directions = raw.directions;
      if (raw.anchor !== undefined && !(whole(raw.anchor) && raw.anchor < e.height)) return refuse(`${imagePath}: anchor ${JSON.stringify(raw.anchor)} is not a row of the frame`);
      e.anchor = raw.anchor ?? e.height - 1;
    }
    const count = kind === 'angles' ? e.directions : e.count;
    if (raw.columns !== undefined && !whole(raw.columns, 1)) return refuse(`${imagePath}: columns ${JSON.stringify(raw.columns)} is not a whole number from 1`);
    e.columns = Math.min(raw.columns ?? count, count);
    e.cell = pair(raw.cell, [e.width * p, e.height * p], 1); e.box = pair(raw.box, [0, 0], 0);
    if (!e.cell || !e.box) return refuse(`${imagePath}: cell and box are [x, y] pairs of whole numbers`);
    if (e.box[0] + e.width * p > e.cell[0] || e.box[1] + e.height * p > e.cell[1]) return refuse(`${imagePath}: the box at ${e.box.join(', ')} of ${e.width * p} x ${e.height * p} pixels does not fit its cell of ${e.cell.join(' x ')}`);
    if (kind === 'frames' && raw.anchors !== undefined && raw.anchors !== null) {
      if (!Array.isArray(raw.anchors) || raw.anchors.length !== e.count || !raw.anchors.every(a => whole(a) && a < e.height)) return refuse(`${imagePath}: anchors are a row of each frame (0 to ${e.height - 1}), one a frame`);
      e.anchors = raw.anchors.slice();
    } else if (kind === 'frames') e.anchors = null;
  }
  if (ctx) { // against the archive
    const names = e.members ?? [e.member];
    for (const n of names) {
      if (!ctx.member(n)) return refuse(`${imagePath}: ${n} is not in this archive`);
      if (ctx.crc(n) !== e.memberCrc) return refuse(`${imagePath}: made for another ${n} (this archive's has the CRC-32 ${crcHex(ctx.crc(n))}, the pack's ${crcHex(e.memberCrc)})`);
    }
    if (palette && !ctx.palette(palette)) return refuse(`${imagePath}: its palette ${palette} is not a picture of this archive`);
    if (kind === 'tiles' || kind === 'sky') { const pic = ctx.picture(e.member); if (!pic || pic.width !== F.width || pic.height < (kind === 'tiles' ? F.height : S.skyRows + S.horizonRows)) return refuse(`${imagePath}: ${e.member} is not a ${kind === 'tiles' ? 'tile sheet' : 'sky picture'} of ${F.width} x ${F.height}`); }
    if (kind === 'strip') {
      const P = ctx.period(e.member);
      if (e.members.some(n => ctx.period(n) !== P)) return refuse(`${imagePath}: the strips listed do not share one period`);
      if (e.period === null) e.period = P;
      else if (e.period !== P) return refuse(`${imagePath}: a strip of period ${e.period}; ${e.member} repeats every ${P} pixels`);
    }
    if (kind === 'frames') {
      const length = ctx.member(e.member).length, end = e.offset + (e.count - 1) * e.stride + e.width * e.height;
      if (end > length) return refuse(`${imagePath}: ${e.count} frames from byte ${e.offset} run to byte ${end}, past the end of ${e.member} (${length} bytes)`);
      for (let k = 0; k < e.count; k++) { const at = e.offset + k * e.stride; if (!ctx.regions.has(e.member, at, e.width, e.height)) return refuse(`${imagePath}: frame ${k} (${e.width} x ${e.height} at byte ${at} of ${e.member}) is no picture the race draws`); }
    }
    if (kind === 'angles') {
      if (e.slot >= ctx.slots) return refuse(`${imagePath}: CARS.SP has ${ctx.slots} slots, not ${e.slot + 1}`);
      if (e.width !== ctx.car.w || e.height !== ctx.car.h) return refuse(`${imagePath}: a kart angle is ${ctx.car.w} x ${ctx.car.h}, the cars' size`);
    }
  } else if (kind === 'strip' && e.period === null) return refuse(`${imagePath}: a strip names its period (or is checked against the archive)`);
  if (image) { // against its picture
    const want = expectedSize(e);
    if (image.width > ART.maxSide || image.height > ART.maxSide) return refuse(`${imagePath}: image ${image.width} x ${image.height}; a side is at most ${ART.maxSide} pixels`);
    if (image.width * image.height > ART.maxImagePixels) return refuse(`${imagePath}: image ${image.width} x ${image.height}; a picture has at most ${ART.maxImagePixels} pixels`);
    if (image.width !== want.width || image.height !== want.height) return refuse(`${imagePath}: image ${image.width} x ${image.height}, expected ${want.width} x ${want.height}`);
    if (e.color === 'indexed') {
      if (!image.indices) return refuse(`${imagePath}: an indexed entry is a palette PNG (its indices are the game's palette indices)`);
      if (ctx) {
        const pal = ctx.palette(palette), used = new Uint8Array(256); // @math a flag for each palette index
        for (const v of image.indices) used[v] = 1;
        for (let v = 0; v < used.length; v++) {
          if (!used[v]) continue;
          const a = [image.palette[v * 3], image.palette[v * 3 + 1], image.palette[v * 3 + 2]], b = [pal[v * 3], pal[v * 3 + 1], pal[v * 3 + 2]]; // @math three components an entry
          if (a.some((x, k) => x !== b[k])) return refuse(`${imagePath}: its palette's entry ${v} is ${a.join(', ')}, ${palette}'s ${b.join(', ')}: an indexed picture keeps the game's palette`);
        }
      }
    } else if (!image.rgba) return refuse(`${imagePath}: no pixels`);
    if (kind === 'frames' || kind === 'angles') { // the art stands on its ground row
      const low = lowestRows(e, image), member = ctx?.member(e.member), off = [];
      low.forEach((r, k) => {
        if (r < 0) return;
        let want = kind === 'angles' ? e.anchor : e.anchors?.[k];
        if (want === undefined || want === null) { want = -1; if (member) { const at = e.offset + k * e.stride; for (let x = 0; x < e.width; x++) for (let y = e.height - 1; y > want; y--) if (member[at + x * e.height + y] !== 0) { want = y; break; } } } // the archive frame's lowest opaque row
        if (want >= 0 && Math.abs(r / p - want) > 1) off.push(k);
      });
      if (off.length) warnings.push(`${imagePath}: ${off.length} frame${off.length > 1 ? 's stand' : ' stands'} more than a row off ${kind === 'angles' ? 'its' : 'their'} ground row (frame${off.length > 1 ? 's' : ''} ${off.slice(0, 6).join(', ')}${off.length > 6 ? ', ...' : ''}): the race stands the art where the archive's frame stands`); // @math the first few
    }
  }
  return { entry: e, reason: null, warnings };
}

// The files of a pack (a zip's, a folder's or the files picked: [{ name: path, data }]): the folder that holds pack.json (the shallowest one;
// a folder picked or a zip made of a folder puts the pack under its name), its manifest parsed, and file(path) for its pictures by their
// paths in the manifest (files picked without their folders: by their names, when the name is not ambiguous). The macOS Finder's leftovers (__MACOSX/, .DS_Store) are left out. { json (or null), reason, file(path) }.
export function packFiles(files) {
  const clean = n => String(n).replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
  const list = files.map(f => ({ path: clean(f.name), data: f.data })).filter(f => !f.path.split('/').some(part => part === '__MACOSX' || part === '.DS_Store'));
  const manifests = list.filter(f => f.path.split('/').pop().toLowerCase() === PACK.manifest).sort((a, b) => a.path.split('/').length - b.path.split('/').length);
  const none = reason => ({ json: null, reason, file: () => null });
  if (!manifests.length) return none(`no ${PACK.manifest} among the files`);
  const top = manifests[0], base = top.path.includes('/') ? top.path.slice(0, top.path.lastIndexOf('/') + 1) : '';
  const byPath = new Map(list.map(f => [f.path, f])), byLower = new Map(list.map(f => [f.path.toLowerCase(), f]));
  // Files picked one by one come without their folders (a file picker gives their names only): then a picture is also found by its name alone,
  // when exactly one of the files has it (two of one name are ambiguous and find nothing).
  const flat = list.every(f => !f.path.includes('/')), byName = new Map();
  if (flat) for (const f of list) { const k = f.path.toLowerCase(); byName.set(k, byName.has(k) ? null : f); }
  const file = path => {
    const parts = [];
    for (const part of clean(base + path).split('/')) { if (part === '..') { if (!parts.length) return null; parts.pop(); } else if (part && part !== '.') parts.push(part); }
    const full = parts.join('/');
    if (!full.startsWith(base)) return null; // outside the pack's folder
    return (byPath.get(full) ?? byLower.get(full.toLowerCase()) ?? (flat ? byName.get(parts[parts.length - 1]?.toLowerCase()) : null))?.data ?? null;
  };
  let json;
  try { json = JSON.parse(new TextDecoder().decode(top.data)); } catch (error) { return none(`${PACK.manifest} is not JSON: ${error.message}`); }
  return { json, reason: null, file };
}

// What an entry is, for the import's report: its kind, member and picture.
export const describeEntry = raw => (raw && typeof raw === 'object' ? `${raw.kind ?? '?'} ${raw.kind === 'strip' ? (Array.isArray(raw.members) ? raw.members.join(', ') : '?') : raw.member ?? '?'}${raw.kind === 'frames' ? ` at byte ${raw.offset}` : ''}${raw.kind === 'angles' ? ` slot ${raw.slot}` : ''} (${raw.image ?? 'no picture'})` : 'not an entry');

// A pack's files (packFiles') read and checked against the archive (`ctx`: packContext): { pack: { name, author, licence, manifest, source } or
// null, reason (why the whole pack is refused), warnings (the pack's), report: [{ entry: describeEntry's, status: 'ok' | 'warning' |
// 'refused', reasons }], arts: [{ entry, png (the picture's bytes), image (decoded), width, height }] } (the entries that are not refused, to be
// kept). An entry is refused for its own fields, its member (missing, of another CRC), its frames (no picture the race draws), its picture
// (missing, unreadable, of another size, of other colours than its palette's) or because the pack's pictures would pass ART.maxPackPixels; two
// entries of one key keep the later one (as two packs do).
export async function readPack(files, ctx) {
  const empty = (reason, warnings = []) => ({ pack: null, reason, warnings, report: [], arts: [] });
  const { json, reason, file } = packFiles(files);
  if (!json) return empty(reason);
  const m = normalizeManifest(json);
  if (!m.manifest) return empty(m.reason);
  const warnings = [...m.warnings], report = [], arts = [], here = ctx.archive;
  if (m.manifest.source && here && (m.manifest.source.size !== here.size || m.manifest.source.crc32 !== here.crc32)) warnings.push(`made against another WACKY.DAT (${m.manifest.source.size} bytes, CRC-32 ${crcHex(m.manifest.source.crc32)}; this one ${here.size} bytes, ${crcHex(here.crc32)}): each entry is checked against this one`);
  let pixels = 0;
  const keyOf = e => `${e.kind}|${e.member}|${e.offset ?? ''}|${e.width ?? ''}x${e.height ?? ''}|${e.slot ?? ''}`, seen = new Map();
  for (const raw of m.manifest.entries) {
    const label = describeEntry(raw), refuse = why => report.push({ entry: label, status: 'refused', reasons: [why] });
    const first = normalizeArtEntry(raw);
    if (!first.entry) { refuse(first.reason); continue; }
    const bytes = file(first.entry.image);
    if (!bytes) { refuse(`${first.entry.image}: no such picture in the pack`); continue; }
    let image;
    try { image = await decodePng(bytes); } catch (error) { refuse(`${first.entry.image}: ${error.message}`); continue; }
    const checked = normalizeArtEntry(raw, ctx, image);
    if (!checked.entry) { refuse(checked.reason); continue; }
    if (pixels + image.width * image.height > ART.maxPackPixels) { refuse(`${first.entry.image}: the pack's pictures would pass ${ART.maxPackPixels} pixels`); continue; }
    pixels += image.width * image.height;
    const key = keyOf(checked.entry);
    if (seen.has(key)) { const was = seen.get(key); arts[was.index] = null; report[was.row].status = 'refused'; report[was.row].reasons = [`replaced by the later entry of ${checked.entry.image}`]; }
    seen.set(key, { index: arts.length, row: report.length });
    arts.push({ entry: checked.entry, png: bytes, image, width: image.width, height: image.height });
    report.push({ entry: label, status: checked.warnings.length ? 'warning' : 'ok', reasons: checked.warnings });
  }
  const { name, author, licence, source } = m.manifest;
  return { pack: { name, author, licence, manifest: m.manifest, source }, reason: null, warnings, report, arts: arts.filter(Boolean) };
}
