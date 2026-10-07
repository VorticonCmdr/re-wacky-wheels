// The player's own relief maps (docs/enhancements.md, the relief): height maps made for tile sheets and sprite sheets and imported in the
// asset garage, kept in this browser (IndexedDB) apart from the game files and the settings. A record is { member (the archive member's
// name, upper case), kind: 'tiles' | 'sprites', heights (Uint8Array, 0 to 255 a pixel), saved (ms since 1970) } and, for a sprite sheet,
// { width, height, offset, columnMajor, frames }: the frames' heights one after the other, each in the order of the frame's own bytes.
// - tiles: the sheet's tiles (RELIEF's tile order, as the floor reads them), a tile's texels row by row.
// - sprites: frame k's height of byte i at k x width x height + i; the frames start at `offset` bytes into the member.
// The records live in the page's database (store.js, the store 'relief', keyed by the member), which every part of the page opens through store.js.
import { archiveMembers } from '../game/track-data.js';
import { models } from './models.js';
import { withStore } from './store.js';

const STORE = 'relief';
const run = (mode, work) => withStore(STORE, mode, work);

// A record from anything stored: null when it is not one this page made.
export function normalizeRecord(r) {
  if (!r || typeof r.member !== 'string' || !(r.heights instanceof Uint8Array) || !['tiles', 'sprites'].includes(r.kind)) return null;
  const member = r.member.toUpperCase(), saved = Number.isFinite(r.saved) ? r.saved : 0;
  if (r.kind === 'tiles') { const F = models().floor; return r.heights.length === F.sheetCount * F.tileBytes ? { member, kind: 'tiles', heights: r.heights, saved } : null; } // every texel of the sheet's tiles
  const whole = n => Number.isInteger(n) && n >= 0;
  if (![r.width, r.height, r.offset, r.frames].every(whole) || !r.width || !r.height || !r.frames || r.heights.length !== r.frames * r.width * r.height) return null;
  return { member, kind: 'sprites', heights: r.heights, saved, width: r.width, height: r.height, offset: r.offset, frames: r.frames, columnMajor: Boolean(r.columnMajor) };
}

// Every kept record ([] when the browser keeps nothing, refuses, or another tab of the page blocks the database's upgrade).
export async function loadReliefMaps() {
  try { return ((await run('readonly', store => store.getAll())) ?? []).map(normalizeRecord).filter(Boolean); } catch { return []; }
}
export async function saveReliefMap(record) {
  const r = normalizeRecord(record);
  if (!r) return false;
  try { await run('readwrite', store => store.put(r)); return true; } catch { return false; }
}
export async function removeReliefMap(member) {
  try { await run('readwrite', store => store.delete(String(member).toUpperCase())); return true; } catch { return false; }
}

// The maps as the enhancer reads them (createEnhancer's `relief`): tiles(member) gives a tile sheet's { id, heights } or null, frame(bytes)
// a sprite frame's height by the index of its byte (0 to 255) or null. A frame is found by where its bytes lie in the archive (`archive()`
// gives the archive's bytes the race was loaded from): the race's frames are views of their member, column-major, wholly inside it (a map
// made for another layout or with more frames than the member holds is never applied to bytes it was not made for). `set(records)` replaces
// the maps.
export function createReliefProvider(archive) {
  let tiles = new Map(), sprites = [], frames = new Map(), from = null;
  const provider = {
    set(records) {
      tiles = new Map(); sprites = []; frames = new Map(); from = null;
      for (const r of records.map(normalizeRecord).filter(Boolean)) {
        if (r.kind === 'tiles') tiles.set(r.member, { id: `${r.member}:${r.saved}`, heights: r.heights });
        else sprites.push(r);
      }
      return provider;
    },
    get size() { return tiles.size + sprites.length; },
    tiles: member => tiles.get(String(member).toUpperCase()) ?? null,
    frame(bytes) {
      if (!sprites.length || !bytes) return null;
      const dat = archive?.();
      if (!dat || bytes.buffer !== dat.buffer) return null;
      if (from !== dat) { frames = new Map(); from = dat; }
      const key = bytes.byteOffset;
      if (frames.has(key)) return frames.get(key);
      let found = null;
      const members = archiveMembers(dat);
      for (const r of sprites) {
        const data = members.get(r.member), size = r.width * r.height;
        if (!data || !r.columnMajor || bytes.length !== size) continue;
        const at = bytes.byteOffset - (data.byteOffset + r.offset);
        if (at < 0 || at % size !== 0 || at / size >= r.frames || r.offset + at + size > data.length) continue;
        const base = at;
        found = i => (i >= 0 && i < size ? r.heights[base + i] : null);
        break;
      }
      frames.set(key, found);
      return found;
    },
  };
  return provider;
}
