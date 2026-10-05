import test from 'node:test';
import assert from 'node:assert/strict';
import { createAi, stepAi, gridPositions, rankPlayer, routeEntries } from '../src/game/ai.js';
import { frameTable, compassSector, racerFrame, racerRecords } from '../src/game/racers.js';

// A synthetic track: one straight route record from (1024, 1024) to (1024, 3024) (the words are without the 0x400 bias), a grid of zeros and a speed table whose value is half its index.
const world = () => ({
  route: [[0, 0, 0, 2000, 0, 5, 0]], pos: { grid: new Uint16Array(4096), trailer: 27 }, start: { x: 1024, y: 1100 }, aiSpeeds: Array.from({ length: 200 }, (_, i) => Math.floor(i / 2)),
});
const env = (extra = {}) => ({ pos: world().pos, trailer: 27, total: 6, playerKey2: -1e9, playerPlace: 8, ...extra });

test('the grid line is the first racer\'s x, then 0x14 apart from the entry 4 down, wrapping from 0 to 7', () => {
  assert.deepEqual(gridPositions({ x: 1280, y: 1600 }).map(p => p.x), [1280, 1300, 1320, 1340, 1360, 1220, 1240, 1260]);
  assert.ok(gridPositions({ x: 1280, y: 1600 }).every(p => p.y === 1600));
});

test('a start that does not lie on the first route entry gets no computer racers', () => {
  const w = world(); w.start = { x: 1024, y: 1024 + 5000 };
  assert.equal(createAi(w), null);
});

test('the racers start on the route as far along as their row is from its start, with a sideways offset and a mode by side', () => {
  const ai = createAi(world());
  assert.deepEqual(ai.racers.map(r => r.mode), [0, 4, 4, 4, 4, 3, 3, 3]);
  assert.deepEqual(ai.racers.map(r => r.lateral), [0, 20, 40, 60, 80, 60, 40, 20]);
  assert.ok(ai.racers.every(r => r.index === 76 && r.entry === 0 && r.compass === 5 && r.state === 0 && r.first === 0x18));
  assert.deepEqual(ai.racers.map(r => r.second), [22, 28, 30, 34, 40, 50, 58, 60]);
  const r = ai.racers[1]; // the table values replace the indices: word +8 level, word +0xa the level + 0x3c - 10 x (7 - n), word +0xc stays an index
  assert.deepEqual([r.level, r.fast, r.slow], [44, 44, 25]); // the table at 89 (half of 89, rounded down), the same index for racer 1, and 89 - 4 - 60
  assert.equal(routeEntries(world().route)[0].points.length, 2001);
});

test('state 0 walks the word +0xc points, the offset wears off by 4 a frame and the mode clears when it reaches 0', () => {
  let ai = createAi(world());
  ai = stepAi(ai, env()).ai;
  const r = ai.racers[1];
  assert.deepEqual([r.y, r.x, r.index, r.first, r.lateral, r.mode], [1024 + 76 + 24, 1044, 76 + 25, 0x17, 16, 4]); // 25 steps: the points 76 to 100
  for (let f = 0; f < 4; f++) ai = stepAi(ai, env()).ai;
  assert.equal(ai.racers[1].mode, 0); // 20, 16, 12, 8, 4 then 0
  assert.equal(ai.racers[1].lateral, 0);
  assert.equal(stepAi(ai, env()).ai.racers[1].x, 1024);
});

test('the state changes follow the counters: 0 for 24 frames, then 1 for the racer\'s own counter, then 2', () => {
  let ai = createAi(world());
  const seen = [];
  for (let f = 0; f < 60; f++) { ai = stepAi(ai, env()).ai; seen.push(ai.racers[1].state); }
  assert.equal(seen.indexOf(1), 0x17); // the 24th frame counts the first counter down to 0
  assert.equal(seen.indexOf(2), 0x18 + 27); // then 28 frames in state 1
  assert.equal(ai.racers[1].level, 44);
});

test('the push adds 0x3c points to a racer in state 2 when another racer is within 0x14', () => {
  const ai = createAi(world());
  const racers = ai.racers.map(r => ({ ...r, state: 2, mode: 0, lateral: 0 }));
  racers[2].x = racers[1].x + 5; racers[2].y = racers[1].y + 5; // within 0x14 of each other
  const out = stepAi({ ...ai, racers }, env());
  assert.ok(out.events.includes('the push of racers close together'));
  assert.equal(out.ai.racers[1].index - 76, 44 + 0x3c);
  assert.equal(out.ai.racers[4].index - 76, 44); // racer 4 has nobody close by
});

test('a racer 4 to 7 far behind the player enters state 3 with the boosted advance; racers 5 to 7 add the player\'s place bonus', () => {
  const ai = createAi(world());
  const racers = ai.racers.map(r => ({ ...r, state: 2, mode: 0, lateral: 0, key2: 0 }));
  racers.forEach((r, n) => { r.x = 1024; r.y = 1100 + 40 * n; }); // nobody close together: 40 rows apart
  const out = stepAi({ ...ai, racers }, env({ playerKey2: 1000, playerPlace: 1 }));
  assert.ok(out.events.includes('the catch-up helper and state 3'));
  assert.equal(out.ai.racers[3].state, 2); // below racer 4: no helper
  const boost = [0x10, 0x1c, 0x24, 0x28], base = 44;
  [4, 5, 6, 7].forEach((n, k) => { assert.equal(out.ai.racers[n].state, 3); assert.equal(out.ai.racers[n].second, 0x7d00); assert.equal(out.ai.racers[n].fast, base + boost[k]); });
  const walked = n => out.ai.racers[n].index - 76;
  assert.deepEqual([4, 5, 6, 7].map(walked), [base + 0x10, base + 0x1c + 3, base + 0x24 + 4, base + 0x28 + 5]);
});

test('state 3 ends when its counter ends or the player is not far enough ahead', () => {
  const ai = createAi(world());
  const racers = ai.racers.map(r => ({ ...r, state: 3, mode: 0, lateral: 0, second: 5, fast: 60, key2: 0 }));
  const far = stepAi({ ...ai, racers }, env({ playerKey2: 1000 })).ai.racers[5];
  assert.deepEqual([far.state, far.second], [3, 4]);
  const near = stepAi({ ...ai, racers }, env({ playerKey2: 0 })).ai.racers[5];
  assert.equal(near.state, 2);
});

test('the compass sector rounds the heading to the nearest of 8 and the table is (6 - sector + compass) mod 8', () => {
  assert.deepEqual([0, 119, 120, 360, 480, 1480, 1900, 1919].map(compassSector), [0, 0, 1, 2, 2, 6, 0, 0]);
  const table = frameTable();
  assert.deepEqual(table[0], [6, 7, 0, 1, 2, 3, 4, 5]);
  assert.deepEqual(table[2], [4, 5, 6, 7, 0, 1, 2, 3]);
  assert.deepEqual(table[7], [7, 0, 1, 2, 3, 4, 5, 6]);
  assert.equal(racerFrame(480, 0), 4);
  assert.equal(racerFrame(1480, 2), 2);
});

test('the player\'s place is its position by the first key, highest first, and stays on a tie', () => {
  assert.equal(rankPlayer([10, 30, 20, 5, 1, 0, 0, 0], 8), 3);
  assert.equal(rankPlayer([99, 30, 20, 5, 1, 0, 0, 0], 8), 1);
  assert.equal(rankPlayer([0, 30, 20, 5, 1, 2, 3, 4], 3), 8);
  assert.equal(rankPlayer([20, 20, 5, 5, 1, 0, 0, 0], 6), 6); // a tie keeps the place
  assert.equal(rankPlayer([5, 30, 20, 7, 1, 0, 0, 0], 8), 4);
});

test('the computer racers are drawn at the projected column with the frame of the compass, none for racer 0', () => {
  const w = world();
  assert.deepEqual(racerRecords(w, null, { x: 0, y: 0 }, [{ n: 0 }], 0, [0]), []);
});
