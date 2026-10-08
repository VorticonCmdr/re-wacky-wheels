// The region registry of the artwork packs (Stage 4: docs/artpacks.md): every picture of the archive the race world's draw reads, as groups of
// frames { member, what, offset, width, height, count, stride, columns } (frame k is `width` x `height` bytes, column-major, at `offset` + k
// `stride` bytes into the member). A frames entry of a pack may replace exactly these pictures (pack-format.js checks that each frame it names is
// one of them), the garage's template export lays them out, and scripts/check-enhance.js section 5 records every picture the scenarios' draws
// blit and finds none outside the registry. Nothing here is a number of the game's: every group comes from the game's own exported functions and
// data, by reading the byte offsets and lengths of the pictures they hand out (the frames the race draws are views of their member), and where
// the pictures are chosen inside a game routine, by asking that routine with probe states (its result's pictures, never its constants):
// - CARS.SP and the driver files: every whole frame of the cars' class 0 size (38X28.INF, world.carShape), the slots laid out as carFrame has
//   them (one row a slot);
// - DIGGER.SP's ducks and GENEF.SP's explosions (duckPictures); the starter lion's frames (lionFrame, for every frame the countdown shows:
//   createStart and stepStart until the race starts);
// - every object of SPRITE.ATR (world.sprites: their frames, objectFrame goes through all of them);
// - HOGMIS.SP: every whole frame of the shots' size (18X13.INF, world.shotShape): the shots' blocks and the car's rear pictures are frames of
//   that sheet;
// - SPARK.SP (stepSparks, for every spark word sparkShift knows), GENEF.SP's tyre strips (stepEffects through a tyre stack's states from
//   startTyres) and EFFECTS.SP's wheel dust and puffs (stepEffects for every surface of WACKY.SDX on the first track whose loader reads its
//   pictures, its counters run until they repeat), the pit state's picture and its splash overlay (the same for the surfaces that start the
//   pit state, specialSurfaces).
// spriteLayout's curated table (src/sprites.js) is never used: it is wrong for GIGGLES and SPARK.
import { carFrame, createControl } from '../game/control.js';
import { driverFile, driverCount } from '../game/drivers.js';
import { duckPictures } from '../game/duck-rules.js';
import { createStart, stepStart, counting, lionFrame, lionBytes } from '../game/start.js';
import { stepEffects, stepSparks, sparkShift, startTyres } from '../game/effects.js';
import { specialSurfaces } from '../game/surface.js';

// The groups of a run of pictures (their byte offsets in a member, each `size` bytes): consecutive offsets an equal step apart make one group.
function runs(offsets, size) {
  const sorted = [...new Set(offsets)].sort((a, b) => a - b), out = [];
  for (const at of sorted) {
    const last = out[out.length - 1];
    if (last && (last.count === 1 ? at - last.offset >= size : at - (last.offset + (last.count - 1) * last.stride) === last.stride)) { if (last.count === 1) last.stride = at - last.offset; last.count++; }
    else out.push({ offset: at, count: 1, stride: size });
  }
  return out;
}

const cache = new WeakMap();
// The registry of an archive's members (archiveMembers: upper-case names to their bytes, views of the archive) with a world of it (loadTrack:
// its shapes, its object sprites, WACKY.SDX). Kept per members map: the probes ask the game's routines a few thousand times.
export function worldRegions(members, world) {
  const known = cache.get(members);
  if (known) return known;
  const groups = [], add = (member, what, offset, width, height, count, stride = width * height, columns = 0) => { if (count > 0) groups.push({ member, what, offset, width, height, count, stride, columns: columns || count }); };
  const places = new Map(); // the member a byte offset of the archive lies in, as found
  const memberOf = bytes => {
    const key = `${bytes.byteOffset}:${bytes.length}`;
    if (places.has(key)) return places.get(key);
    let found = null;
    for (const [name, data] of members) if (bytes.buffer === data.buffer && bytes.byteOffset >= data.byteOffset && bytes.byteOffset + bytes.length <= data.byteOffset + data.length) { found = { name, at: bytes.byteOffset - data.byteOffset }; break; }
    places.set(key, found);
    return found;
  };
  const car = world.carShape[0], carBytes = car.w * car.h, slot = carFrame(1, 0) - carFrame(0, 0); // the frames of a slot
  const whole = name => Math.floor((members.get(name)?.length ?? 0) / carBytes);
  add('CARS.SP', 'the racers\' cars, a slot a row', 0, car.w, car.h, whole('CARS.SP'), carBytes, slot);
  const drivers = new Set(Array.from({ length: driverCount() }, (_, n) => driverFile(n).toUpperCase()));
  for (const name of drivers) add(name, 'the player\'s car and its crash pictures', 0, car.w, car.h, whole(name));
  const D = duckPictures();
  add(D.member.toUpperCase(), 'the ducks', 0, D.width, D.height, Math.min(D.frames, Math.floor((members.get(D.member.toUpperCase())?.length ?? 0) / D.frameBytes)), D.frameBytes);
  add(D.explosion.member.toUpperCase(), 'the explosions and wrecks', D.explosion.at, D.width, D.height, D.explosion.frames, D.frameBytes);
  // The starter lion: every frame the countdown shows (stepStart until the race runs).
  const lion = lionBytes(members), lions = new Set();
  if (lion) {
    let s = createStart();
    lions.add(s.lion);
    while (counting(s)) { s = stepStart(s).start; lions.add(s.lion); }
    const at = [...lions].map(k => lionFrame({ lion }, k)).filter(b => b.length === carBytes).map(b => memberOf(b));
    for (const r of runs(at.filter(Boolean).map(a => a.at), carBytes)) add(at[0].name, 'the starter lion', r.offset, car.w, car.h, r.count, r.stride);
  }
  // The objects of SPRITE.ATR: every frame of each sprite (objectFrame steps through all of them).
  const seen = new Set();
  for (const sprite of world.sprites) {
    const name = sprite.name.toUpperCase(), size = sprite.width * sprite.height, key = `${name}:${size}`;
    if (seen.has(key) || !members.get(name) || !size) continue;
    seen.add(key);
    add(name, 'an object of SPRITE.ATR', 0, sprite.width, sprite.height, Math.min(sprite.frames, Math.floor(members.get(name).length / size)));
  }
  const shot = world.shotShape[0], shotBytes = shot.w * shot.h;
  add('HOGMIS.SP', 'the shots and the car\'s rear pictures', 0, shot.w, shot.h, Math.floor((members.get('HOGMIS.SP')?.length ?? 0) / shotBytes));
  // The routines' own pictures (the sparks, the tyre strips, the wheel dust, the puffs, the pit state's picture and its overlay): each probe run
  // keeps the pictures in the order the routine draws them, a group for each run of its frames an equal step apart (a counter's frames).
  const probeWorld = { ...world, lion }, base = { ...createControl(), surface: -1, crashed: false, throttle: 0, speed: 0 }, entry = { left: 0, top: 0 }, made = new Set();
  let drawn = null; // the pictures of the probe run going on: member|w x h to their offsets in the order drawn
  const keep = (bytes, width, height) => { const m = memberOf(bytes); if (!m || bytes.length !== width * height) return; const k = `${m.name}|${width}|${height}`; if (!drawn.has(k)) drawn.set(k, []); const list = drawn.get(k); if (!list.includes(m.at)) list.push(m.at); };
  const probe = (what, fn) => {
    drawn = new Map();
    const out = fn();
    for (const [k, offsets] of drawn) {
      const [member, w, h] = k.split('|'), width = Number(w), height = Number(h), step = offsets.length > 1 ? offsets[1] - offsets[0] : width * height;
      const even = step > 0 && offsets.every((at, i) => at === offsets[0] + i * step), parts = even ? [{ offset: offsets[0], count: offsets.length, stride: step }] : offsets.map(at => ({ offset: at, count: 1, stride: width * height }));
      for (const p of parts) { const key = `${member}|${p.offset}|${p.count}|${p.stride}|${width}x${height}`; if (!made.has(key)) { made.add(key); add(member, what, p.offset, width, height, p.count, p.stride); } }
    }
    return out;
  };
  const byte = 0xff; // @math the spark words looked for: a byte's values
  for (let word = 1; word <= byte; word++) {
    if (sparkShift(word) === undefined) continue;
    probe('the sparks', () => { let c = { ...base, spark: word, sparkCount: 0 }; do { const r = stepSparks(c, probeWorld, entry); for (const d of r.after) keep(d.bytes, d.width, d.height); c = r.car; } while (c.spark !== 0); });
  }
  const ctx = (track, extra = {}) => ({ world: probeWorld, track, entryNumber: -1, racing: true, racingNow: true, finished: true, pending: false, tick: 0, fallFrames: 1, geometry: entry, sparksLater: true, ...extra }); // finished: no rear pictures (HOGMIS.SP is listed whole)
  const collect = r => { for (const d of r.after) keep(d.bytes, d.width, d.height); if (r.pit) keep(r.pit.bytes, r.pit.width, r.pit.height); };
  const tracks = [...members.keys()].filter(n => /^\d+\.GAM$/.test(n)).map(n => Number(n.slice(0, -'.GAM'.length))).sort((a, b) => a - b);
  probe('the tyre strips', () => { // the tyre stack: from the pick through its states until it is done
    let c = startTyres(base, entry.top), guard = 0;
    const steps = (members.get('GENEF.SP')?.length ?? 0) + 1; // a bound no machine of the routine reaches
    do { const r = stepEffects(c, ctx(tracks[0] ?? 1)); collect(r); c = r.car; } while (c.tyreState !== 0 && ++guard < steps);
  });
  // A probe run: from the car `c`, stepEffects until `done(car)` or until the pictures of a call repeat; true when it drew a picture of EFFECTS.SP.
  const effects = members.get('EFFECTS.SP');
  const run = (c, context, done) => {
    const met = new Set();
    let drew = false;
    for (;;) {
      const r = stepEffects(c, context), pics = [...r.after.map(d => d.bytes), ...(r.pit ? [r.pit.bytes] : [])].filter(b => effects && b.buffer === effects.buffer && b.byteOffset >= effects.byteOffset && b.byteOffset < effects.byteOffset + effects.length);
      const key = pics.map(b => b.byteOffset).join(',');
      if (pics.length) drew = true;
      collect(r); c = r.car;
      if (done(c) || met.has(key)) return drew;
      met.add(key);
    }
  };
  const values = world.sdx?.records?.length ?? 0, pits = specialSurfaces().pit;
  const firstTrack = fn => { for (const t of tracks) if (fn(t)) return true; return false; }; // the first track whose loader reads the picture: its frames are the same on every track that reads it
  for (let v = 0; v < values; v++) {
    if (pits.includes(v)) { // the surfaces that start the pit state (specialSurfaces): its picture, then its splash overlay
      probe('the pit state\'s picture', () => firstTrack(t => run({ ...base, special: 1, specialValue: v, specialFrame: 0, surface: v }, ctx(t), c => c.specialFrame === 0 || c.special === 0)));
      probe('the pit state\'s splash overlay', () => firstTrack(t => run({ ...base, specialShow: 1, specialRow: 0, specialValue: v }, ctx(t), c => c.specialShow === 0)));
    }
    for (let e = -1; e < slot; e++) probe('the wheel dust and the puffs', () => firstTrack(t => run({ ...base, surface: v, stepWord: 1 }, ctx(t, { entryNumber: e }), () => false))); // every entry of a slot (the dust beside the wheels) and none (the puffs behind)
  }
  const absolute = new Set();
  for (const g of groups) { const data = members.get(g.member); if (!data) continue; for (let k = 0; k < g.count; k++) absolute.add(`${data.byteOffset + g.offset + k * g.stride}:${g.width}x${g.height}`); }
  const out = {
    groups,
    // Whether `width` x `height` bytes at `offset` into `member` are a picture of the registry, and the same by the bytes' place in the archive.
    has: (member, offset, width, height) => { const data = members.get(String(member).toUpperCase()); return Boolean(data) && absolute.has(`${data.byteOffset + offset}:${width}x${height}`); },
    hasAt: (byteOffset, width, height) => absolute.has(`${byteOffset}:${width}x${height}`),
    size: absolute.size,
  };
  cache.set(members, out);
  return out;
}
