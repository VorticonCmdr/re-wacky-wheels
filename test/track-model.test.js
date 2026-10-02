import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDat } from '../src/archive.js';
import { parseGam, parseRoute, parseSpawns } from '../src/tracks.js';
import {
  createTrack,
  snapshot,
  restore,
  trackChanges,
  patchArchive,
  History,
  paintBrush,
  paintLine,
  floodFill,
  routeSegment,
  moveWaypoint,
  insertWaypoint,
  deleteWaypoint,
  fingerprint,
} from '../src/track-model.js';

function trackFixture(asBuffer = false) {
  const lines = [
    'f1.pcx',
    'f2.pcx',
    'mask1.bin',
    'mask2.bin',
    'sky.pcx',
    ...Array(20).fill(' 0 '),
  ];
  lines[8] = ' 320 ';
  lines[9] = ' 640 ';
  lines[5] = '\u0080original';
  const gam = Uint8Array.from(lines.join('\r\n') + '\r\n', (c) =>
    c.charCodeAt(0)
  );
  const route = [
    routeSegment(100, 100, 300, 100),
    routeSegment(300, 100, 300, 300),
    routeSegment(300, 300, 100, 100),
  ];
  const rd = new Uint8Array(2 + route.length * 14 + 2),
    rv = new DataView(rd.buffer);
  rv.setUint16(0, route.length, true);
  route.forEach((r, i) =>
    Object.values(r).forEach((n, j) =>
      rv.setUint16(2 + i * 14 + j * 2, n, true)
    )
  );
  rd.set([222, 223], rd.length - 2);
  const spw = new Uint8Array(15),
    sv = new DataView(spw.buffer);
  sv.setUint16(0, 1, true);
  [3, 49152, 700, 800, 65530].forEach((n, i) =>
    sv.setUint16(2 + i * 2, n, true)
  );
  sv.setInt16(12, -1200, true);
  spw[14] = 199;
  const by = new Map(
    Object.entries({ m: new Uint8Array(4096), gam, rd, spw }).map(
      ([suffix, data]) => [
        `1.${suffix}`,
        { data: asBuffer ? Buffer.from(data) : data },
      ]
    )
  );
  return createTrack(by, '1');
}
function archiveFixture() {
  const out = new Uint8Array(70),
    v = new DataView(out.buffer);
  v.setUint16(0, 2, true);
  for (let i = 0; i < 2; i++) {
    out.set(new TextEncoder().encode(`asset${i}.m`), 2 + i * 22);
    v.setUint32(16 + i * 22, 3, true);
    v.setUint32(20 + i * 22, 48, true);
  }
  out.set([7, 8, 9], 50);
  out.fill(244, 55);
  return out;
}

test('unedited tracks serialize identically, including unknown fields and trailing bytes', () => {
  const track = trackFixture();
  assert.equal(trackChanges(track).size, 0);
  restore(track, snapshot(track));
  assert.equal(trackChanges(track).size, 0);
});
test('changing only start coordinates preserves GAM spacing, line endings and non-ASCII bytes', () => {
  const track = trackFixture();
  track.start.x = 1023;
  const changed = trackChanges(track);
  assert.deepEqual([...changed.keys()], ['1.gam']);
  assert.equal(parseGam(changed.get('1.gam')).startX, 1023);
  const expected = Array.from(track.original.gam, (n) => String.fromCharCode(n))
    .join('')
    .replace(' 320 ', ' 1023 ');
  assert.deepEqual(
    changed.get('1.gam'),
    Uint8Array.from(expected, (c) => c.charCodeAt(0))
  );
});
test('moving an object preserves every unknown attribute and trailing byte', () => {
  const track = trackFixture();
  track.objects[0].x = 17;
  const output = trackChanges(track).get('1.spw'),
    [object] = parseSpawns(output);
  assert.deepEqual(object, {
    id: 3,
    x: 17,
    y: 800,
    unknown1: 49152,
    unknown2: 65530,
    unknown3: -1200,
  });
  assert.equal(output.at(-1), 199);
});
test('brush strokes cover skipped pointer positions and clip square brushes to the map', () => {
  const map = new Uint8Array(4096);
  paintLine(map, { x: 1, y: 1 }, { x: 12, y: 1 }, 54);
  for (let x = 1; x <= 12; x++) assert.equal(map[64 + x], 54);
  paintBrush(map, 63, 63, 107, 3);
  assert.equal(map[4095], 107);
  assert.equal(map[4094], 107);
  assert.equal(map[4031], 107);
  assert.equal(map[0], 0);
});
test('fill respects four-way connectivity and cannot wrap across row boundaries', () => {
  const map = new Uint8Array(4096).fill(1);
  map[63] = map[64] = 2;
  floodFill(map, 63, 0, 7);
  assert.equal(map[63], 7);
  assert.equal(map[64], 2);
  const blank = new Uint8Array(4096);
  floodFill(blank, 0, 0, 9);
  assert.ok(blank.every((n) => n === 9));
  floodFill(blank, 0, 0, 9);
  assert.ok(blank.every((n) => n === 9));
});
test('moving, inserting and deleting waypoints keeps connected neighbors joined and recalculates geometry', () => {
  const track = trackFixture();
  moveWaypoint(track, 1, 400, 120);
  assert.equal(track.route[0].x2, 400);
  assert.equal(track.route[0].y2, 120);
  assert.equal(track.route[1].x1, 400);
  assert.equal(track.route[1].y1, 120);
  assert.deepEqual(track.route[0], routeSegment(100, 100, 400, 120));
  const original = snapshot(track).route,
    index = insertWaypoint(track, 0, 200, 110);
  assert.equal(index, 1);
  assert.equal(track.route.length, 4);
  deleteWaypoint(track, index);
  assert.deepEqual(track.route, original);
  const data = trackChanges(track).get('1.rd');
  assert.deepEqual(parseRoute(data), track.route);
  assert.deepEqual([...data.slice(-2)], [222, 223]);
});
test('moving a waypoint does not silently reconnect intentionally disconnected segments', () => {
  const track = trackFixture();
  track.route[0].x2 = 250;
  const before = { ...track.route[0] };
  moveWaypoint(track, 1, 400, 120);
  assert.deepEqual(track.route[0], before);
});
test('history reverses complete edits, clears redo branches and bounds retained snapshots', () => {
  const track = trackFixture(),
    history = new History(2);
  const before = snapshot(track);
  track.map[1] = 107;
  track.start.x = 800;
  history.commit(before, snapshot(track), 'Paint');
  assert.equal(history.undo(track), 'Paint');
  assert.equal(trackChanges(track).size, 0);
  assert.equal(history.redo(track), 'Paint');
  assert.equal(track.map[1], 107);
  history.undo(track);
  const second = snapshot(track);
  track.objects.pop();
  history.commit(second, snapshot(track), 'Remove');
  assert.equal(history.redoStack.length, 0);
  for (let i = 0; i < 3; i++) {
    const old = snapshot(track);
    track.map[i] = i + 1;
    history.commit(old, snapshot(track), 'Stroke');
  }
  assert.equal(history.undoStack.length, 2);
});
test('drafts are validated fully before mutation, including tile IDs, coordinates and signed attributes', () => {
  const track = trackFixture(),
    before = snapshot(track),
    bad = snapshot(track);
  bad.objects[0].unknown3 = -32769;
  assert.throws(() => restore(track, bad), /object field/);
  assert.deepEqual(snapshot(track), before);
  bad.objects[0].unknown3 = 0;
  bad.map[100] = 108;
  assert.throws(() => restore(track, bad), /tile/);
  assert.deepEqual(snapshot(track), before);
  const good = snapshot(track);
  assert.throws(() => restore(track, good, 3), /object type/);
});
test('archive export changes only designated members and preserves aliases, gaps and the source buffer', () => {
  const original = archiveFixture(),
    copy = original.slice(),
    replacement = new Uint8Array([20, 21, 22, 23]);
  const output = patchArchive(original, new Map([['asset0.m', replacement]])),
    entries = parseDat(output);
  assert.deepEqual(
    entries.map((e) => e.name),
    ['asset0.m', 'asset1.m']
  );
  assert.deepEqual(entries[0].data, replacement);
  assert.deepEqual([...entries[1].data], [7, 8, 9]);
  assert.deepEqual(output.subarray(46, original.length), original.subarray(46));
  assert.deepEqual(original, copy);
  assert.deepEqual(patchArchive(original, new Map()), original);
  assert.throws(
    () => patchArchive(original, new Map([['missing.m', replacement]])),
    /no missing/
  );
  assert.notEqual(fingerprint(output), fingerprint(original));
});

test('Node Buffer sources remain immutable when the editable map is painted', () => {
  const track = trackFixture(true),
    before = track.original.m.slice();
  paintBrush(track.map, 0, 0, 107);
  assert.equal(track.original.m[0], 0);
  assert.deepEqual(track.original.m, before);
  assert.ok(trackChanges(track).has('1.m'));
});

test('a route can be rebuilt from empty without losing its closed endpoint when the first node moves', () => {
  const track = trackFixture();
  track.route = [];
  const index = insertWaypoint(track, 0, 100, 100);
  moveWaypoint(track, index, 200, 200);
  assert.deepEqual(track.route[0], routeSegment(200, 200, 200, 200));
  insertWaypoint(track, 0, 300, 300);
  assert.equal(track.route.length, 2);
  assert.equal(track.route[0].x2, track.route[1].x1);
  assert.equal(track.route[1].x2, track.route[0].x1);
});
