import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { parseDat } from '../src/archive.js';
import { parseGam, parseRoute, parseSpawns } from '../src/tracks.js';
import {
  createTrack,
  snapshot,
  restore,
  trackChanges,
  patchArchive,
  moveWaypoint,
} from '../src/track-model.js';

async function find(dir) {
  for (const file of await readdir(dir, { withFileTypes: true }).catch(
    () => []
  )) {
    if (file.isFile() && file.name.toLowerCase() === 'wacky.dat')
      return resolve(dir, file.name);
    if (file.isDirectory()) {
      const path = await find(resolve(dir, file.name));
      if (path) return path;
    }
  }
}
const path = process.argv[2] ?? (await find(resolve('game')));
if (!path) {
  console.error(
    'Provide your original archive: npm run check:tracks -- /path/to/WACKY.DAT'
  );
  process.exit(1);
}
const original = new Uint8Array(await readFile(path)),
  hash = createHash('sha256').update(original).digest('hex');
const entries = parseDat(original),
  byName = new Map(entries.map((e) => [e.name, e]));
const changes = new Map();
let count = 0;
for (const entry of entries.filter((e) => /^\d+\.gam$/.test(e.name))) {
  const track = createTrack(byName, entry.name.split('.')[0]);
  assert.equal(trackChanges(track).size, 0, `Track ${track.stem} roundtrip`);
  const initial = snapshot(track);
  restore(track, initial);
  assert.equal(trackChanges(track).size, 0);
  track.map[0] = (track.map[0] + 1) % 108;
  track.start.x = track.start.x === 1000 ? 1001 : 1000;
  if (track.route.length) moveWaypoint(track, 0, 1024, 1024);
  if (track.objects.length) track.objects[0].x = 1024;
  const edited = snapshot(track);
  restore(track, initial);
  assert.equal(trackChanges(track).size, 0, `Track ${track.stem} undo`);
  restore(track, edited);
  for (const [name, data] of trackChanges(track)) changes.set(name, data);
  count++;
}
const exported = patchArchive(original, changes),
  parsed = parseDat(exported);
assert.deepEqual(
  parsed.map((e) => e.name),
  entries.map((e) => e.name)
);
for (let i = 0; i < parsed.length; i++) {
  const entry = parsed[i];
  assert.deepEqual(
    entry.data,
    changes.get(entry.name) ?? entries[i].data,
    entry.name
  );
  if (!changes.has(entry.name)) continue;
  if (entry.name.endsWith('.gam'))
    assert.ok([1000, 1001].includes(parseGam(entry.data).startX));
  if (entry.name.endsWith('.rd'))
    assert.equal(parseRoute(entry.data)[0].x1, 1024);
  if (entry.name.endsWith('.spw'))
    assert.equal(parseSpawns(entry.data)[0].x, 1024);
}
assert.equal(createHash('sha256').update(original).digest('hex'), hash);
assert.equal(
  createHash('sha256')
    .update(await readFile(path))
    .digest('hex'),
  hash
);
console.log(
  `Verified ${count} track roundtrips, edit/undo/project restore, and ${changes.size} edited assets.`
);
console.log(
  `Export preserves all ${entries.length - changes.size} untouched members and leaves the original archive unchanged.`
);
