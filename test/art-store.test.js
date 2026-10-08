// The artwork packs kept in this browser (src/enhance/art-store.js, on the page's database, store.js) and their import (src/enhance/pack-format.js
// readPack): the records' strictness (as relief-store.js's), a pack and its art saved and removed in one transaction each, the order and the
// switches, a full quota keeping nothing and saying so; and each reason an import refuses an entry or a pack for. Runs on a minimal IndexedDB
// of the test's own (no browser) with transactions over several stores that keep nothing when they abort, and on synthetic packs only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeArtRecord, normalizePackRecord, artId, savePack, loadPacks, loadArt, enabledArt, setEnabled, setOrder, removePack } from '../src/enhance/art-store.js';
import { normalizeArtEntry, readPack } from '../src/enhance/pack-format.js';
import { encodePng } from '../src/enhance/png.js';
import { writeZip, readZip } from '../src/zip.js';
import { ART } from '../src/enhance/config.js';
import { crc32 } from '../src/evidence/crc32.js';

// A minimal IndexedDB: one database at the version asked for (an upgrade creates its stores), transactions over several stores whose writes are
// staged and kept when the transaction completes (on a later turn), or dropped with the transaction's error when a write passes `quota` bytes
// of PNG kept (the browser's QuotaExceededError). `requestError` reports the failure as a browser may: an error event of the failed request,
// which reaches the transaction while its own error is still null, before the abort.
function fakeIndexedDB({ quota = Infinity, requestError = false } = {}) {
  const db = { version: 0, stores: new Map() };
  const size = r => (r?.png instanceof Blob ? r.png.size : r?.png?.length ?? 0);
  const kept = () => [...db.stores.values()].reduce((n, s) => n + [...s.records.values()].reduce((m, r) => m + size(r), 0), 0);
  return {
    open(name, version) {
      const request = { result: null, error: null };
      setTimeout(() => {
        const conn = {
          objectStoreNames: { contains: n => db.stores.has(n) }, close() {}, onversionchange: null,
          createObjectStore(n, { keyPath }) { db.stores.set(n, { keyPath, records: new Map() }); },
          transaction(names, mode) {
            const list = [].concat(names), staged = new Map(list.map(n => [n, new Map(db.stores.get(n).records)])), tx = { oncomplete: null, onerror: null, onabort: null, error: null };
            let failed = null;
            tx.objectStore = n => ({
              getAll: () => ({ result: [...staged.get(n).values()].map(r => structuredClone(r)) }),
              put: r => { if (mode !== 'readwrite') throw new Error('ReadOnlyError'); staged.get(n).set(r[db.stores.get(n).keyPath], structuredClone(r)); return { result: r.id }; },
              delete: k => { if (mode !== 'readwrite') throw new Error('ReadOnlyError'); staged.get(n).delete(k); return { result: undefined }; },
            });
            tx.abort = () => { failed = new Error('AbortError'); };
            setTimeout(() => {
              if (!failed) { const before = kept(), after = before - list.reduce((n, s) => n + [...db.stores.get(s).records.values()].reduce((m, r) => m + size(r), 0), 0) + list.reduce((n, s) => n + [...staged.get(s).values()].reduce((m, r) => m + size(r), 0), 0); if (after > quota) failed = Object.assign(new Error('the quota is exceeded'), { name: 'QuotaExceededError' }); }
              if (failed) { if (requestError) tx.onerror?.({ target: { error: failed } }); tx.error = failed; tx.onabort?.(); return; } // a request's error event first (the transaction's error still null), then the abort
              for (const n of list) db.stores.get(n).records = staged.get(n);
              tx.oncomplete?.();
            });
            return tx;
          },
        };
        request.result = conn;
        if (version > db.version) { db.version = version; request.onupgradeneeded?.(); }
        request.onsuccess?.();
      });
      return request;
    },
  };
}
const withDB = async (options, fn) => { const keep = globalThis.indexedDB; globalThis.indexedDB = fakeIndexedDB(options); try { await fn(); } finally { globalThis.indexedDB = keep; } };

const entry = (member = 'A_F1.PCX', o = {}) => normalizeArtEntry({ kind: 'tiles', member, memberCrc: 'deadbeef', image: `tiles/${member}.png`, scale: 1, color: 'rgba', ...o }).entry;
const png = (bytes = 10) => new Blob([new Uint8Array(bytes).fill(1)], { type: 'image/png' });
const art = (member, bytes) => ({ entry: entry(member), png: png(bytes), width: 320, height: 200 }); // @math the sheet's size at p = 1
const pack = name => ({ name, author: 'me', licence: 'CC BY 4.0', manifest: { format: 'wackywheels-artpack', version: 1, name, entries: [{}] }, source: null });

test('the records: an art record as strict as the relief maps\' (its entry valid, of its own kind, member, CRC, id and picture size), a pack record', () => {
  const e = entry(), good = { id: artId('p1', e), pack: 'p1', kind: 'tiles', member: 'A_F1.PCX', memberCrc: 0xdeadbeef, meta: e, png: png(), width: 320, height: 200, saved: 1 }; // @math the CRC; the sheet's size
  assert.deepEqual(normalizeArtRecord(good), good);
  assert.equal(normalizeArtRecord({ ...good, png: new Uint8Array([1, 2]) }).png.length, 2, 'the PNG\'s bytes are kept too'); // @math two bytes
  for (const bad of [{ id: 'x' }, { pack: '' }, { kind: 'sky' }, { member: 'A_F2.PCX' }, { memberCrc: 1 }, { png: new Blob([]) }, { png: 'png' }, { width: 319 }, { height: 0 }, { saved: NaN }, { meta: { ...e, scale: 0 } }, { meta: null }]) // @math a width off by one
    assert.equal(normalizeArtRecord({ ...good, ...bad }), null, JSON.stringify(Object.keys(bad)));
  const p = { id: 'p1', name: 'Karts', author: '', licence: 'CC0', manifest: {}, source: null, enabled: true, order: 0, saved: 5 }; // @math a time
  assert.deepEqual(normalizePackRecord(p), p);
  for (const bad of [{ id: '' }, { name: ' ' }, { licence: '' }, { enabled: 1 }, { order: -1 }, { saved: 'now' }]) assert.equal(normalizePackRecord({ ...p, ...bad }), null, JSON.stringify(bad));
});

test('a pack and its art saved in one transaction, the order and the switches, removed in one transaction', async () => {
  await withDB({}, async () => {
    assert.deepEqual(await loadPacks(), []);
    const a = await savePack(pack('First'), [art('A_F1.PCX', 30), art('A_F2.PCX', 20)]), b = await savePack(pack('Second'), [art('A_F1.PCX', 5)]); // @math the PNGs' sizes
    assert.ok(a.ok && b.ok, `${a.reason} ${b.reason}`);
    let packs = await loadPacks();
    assert.deepEqual(packs.map(p => [p.name, p.order, p.enabled]), [['First', 0, true], ['Second', 1, true]]);
    assert.equal(packs[0].manifest.entries, undefined, 'the entries live in the art records');
    assert.equal((await loadArt()).length, 3); assert.equal((await loadArt([a.id])).length, 2); // @math three pictures, two of the first pack
    assert.deepEqual((await enabledArt()).art.map(r => r.pack), [a.id, a.id, b.id], 'in the packs\' order: a later pack\'s art wins in the race');
    await setOrder([b.id, a.id]);
    packs = await loadPacks(); assert.deepEqual(packs.map(p => p.name), ['Second', 'First']);
    assert.deepEqual((await enabledArt()).art.map(r => r.pack), [b.id, a.id, a.id]);
    await setEnabled(b.id, false);
    assert.deepEqual((await enabledArt()).packs.map(p => p.name), ['First']);
    assert.equal((await setEnabled('nope', true)).ok, false);
    assert.ok((await removePack(a.id)).ok);
    assert.deepEqual((await loadPacks()).map(p => p.name), ['Second']); assert.deepEqual((await loadArt()).map(r => r.pack), [b.id], 'its art went with it');
  });
});

test('a kart angle set (M4) kept and read back: its slot in the id, its directions, anchor and anchors in the record; two slots, two records', async () => {
  const set = (slot, o = {}) => normalizeArtEntry({ kind: 'angles', member: 'CARS.SP', memberCrc: 'deadbeef', image: `angles/CARS-slot${slot}-32.png`, scale: 1, color: 'rgba', slot, directions: 32, width: 38, height: 28, columns: 4, anchor: 27, anchors: Array.from({ length: 32 }, (_, k) => 24 + (k % 4)), ...o }).entry; // @math a set of 32, four a row (an octant a row); its ground rows
  await withDB({}, async () => {
    const r = await savePack(pack('Angles'), [{ entry: set(2), png: png(12), width: 4 * 38, height: 8 * 28 }, { entry: set(5), png: png(12), width: 4 * 38, height: 8 * 28 }]); // @math the sets' pictures: four cells by eight
    assert.ok(r.ok, r.reason);
    const kept = await loadArt();
    assert.deepEqual(kept.map(a => [a.id, a.kind, a.meta.slot, a.meta.directions, a.meta.anchor, a.meta.anchors.slice(0, 4)]), [[`${r.id}|angles|CARS.SP||38x28|2`, 'angles', 2, 32, 27, [24, 25, 26, 27]], [`${r.id}|angles|CARS.SP||38x28|5`, 'angles', 5, 32, 27, [24, 25, 26, 27]]]); // @math the slots; the first four ground rows
    assert.equal(normalizeArtRecord({ ...kept[0], width: 4 * 38 + 1 }), null, 'a picture of another size than the set\'s'); // @math a column more
    assert.equal(normalizeArtRecord({ ...kept[0], id: `${r.id}|angles|CARS.SP||38x28|3` }), null, 'an id of another slot'); // @math another slot
  });
});

test('a full quota keeps nothing of the pack and says so; a browser that keeps nothing gives no packs', async () => {
  await withDB({ quota: 40 }, async () => { // @math room for 40 bytes of PNG
    assert.ok((await savePack(pack('Small'), [art('A_F1.PCX', 30)])).ok); // @math within the quota
    const r = await savePack(pack('Big'), [art('A_F1.PCX', 5), art('A_F2.PCX', 10)]); // @math past it together
    assert.equal(r.ok, false); assert.match(r.reason, /storage for this page is full/);
    assert.deepEqual((await loadPacks()).map(p => p.name), ['Small'], 'neither the pack nor any of its art is kept');
    assert.equal((await loadArt()).length, 1);
  });
  await withDB({ quota: 40, requestError: true }, async () => { // @math the same room, the failure reported by the request's error event first
    const r = await savePack(pack('Big'), [art('A_F1.PCX', 50)]); // @math past it
    assert.equal(r.ok, false); assert.match(r.reason, /storage for this page is full \(QuotaExceededError\)/, 'the request\'s error, not the transaction\'s null');
    assert.deepEqual(await loadPacks(), []);
  });
  const keep = globalThis.indexedDB; delete globalThis.indexedDB;
  try { assert.deepEqual(await loadPacks(), []); assert.deepEqual(await loadArt(), []); assert.equal((await savePack(pack('X'), [art('A_F1.PCX', 1)])).ok, false); } finally { globalThis.indexedDB = keep; }
});

// ---- the import's refusals, on synthetic packs (pack.json and palette or RGBA PNGs in a zip) against an archive's facts (packContext's)
const cars = new Uint8Array(38 * 28 * 2).fill(7), sheetPal = Uint8Array.from({ length: 768 }, (_, i) => (i * 3) & 0xff); // @math two frames; a palette pattern
const ctx = {
  member: n => ({ 'CARS.SP': cars, 'A_F1.PCX': new Uint8Array(9), '1.PAR': new Uint8Array(4) })[n] ?? null, // @math stand-ins for the members' bytes
  crc: n => ({ 'CARS.SP': crc32(cars), 'A_F1.PCX': 0xdeadbeef, '1.PAR': 7 })[n] ?? null, picture: n => (n === 'A_F1.PCX' ? { width: 320, height: 200 } : null), palette: n => (n === 'A_F1.PCX' ? sheetPal : null), period: () => 640, // @math the CRCs; the sheet; the strips' period
  regions: { has: (m, offset, w, h) => m === 'CARS.SP' && w === 38 && h === 28 && offset % (38 * 28) === 0 && offset < cars.length }, car: { w: 38, h: 28 }, slots: 8, archive: { size: 1000, crc32: 1 }, // @math the cars' frames; eight slots; an archive
};
const rgbaPng = (w, h) => encodePng({ width: w, height: h, rgba: new Uint8ClampedArray(w * h * 4).fill(0xff) }); // @math four bytes a colour
async function zipOf(manifest, pictures) {
  const files = [{ name: 'pack.json', data: new TextEncoder().encode(JSON.stringify(manifest)) }];
  for (const [name, bytes] of Object.entries(pictures)) files.push({ name, data: await bytes });
  return readZip(writeZip(files));
}
const M = entries => ({ format: 'wackywheels-artpack', version: 1, name: 'Test', author: 'me', licence: 'mine to share', entries, source: { size: 999, crc32: '00000001' } });

test('an import: each entry refused with its reason, the others kept, the pack refused for an empty licence', async () => {
  const sheet = { kind: 'tiles', member: 'A_F1.PCX', memberCrc: 'deadbeef', scale: 1, color: 'rgba' }, f = { kind: 'frames', member: 'CARS.SP', memberCrc: crc32(cars), scale: 1, color: 'rgba', offset: 0, width: 38, height: 28, count: 2, columns: 2 }; // @math two frames side by side
  const palette = Uint8Array.from(sheetPal); palette[5 * 3] ^= 1; // @math entry 5's red, off by one
  const entries = [
    { ...sheet, image: 'ok.png' },
    { ...sheet, image: 'small.png' }, // a wrong image size
    { ...f, image: 'cars.png', count: 3 }, // a region outside the member
    { ...sheet, image: 'ok.png', memberCrc: 'deadbeee' }, // a CRC mismatch
    { kind: 'angles', member: 'CARS.SP', memberCrc: crc32(cars), image: 'a.png', scale: 1, color: 'rgba', slot: 0, directions: 12, width: 38, height: 28 }, // @math a bad N
    { kind: 'strip', members: ['1.PAR'], memberCrc: 7, image: 'strip.png', scale: 1, color: 'rgba', period: 1280 }, // @math a period that is not the validated one
    { ...sheet, image: 'indexed.png', color: 'indexed', palette: 'A_F1.PCX' }, // colours outside the palette
    { ...sheet, image: 'huge.png' }, // an oversize image
    { ...sheet, image: 'missing.png' }, // no such picture
    { ...f, image: 'cars.png' }, // kept
  ];
  const zip = await zipOf(M(entries), { 'ok.png': rgbaPng(320, 200), 'small.png': rgbaPng(318, 200), 'cars.png': rgbaPng(76, 28), 'a.png': rgbaPng(38, 28), 'strip.png': rgbaPng(1280, 20), 'huge.png': rgbaPng(ART.maxSide + 1, 1), // @math the sizes
    'indexed.png': encodePng({ width: 320, height: 200, indices: new Uint8Array(64000).fill(5), palette, alpha: null }) }); // @math every pixel index 5
  const r = await readPack(zip, ctx), why = r.report.map(x => [x.status, x.reasons.join(' ')]);
  assert.equal(r.reason, null); assert.match(r.warnings.join(' '), /another WACKY.DAT/);
  assert.deepEqual(why.map(w => w[0]), ['ok', 'refused', 'refused', 'refused', 'refused', 'refused', 'refused', 'refused', 'refused', 'ok']);
  for (const [k, re] of [[1, /image 318 x 200, expected 320 x 200/], [2, /past the end of CARS.SP/], [3, /made for another A_F1.PCX/], [4, /multiple of 8/], [5, /repeats every 640/], [6, /entry 5 is/], [7, /at most 16384 pixels a side/], [8, /no such picture/]]) assert.match(why[k][1], re, String(k)); // @math the rows of the report
  assert.deepEqual(r.arts.map(a => a.entry.kind), ['tiles', 'frames']);
  assert.match((await readPack(await zipOf({ ...M(entries), licence: ' ' }, {}), ctx)).reason, /no licence/);
  // Two entries of one key: the later is kept.
  const twice = await readPack(await zipOf(M([{ ...sheet, image: 'ok.png' }, { ...sheet, image: 'ok.png' }]), { 'ok.png': rgbaPng(320, 200) }), ctx); // @math the sheet's size
  assert.deepEqual(twice.report.map(x => x.status), ['refused', 'ok']); assert.equal(twice.arts.length, 1);
  // A pack whose pictures pass ART.maxPackPixels refuses the entries past it.
  const many = Math.floor(ART.maxPackPixels / 64000) + 1, big = await readPack(await zipOf(M(Array.from({ length: many }, () => ({ ...sheet, image: 'ok.png' }))), { 'ok.png': rgbaPng(320, 200) }), ctx); // @math one sheet more than the pack may hold
  assert.match(big.report.at(-1).reasons.join(' '), /would pass/);
});
