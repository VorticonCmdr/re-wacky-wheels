import test from 'node:test';
import assert from 'node:assert/strict';
import { createDope, triggerDope, stepDope, overlayDope } from '../src/game/dope.js';

const HOLD = { left: true, still: true, starter: true, accelerate: false, brake: true, alone: true };

test('dope trigger: left and the brake held through 54 calls, and nothing less', () => {
  let d = createDope(), started = false;
  for (let t = 1; t <= 53; t++) { const o = triggerDope(d, HOLD, t); d = o.dope; started ||= o.started; }
  assert.equal(started, false);
  assert.equal(d.count, 53);
  const o = triggerDope(d, HOLD, 54);
  assert.equal(o.started, true);
  assert.equal(o.dope.on, true);
  assert.equal(o.dope.count, 0);
  assert.equal(o.dope.y, 0xc7);
});

test('dope trigger: any release clears the counter (brake, left, throttle, a moving car, a gone starter, two screens)', () => {
  const run = change => { let d = createDope(); for (let t = 1; t <= 30; t++) d = triggerDope(d, HOLD, t).dope; return triggerDope(d, { ...HOLD, ...change }, 31).dope.count; };
  assert.equal(run({}), 31);
  for (const change of [{ brake: false }, { left: false }, { accelerate: true }, { still: false }, { starter: false }]) assert.equal(run(change), 0);
  assert.equal(run({ alone: false }), 31); // the one-screen gate only blocks the start, the counter goes on
  let d = createDope(); for (let t = 1; t <= 60; t++) d = triggerDope(d, { ...HOLD, alone: false }, t).dope;
  assert.equal(d.on, false);
});

test('dope scene: rises 8 a call to 0x70, waits 16, talks 20 with the bubble and the belch, sinks 4 a call', () => {
  let d = triggerDope({ ...createDope(), count: 53 }, HOLD, 100).dope, tick = 100, belches = 0, ys = [], frames = [], bubbles = 0;
  for (let n = 0; n < 200 && d.on; n++) {
    const o = stepDope(d, tick); d = o.dope; if (o.belch) belches++;
    ys.push(o.draw.face?.y ?? null); frames.push(o.draw.face?.frame ?? null); if (o.draw.bubble) bubbles++;
    tick++;
  }
  assert.equal(d.on, false);
  assert.equal(belches, 1);
  assert.deepEqual(ys.slice(0, 3), [0xc7, 0xbf, 0xb7]); // @spec dope.scene the rise by 8 from 0xc7
  assert.ok(ys.includes(0x70));
  assert.equal(Math.max(...ys.filter(y => y !== null)), 0xc7);
  assert.ok(frames.includes(1) && frames.includes(0));
  assert.ok(bubbles >= 15 && bubbles <= 25, `bubble calls ${bubbles}`);
});

test('dope overlay: DOPE.SP over the start of the GIGGLES.SP buffer, the rest kept', () => {
  const g = new Uint8Array(20).fill(7), dope = new Uint8Array(5).fill(9), out = overlayDope(g, dope);
  assert.deepEqual([...out.slice(0, 6)], [9, 9, 9, 9, 9, 7]);
  assert.equal(g[0], 7);
});
