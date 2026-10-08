// The kart angle sets (src/enhance/angles.js, Stage 4 M4) on synthetic data only: the mapping derived from the game's functions (and from
// synthetic tables), the index of each mode (N = 8 locked and off are the game's frame for every camera heading and segment angle, locked never
// strays more than half an octant from it, free is the game's frame moved by the difference of its two roundings, monotonic and wrapping), the
// route's directions and the convention check, which records are drawn from a set (forged records of everything that must keep its frame, the
// own car among them), an empty cell's fallback, the provider's sets and the template's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { angleMapping, mapping, angleIndex, wrapSigned, routeDirections, angleRecords } from '../src/enhance/angles.js';
import { frameTable, racerFrame, compassSector } from '../src/game/racers.js';
import { humanCompass } from '../src/game/versus-seat.js';
import { carFrame } from '../src/game/control.js';
import { toArt, createArtProvider } from '../src/enhance/art.js';
import { normalizeArtEntry, expectedSize, frameCell } from '../src/enhance/pack-format.js';
import { buildTemplate, templateChoices, carSlots, anglesChoice } from '../src/enhance/art-template.js';
import { ANGLES, ART } from '../src/enhance/config.js';
import { models } from '../src/enhance/models.js';

const TURN = models().view.turn, W = 38, H = 28, SIZE = W * H, PER = carFrame(1, 0) - carFrame(0, 0), OCTANTS = frameTable().length; // @math the cars' class 0 size
const mod = (v, n) => ((v % n) + n) % n;

// A TRIG table of the game's layout (16.16 dwords, x then y, entry 0 along +x, the turn counterclockwise in the table's own axes).
function trigTable(turn = TURN) {
  const v = new DataView(new ArrayBuffer(turn * 8)); // @math two dwords an entry
  for (let e = 0; e < turn; e++) { const a = (2 * Math.PI * e) / turn; v.setInt32(e * 8, Math.round(Math.cos(a) * 65536), true); v.setInt32(e * 8 + 4, Math.round(Math.sin(a) * 65536), true); } // @math a turn in radians; two dwords an entry; 16.16
  return v;
}
// One buffer as an archive holds its members: CARS.SP (eight slots of twelve frames, each frame filled with its own number), then GENEF.SP,
// DIGGER.SP, an object's sheet and HOGMIS.SP.
const carsLength = carFrame(8, 0) * SIZE, dat = new Uint8Array(carsLength + 14692 + 16 * SIZE + 32 * 24 * 3 + 234 * 26); // @math eight slots; GENEF.SP's, DIGGER.SP's, an object's three frames and the shots' sheet
for (let k = 0; k < carFrame(8, 0); k++) dat.fill((k % 250) + 1, k * SIZE, (k + 1) * SIZE); // @math a byte for each frame, never 0
const cars = dat.subarray(0, carsLength), genef = dat.subarray(carsLength, carsLength + 14692), digger = dat.subarray(carsLength + 14692, carsLength + 14692 + 16 * SIZE), sprite = dat.subarray(carsLength + 14692 + 16 * SIZE, carsLength + 14692 + 16 * SIZE + 32 * 24 * 3), hogmis = dat.subarray(dat.length - 234 * 26); // @math the members' sizes
const NUMBER = Array.from({ length: 8 }, (_, slot) => Array.from({ length: PER }, (_, e) => carFrame(slot, e))); // @math the slots' frame numbers (carFrame reads its claim on every call: once here)
const frameOf = (slot, e) => cars.subarray(NUMBER[slot][e] * SIZE, (NUMBER[slot][e] + 1) * SIZE);

// A world whose route has one entry a segment `{ angle, length, compass }` (the compass word humanCompass(angle) unless given), from points
// spread over the map.
function worldOf(segments) {
  const route = segments.map((s, i) => {
    const len = s.length ?? 2000, a = (2 * Math.PI * s.angle) / TURN, x1 = 2048 + (i % 7) * 3, y1 = 2048 + (i % 5) * 3; // @math a long chord; a turn in radians; the map's middle
    return [x1, y1, x1 + Math.round(len * Math.cos(a)), y1 + Math.round(len * Math.sin(a)), s.angle, s.compass ?? humanCompass(mod(Math.round(s.angle), TURN)), len].map((v, k) => (k < 4 ? v - 0x400 : v)); // @math the loader adds 0x400 to the four coordinate words
  });
  return { trig: trigTable(), route, carFrames: { cars }, carShape: [{ w: W, h: H }] };
}
// A provider of forged sets: every slot a set of N directions (`filled` the cells drawn, or every cell).
const setsOf = (N, filled = null) => { const sets = Array.from({ length: 8 }, (_, slot) => ({ entry: { kind: 'angles', slot, directions: N }, filled })); return { angleSlots: sets.length, angles: slot => sets[slot] ?? null }; }; // @math eight slots

test('the mapping comes from the game\'s functions: the octants, a sector, the rear (the kart seen from behind) and the sense; synthetic tables give their own', () => {
  const M = mapping(), T = frameTable();
  assert.equal(M.octants, T.length); assert.equal(M.sector * M.octants, TURN);
  assert.equal(M.rear, racerFrame(0, humanCompass(0), T)); assert.equal(M.rear, 4); // @math the player's own straight picture is entry 4 of its slot (car.player-frames-observed): the kart from behind
  assert.equal(M.sense, 1, 'the frame rises as the racer turns one sector on');
  for (let c = 0; c < M.octants; c++) assert.equal(humanCompass(M.centres[c]), c, `the centre of compass word ${c}`);
  const mirrored = T.map((row, r) => row.map((_, c) => mod(6 + r - c, OCTANTS))), shifted = T.map((row, r) => row.map((_, c) => mod(2 - r + c, OCTANTS))); // @math a table falling where the game's rises; one rising from another start
  const Mm = angleMapping({ table: mirrored }), Ms = angleMapping({ table: shifted }), Mc = angleMapping({ compassOf: h => compassSector(h) }); // a compass word that is the sector itself
  assert.deepEqual([Mm.sense, Mm.rear], [-1, mod(6 - humanCompass(0), OCTANTS)]); assert.deepEqual([Ms.sense, Ms.rear], [1, mod(2 + humanCompass(0), OCTANTS)]); assert.deepEqual([Mc.sense, Mc.rear], [1, T[0][0]]); // @math the tables' first rows
  assert.deepEqual([...Mc.centres], Array.from({ length: OCTANTS }, (_, k) => k * Mc.sector));
  // The derivation bites: with the camera and the racer at sector centres, free at N = 8 is each table's own frame (a wrong rear or sense is not).
  for (const m of [M, Mm, Ms, Mc]) for (let k = 0; k < OCTANTS; k++) for (let j = 0; j < OCTANTS; j++) {
    const cam = k * m.sector, dir = j * m.sector, f = m.frameOf(cam, m.compassOf(dir), m.table);
    assert.equal(angleIndex(m, f, wrapSigned(dir - cam, TURN), OCTANTS, 'free'), f);
  }
  assert.notEqual(angleIndex({ ...Mm, sense: 1 }, mirrored[1][humanCompass(0)], wrapSigned(0 - Mm.sector, TURN), OCTANTS, 'free'), mirrored[1][humanCompass(0)], 'the wrong sense misses'); // the camera a sector on, the racer at 0
  assert.deepEqual([wrapSigned(959, TURN), wrapSigned(960, TURN), wrapSigned(-960, TURN), wrapSigned(1919.5, TURN)], [959, -960, -960, -0.5]); // @math half a turn either way
});

test('N = 8 locked and off are racerFrame for every camera heading 0..1919 and every segment angle 0..1919, free one frame from it where the two roundings part, and through the records at every heading', () => {
  const M = mapping(), T = frameTable(), fr = Array.from({ length: TURN }, (_, h) => Int8Array.from({ length: OCTANTS }, (_, c) => racerFrame(h, c, T))), comp = Int8Array.from({ length: TURN }, (_, a) => humanCompass(a));
  // Locked and off at N = 8 are the game's frame by construction (q = 1: off is q f, locked moves at most floor(q / 2) = 0), so that half
  // cannot fail on the mapping. Free can: the game rounds the racer's direction and the camera's heading each to its own octant's centre
  // (M.centres) and takes the frame of the two, free rounds their difference, so free must be the game's frame moved by round(sense delta /
  // sector), delta the racer's remainder in its octant less the camera's in its sector (in TRIG entries): the game's frame where the two
  // remainders are less than half a sector apart, one frame on (in the sense) where they are more. A wrong rear or sense misses it.
  let wrong = 0, pairs = 0, freeWrong = 0, parted = 0;
  for (let cam = 0; cam < TURN; cam++) for (let a = 0; a < TURN; a++) {
    const f = fr[cam][comp[a]], d = wrapSigned(a - cam, TURN);
    if (angleIndex(M, f, d, OCTANTS, 'locked') !== f || angleIndex(M, f, d, OCTANTS, 'off') !== f) wrong++;
    const delta = wrapSigned(a - M.centres[comp[a]], TURN) - wrapSigned(cam - M.centres[comp[cam]], TURN), free = angleIndex(M, f, d, OCTANTS, 'free');
    if (free !== mod(f + Math.round((M.sense * delta) / M.sector), OCTANTS)) freeWrong++;
    if (free !== f) parted++;
    pairs++;
  }
  assert.equal(pairs, TURN * TURN); assert.equal(wrong, 0); assert.equal(freeWrong, 0, 'free is the game\'s frame moved by the two roundings\' difference');
  assert.equal(parted, (TURN * TURN) / 4, 'free parts from the game\'s frame on a quarter of the pairs'); // @math remainders half a sector or more apart: a quarter of the square
  for (const wrongM of [{ ...M, rear: M.rear + 1 }, { ...M, sense: -M.sense }]) { // the comparison bites: a wrong rear or sense misses it
    let misses = 0;
    for (let cam = 0; cam < TURN; cam += 7) for (let a = 0; a < TURN; a += 5) { // @math a sample of the pairs
      const f = fr[cam][comp[a]], delta = wrapSigned(a - M.centres[comp[a]], TURN) - wrapSigned(cam - M.centres[comp[cam]], TURN);
      if (angleIndex(wrongM, f, wrapSigned(a - cam, TURN), OCTANTS, 'free') !== mod(f + Math.round((M.sense * delta) / M.sector), OCTANTS)) misses++;
    }
    assert.ok(misses > 0);
  }
  // The records' path (angleRecords): a racer on each of a route's entries, their angles every octant edge and its neighbours and every 16th
  // entry, at every camera heading: each record is remapped (its bytes are the game's direction frame) to the game's frame.
  const angles = [...new Set([...Array.from({ length: OCTANTS }, (_, k) => [-3, -2, -1, 0, 1, 2, 3].map(o => mod(k * M.sector + M.sector / 2 + o, TURN))).flat(), ...Array.from({ length: TURN / 16 }, (_, k) => k * 16)])]; // @math the edges (half a sector on) and three either side; every 16th
  const world = worldOf(angles.map(angle => ({ angle }))), dirs = routeDirections(world);
  assert.ok(dirs.ok, `the synthetic route keeps the convention (${dirs.agree} of ${dirs.long})`);
  const racers = [{ compass: 0, hit: 0, entry: 0 }, ...angles.map((a, i) => ({ compass: comp[a], hit: 0, entry: i }))], slots = racers.map((_, n) => n % 8), P = { ai: { racers }, slots }; // @math the slots in turn
  let records = 0, same = 0;
  for (let cam = 0; cam < TURN; cam++) {
    const list = racers.slice(1).map((r, i) => ({ type: 1, racer: i + 1, frame: frameOf(slots[i + 1], fr[cam][r.compass]) }));
    for (const r of angleRecords(list, { P, world, heading: cam, camera: cam, mode: 'locked', provider: setsOf(OCTANTS) })) { records++; if (r.art?.direct && r.art.index === (r.frame[0] - 1) % PER) same++; } // the frame's byte is its number plus 1
  }
  assert.equal(records, TURN * angles.length); assert.equal(same, records, 'every record remapped, to the game\'s own frame');
});

test('locked never strays more than floor(q / 2) from q f; the segment at 119 and the camera at 121', () => {
  const M = mapping(), T = frameTable(), fr = Array.from({ length: TURN }, (_, h) => Int8Array.from({ length: OCTANTS }, (_, c) => racerFrame(h, c, T))), comp = Int8Array.from({ length: TURN }, (_, a) => humanCompass(a));
  for (const N of [16, 24, 32, 40, 48, 56, 64]) { // @math every N above 8 the format takes
    const q = N / OCTANTS, half = Math.floor(q / 2);
    let worst = 0, moved = 0;
    for (let cam = 0; cam < TURN; cam++) for (let a = 0; a < TURN; a += 3) { // @math every third segment angle at every camera heading
      const f = fr[cam][comp[a]], i = angleIndex(M, f, wrapSigned(a - cam, TURN), N, 'locked'), off = Math.abs(wrapSigned(i - q * f, N));
      worst = Math.max(worst, off); if (off) moved++;
    }
    assert.ok(worst <= half, `N = ${N}: ${worst} from q f`); assert.equal(worst, half, `N = ${N} uses the whole half octant`); assert.ok(moved > 0);
  }
  const f = racerFrame(121, humanCompass(119)); // @math the plan's example: the segment at 119, the camera at 121
  assert.equal(f, 3); // @math the game's separate roundings: the racer's octant 0 (compass 6), the camera's sector 1
  assert.equal(angleIndex(M, f, wrapSigned(119 - 121, TURN), OCTANTS, 'free'), 4, 'free at N = 8 is not the game\'s frame here'); // @math round(x) is 4
  assert.equal(angleIndex(M, f, wrapSigned(119 - 121, TURN), OCTANTS, 'locked'), 3); // @math the game's frame
  assert.equal(angleIndex(M, f, wrapSigned(119 - 121, TURN), 32, 'locked'), 14, 'within two of 12'); // @math N = 32: q f = 12, round(q x) = 16, held at 12 + 2
  assert.equal(angleIndex(M, f, wrapSigned(119 - 121, TURN), 32, 'off'), 12); // @math q f
});

test('free is monotonic in d and wraps once a turn (falling with a table whose sense is -1)', () => {
  const T = frameTable(), mirrored = T.map((row, r) => row.map((_, c) => mod(6 + r - c, OCTANTS))); // @math the mirrored table of the mapping's test
  for (const [M, rising] of [[mapping(), true], [angleMapping({ table: mirrored }), false]]) for (const N of [8, 32, 64]) for (const cam of [0, 121, 1000.5]) { // @math three N; three cameras, one between entries
    let prev = null, total = 0, seen = new Set();
    for (let d = -TURN / 2; d <= TURN / 2; d += 0.25) { // @math half a turn either way, a quarter entry a step
      const direction = mod(cam + d, TURN), i = angleIndex(M, 0, wrapSigned(direction - cam, TURN), N, 'free'); // the racer's direction in the turn (wrapped past 0 and 1920), against the camera as angleRecords takes it; free does not read the game's frame
      seen.add(i);
      if (prev !== null) { const step = mod(i - prev, N); assert.ok(step === 0 || step === (rising ? 1 : N - 1), `N = ${N}, camera ${cam}, d ${d}: a step of ${step}`); total += step === 0 ? 0 : 1; }
      prev = i;
    }
    assert.equal(total, N, 'one full turn of the set'); assert.equal(seen.size, N);
  }
});

test('which records are drawn from a set: forged records of the own car, entries 8 to 11, hit racers, glances, crash and wreck pictures, the lion, ducks, objects and shots never remapped', () => {
  const world = worldOf([{ angle: 600 }, { angle: 1700 }]), M = mapping(), cam = 0, N = 32, q = N / OCTANTS; // @math a direction whose locked index is not q f; a set of 32
  const compass = humanCompass(600), f = racerFrame(cam, compass), direct = angleIndex(M, f, wrapSigned(routeDirections(world).directions[0] - cam, TURN), N, 'locked'); // @math the first entry's angle
  assert.notEqual(direct, q * f, 'the remap would move this racer');
  const racers = [{ compass: 0, hit: 0, entry: 0 }, { compass, hit: 0, entry: 0 }, { compass, hit: 0, entry: 0 }, { compass, hit: 1, hitSpin: f, entry: 0 }, { compass, hit: 0, entry: 0, blink: { shown: 10 } }, { compass, hit: 0, entry: 0 }, { compass, hit: 0, entry: 0 }]; // @math the glance frame 10
  const slots = [7, 1, 2, 3, 4, 5, 6], P = { ai: { racers }, slots }; // @math a slot each
  const records = [
    { type: 1, racer: 1, frame: frameOf(1, f), name: 'racer' },
    { type: 0, racer: 0, frame: frameOf(7, 4), name: 'own car' }, // @math the own straight picture: CARS.SP 88, a direction frame of slot 7
    { type: 1, racer: 2, frame: frameOf(2, 9), name: 'entry 9' }, // @math an idle picture
    { type: 1, racer: 3, frame: frameOf(3, f), name: 'hit' },
    { type: 1, racer: 4, frame: frameOf(4, 10), name: 'glance' }, // @math the glance picture
    { type: 1, racer: 5, frame: genef.subarray(7641, 7641 + SIZE), name: 'crash' }, // @math GENEF.SP's explosions and wrecks
    { type: -1, racer: -1, frame: genef.subarray(4449, 4449 + SIZE), name: 'lion' }, // @math the starter lion
    { type: -1, racer: -1, object: 0, frame: sprite.subarray(0, 32 * 24), name: 'object' }, // @math an object's frame
    { type: -1, racer: -1, object: -1, shot: 0, frame: hogmis.subarray(0, 234), name: 'shot' }, // @math a shot's block
    { type: 1, racer: 6, frame: frameOf(1, f), name: 'another slot' }, // the racer's slot is 6, the bytes slot 1's
    { type: 1, racer: 1, frame: frameOf(1, f), skip: true, name: 'skipped' },
  ];
  const before = JSON.stringify(records.map(r => ({ ...r, frame: r.frame.byteOffset }))), log = [];
  for (const mode of ['locked', 'free']) {
    const out = angleRecords(records, { P, world, heading: cam, camera: cam, mode, provider: setsOf(N), log: e => log.push(e) }), by = Object.fromEntries(out.map(r => [r.name, r]));
    assert.equal(by.racer.art.index, angleIndex(M, f, wrapSigned(routeDirections(world).directions[0] - cam, TURN), N, mode)); assert.equal(by.racer.art.direct, true);
    assert.deepEqual([by.hit.art.index, by.hit.art.direct], [q * f, false], 'a hit racer\'s spin frame: its own entry');
    assert.deepEqual([by['another slot'].art.index, by['another slot'].art.direct], [q * f, false]);
    for (const name of ['own car', 'entry 9', 'glance', 'crash', 'lion', 'object', 'shot', 'skipped']) assert.equal(by[name], records.find(r => r.name === name), `${name}: the game's own record`); // the own car too: its straight picture is a direction frame of its slot, but its other pictures are the driver files'
    assert.equal(by.racer.frame, records[0].frame, 'the bytes stay the game\'s');
  }
  assert.equal(JSON.stringify(records.map(r => ({ ...r, frame: r.frame.byteOffset }))), before, 'the game\'s records untouched');
  assert.ok(records.every(r => !('art' in r)));
  assert.ok(log.every(e => !e.direct || e.racer === 1) && log.filter(e => e.direct).length === 2, 'only the racer remapped, once a mode'); // @math two modes
  assert.ok(log.every(e => e.type !== 0), 'the own car never drawn from a set');
  // The ducks: their frames are DIGGER.SP's, and a duck record never takes a direction even on CARS.SP bytes.
  const ducks = angleRecords([{ type: 1, racer: 1, frame: digger.subarray(0, SIZE) }, { type: 1, racer: 1, frame: frameOf(1, f) }], { P: { ...P, duck: true }, world, heading: cam, camera: cam, mode: 'free', provider: setsOf(N) });
  assert.equal(ducks[0].art, undefined); assert.deepEqual([ducks[1].art.index, ducks[1].art.direct], [q * f, false]);
  // No set for the slot: the record is the game's.
  const none = { angleSlots: 1, angles: slot => (slot === 2 ? setsOf(N).angles(2) : null) };
  assert.equal(angleRecords([records[0]], { P, world, heading: cam, camera: cam, mode: 'free', provider: none })[0], records[0]);
});

test('the intro human and the other human of a two player game face their own directions', () => {
  const world = worldOf([{ angle: 300 }]), M = mapping(), N = 64, q = N / OCTANTS; // @math one entry; a set of 64
  // The intro: the human's compass word 0, facing its octant's centre.
  const cam = 400, f = racerFrame(cam, 0), intro = angleRecords([{ type: 1, racer: 0, frame: frameOf(3, f) }], { P: { intro: true, slots: [3], ai: { racers: [] } }, world, heading: cam, camera: cam, mode: 'free', provider: setsOf(N) })[0]; // @math a camera; slot 3
  assert.equal(intro.art.index, angleIndex(M, f, wrapSigned(M.centres[0] - cam, TURN), N, 'free')); assert.ok(intro.art.direct);
  // The other human of a split screen: its car's heading at the tick, its compass word humanCompass of it (versus.js viewRacers).
  const heading = 1300, other = { px: 100, py: 100, heading, wrecked: false }, own = { px: 0, py: 0, heading: 0 }; // @math the other car's heading
  const P = { versus: { viewer: 0, kind: 'shootout', modes: [0, 0], blinks: [[], []] }, car: own, seat2: { car: other, humanSlot: 5 }, humanSlot: 7, world }; // @math the slots of the two humans
  const fo = racerFrame(cam, humanCompass(heading)), r = angleRecords([{ type: 1, racer: 1, frame: frameOf(5, fo) }], { P, world, heading: cam, camera: cam + 0.5, mode: 'free', provider: setsOf(N) })[0]; // @math the floor's heading half an entry on
  assert.equal(r.art.index, angleIndex(M, fo, wrapSigned(heading - cam - 0.5, TURN), N, 'free')); assert.ok(r.art.direct); // @math the camera's half entry
  assert.equal(angleRecords([{ type: 1, racer: 1, frame: frameOf(5, fo) }], { P, world, heading: cam, camera: cam, mode: 'off', provider: setsOf(N) })[0].art.index, q * fo);
});

test('the convention check accepts a synthetic route and refuses a mirrored one; a short entry faces its octant\'s centre', () => {
  const M = mapping(), angles = Array.from({ length: 60 }, (_, k) => (k * 37 + 11) % TURN); // @math sixty segments spread over the turn
  const good = routeDirections(worldOf([...angles.map(angle => ({ angle })), { angle: 500, length: ANGLES.minChord - 5 }])); // @math a short one too
  assert.ok(good.ok); assert.equal(good.long, angles.length); assert.ok(good.agree >= ANGLES.agreement * good.long);
  angles.forEach((a, i) => assert.ok(Math.abs(wrapSigned(good.directions[i] - a, TURN)) < 0.5, `entry ${i}: ${good.directions[i]} for ${a}`)); // @math within half an entry of the segment's angle
  assert.ok(Number.isNaN(good.chords[angles.length]) && good.directions[angles.length] === M.centres[humanCompass(500)], 'the short entry faces its octant\'s centre'); // @math the short one
  const mirrored = routeDirections(worldOf(angles.map(angle => ({ angle, compass: humanCompass(mod(TURN - angle, TURN)) }))));
  assert.equal(mirrored.ok, false, `a mirrored route agrees on ${mirrored.agree} of ${mirrored.long}`);
  angles.forEach((a, i) => assert.equal(mirrored.directions[i], M.centres[humanCompass(mod(TURN - a, TURN))], 'a refused world faces the octant centres of its words'));
  assert.equal(routeDirections(worldOf([{ angle: 3, length: 10 }])).ok, false, 'a world of short entries alone is not taken'); // @math too short
});

test('an empty cell is drawn as the game\'s frame, and with that empty too the record is the archive\'s; the provider\'s sets', () => {
  const world = worldOf([{ angle: 600 }]), M = mapping(), N = 32, q = N / OCTANTS, f = racerFrame(0, humanCompass(600)), want = angleIndex(M, f, wrapSigned(routeDirections(world).directions[0], TURN), N, 'locked'); // @math the racer of the forged records' test
  const P = { ai: { racers: [null, { compass: humanCompass(600), hit: 0, entry: 0 }] }, slots: [0, 2] }, rec = { type: 1, racer: 1, frame: frameOf(2, f) }; // @math slot 2
  const filled = new Uint8Array(N).fill(1); filled[want] = 0;
  const drawn = filledNow => angleRecords([rec], { P, world, heading: 0, camera: 0, mode: 'locked', provider: setsOf(N, filledNow) })[0];
  assert.deepEqual([drawn(null).art.index, drawn(null).art.direct], [want, true], 'every cell drawn: the remapped index');
  assert.deepEqual([drawn(filled).art.index, drawn(filled).art.direct], [q * f, false], 'that cell empty: the game\'s frame from the set');
  filled[q * f] = 0;
  assert.equal(drawn(filled), rec, 'the game\'s frame empty too: the archive\'s');
  // toArt flags the cells (indexed: an index not clear; RGBA: an alpha above 0); the provider keys a set by its slot, a later one winning.
  const entry = normalizeArtEntry({ kind: 'angles', member: 'CARS.SP', memberCrc: 1, image: 'a.png', scale: 1, color: 'indexed', palette: 'A_F1.PCX', slot: 2, directions: 16, width: W, height: H, columns: 2 }).entry, size = expectedSize(entry); // @math a set of 16, two a row
  const indices = new Uint8Array(size.width * size.height), cell = k => frameCell(entry, k);
  for (const k of [0, 2, 5]) indices[(cell(k).y + 3) * size.width + cell(k).x + 4] = 9; // @math three cells with a pixel
  indices[(cell(7).y + 1) * size.width + cell(7).x] = 200; // @math a cell whose only pixel is a transparent index
  const alpha = new Uint8Array(256).fill(255); alpha[200] = 0; // @math index 200 transparent
  const art = toArt(entry, { width: size.width, height: size.height, indices, alpha, palette: new Uint8Array(768) }); // @math a palette's bytes
  assert.deepEqual([...art.filled].flatMap((v, k) => (v ? [k] : [])), [0, 2, 5]); // @math the cells drawn
  const rgbaEntry = { ...entry, color: 'rgba', palette: null }, rgba = new Uint8ClampedArray(size.width * size.height * 4); rgba[((cell(3).y + 27) * size.width + cell(3).x + 37) * 4 + 3] = 1; // @math four bytes a colour; the cell's last pixel, alpha 1
  assert.deepEqual([...toArt(rgbaEntry, { width: size.width, height: size.height, rgba }).filled].flatMap((v, k) => (v ? [k] : [])), [3]); // @math the one cell
  const later = toArt({ ...entry, image: 'b.png' }, { width: size.width, height: size.height, indices, alpha, palette: new Uint8Array(768) }), p = createArtProvider(() => null).set([art, later]); // @math a palette's bytes
  assert.equal(p.angles(2), later); assert.equal(p.angles(1), null); assert.equal(p.angleSlots, 1);
  assert.equal(p.active({ name: '1', gam: null, sky: null }), true, 'a pack of angle sets alone is drawn');
  assert.equal(createArtProvider(() => null).set([]).angleSlots, 0);
});

// A 320 x 200 PCX of the game's layout, every pixel 0, with a palette pattern.
function blankPcx() {
  const runs = [];
  for (let left = 64000; left > 0; left -= 63) runs.push(0xc0 | Math.min(63, left), 0); // @math the picture's pixels; runs of at most 63
  const out = new Uint8Array(128 + runs.length + 1 + 768); out.set(runs, 128); out[128 + runs.length] = 0x0c; // @math the header, the marker, the palette
  for (let i = 0; i < 768; i++) out[128 + runs.length + 1 + i] = (i * 7) & 0xfc; // @math a palette pattern of 6-bit values
  return out;
}

test('the template of a slot\'s angle set: the originals in the cells q f, the in-between cells empty, a guide beside it; N = 8 is the identity', () => {
  const members = new Map([['CARS.SP', cars], ['A_F1.PCX', blankPcx()], ['GENEF.SP', genef], ['DIGGER.SP', digger], ['HOGMIS.SP', hogmis], ['SPARK.SP', new Uint8Array(360)], ['EFFECTS.SP', new Uint8Array(1000)]]); // @math the sparks' four frames; the effects' bytes
  const world = { carShape: [{ w: W, h: H }], shotShape: [{ w: 18, h: 13 }], sprites: [], sdx: { records: [] }, spark: members.get('SPARK.SP'), effects: members.get('EFFECTS.SP'), hogmis }; // @math the shapes' class 0 sizes (the region registry's synthetic world)
  assert.deepEqual(carSlots(members, world), [0, 1, 2, 3, 4, 5, 6, 7]); // @math the eight slots
  const choices = templateChoices(members, world).filter(c => c.kind === 'angles');
  assert.equal(choices.length, 9); assert.ok(choices.some(c => c.value === anglesChoice(3))); // @math every slot and one of each
  for (const [color, p, N] of [['indexed', 1, 16], ['rgba', 2, 24], ['indexed', 1, 8]]) { // @math a few scales and sets
    const t = buildTemplate(members, world, { select: anglesChoice(3), directions: N, scale: p, color }), q = N / OCTANTS; // @math slot 3
    assert.equal(t.manifest.entries.length, 1); assert.equal(t.extras.length, 1);
    const raw = t.manifest.entries[0], image = t.images[0], guide = t.extras[0];
    assert.deepEqual([raw.kind, raw.slot, raw.directions, raw.columns, raw.width, raw.height], ['angles', 3, N, q, W, H]); // @math slot 3
    const ctx = { member: n => members.get(n) ?? null, crc: n => (n === 'CARS.SP' ? parseInt(raw.memberCrc, 16) : null), picture: () => null, palette: () => Uint8Array.from(image.palette ?? new Uint8Array(768)), period: () => null, regions: { has: (m, at, w, h) => m === 'CARS.SP' && w === W && h === H && at % SIZE === 0 && at < cars.length }, car: { w: W, h: H }, slots: 8 }; // @math the template's own palette; eight slots
    const checked = normalizeArtEntry(raw, ctx, image);
    assert.equal(checked.reason, null); assert.deepEqual(checked.warnings, [], 'no ground row warning: the anchors are the originals\'');
    assert.deepEqual([image.width, image.height], [expectedSize(checked.entry).width, expectedSize(checked.entry).height]); assert.deepEqual([guide.width, guide.height], [image.width, image.height]);
    const art = toArt(checked.entry, image);
    assert.deepEqual([...art.filled].flatMap((v, k) => (v ? [k] : [])), Array.from({ length: OCTANTS }, (_, f) => q * f), 'the originals only');
    for (let f = 0; f < OCTANTS; f++) { // the original frame f in the cell q f, enlarged p times
      const c = frameCell(checked.entry, q * f), at = (x, y) => (c.y + y * p) * image.width + c.x + x * p, src = frameOf(3, f)[0];
      assert.equal(image.indices ? image.indices[at(5, 6)] : image.rgba[at(5, 6) * 4 + 3], image.indices ? src : 0xff); // @math a pixel of the frame; opaque
    }
    const ghost = frameCell(checked.entry, 1), mid = ((ghost.y + 10 * p) * guide.width + ghost.x + 10 * p) * 4; // @math a pixel of the first in-between cell
    if (q > 1) assert.ok(guide.rgba[mid + 3] > 0 && guide.rgba[mid + 3] < 0xff, 'the guide shows the faded originals there'); // @math the alpha
    if (N === OCTANTS) { // the identity: every direction record drawn from the set is the archive's own frame
      const world2 = worldOf([{ angle: 777 }]), P = { ai: { racers: [null, { compass: humanCompass(777), hit: 0, entry: 0 }] }, slots: [0, 3] }, provider = createArtProvider(() => null).set([art]); // @math an angle; slot 3
      for (let cam = 0; cam < TURN; cam += 5) { // @math every fifth heading
        const fr = racerFrame(cam, humanCompass(777)), out = angleRecords([{ type: 1, racer: 1, frame: frameOf(3, fr) }], { P, world: world2, heading: cam, camera: cam, mode: 'locked', provider })[0];
        assert.equal(out.art.index, fr); const c = frameCell(checked.entry, out.art.index); assert.equal(image.indices[c.y * image.width + c.x], frameOf(3, fr)[0]); // the set's cell is the archive's frame
      }
    }
  }
  assert.ok(ART.directions.step % OCTANTS === 0, 'the format\'s step is whole octants');
  assert.throws(() => buildTemplate(members, world, { select: anglesChoice(0), directions: 12 }), /12 directions/); // @math not a multiple of 8
});
