// The kart angle sets (Stage 4, M4: docs/artpacks.md, docs/enhancements.md, Stage 4 as built, M4). An artwork pack may give a slot of CARS.SP
// a set of N = 8q directions (q for each of the original's eight direction frames: index q f is the original entry f, indices rising as the
// original entries rise, no mirroring). The enhancer then draws a computer racer, the other human of a two player game and the human of the
// intro from the set at an index picked by how far the racer's direction is turned from the camera's, between the game's own steps; the game's
// choice of frame (racers.js racerFrame: the frame of the racer's compass word in the camera's sector) is never changed, nor anything else it
// decided: the records keep their bytes, sizes, places and order, and only a shallow copy carries the set's picture (`art`).
// - The mapping (angleMapping) comes from the game's exported functions alone, with no literal of the original's numbers: the octants are
//   frameTable()'s rows, a sector is the turn over them, `rear` is the frame of a racer facing the camera's way (racerFrame(0,
//   humanCompass(0)): the kart seen from behind) and `sense` whether the frame rises (+1) or falls (-1) as the racer turns one sector on
//   (humanCompass(sector)). The continuous frame of a racer turned d TRIG entries from the camera is x = rear + sense d / sector (mod the
//   octants).
// - angleIndex(M, f, d, N, mode): 'off' q f (the game's frame from the set); 'locked' (the default) q f moved toward round(q x) by at most
//   floor(q / 2), so the picture never strays half an octant from the game's frame, which keeps the game's separate roundings of the
//   racer's octant and the camera's sector (a segment at 119 and the camera at 121 give the game's frame 3 while round(x) is 4: locked
//   stays within floor(q / 2) of 3q), and N = 8 is the game's frame itself; 'free' round(q x) mod N, monotonic in d, which may differ from
//   the game's frame by an octant at its edges (N = 8 is not the identity there).
// - The directions (routeDirections, racerDirection): a computer racer faces the route entry it drives along, the chord of the entry's
//   rasterised points (ai.js routeEntries: points[0] to points[last]) turned into TRIG entries from the loaded table itself (the angle of
//   the chord from entry 0's, signed by the table's own turning: cross(T[0], T[1])). Directions stay on ticks: a racer turns where its entry
//   changes, which is where the game's own frame changes; no blended travel or smoothing (both would invent motion). A world's route is
//   checked first (the convention check): humanCompass of the chord's angle must be the entry's own compass word for at least
//   ANGLES.agreement of the entries at least ANGLES.minChord long (rd.derived-words: the chords lie within a cosine of 0.999865 of the
//   angle word the compass word is the octant of); a world that fails, and a short entry anywhere, face the centre of the compass word's
//   octant (k sector where humanCompass(k sector) is the word). The other human of a two player game faces its car's heading at the tick
//   (the heading its compass word is made from: versus.js viewRacers); the human of the intro, whose compass word is fixed (render/scene.js
//   introHuman), faces its word's octant centre.
// - angleRecords(records, ...): which records are drawn from a set. A record whose bytes are a direction frame (entries 0 to 7) of a slot of
//   CARS.SP that has a set: remapped by its direction when it is a racer's record (type 1) of that slot, its bytes the frame the game's rule
//   chose (racerFrame at the heading the records were made by and the racer's compass word) and the racer not hit (a hit racer's hitSpin
//   walks the entries 0 to 7); any other racer's such record (a hit racer's spin, a racer's frame of another slot's bytes) is drawn from the
//   set at q e, its own entry, so a slot's art stays one sheet. Never: the own car (type 0: its straight picture is a direction frame of its
//   slot, but its lean, drift, spin and crash pictures are the driver files', so all of them keep the archive's art or a frames entry's),
//   entries 8 to 11 (the idle and glance pictures), the GENEF.SP crash and wreck pictures, the starter lion, the objects, the shots and the
//   ducks (their DIGGER.SP frames follow another rule: frames packs may replace them). A
//   cell the set left empty (no opaque pixel: the garage's template leaves the in-between cells empty) is drawn as the game's frame, from the
//   set's cell q f, or where that is empty too from the archive (or a frames entry of those bytes).
import { ANGLES } from './config.js';
import { models } from './models.js';
import { frameTable, racerFrame } from '../game/racers.js';
import { humanCompass, carsBySeat } from '../game/versus-seat.js';
import { carFrame } from '../game/control.js';
import { routeEntries } from '../game/ai.js';
import { viewRacers, viewSlots } from '../game/versus.js';

const mod = (v, n) => ((v % n) + n) % n;
// The representative of v modulo n in [-n/2, n/2).
export const wrapSigned = (v, n) => v - n * Math.floor(v / n + 1 / 2); // @math half a period either way

// The mapping from the game's functions: { table, octants, sector, rear, sense, turn, centres (the octant centre of each compass word, in TRIG
// entries), frameOf, compassOf }. `table`, `frameOf` and `compassOf` may be another table and functions (the tests derive rear and sense on
// synthetic ones); the defaults are the game's frameTable(), racerFrame and humanCompass, read once.
export function angleMapping({ table = null, frameOf = racerFrame, compassOf = humanCompass, turn = models().view.turn } = {}) {
  const T = table ?? frameTable(), octants = T.length, sector = turn / octants, rear = frameOf(0, compassOf(0), T);
  const sense = mod(frameOf(0, compassOf(sector), T) - rear, octants) === 1 ? 1 : -1;
  const centres = new Float64Array(octants).fill(NaN);
  for (let k = 0; k < octants; k++) { const c = compassOf(k * sector); if (c >= 0 && c < octants && Number.isNaN(centres[c])) centres[c] = k * sector; }
  return { table: T, octants, sector, rear, sense, turn, centres, frameOf, compassOf };
}
let gameMapping = null;
export const mapping = () => (gameMapping ??= angleMapping());

// The index of a set of N directions for a record of the game's frame f, its racer turned d TRIG entries from the camera (wrapSigned of the
// racer's direction less the camera's heading; fractions allowed).
export function angleIndex(M, f, d, N, mode) {
  const q = N / M.octants, base = q * f;
  if (mode === 'off') return base;
  const near = Math.round(q * (M.rear + (M.sense * d) / M.sector)); // round(q x)
  if (mode === 'free') return mod(near, N);
  const half = Math.floor(q / 2); // @math half an octant of the set's directions, rounded down
  return mod(base + Math.min(Math.max(wrapSigned(near - base, N), -half), half), N);
}

// The TRIG angle of a world vector (dx, dy) from the loaded table: the angle from entry 0's vector, in the table's own turning sense (the sign
// of cross(T[0], T[1])), in entries, 0 to the turn.
function trigAngle(world, dx, dy, turn) {
  const V = models().view, half = V.trigEntryBytes / 2, t = world.trig; // @math the second dword of an entry is half an entry on
  const x0 = t.getInt32(0, true), y0 = t.getInt32(half, true), x1 = t.getInt32(V.trigEntryBytes, true), y1 = t.getInt32(V.trigEntryBytes + half, true);
  const sigma = Math.sign(x0 * y1 - y0 * x1) || 1;
  return mod((sigma * (Math.atan2(dy, dx) - Math.atan2(y0, x0)) * turn) / (2 * Math.PI), turn); // @math a turn in radians
}

// A world's route directions and its convention check, kept per world: { directions (TRIG entries, one an entry: the chord's angle, or the
// octant centre of its compass word for a short entry or a world that fails), chords (the chords' angles, NaN where short), long, agree, ok }.
const routes = new WeakMap();
export function routeDirections(world, M = mapping()) {
  const known = routes.get(world);
  if (known?.M === M) return known;
  const entries = world.route ? routeEntries(world.route) : [], chords = new Float64Array(entries.length).fill(NaN);
  let long = 0, agree = 0;
  entries.forEach((e, i) => {
    const p = e.points;
    if (p.length < 2) return; // @math a chord needs two points
    const dx = p[p.length - 1][0] - p[0][0], dy = p[p.length - 1][1] - p[0][1];
    if (Math.hypot(dx, dy) < ANGLES.minChord) return;
    chords[i] = trigAngle(world, dx, dy, M.turn); long++;
    if (M.compassOf(mod(Math.round(chords[i]), M.turn)) === e.compass) agree++;
  });
  const ok = long > 0 && agree >= ANGLES.agreement * long;
  const directions = Float64Array.from(entries, (e, i) => (ok && !Number.isNaN(chords[i]) ? chords[i] : M.centres[e.compass]));
  const out = { M, directions, chords, long, agree, ok, entries: entries.length };
  routes.set(world, out);
  return out;
}

const INTRO_COMPASS = 0; // the intro human's compass word (render/scene.js introHuman: the human's word at the start)

// The racer of a type 1 record in the present state P, as the game's draw list has it: { slot, compass, hit, direction } or null (the duck
// game's ducks, a record of no racer). `view` caches the two player list of the frame (versus.js viewRacers, viewSlots).
export function racerOf(r, P, world, M, view = {}) {
  const n = r.racer;
  if (P.duck) return null; // the ducks' frames are DIGGER.SP's, by another rule
  if (P.intro && n === 0) return { slot: P.slots?.[0], compass: INTRO_COMPASS, hit: 0, direction: M.centres[INTRO_COMPASS] };
  if (P.versus) {
    view.list ??= viewRacers(P); view.slots ??= viewSlots(P);
    const racer = view.list[n];
    if (!racer || n === 0) return null;
    const direction = racer.human ? carsBySeat(P)[1 - P.versus.viewer].heading : routeDirections(world, M).directions[racer.entry];
    return { slot: view.slots[n], compass: racer.compass, hit: racer.hit, direction };
  }
  const racer = P.ai?.racers?.[n];
  if (!racer || n === 0) return null;
  return { slot: P.slots?.[n], compass: racer.compass, hit: racer.hit, direction: routeDirections(world, M).directions[racer.entry] };
}

// The records of a frame with the kart angle sets' art: each record drawn from a set is a shallow copy with `art` { asset (the set's art,
// art.js), index, direct (remapped by its direction) }; every other record is the game's own. `heading` is the heading the records' frames
// were chosen by (sceneRecords' frames.heading: the tick's), `camera` the floor's heading (the whole camera's at 1x, which moves between ticks
// with smooth motion; the fine one above 1x), `mode` the setting (RENDER.angles), `provider` the art provider (angles(slot)), `log(entry)` the
// checks' recorder of each record drawn from a set ({ seat, racer, slot, entry, f, index, direct, bytes, direction, camera }).
export function angleRecords(records, { P, world, heading, camera, mode, provider, seat = 0, log = null, M = mapping() }) {
  const cars = world.carFrames?.cars, shape = world.carShape?.[0];
  if (!cars || !shape || !provider?.angleSlots) return records;
  const size = shape.w * shape.h, first = carFrame(0, 0), per = carFrame(1, 0) - first, view = {}; // carFrame is a slot's frames from `first`, `per` a slot (its claim is read once a frame, not once a record)
  return records.map(r => {
    const bytes = r.frame;
    if (r.type === 0) return r; // the own car: its lean, drift, spin and crash pictures are the driver files', so its straight picture stays with them
    if (r.skip || !bytes || bytes.buffer !== cars.buffer || bytes.length !== size) return r;
    const at = bytes.byteOffset - cars.byteOffset;
    if (at < 0 || at >= cars.length || at % size !== 0) return r;
    const frame = at / size, slot = Math.floor((frame - first) / per), e = frame - first - slot * per;
    if (e >= M.octants) return r; // the idle and glance pictures
    const set = provider.angles(slot);
    if (!set) return r;
    const N = set.entry.directions, q = N / M.octants, filled = set.filled;
    let index = q * e, direct = false, f = e, direction = null;
    if (r.type === 1) {
      const who = racerOf(r, P, world, M, view);
      if (who && who.slot === slot && who.hit !== 1 && !Number.isNaN(who.direction)) {
        f = M.frameOf(heading, who.compass, M.table);
        if (f === e) { direction = who.direction; index = angleIndex(M, f, wrapSigned(direction - camera, M.turn), N, mode); direct = true; }
      }
    }
    if (filled && !filled[index]) { index = q * e; direct = false; } // an empty cell: the game's frame
    if (filled && !filled[index]) return r; // the game's frame left empty too: the archive's (or a frames entry's)
    log?.({ seat, racer: r.racer, type: r.type, slot, entry: e, f, index, direct, bytes, direction, camera, directions: N });
    return { ...r, art: { asset: set, index, direct } };
  });
}
