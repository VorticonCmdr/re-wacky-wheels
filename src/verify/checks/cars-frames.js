import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { expected } from '../expect.js';

const values = () => ({ cars: expected('cars.frames') });

// CARS.SP is whole slots of whole frames, and each driver's own file is a whole number of the same frames.
function validate(members, C) {
  const frame = C.width * C.height, cars = members.get('CARS.SP');
  assert.ok(cars, 'CARS.SP is an archive member');
  assert.equal(cars.length, C.slots * C.framesPerSlot * frame, 'CARS.SP is slots of frames');
  assert.equal(C.slotBytes, C.framesPerSlot * frame, 'the slot size the loader steps by');
  assert.equal(C.readBytes, C.readFrames * frame, 'the number of bytes read into a slot');
  assert.ok(C.readFrames < C.framesPerSlot, 'a slot has frames the per-driver read does not fill');
  assert.equal(expected('static.read').cars.bytes, C.slots * C.slotBytes, 'the loader reads the whole CARS.SP');
  const sizes = {};
  for (const name of C.drivers) {
    const file = members.get(name);
    assert.ok(file, `${name} is an archive member`);
    assert.equal(file.length % frame, 0, `${name} is a whole number of ${C.width} x ${C.height} frames`);
    sizes[name] = file.length / frame;
  }
  assert.deepEqual(sizes, C.driverFrames, 'frames per driver file');
}

export default {
  id: 'cars-frames',
  claims: ['cars.frames'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(new Map(parseDatDirectory(await ctx.open('WACKY.DAT')).map(e => [e.name, e.data])), values().cars); },
  async discriminate(ctx) {
    const members = new Map(parseDatDirectory(await ctx.open('WACKY.DAT')).map(e => [e.name, e.data])), C = values().cars, t = patch => () => validate(members, { ...C, ...patch });
    return [
      { label: 'frames of 38 x 27', fn: t({ height: C.height - 1, slotBytes: C.framesPerSlot * C.width * (C.height - 1), readBytes: C.readFrames * C.width * (C.height - 1) }) },
      { label: 'frames of 37 x 28', fn: t({ width: C.width - 1, slotBytes: C.framesPerSlot * (C.width - 1) * C.height, readBytes: C.readFrames * (C.width - 1) * C.height }) },
      { label: '7 slots', fn: t({ slots: C.slots - 1 }) },
      { label: '13 frames per slot', fn: t({ framesPerSlot: C.framesPerSlot + 1 }) },
      { label: 'slot step 0x31e1', fn: t({ slotBytes: C.slotBytes + 1 }) },
      { label: 'read of 9 frames', fn: t({ readFrames: C.readFrames + 1 }) },
      { label: 'AJ.SP claimed to hold 5 frames', fn: t({ driverFrames: { ...C.driverFrames, 'AJ.SP': C.driverFrames['AJ.SP'] + 1 } }) },
    ];
  },
};
