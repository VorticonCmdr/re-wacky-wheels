// What the draw of the player's own car adds around it, once a frame (effects.ground-dust, effects.car-rear, effects.sparks, effects.pit): the one-row jiggle, the pit state's
// picture and splash overlay, the wheel dust, the pictures at the car's rear and the sparks. The game does this in the routines that queue and draw the car's entry
// (obj1+0x16a3c, +0x14bcc), which run once a frame before the next call of the logic; the port runs this after each call, with the state that call left.
import { K } from '../evidence/k.js';

const GROUND = () => K({ routine: 0x14bcc, ground: 0x14e5f, table: 0x10660, entries: [1, 2, 3, 5, 6, 7], shifts: [17, 10, 0, 18, 8, 1], flagFirst: 0, flagSecond: 0x80, loaded: 1, kept: 3, idStart: 0xff, record: { first: { offset: 0x100, stride: 0x108, width: 0x10a, height: 0x10c, frames: 0x112 }, second: { offset: 0x104, stride: 0x114, width: 0x116, height: 0x118, frames: 0x11e } }, firstDown: 0x10, tall: { rows: 0x18, sound: 0x10, lefts: [1, 0x19], down: 4 }, puffs: { lefts: [0, 0x1c], down: 0x14 }, racing: 2, jiggle: 1, member: 'EFFECTS.SP' }, 'effects.ground-dust');
const REAR = () => K({ routine: 0x14afc, call: 0x15042, member: 'HOGMIS.SP', blocks: { idle: 2574, start: 3510, fast: 4446 }, frameBytes: 0xea, width: 0x12, height: 0xd, lefts: [5, 0x10], down: 0xb, idleSpeed: 10, fastSpeed: 0x64, startStage: 1, startSound: 0x18, wrapAbove: 3, clearAbove: 2 }, 'effects.car-rear');
const SWITCH = () => K({ holdIdle: true }, 'effects.rear-switch'); // the step that switches to the race leaves an idle word of the rear pictures where it is
const SPARKS = () => K({ site: 0x152f2, member: 'SPARK.SP', frameBytes: 90, width: 10, height: 9, down: 0x10, shifts: { 3: 0, 4: 0x1e }, frames: 4 }, 'effects.sparks');
const TYRES = () => K({ trigger: 0x132d6, machine: 0x1f7aa, states: { picked: 0xffff, down: 1, up: 2, done: 3 }, member: 'GENEF.SP', pictures: { full: 13269, cut: 12961 }, width: 0x1c, height: 0xb, gap: 0xb, left: 5, carDown: 0xc, down: { steps: [0x1e, 0x14, 0xa], floors: [0x72, 0x80, 0x8e] }, up: { steps: [0xa, 0x14, 0x1e], caps: [0xc7, 0xc7, 0xb1] }, sound: 0x16 }, 'effects.tyres');
const CRASH = () => K({ routine: 0x16a3c, states: { flight: 1, hold: 2, fall: 3, gone: 4 }, flightFrames: 8, flightStep: 6, flightStop: 0x72, hold: 0xb, fallStep: 4, fallMax: 0xc7, gone: 0xd, crack: { member: 'CRACK.SP', left: 0x76, top: 0x5a, width: 0x54, height: 0x3e, color: 0x14, sound: 0xb, from: 2, lines: [[0x77, 0x16, 0x5f, 0x29], [0xa8, 0xb9, 0x5a, 0x35], [0xc6, 0xf7, 0x5d, 0x2b], [0xf7, 0x128, 0x2b, 0x38], [0xc3, 0xf1, 0x91, 0xb2], [0xf1, 0xd7, 0xb2, 0xc2], [0x78, 0x2c, 0x86, 0xa9]] } }, 'effects.crash');
const PIT = () => K({ entry: 0x141d1, terrains: [6, 15], wall: 3, show: { first: 1, after: 2 }, overlay: { left: 0x8d, top: 0xa8, width: 0x26, height: 0x1c, frameBytes: 0x428, frames: 4, hideRows: 2 }, car: { frameBytes: 0x300, frames: 8, shape: '32X24.INF', sound: 0xe }, enterSound: 0xf, exitSound: 0xf }, 'effects.pit');

const WORD_BITS = 16; // @math the id words are 16 bits wide and compared sign-extended (movsx, obj1+0x14f16)
const signed16 = v => (v << WORD_BITS) >> WORD_BITS;

// The words of the car record this module keeps (the car's record words +0x26, +0x54 and +0x62 of the racer record, +0x5e, +0x68, +0x6e, +0x72, +0x7a), at their race-start values.
export function effectsStart() {
  return { stepWord: 0, fxId: GROUND().idStart, fxRecord: -1, fxCounter: 0, jiggle: 0, flame: 0, flameStage: 0, specialValue: 0, specialFrame: 0, drawnJump: 0, tyreState: 0, tyreWords: [0, 0, 0], tyreOn: 0, crashState: 0, crashFrame: 0, crashY: 0, crashStamp: 0, crackSound: 0 };
}

// A tyre stack taken while the screen effect is idle (obj1+0x132d6): the state word 0xffff, the tyre off the car, the three strips from the entry's top row down in steps of 0xb.
export function startTyres(car, top) {
  const T = TYRES();
  return { ...car, tyreState: T.states.picked, tyreOn: 0, tyreWords: [top, top + T.gap, top + T.gap + T.gap] };
}

// The throttle sites of the control routine on the stage word of the rear pictures (effects.car-rear): the accelerate flag off clears a stage above 2 (obj1+0x195c7), the flag on with
// the boost off starts stage 1 at frame 0 when the stage is 0 (obj1+0x19673).
export function clearFlame(car, accelerate) {
  if (!accelerate && car.flameStage > REAR().clearAbove) car.flameStage = 0;
  return car;
}
export function startFlame(car) {
  if (car.flameStage === 0) { car.flameStage = REAR().startStage; car.flame = 0; }
  return car;
}

// The picture words of the SDX record `value` for the picture `which` ('first' or 'second') on the track: its offset in EFFECTS.SP, the frame bytes, the size, the frame count, and
// whether the loader read it for this track (the flag byte is 1, obj1+0x175cf and obj1+0x176c2).
function pictureOf(world, value, which, track) {
  const G = GROUND(), R = G.record[which], record = world.sdx.records[value];
  if (!record) return null;
  const dv = new DataView(record.buffer, record.byteOffset, record.byteLength);
  return { value, offset: dv.getUint32(R.offset, true), stride: dv.getInt16(R.stride, true), width: dv.getInt16(R.width, true), height: dv.getInt16(R.height, true), frames: dv.getInt16(R.frames, true), flag: record[(which === 'first' ? G.flagFirst : G.flagSecond) + track - 1] };
}

const flat = (bytes, width, height, x, y) => ({ bytes, width, height, x, y });
const effectBytes = (world, p, counter) => (p.flag === GROUND().loaded ? world.effects.subarray(p.offset + counter * p.stride, p.offset + counter * p.stride + p.width * p.height) : null);

// The choice of a picture (obj1+0x14ee5 to +0x14f6e, +0x15090 to +0x1511a) and the frame counter it moves: a flag byte of 3 keeps the car's last record and id.
function choose(car, world, track, which) {
  const G = GROUND(), own = pictureOf(world, car.surface, which, track);
  if (!own) return null;
  const keep = own.flag === G.kept, p = keep ? (car.fxRecord >= 0 ? pictureOf(world, car.fxRecord, which, track) : null) : own;
  if (!p) return null;
  const id = keep ? car.fxId : signed16(own.offset);
  let counter = car.fxCounter;
  if (id !== car.fxId) counter = car.dustStart ?? 0; // the first frame of a new dust picture: the cars of a two player game start it one on (versus.race-rules)
  else { counter += 1; if (counter === p.frames) counter = 0; }
  return { id, p, counter, bytes: effectBytes(world, p, counter) };
}

// One call of the draw. `car` is the car after the logic call; ctx: { world, track, entryNumber: the entry of the slot record the car's picture is (a CARS.SP frame of the slot) or -1, racing,
// finished, pending (a head-on hit the contact pass took in this draw: the wreck call follows), tick, fallFrames (the A frames of the slot's fall table), geometry: { left, top } } with the entry's
// left column and its top row before the jiggle. Returns { car, sounds, up (rows the picture rises), hidden (the car's own picture is not drawn), pit (the pit state's picture or null), after (the blits
// that follow the car, in order), unproven }.
export function stepEffects(car0, ctx) {
  const G = GROUND(), R = REAR(), S = SPARKS(), P = PIT(), { world, track, geometry } = ctx;
  const car = { ...car0 }, sounds = [], after = [], unproven = [];
  let up = 0, pit = null, hidden = false, crash = null, lifeLost = false;
  const down = car.crashed || Boolean(ctx.pending); // the crash word is set by the contact pass before the entry is drawn (obj1+0x133f4)
  // the car routine (obj1+0x16a3c): the pit state's picture and its end, or the jiggle
  if (car.special !== 0) {
    sounds.push({ id: P.car.sound, guard: true });
    const record = pictureOf(world, car.specialValue, 'second', track), bytes = record ? effectBytes(world, { ...record, stride: P.car.frameBytes }, car.specialFrame) : null;
    if (bytes) pit = { bytes, width: record.width, height: record.height };
    else unproven.push('the pit state\'s picture where the terrain record has none loaded for the track');
    car.specialFrame += 1; if (car.specialFrame === P.car.frames) car.specialFrame = 0;
    if (car.surface !== P.wall && car.surface !== car.specialValue) { car.special = 0; car.specialRow = 0; car.specialShow = P.show.after; sounds.push(P.exitSound); }
  }
  if (car.special === 0 && car.stepWord > 0 && ctx.racing && !down) { // obj1+0x16d8c: after the pit state ended in this call, too
    if (car.jiggle !== 0) { up = G.jiggle; car.jiggle = 0; } else car.jiggle = G.jiggle;
  }
  const entry = { left: geometry.left, top: geometry.top - up };
  // the car's own picture and the splash overlay (obj1+0x14cec): the first two overlay rows replace the car
  if (car.specialShow !== 0 && !down) {
    if (car.specialShow === P.show.first && car.specialRow < P.overlay.hideRows) hidden = true;
    const record = pictureOf(world, car.specialValue, 'first', track), bytes = record ? effectBytes(world, { ...record, stride: P.overlay.frameBytes }, car.specialRow) : null;
    if (bytes) after.push(flat(bytes, P.overlay.width, P.overlay.height, P.overlay.left, P.overlay.top));
    else unproven.push('the pit overlay where the terrain record has no picture loaded for the track');
    car.specialRow += 1; if (car.specialRow === P.overlay.frames) car.specialShow = 0;
  }
  // the tyre on the car (obj1+0x14ddf): after the car, with the hop height taken off while the jump word is not 0
  if (car.tyreOn !== 0 && !down && car.special === 0) { const T = TYRES(), at = T.pictures.cut; after.push(flat(world.lion.subarray(at, at + T.width * T.height), T.width, T.height, entry.left + T.left, entry.top + T.carDown - (car.drawnJump !== 0 ? car.jumpHeight : 0))); }
  // the ground effects (obj1+0x14e5f): not in the air (the word before the landing frame clears it), not in the pit state, not crashed
  if (car.drawnJump === 0 && car.special === 0 && !down) {
    const shift = ctx.glanceNow ? -1 : G.entries.indexOf(ctx.entryNumber); // a glance that starts in the pass puts a frame of the bump table in the entry, none of the table's entries (effects.ground-dust)
    const which = shift >= 0 ? 'first' : 'second', picked = choose(car, world, track, which);
    if (shift >= 0) {
      if (picked && car.stepWord !== 0 && picked.bytes) after.push(flat(picked.bytes, picked.p.width, picked.p.height, entry.left + G.shifts[shift], entry.top + G.firstDown));
    } else {
      // the rear pictures come first (obj1+0x15042): not once the race is over, and not while the racer is hit (the human's hit word is 0 here)
      if (!ctx.finished) {
        const speed = car.throttle, stage = car.flameStage;
        let block = null;
        if (stage === 0) { if (speed >= 0 && speed <= R.idleSpeed) block = R.blocks.idle; }
        else if (stage <= R.startStage) { if (car.special === 0) sounds.push({ id: R.startSound, guard: true }); block = R.blocks.start; }
        if (speed > R.fastSpeed) block = R.blocks.fast;
        if (block !== null) {
          const at = block + car.flame * R.frameBytes, bytes = world.hogmis.subarray(at, at + R.frameBytes);
          for (const left of R.lefts) after.push(flat(bytes, R.width, R.height, entry.left + left, entry.top + R.down));
        }
      }
      if (picked && car.stepWord !== 0) {
        if (picked.p.height === G.tall.rows) {
          sounds.push({ id: G.tall.sound, guard: true });
          if ((ctx.racingNow ?? ctx.racing) && picked.bytes) for (const left of G.tall.lefts) after.push(flat(picked.bytes, picked.p.width, picked.p.height, entry.left + left, entry.top + G.tall.down));
        } else if ((ctx.racingNow ?? ctx.racing) && picked.bytes) for (const left of G.puffs.lefts) after.push(flat(picked.bytes, picked.p.width, picked.p.height, entry.left + left, entry.top + G.puffs.down));
        if (!picked.bytes) unproven.push('the dust where the terrain record has no picture loaded for the track (the flag byte is not 1: the game reads whatever its pointer holds)');
      }
    }
    if (picked) { car.fxId = picked.id; car.fxRecord = picked.p.value; car.fxCounter = car.stepWord === 0 ? 0 : picked.counter; if (car.stepWord !== 0) car.dustStart = 0; } // the start offset is for the first dust picture of a drive only
    else if (car.stepWord === 0) car.fxCounter = 0;
  }
  // the three strips of the tyre effect (obj1+0x15283): the states 1 to 3
  if (car.tyreState !== 0 && car.tyreState !== TYRES().states.picked) { const T = TYRES(), at = T.pictures.full; for (const row of car.tyreWords) after.push(flat(world.lion.subarray(at, at + T.width * T.height), T.width, T.height, entry.left + T.left, row)); }
  // the crash states of the car routine (obj1+0x16bd9): the contact pass starts them in this draw, the next draws step them
  const Cr = CRASH(), St = Cr.states;
  if (ctx.pending && car.crashState === 0) { car.crashState = St.flight; car.crashFrame = 0; car.crashY = entry.top; }
  else if (car.crashState !== 0) {
    if (car.crashState === St.flight) {
      const row = car.crashFrame; car.crashFrame = row + 1 === Cr.flightFrames ? 0 : row + 1; car.crashY -= Cr.flightStep; crash = { table: 'flight', row };
      if (car.crashY <= Cr.flightStop) { car.crashY = Cr.flightStop; car.crashState = St.hold; crash = { table: 'fall', row: 0 }; car.crashFrame = 0; car.crashStamp = ctx.tick; }
    } else if (car.crashState === St.hold) {
      crash = { table: 'fall', row: car.crashFrame };
      if (ctx.tick - car.crashStamp >= Cr.hold) car.crashState = St.fall;
    } else if (car.crashState === St.fall) {
      car.crashFrame = car.crashFrame + 1 === ctx.fallFrames ? 0 : car.crashFrame + 1; crash = { table: 'fall', row: car.crashFrame }; car.crashY += Cr.fallStep;
      if (car.crashY > Cr.fallMax) { car.crashY = Cr.fallMax; car.crashState = St.gone; car.crashStamp = ctx.tick; }
    } else if (ctx.tick - car.crashStamp >= Cr.gone) lifeLost = true; // the car is not drawn; the try is lost
    if (car.crashState === St.gone && !crash) { hidden = true; after.length = 0; }
  }
  if (crash) crash.top = car.crashY;
  const cracked = car.crashState >= Cr.crack.from;
  if (cracked && car.crackSound === 0) { car.crackSound = 1; sounds.push(Cr.crack.sound); }
  // the sparks (obj1+0x152f2), counted after the draw (obj1+0x155a4); the frame of a touch answers it before the entry is drawn, so the caller of that frame draws them after the answer (stepSparks)
  if (!ctx.sparksLater) { const sparked = stepSparks(car, world, entry); after.push(...sparked.after); Object.assign(car, sparked.car); }
  // the tyre state machine (obj1+0x1f7aa), once a call after the scene draw
  if (car.tyreState !== 0) {
    const T = TYRES(), words = [...car.tyreWords], last = words.length - 1;
    let state = car.tyreState === T.states.picked ? T.states.down : car.tyreState;
    if (state === T.states.down) {
      T.down.steps.forEach((step, i) => { words[i] = Math.max(words[i] - step, T.down.floors[i]); });
      if (words.every((w, i) => w === T.down.floors[i])) state = T.states.up;
    } else if (state === T.states.up) {
      for (let i = last; i >= 0; i--) words[i] = Math.min(words[i] + T.up.steps[i], T.up.caps[i]); // the third word first (obj1+0x1f885)
      if (words[last] === T.up.caps[last]) car.tyreOn = 1;
      if (words.every((w, i) => w === T.up.caps[i])) state = T.states.done;
    } else if (state === T.states.done) state = 0;
    car.tyreState = state; car.tyreWords = words;
  }
  // the racer words of the rear pictures advance for every racer (obj1+0x162d2); the draw of the step that switches to the race (the counter reaches the start count) leaves an idle word where it is (effects.rear-switch)
  if (!(SWITCH().holdIdle && ctx.switching && car.flameStage === 0)) advanceFlame(car);
  return { car, sounds, up, hidden, pit, after, unproven, crash, cracked, lifeLost, entry };
}

// The sparks of the car's entry (obj1+0x152f2): the picture of the frame the spark counter names at the side the word names, and the counter on by one after the draw (the end of the 4 frames clears the word).
export function stepSparks(car0, world, entry) {
  const S = SPARKS(), car = { ...car0 }, after = [];
  if (car.spark !== 0) {
    const shift = S.shifts[car.spark];
    if (shift !== undefined) { const at = car.sparkCount * S.frameBytes; after.push(flat(world.spark.subarray(at, at + S.frameBytes), S.width, S.height, entry.left + shift, entry.top + S.down)); }
    car.sparkCount += 1; if (car.sparkCount === S.frames) { car.spark = 0; car.sparkCount = 0; }
  }
  return { car, after };
}

// The racer words of the rear pictures go on by one (obj1+0x162d2): the call of every frame, also of the intro's passes, which draw no picture of the car.
export function advanceFlame(car) {
  const R = REAR();
  car.flame += 1;
  if (car.flame > R.wrapAbove) { car.flame = 0; if (car.flameStage !== 0) car.flameStage += 1; }
  return car;
}

// The rows a hop raises the car's picture (obj1+0x14c8f to +0x14ce0): the height word while the jump runs.
export const hopOf = car => (car.jump !== 0 ? car.jumpHeight : 0);
