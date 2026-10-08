// The player's artwork packs kept in this browser (Stage 4: docs/artpacks.md), in the page's database (store.js: the stores 'packs' and 'art',
// both keyed by id), apart from the game files and the settings. The pictures are kept as the PNG files the pack brought (never decoded pixels,
// which would take several times the room); the race decodes them when it needs them (art.js).
// - packs: { id, name, author, licence, manifest (the pack.json as imported, its entries left out), source, enabled, order, saved }.
// - art: { id: `${pack}|${kind}|${member}|${offset}|${width}x${height}|${slot}`, pack, kind, member, memberCrc, meta (the entry as pack-format.js
//   normalized it against the archive and its picture), png (a Blob or the PNG's bytes), width, height (the picture's), saved }.
// A pack and its art are saved and removed in one transaction each, so the store never holds a pack without its pictures. A browser that
// keeps nothing, refuses, or whose database another tab of the page holds at an older version gives no packs to the loaders (as the relief
// maps' loader does) and its reason to the writers: a full quota says so.
import { withStore, withStores } from './store.js';
import { normalizeArtEntry, expectedSize, KINDS } from './pack-format.js';

const whole = (v, min = 0) => Number.isInteger(v) && v >= min;
// The id of an entry's art in a pack.
export const artId = (pack, e) => `${pack}|${e.kind}|${e.member}|${e.offset ?? ''}|${e.width ?? ''}x${e.height ?? ''}|${e.slot ?? ''}`;

// A pack's record from anything stored: null when it is not one this page made.
export function normalizePackRecord(r) {
  if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !r.id || typeof r.name !== 'string' || !r.name.trim() || typeof r.licence !== 'string' || !r.licence.trim()) return null;
  if (typeof r.author !== 'string' || typeof r.enabled !== 'boolean' || !whole(r.order) || !Number.isFinite(r.saved)) return null;
  const source = r.source && whole(r.source.size, 1) && whole(r.source.crc32) ? { size: r.source.size, crc32: r.source.crc32 } : null;
  return { id: r.id, name: r.name, author: r.author, licence: r.licence, manifest: r.manifest && typeof r.manifest === 'object' ? r.manifest : {}, source, enabled: r.enabled, order: r.order, saved: r.saved };
}

const isPng = v => (typeof Blob !== 'undefined' && v instanceof Blob ? v.size > 0 : v instanceof Uint8Array && v.length > 0);
// An art record from anything stored: null when it is not one this page made (its entry must still be a valid entry, of its own kind,
// member, CRC and id, and its picture's size the entry's).
export function normalizeArtRecord(r) {
  if (!r || typeof r !== 'object' || typeof r.id !== 'string' || typeof r.pack !== 'string' || !r.pack || !KINDS.includes(r.kind) || typeof r.member !== 'string' || !whole(r.memberCrc)) return null;
  if (!isPng(r.png) || !whole(r.width, 1) || !whole(r.height, 1) || !Number.isFinite(r.saved)) return null;
  const { entry } = normalizeArtEntry(r.meta);
  if (!entry || entry.kind !== r.kind || entry.member !== r.member || entry.memberCrc !== r.memberCrc || artId(r.pack, entry) !== r.id) return null;
  const size = expectedSize(entry);
  if (!size || size.width !== r.width || size.height !== r.height) return null;
  return { id: r.id, pack: r.pack, kind: r.kind, member: r.member, memberCrc: r.memberCrc, meta: entry, png: r.png, width: r.width, height: r.height, saved: r.saved };
}

// The reason a write failed, for the garage.
function why(error) {
  const name = error?.name ?? '', text = error?.message ?? String(error);
  if (name === 'QuotaExceededError' || /quota/i.test(text)) return `the browser's storage for this page is full (${name || text}): remove a pack, or free space for the site in the browser's settings`;
  return text || 'the browser did not keep it';
}

// Every pack kept, in their order ([] when the browser keeps nothing, refuses, or another tab blocks the database's upgrade).
export async function loadPacks() {
  try { return ((await withStore('packs', 'readonly', store => store.getAll())) ?? []).map(normalizePackRecord).filter(Boolean).sort((a, b) => a.order - b.order); } catch { return []; }
}
// The art of the packs `ids` (all packs' when null), [] when the browser gives none.
export async function loadArt(ids = null) {
  try { const want = ids ? new Set(ids) : null; return ((await withStore('art', 'readonly', store => store.getAll())) ?? []).map(normalizeArtRecord).filter(r => r && (!want || want.has(r.pack))); } catch { return []; }
}
// The art of the enabled packs, in the packs' order (a later pack's art wins its keys in the race: art.js), with the packs.
export async function enabledArt() {
  const packs = (await loadPacks()).filter(p => p.enabled);
  if (!packs.length) return { packs, art: [] };
  const art = await loadArt(packs.map(p => p.id)), rank = new Map(packs.map((p, i) => [p.id, i]));
  return { packs, art: art.sort((a, b) => rank.get(a.pack) - rank.get(b.pack)) };
}

// Keeps a pack and its art in one transaction: `pack` { name, author, licence, manifest, source }, `arts` [{ entry (normalized), png, width,
// height }]. It is enabled and goes last in the order. { ok, id, reason }.
export async function savePack(pack, arts) {
  const saved = Date.now(), id = `pack-${saved.toString(36)}-${(globalThis.crypto?.randomUUID?.() ?? String(performance.now())).replace(/[^0-9a-z]/gi, '').slice(0, 8)}`; // @math a short random tail
  const order = (await loadPacks()).reduce((n, p) => Math.max(n, p.order + 1), 0);
  const { entries, ...manifest } = pack.manifest ?? {}; // the entries live in the art records
  const record = normalizePackRecord({ id, name: pack.name, author: pack.author ?? '', licence: pack.licence, manifest, source: pack.source ?? null, enabled: true, order, saved });
  if (!record) return { ok: false, id: null, reason: 'the pack has no name or licence' };
  const records = arts.map(a => normalizeArtRecord({ id: artId(id, a.entry), pack: id, kind: a.entry.kind, member: a.entry.member, memberCrc: a.entry.memberCrc, meta: a.entry, png: a.png, width: a.width, height: a.height, saved }));
  if (records.some(r => !r)) return { ok: false, id: null, reason: 'an entry of the pack could not be kept as it was checked' };
  try { await withStores(['packs', 'art'], 'readwrite', s => { s.packs.put(record); for (const r of records) s.art.put(r); }); return { ok: true, id, reason: null }; } catch (error) { return { ok: false, id: null, reason: why(error) }; }
}

// A pack switched on or off.
export async function setEnabled(id, enabled) {
  const pack = (await loadPacks()).find(p => p.id === id);
  if (!pack) return { ok: false, reason: 'no such pack' };
  try { await withStore('packs', 'readwrite', store => store.put({ ...pack, enabled: Boolean(enabled) })); return { ok: true, reason: null }; } catch (error) { return { ok: false, reason: why(error) }; }
}
// The packs in the order of `ids` (the ids not named keep their place after them).
export async function setOrder(ids) {
  const packs = await loadPacks(), rank = new Map(ids.map((id, i) => [id, i]));
  const sorted = packs.slice().sort((a, b) => (rank.get(a.id) ?? ids.length + a.order) - (rank.get(b.id) ?? ids.length + b.order));
  try { await withStore('packs', 'readwrite', store => { sorted.forEach((p, order) => store.put({ ...p, order })); }); return { ok: true, reason: null }; } catch (error) { return { ok: false, reason: why(error) }; }
}
// A pack and its art removed, in one transaction.
export async function removePack(id) {
  let ids;
  try { ids = ((await withStore('art', 'readonly', store => store.getAll())) ?? []).filter(r => r?.pack === id).map(r => r.id); } catch (error) { return { ok: false, reason: why(error) }; } // every record of the pack, a damaged one too
  try { await withStores(['packs', 'art'], 'readwrite', s => { s.packs.delete(id); for (const a of ids) s.art.delete(a); }); return { ok: true, reason: null }; } catch (error) { return { ok: false, reason: why(error) }; }
}
