// The page's database (src/enhance/store.js, Stage 4): the one opener at version 2, the upgrade from version 1 that keeps the relief maps, a tab
// of an older version that blocks the upgrade, connections that give way to a newer version; and the relief store on top of it. Runs on a
// minimal IndexedDB of the test's own (no browser): events fire after the call that asks for them, records are kept as structured clones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openStore, withStore, DB_NAME, STORES } from '../src/enhance/store.js';
import { loadReliefMaps, saveReliefMap, removeReliefMap } from '../src/enhance/relief-store.js';
import { ART } from '../src/enhance/config.js';
import { models } from '../src/enhance/models.js';

const later = () => new Promise(r => setTimeout(r, 0));

// A minimal IndexedDB: databases by name, each { version, stores: Map(name -> { keyPath, records: Map }), connections: Set, queue }. The opens
// of a database wait in its queue, each until the ones before it are answered, as a browser's connection queue does. An open of a higher
// version upgrades (firing versionchange on the open connections first; while any of them stays open it is told `blocked`, and only it: the
// opens behind it wait without a word, until the connections close and it goes on); an open of a lower version is refused (VersionError);
// else it succeeds. Transactions run their one request and complete on the next turn.
function fakeIndexedDB() {
  const dbs = new Map();
  const entryOf = name => { if (!dbs.has(name)) dbs.set(name, { version: 0, upgrading: false, held: null, queue: [], connections: new Set(), stores: new Map() }); return dbs.get(name); };
  // Answers the open at the head of the queue, then the next one on a later turn.
  const step = entry => {
    const head = entry.queue[0]; if (!head) return;
    const { request, version } = head, done = () => { entry.queue.shift(); if (entry.queue.length) setTimeout(() => step(entry)); };
    if (version < entry.version) { request.error = new Error('VersionError'); request.onerror?.(); done(); return; }
    const go = () => {
      const db = connect(entry); request.result = db;
      if (version > entry.version) { entry.version = version; entry.upgrading = true; try { request.onupgradeneeded?.(); } finally { entry.upgrading = false; } }
      request.onsuccess?.(); done();
    };
    if (version > entry.version && entry.connections.size) {
      for (const c of [...entry.connections]) c.onversionchange?.();
      if (entry.connections.size) { entry.held = go; request.onblocked?.(); return; }
    }
    go();
  };
  const connect = entry => {
    const db = {
      closed: false, onversionchange: null,
      objectStoreNames: { contains: n => entry.stores.has(n) },
      createObjectStore(name, { keyPath }) { if (!entry.upgrading) throw new Error('InvalidStateError'); entry.stores.set(name, { keyPath, records: new Map() }); },
      transaction(name, mode) {
        if (db.closed) throw new Error('InvalidStateError: the connection is closed');
        const store = entry.stores.get(name); if (!store) throw new Error(`NotFoundError: no store ${name}`);
        const tx = { oncomplete: null, onerror: null, onabort: null, error: null };
        const writable = () => { if (mode !== 'readwrite') throw new Error('ReadOnlyError'); };
        tx.objectStore = () => ({
          getAll: () => ({ result: [...store.records.values()].map(r => structuredClone(r)) }),
          put: r => { writable(); store.records.set(r[store.keyPath], structuredClone(r)); return { result: r[store.keyPath] }; },
          delete: k => { writable(); store.records.delete(k); return { result: undefined }; },
        });
        setTimeout(() => tx.oncomplete?.());
        return tx;
      },
      close() { if (db.closed) return; db.closed = true; entry.connections.delete(db); if (entry.held && !entry.connections.size) { const go = entry.held; entry.held = null; setTimeout(go); } },
    };
    entry.connections.add(db);
    return db;
  };
  const api = {
    dbs,
    // A database as an older build left it: `stores` { name: { keyPath, records: [...] } }.
    seed(name, version, stores) { const entry = entryOf(name); entry.version = version; entry.stores = new Map(Object.entries(stores).map(([n, s]) => [n, { keyPath: s.keyPath, records: new Map(s.records.map(r => [r[s.keyPath], structuredClone(r)])) }])); },
    // A connection an older tab holds open (it does not close itself on versionchange).
    holdOpen(name) { return connect(dbs.get(name)); },
    opens: 0, // every open asked for
    open(name, version) {
      const request = { result: null, error: null, onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null }, entry = entryOf(name);
      api.opens++; entry.queue.push({ request, version });
      if (entry.queue.length === 1) setTimeout(() => step(entry)); // else it waits for the ones before it
      return request;
    },
  };
  return api;
}
async function withFake(work) {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB'), fake = fakeIndexedDB();
  Object.defineProperty(globalThis, 'indexedDB', { value: fake, configurable: true, writable: true });
  try { return await work(fake); } finally { if (had) Object.defineProperty(globalThis, 'indexedDB', had); else delete globalThis.indexedDB; }
}
const tiles = (member, v) => ({ member, kind: 'tiles', heights: new Uint8Array(models().floor.sheetCount * models().floor.tileBytes).fill(v), saved: 1 }); // every texel of a sheet's tiles

test('version 2: a version 1 database holding relief maps, opened by the page, keeps them and gains the packs and the art', () => withFake(async fake => {
  assert.equal(ART.dbVersion, 2); // @math Stage 4's version
  fake.seed(DB_NAME, 1, { relief: { keyPath: 'member', records: [tiles('A_F1.PCX', 40), tiles('A_F2.PCX', 90)] } }); // @math two maps of an older build
  const maps = await loadReliefMaps();
  assert.deepEqual(maps.map(r => [r.member, r.heights[0]]), [['A_F1.PCX', 40], ['A_F2.PCX', 90]]); // @math the heights kept
  assert.ok(maps.every(r => r.heights instanceof Uint8Array));
  const entry = fake.dbs.get(DB_NAME);
  assert.equal(entry.version, 2); // @math upgraded
  assert.deepEqual([...entry.stores.keys()].sort(), Object.keys(STORES).sort());
  assert.equal(entry.stores.get('packs').keyPath, 'id'); assert.equal(entry.stores.get('art').keyPath, 'id'); assert.equal(entry.stores.get('relief').keyPath, 'member');
  assert.equal(entry.connections.size, 0, 'every connection closed after its work');
  // A fresh browser gets all three stores at once; the relief store saves, loads and removes as before.
  fake.dbs.clear();
  assert.equal(await saveReliefMap(tiles('a_f3.pcx', 7)), true); // @math a map of the player's
  assert.deepEqual((await loadReliefMaps()).map(r => r.member), ['A_F3.PCX']);
  assert.equal(await removeReliefMap('A_F3.PCX'), true);
  assert.deepEqual(await loadReliefMaps(), []);
  assert.deepEqual([...fake.dbs.get(DB_NAME).stores.keys()].sort(), Object.keys(STORES).sort());
  assert.equal(await withStore('packs', 'readwrite', s => s.put({ id: 'p1', name: 'a pack' })), 'p1');
  assert.deepEqual(await withStore('packs', 'readonly', s => s.getAll()), [{ id: 'p1', name: 'a pack' }]);
}));

test('a tab holding version 1 open blocks the upgrade: the relief loader gives nothing, saving fails, and the late connections are closed', () => withFake(async fake => {
  fake.seed(DB_NAME, 1, { relief: { keyPath: 'member', records: [tiles('A_F1.PCX', 40)] } }); // @math a map of an older build
  const old = fake.holdOpen(DB_NAME), entry = fake.dbs.get(DB_NAME);
  // Two opens in the same turn: the browser tells only the first that it is blocked, the second waits behind it without a word. Both give up.
  const [maps, saved] = await Promise.all([loadReliefMaps(), saveReliefMap(tiles('A_F2.PCX', 1))]); // @math a map of the player's
  assert.deepEqual(maps, []); assert.equal(saved, false);
  assert.equal(entry.queue.length, 2, 'the two opens wait, the first for the old tab'); // @math the loader's and the save's
  // While the upgrade waits, a later open fails at once and asks the browser for nothing (it would queue behind the held one, never told).
  const asked = fake.opens;
  await assert.rejects(openStore(), /close the other tabs of the page/);
  assert.deepEqual(await loadReliefMaps(), []);
  assert.equal(await removeReliefMap('A_F1.PCX'), false);
  assert.equal(fake.opens, asked, 'no open asked for while the upgrade waits'); assert.equal(entry.queue.length, 2); // @math still the two
  old.close(); for (let k = 0; k < 4; k++) await later(); // @math the held open goes on once the old tab lets go, then the one behind it
  assert.equal(entry.version, 2); // @math upgraded once nothing held it
  assert.equal(entry.queue.length, 0);
  assert.equal(entry.connections.size, 0, 'the connections that arrived after they were given up are closed at once');
  assert.deepEqual((await loadReliefMaps()).map(r => r.member), ['A_F1.PCX'], 'the maps kept through the upgrade, and the page opens its data again');
}));

test('a connection of the page gives way when another tab asks for a newer version, and an older version cannot open the upgraded database', () => withFake(async fake => {
  const db = await openStore();
  assert.equal(db.closed, false);
  const newer = fake.open(DB_NAME, ART.dbVersion + 1); let opened = false, blocked = false; newer.onsuccess = () => { opened = true; newer.result.close(); }; newer.onblocked = () => { blocked = true; }; // @math the next version
  await later(); await later();
  assert.equal(db.closed, true); assert.equal(blocked, false); assert.equal(opened, true);
  await assert.rejects(openStore(), /VersionError/); // the page at version 2 against a database of version 3: refused, the loaders give nothing
  assert.deepEqual(await loadReliefMaps(), []);
}));

test('without IndexedDB the store says so and the relief loader gives nothing', async () => {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true, writable: true });
  try {
    await assert.rejects(openStore(), /keeps no data/);
    assert.deepEqual(await loadReliefMaps(), []);
    assert.equal(await saveReliefMap(tiles('A_F1.PCX', 1)), false);
  } finally { if (had) Object.defineProperty(globalThis, 'indexedDB', had); else delete globalThis.indexedDB; }
});
