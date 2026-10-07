// The page's own database in this browser (IndexedDB 'wackywheels'), apart from the game files and the settings: the player's relief maps
// (relief-store.js) and, from Stage 4, the artwork packs and their art. This module is the only place that opens it, so every part of the page
// opens the same version with the same upgrade:
// - version ART.dbVersion (2): an upgrade creates whichever of the stores is missing, 'relief' (keyed by the archive member, as version 1 had
//   it, its records kept), 'packs' and 'art' (keyed by their id);
// - a tab of the page still holding an older version open blocks the upgrade: the open then fails with a message (the callers' loaders give
//   nothing, as they do when the browser keeps no data), and a connection that arrives after that is closed at once. The browser tells only
//   the open that upgrades: the opens behind it in the database's queue wait without a word until it goes on. So every open still waiting
//   fails with it, and while the upgrade stays held an open fails at once without asking the browser;
// - every connection this module makes closes itself when another tab asks for a newer version, so this page never blocks a later one.
// A build that still opens version 1 after the upgrade fails to open the database (the browser refuses a lower version) and finds no maps there.
import { ART } from './config.js';

export const DB_NAME = 'wackywheels';
export const STORES = { relief: { keyPath: 'member' }, packs: { keyPath: 'id' }, art: { keyPath: 'id' } };
const BLOCKED = 'Another tab of the page holds its data open in an older version: close the other tabs of the page.';

let held = null; // { factory, request }: the open the browser holds back for a tab of an older version, until it is answered
const waiting = new Set(); // the give-up callbacks of the opens not answered yet

// A connection to the database (closed by the caller), after the upgrade if the browser had an older version.
export function openStore() {
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = error => { waiting.delete(fail); if (!settled) { settled = true; reject(error); } };
    try {
      const factory = globalThis.indexedDB;
      if (factory && held?.factory === factory) { fail(new Error(BLOCKED)); return; } // the browser would queue this open behind the held one, never told
      const request = factory?.open(DB_NAME, ART.dbVersion);
      if (!request) { fail(new Error('This browser keeps no data for the page.')); return; }
      waiting.add(fail);
      const answered = () => { waiting.delete(fail); if (held?.request === request) held = null; };
      request.onupgradeneeded = () => { const db = request.result; for (const [name, options] of Object.entries(STORES)) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, options); };
      request.onblocked = () => { held = { factory, request }; for (const giveUp of [...waiting]) giveUp(new Error(BLOCKED)); }; // this open and the ones queued behind it
      request.onsuccess = () => {
        answered();
        const db = request.result;
        if (settled) { db.close(); return; } // the open went on after it was given up (blocked): nobody waits for it
        settled = true; db.onversionchange = () => db.close(); resolve(db);
      };
      request.onerror = () => { answered(); fail(request.error ?? new Error('The page could not open its data.')); };
    } catch (error) { fail(error); }
  });
}

// One transaction on the store `name` ('readonly' or 'readwrite'): `work(store)` makes the request whose result the promise gives once the
// transaction is complete. The connection is closed afterwards, whatever happened.
export async function withStore(name, mode, work) {
  const db = await openStore();
  try {
    return await new Promise((resolve, reject) => { const tx = db.transaction(name, mode), request = work(tx.objectStore(name)); tx.oncomplete = () => resolve(request?.result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
  } finally { db.close(); }
}
