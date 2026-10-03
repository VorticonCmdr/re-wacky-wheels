import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ car: expected('car.player-frames-observed'), frames: expected('cars.frames'), draw: expected('view.player-car-draw') });

const DRIVERS = ['CARS.SP', 'TIGER.SP'];
const TOOL = { stateOffset: 0x18, frameOffset: 0x1a }; // @math the car words tools/dosbox/car-run.mjs reads first and second

// Every aligned frame of the given members, by CRC-32 -> [member, index]; a CRC that two frames share is not usable.
function frameIndex(dat, bytes, names = DRIVERS) {
  const members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])), seen = new Map(), dup = new Set();
  for (const name of names) {
    const data = members.get(name);
    for (let at = 0, k = 0; at + bytes <= data.length; at += bytes, k++) { const c = crc(data.subarray(at, at + bytes)); if (seen.has(c)) dup.add(c); seen.set(c, [name, k]); }
  }
  return { seen, dup };
}

function validate(dat, r, V, { names = DRIVERS, order = V.car.frameWordOrder } = {}) {
  const K = V.car, F = V.frames, histogram = {};
  assertArchive(r, dat);
  assert.equal(r.samples.length, K.samples, 'the samples');
  assert.deepEqual([K.stateWord, K.frameWord], [TOOL.stateOffset, TOOL.frameOffset], 'the car words the tool read');
  assert.equal(K.frameBytes, F.width * F.height, 'a frame is 38 x 28 bytes');
  assert.deepEqual([K.width, K.height], [F.width, F.height], 'the frame size of cars.frames');
  const { seen, dup } = frameIndex(dat, K.frameBytes, names), picture = {};
  for (const [pointer, hash] of Object.entries(r.frameCrcs)) { assert.ok(seen.has(hash) && !dup.has(hash), `the picture at ${pointer} is one frame of the archive`); picture[pointer] = seen.get(hash); }
  assert.equal(Object.keys(picture).length, Object.keys(K.histogram).length, 'six pictures');
  const tops = new Set(), keyAt = { left: r.keyWords.indexOf('leftByte'), right: r.keyWords.indexOf('rightByte') };
  for (const s of r.samples) {
    const own = s.own, pointer = (((own[6] & 0xffff) | ((own[7] & 0xffff) << 16)) >>> 0), [member, index] = picture[pointer], label = `${member}:${index}`; // @math the dword at word 6 of the record
    histogram[label] = (histogram[label] ?? 0) + 1;
    assert.deepEqual([own[0], own[1], own[2]], [K.width, K.height, K.left], 'the record is 38 x 28 at the left column 141'); // @math words 0 to 2 of the record are width, height and left
    tops.add(own[3]); // @math the top row word of the record
    const [state, frame] = s.car, left = s.keys[keyAt.left] === 1, right = s.keys[keyAt.right] === 1; // @math the car words +0x18 and +0x1a come first
    if (state === 0 && !left && !right) assert.equal(label, `${K.straight[0]}:${K.straight[1]}`, 'straight with no steering key');
    if (left) assert.ok([`${K.steering[0]}:${K.steering[1]}`, `${K.steering[0]}:${K.steering[2]}`].includes(label), 'the left pictures with the left key'); // @math the first two steering frames are the left ones
    if (right) assert.ok([`${K.steering[0]}:${K.steering[3]}`, `${K.steering[0]}:${K.steering[4]}`].includes(label), 'the right pictures with the right key'); // @math the last two are the right ones
    if (state === K.pressedState) assert.ok(frame === 1 || frame === 3, 'the first call after a press has the frame word 1 or 3'); // @math the left and right first frames
    if (state === K.driftState && frame === 0) assert.equal(label, `${K.drift[0]}:${K.drift[1]}`, 'the drift picture'); // @math the drift state's first frame word
  }
  assert.deepEqual([...tops].sort((a, b) => a - b), K.topRows, 'the two top rows');
  assert.deepEqual(histogram, K.histogram, 'the samples of each picture');
  // The frame word runs 0, 1, 2, 3, 4 over the pictures TIGER 0, TIGER 1, CARS 88, TIGER 2, TIGER 3: for each frame word the picture most samples show.
  const byWord = new Map();
  for (const s of r.samples) { const pointer = (((s.own[6] & 0xffff) | ((s.own[7] & 0xffff) << 16)) >>> 0), [member, index] = picture[pointer]; if (s.car[0] === 0 || s.car[0] === K.pressedState) { const w = s.car[1], label = `${member}:${index}`; byWord.set(w, byWord.get(w) ?? {}); byWord.get(w)[label] = (byWord.get(w)[label] ?? 0) + 1; } } // @math the car word +0x1a
  order.forEach(([member, index], w) => { const counts = byWord.get(w) ?? {}, best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]; assert.equal(best, `${member}:${index}`, `the frame word ${w} mostly shows ${member} frame ${index}`); });
}

export default {
  id: 'obs-carframes',
  claims: ['car.player-frames-observed'],
  obs: ['car-1'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('car-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('car-1'), V = values(), K = V.car, k = patch => ({ ...V, car: { ...K, ...patch } });
    const edit = fn => ({ ...r, samples: r.samples.map(fn) });
    return [
      { label: 'straight is frame 87', fn: () => validate(dat, r, k({ straight: ['CARS.SP', 87] })) }, // @math the neighbouring frame
      { label: 'drift is frame 88', fn: () => validate(dat, r, k({ drift: ['CARS.SP', 88] })) }, // @math the neighbouring frame
      { label: 'the steering frames in another order', fn: () => validate(dat, r, k({ steering: ['TIGER.SP', 3, 2, 1, 0] })) }, // @math the frames reversed
      { label: 'a histogram with one more straight', fn: () => validate(dat, r, k({ histogram: { ...K.histogram, 'CARS.SP:88': K.histogram['CARS.SP:88'] + 1 } })) },
      { label: 'top rows 163 and 164', fn: () => validate(dat, r, k({ topRows: [K.topRows[0] - 1, K.topRows[1] - 1] })) },
      { label: 'a left column of 140', fn: () => validate(dat, r, k({ left: K.left - 1 })) },
      { label: 'the frame word order swapped', fn: () => validate(dat, r, V, { order: [['TIGER.SP', 1], ['TIGER.SP', 0], ['CARS.SP', 88], ['TIGER.SP', 2], ['TIGER.SP', 3]] }) }, // @math the first two swapped
      { label: 'only CARS.SP searched', fn: () => validate(dat, r, V, { names: ['CARS.SP'] }) },
      { label: 'a record 37 wide', fn: () => validate(dat, edit((s, i) => (i === 0 ? { ...s, own: s.own.map((v, j) => (j === 0 ? v - 1 : v)) } : s)), V) }, // @math the width word
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
