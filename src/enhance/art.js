// The artwork packs in the race world (Stage 4: docs/artpacks.md, docs/enhancements.md, Stage 4 as built): the player's decoded pictures and the
// lookups the enhancer draws them by. A pack entry replaces art of the archive by key: a tile sheet by its member, a sky by the .GAM's sky, a
// strip by its N.PAR, a picture by where its bytes lie in the archive (the race's pictures are views of their member: the frame k of an entry is
// the w x h bytes at offset + k stride), so the GENEF.SP pieces at byte offsets no frame grid reaches (the lion at 4449, the explosions at 7641)
// are reached too. Several packs may be on: the later one in the order wins a key, and anything no pack has is the archive's.
// - toArt(entry, image): an entry (pack-format.js) with its decoded picture (png.js) as the enhancer draws it: indexed pictures keep their
//   indices (the palette cycle, the fade, the strip's sky indices and every effect then work as for the archive), RGBA pictures their bytes.
// - createArtCache(limit): the decoded pictures kept across races, the least recently used let go past `limit` bytes.
// - createArtProvider(archive): set(arts) (in their order: a later one wins), tiles(member), sky(member), strip(member), frame(bytes) ({ art,
//   k } or null), angles(slot) (the kart angle sets: M4), forWorld(world), active(world) (whether any entry may apply to the world's draw),
//   load(records, cache, wanted) (decodes the store's records, art-store.js, and sets them unless a newer load or set has begun), `size`,
//   `ready`, and `hits` (the lookups that found art, by kind: the checks count them).
// - tileHook(world, provider, L): the floor caster's tile hook (caster.js) for the world's tile sheets, or null where no sheet of it has art.
// - lumaOf(r, g, b): relief.js paletteLuma's expression for an RGBA colour, bit for bit as paletteLuma's Float32 for a colour of the palette.
import { ART } from './config.js';
import { models } from './models.js';
import { decodePng } from './png.js';
import { frameCell } from './pack-format.js';
import { archiveMembers } from '../game/track-data.js';
import { decodePcxMember } from '../formats/pcx.js';
import { LAYOUT } from '../game/versus-rules.js';

// An entry and its decoded picture as drawn: { entry, kind, p, width, height, ix (indices or null), clear (indexed: a flag a palette index whose
// alpha is 0, 'sky here' or 'the archive's'; frames: index 0 too), rgba (4 bytes a pixel or null), px (rgba's 32-bit words), bytes (memory) }.
export function toArt(entry, image) {
  const indexed = entry.color === 'indexed', n = image.width * image.height;
  if (indexed && !image.indices) throw new Error(`${entry.image}: an indexed entry is a palette PNG`);
  let clear = null;
  if (indexed) { clear = new Uint8Array(256); if (image.alpha) for (let v = 0; v < clear.length; v++) clear[v] = image.alpha[v] === 0 ? 1 : 0; if (entry.kind === 'frames' || entry.kind === 'angles') clear[0] = 1; } // @math a flag for each palette index
  const rgba = indexed ? null : new Uint8Array(image.rgba.buffer, image.rgba.byteOffset, n * 4); // @math four bytes a colour
  const px = rgba && rgba.byteOffset % 4 === 0 ? new Uint32Array(rgba.buffer, rgba.byteOffset, n) : rgba ? new Uint32Array(Uint8Array.from(rgba).buffer) : null; // @math four bytes a word
  return { entry, kind: entry.kind, p: entry.scale, width: image.width, height: image.height, ix: indexed ? image.indices : null, clear, rgba: px ? new Uint8Array(px.buffer, px.byteOffset, n * 4) : null, px, bytes: indexed ? n : n * 4 }; // @math four bytes a colour
}

// An entry's art from its PNG (a Blob, an ArrayBuffer or bytes).
export async function decodeArt(entry, png) {
  const bytes = png instanceof Uint8Array ? png : new Uint8Array(png instanceof ArrayBuffer ? png : await png.arrayBuffer());
  return toArt(entry, await decodePng(bytes));
}

export function createArtCache(limit = ART.cacheBytes) {
  const kept = new Map();
  let bytes = 0;
  return {
    get(id) { const a = kept.get(id); if (a) { kept.delete(id); kept.set(id, a); } return a ?? null; },
    put(id, art) {
      if (kept.has(id)) { bytes -= kept.get(id).bytes; kept.delete(id); }
      kept.set(id, art); bytes += art.bytes;
      for (const [k, a] of kept) { if (bytes <= limit || k === id) break; kept.delete(k); bytes -= a.bytes; } // the least recently used first
      return art;
    },
    get bytes() { return bytes; },
    get size() { return kept.size; },
  };
}

// relief.js paletteLuma's expression for 8-bit components (the palette's 6 bits widened to 8 are such components), as a Float32.
export const lumaOf = (r, g, b) => Math.fround(0.299 * (r / 0xff) + 0.587 * (g / 0xff) + 0.114 * (b / 0xff)); // @math the Rec. 601 luma weights; 8 bits to 0 to 1

export function createArtProvider(archive) {
  let arts = [], tiles = new Map(), skies = new Map(), strips = new Map(), frames = new Map(), from = null, ready = false, loads = 0; // `loads` counts the loads and sets begun: only the newest one applies its list
  const worlds = new WeakMap(), hits = { tiles: 0, sky: 0, strip: 0, frames: 0 };
  // The frames' keys by the archive the race draws from: the byte offset in the archive of each frame of each entry.
  const frameKeys = () => {
    const dat = archive?.();
    if (from === dat) return;
    from = dat; frames = new Map();
    if (!dat) return;
    const members = archiveMembers(dat);
    for (const art of arts) {
      const e = art.entry;
      if (e.kind !== 'frames') continue;
      const data = members.get(e.member);
      if (!data) continue;
      for (let k = 0; k < e.count; k++) frames.set(data.byteOffset + e.offset + k * e.stride, { art, k, length: e.width * e.height });
    }
  };
  // The arts in their order (a later one wins its keys).
  const apply = list => {
    arts = list.filter(Boolean); tiles = new Map(); skies = new Map(); strips = new Map(); from = undefined; ready = true;
    for (const art of arts) {
      const e = art.entry;
      if (e.kind === 'tiles') tiles.set(e.member, art);
      else if (e.kind === 'sky') skies.set(e.member, art);
      else if (e.kind === 'strip') for (const m of e.members) strips.set(m, art);
    }
    frameKeys();
  };
  const provider = {
    // The arts in their order (a later one wins its keys); a load still running then sets nothing.
    set(list) { loads++; apply(list); return provider; },
    get size() { return arts.length; },
    get ready() { return ready; },
    hits,
    tiles: member => tiles.get(String(member).toUpperCase()) ?? null,
    sky: member => skies.get(String(member).toUpperCase()) ?? null,
    strip: member => strips.get(String(member).toUpperCase()) ?? null,
    // The art of a picture the race draws, by its bytes (a view of the archive): { art, k } or null.
    frame(bytes) {
      if (!arts.length || !bytes) return null;
      frameKeys();
      if (!from || bytes.buffer !== from.buffer) return null;
      const hit = frames.get(bytes.byteOffset);
      return hit && hit.length === bytes.length ? hit : null;
    },
    angles: () => null, // the kart angle sets come with M4
    // The art of a world's own members: its two tile sheets' (in the world's sheet order), its sky's and its strip's, and `stripSky` the
    // indices of the track's own sky picture (its .GAM's, the picture a strip is drawn against; a split screen's world draws another picture,
    // the strips' background, behind its strips): a pack strip's 'sky here' takes its sky indices and its pixels.
    forWorld(world) {
      const known = worlds.get(world);
      if (known?.arts === arts) return known;
      const F = models().floor, names = world.gam?.tilesets?.map(n => `${F.gamPrefix}${n}`.toUpperCase()) ?? [], strip = provider.strip(`${world.name}.PAR`);
      let stripSky = world.sky;
      if (strip && world.gam) { const own = (from ? archiveMembers(from) : archive?.() ? archiveMembers(archive()) : null)?.get(String(world.gam.sky).toUpperCase()); if (own) { try { stripSky = decodePcxMember(own).indices; } catch { stripSky = world.sky; } } }
      const out = { arts, tiles: names.map(n => provider.tiles(n)), sky: world.gam ? provider.sky(world.gam.sky) : null, strip, stripSky };
      out.any = out.tiles.some(Boolean) || Boolean(out.sky) || Boolean(out.strip);
      worlds.set(world, out);
      return out;
    },
    // Whether the art may change a frame of the world: an entry of its own members, or any picture's.
    active: world => arts.length > 0 && (provider.forWorld(world).any || arts.some(a => a.entry.kind === 'frames')),
    // The store's records (art-store.js: { id, meta (the entry), png, saved }) decoded, through `cache` when given, and set in their order;
    // `wanted(entry)` (wantedFor) leaves out the entries a race does not draw (they are decoded when a race needs them). Loads may overlap (a
    // race started while the last one's pictures are still being decoded): only the newest load or set applies its list, an older load stops
    // decoding once a newer one has begun and sets nothing, so a slow load of another track's pictures never replaces the newer list. Gives
    // true when this load's list was set, false when a newer load or set took its place.
    async load(records, cache = null, wanted = null) {
      const mine = ++loads, out = [];
      for (const r of records) {
        if (wanted && !wanted(r.meta)) continue;
        const id = `${r.id}|${r.saved}`;
        let art = cache?.get(id) ?? null;
        if (!art) { try { art = await decodeArt(r.meta, r.png); } catch { art = null; } if (art && cache) cache.put(id, art); }
        if (mine !== loads) return false;
        if (art) out.push(art);
      }
      if (mine !== loads) return false;
      apply(out);
      return true;
    },
  };
  return provider;
}

// The entries a world's race may draw: every picture (the karts, the objects, the effects are every track's), and the world's own tile sheets,
// sky (the split screen's background picture too) and strip.
export function wantedFor(world) {
  const F = models().floor, sheets = new Set(world.gam?.tilesets?.map(n => `${F.gamPrefix}${n}`.toUpperCase()) ?? []), skies = new Set([String(world.gam?.sky ?? '').toUpperCase(), String(LAYOUT().background).toUpperCase()]), par = `${world.name}.PAR`.toUpperCase();
  return e => e.kind === 'frames' || e.kind === 'angles' || (e.kind === 'tiles' && sheets.has(e.member)) || (e.kind === 'sky' && skies.has(e.member)) || (e.kind === 'strip' && e.members.includes(par));
}

// The floor caster's tile hook for a world (caster.js castFloor's `tile`): the pack pixel of the texel the caster reads, at the sample's place
// inside it (nearest: the texel's p x p pack pixels, the one under the sample), into the indexed floor (an indexed pack: its index) or into
// the art layers `A` (an RGBA pack: its colour with L.direct, the archive's texel kept in the index and in `beneath` for partial alpha; alpha 0
// keeps the archive's texel, which cycles on the beach tracks). Null where none of the world's sheets has art.
export function tileHook(world, provider, A) {
  const sheets = provider.forWorld(world).tiles;
  if (!sheets.some(Boolean)) return null;
  const F = models().floor, S = F.sheetSize, cols = F.sheetColumns, ids = world.sin?.length ?? sheets.length * F.sheetCount, mask = F.tileMask, shift = F.tileShift;
  // Per tile id: its sheet's art and the pack pixel of the tile's top left (-1 where its sheet has none).
  const artOf = new Array(ids).fill(null), base = new Int32Array(ids).fill(-1);
  for (let id = 0; id < ids; id++) { const art = sheets[Math.floor(id / F.sheetCount)]; if (!art) continue; const k = id % F.sheetCount; artOf[id] = art; base[id] = Math.floor(k / cols) * S * art.p * art.width + (k % cols) * S * art.p; }
  provider.hits.tiles++; // a frame's floor drawn with tile art (the checks count frames, not pixels)
  return (id, texel, fu, fv, o, pixel) => {
    const b = base[id];
    if (b < 0) return -1;
    const art = artOf[id], p = art.p, i = p === 1 ? b + (texel >> shift) * art.width + (texel & mask) : b + ((texel >> shift) * p + Math.floor(fv * p)) * art.width + (texel & mask) * p + Math.floor(fu * p);
    if (art.ix !== null) { const v = art.ix[i]; return art.clear[v] ? -1 : v; }
    if (art.rgba[i * 4 + 3] === 0) return -1; // @math four bytes a colour, the alpha last
    A.px[o] = art.px[i]; A.direct[o] = 1; A.beneath[o] = pixel;
    return -1;
  };
}

// The art layers beside an indexed picture of n pixels while art is drawn: the RGBA colour of a pixel of RGBA art (px, its bytes `rgba`),
// whether it is one (direct), the index under it (beneath: partial alpha blends over its colour) and the strip's sky flag of every strip pixel
// (through: the archive's sky indices', or a strip pack's 'sky here').
// `strip` says whether the frame's strip set `through` (a pack strip drawn): without one compositeAt reads the strip's per-index flags as always.
export function createArtLayers(n) {
  const px = new Uint32Array(n);
  return { px, rgba: new Uint8Array(px.buffer), direct: new Uint8Array(n), beneath: new Uint8Array(n), through: new Uint8Array(n), strip: false };
}

// The pack pixel of an art's frame k at the place (u, v) of the picture's logical box (in the archive's pixels, fractions allowed; outside
// 0..w and 0..h is the cell around the box): its index in the picture, or -1 outside the cell.
export function framePixel(art, k, u, v) {
  const e = art.entry, p = art.p, c = frameCell(e, k), x = Math.floor(u * p) + e.box[0], y = Math.floor(v * p) + e.box[1];
  if (x < 0 || y < 0 || x >= e.cell[0] || y >= e.cell[1]) return -1;
  return (c.y + y) * art.width + c.x + x;
}
