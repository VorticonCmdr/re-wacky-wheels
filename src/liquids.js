// Shared presentation-only liquid classification for the classic and 3D renderers.
import { tileSurfaces, specialSurfaces } from './game/surface.js';
import { floorModel } from './render/floor.js';

export const LIQUID = { none: 0, water: 1, red: 2 }; // @math the kinds of a texel

// The liquids of a world: { texels, kinds, any }. `texels` holds per tile id and texel (id x tile bytes + the texel's offset in the tile)
// the kind of liquid there; `kinds` maps the liquid surface values to their kind. A liquid is water unless its mean colour on the track is
// redder than blue; a surface the game does not treat specially is drawn as a liquid whose mean colour lies within similar of its own.
// A track whose map has no sinking surface has none (`any` false, no table).
const liquidCache = new WeakMap();
export function classifyLiquids(world, similar = 40) {
  let out = liquidCache.get(world.tiles)?.get(similar);
  if (out) return out;
  const F = floorModel(), special = specialSurfaces(), ids = world.sin.length, uses = new Uint32Array(ids), sinking = [special.stopped, ...special.pit];
  for (const id of world.tiles) uses[id]++;
  const pairs = tileSurfaces(world);
  if (!pairs.some(([zero, one], id) => uses[id] && (sinking.includes(zero) || sinking.includes(one)))) { out = { texels: new Uint8Array(0), kinds: new Map(), any: false }; if(!liquidCache.has(world.tiles))liquidCache.set(world.tiles,new Map()); liquidCache.get(world.tiles).set(similar,out); return out; }
  const rgb = Uint8Array.from(world.palette, v => (v << 2) | (v >> 4)), sums = new Map(); // @math 6 bits widened to 8 by repeating the top bits
  const add = (v, s, n) => { if (!s[3]) return; const t = sums.get(v) ?? [0, 0, 0, 0]; for (let k = 0; k < 4; k++) t[k] += s[k] * n; sums.set(v, t); }; // @math three components and the count
  for (let id = 0; id < ids; id++) { // the colours of each used tile's texels, by its two surfaces, weighted by how often the map uses it
    if (!uses[id]) continue;
    const sheet = world.sheets[Math.floor(id / F.sheetCount)], mask = world.maskSheets[Math.floor(id / F.sheetCount)], base = (id % F.sheetCount) * F.tileBytes, zero = [0, 0, 0, 0], one = [0, 0, 0, 0]; // @math three components and the count
    for (let t = base; t < base + F.tileBytes; t++) { const p = sheet[t] * 3, s = mask[t] === 0 ? zero : one; s[0] += rgb[p]; s[1] += rgb[p + 1]; s[2] += rgb[p + 2]; s[3]++; } // @math three components a colour
    add(pairs[id][0], zero, uses[id]); add(pairs[id][1], one, uses[id]);
  }
  const mean = v => { const s = sums.get(v); return s && s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : null; }; // @math three components over the count
  const kinds = new Map();
  for (const v of sinking) { const m = mean(v); kinds.set(v, m && m[0] > m[2] ? LIQUID.red : LIQUID.water); } // @math red against blue
  const never = new Set([special.boost, special.wall, special.fall, ...sinking]);
  for (const v of sums.keys()) {
    if (never.has(v)) continue;
    const m = mean(v);
    for (const w of sinking) { const n = mean(w); if (n && Math.hypot(m[0] - n[0], m[1] - n[1], m[2] - n[2]) < similar) { kinds.set(v, kinds.get(w)); break; } } // @math the three components' distance
  }
  const texels = new Uint8Array(ids * F.tileBytes);
  let any = false;
  for (let id = 0; id < ids; id++) {
    const zero = kinds.get(pairs[id][0]) ?? LIQUID.none, one = kinds.get(pairs[id][1]) ?? LIQUID.none;
    if (!zero && !one) continue;
    const mask = world.maskSheets[Math.floor(id / F.sheetCount)], base = (id % F.sheetCount) * F.tileBytes;
    for (let t = 0; t < F.tileBytes; t++) { const k = mask[base + t] === 0 ? zero : one; texels[id * F.tileBytes + t] = k; if (k && uses[id]) any = true; }
  }
  out = { texels, kinds, any };
  if(!liquidCache.has(world.tiles))liquidCache.set(world.tiles,new Map()); liquidCache.get(world.tiles).set(similar,out);
  return out;
}
