import test from 'node:test';
import assert from 'node:assert/strict';
import { humanCompass, messageAt, winnerLayout } from '../src/game/versus.js';
import { composeSplit, drawStrips, flipViewport } from '../src/render/versus.js';
import { versusKeys } from '../src/game/versus-keys.js';
import { createVehicle, stepVehicle, selectedSlot } from '../src/game/vehicle.js';
import { menuDef } from '../src/game/menus.js';

test('a human racer\'s compass word is the table entry of the sector of its heading', () => {
  assert.equal(humanCompass(480), 0); // sector 2: the table starts 6, 7, 0
  assert.equal(humanCompass(1440), 4); // sector 6
  assert.equal(humanCompass(0), 6);
});

test('the message of a round end is a box 8 columns a character plus 8 wide, centred, from the row 92 with the text 4 in', () => {
  const m = messageAt('THAT WAS A DOUBLE KILL!'); // 23 characters: a box of 192 columns from the column 64
  assert.deepEqual([m.x, m.y], [64 + 4, 92 + 4]);
});

test('the split screen takes the first viewer from its row 100 down and the second one 100 rows higher', () => {
  const a = new Uint8Array(320 * 200).fill(1), b = new Uint8Array(320 * 200).fill(2), out = new Uint8Array(320 * 200);
  composeSplit(a, b, out);
  assert.deepEqual([out[0], out[99 * 320 + 5], out[100 * 320], out[199 * 320 + 319]], [2, 2, 1, 1]);
});

test('the flip puts the rows of a viewer upside down and leaves the strips alone', () => {
  const fb = new Uint8Array(320 * 200); for (let y = 0; y < 200; y++) fb.fill(y % 251, y * 320, (y + 1) * 320);
  flipViewport(fb, 0);
  assert.deepEqual([fb[110 * 320], fb[199 * 320], fb[105 * 320]], [199, 110, 105]); // the rows 110 to 199 reversed, the strip as it was
  flipViewport(fb, 1);
  assert.deepEqual([fb[10 * 320], fb[99 * 320], fb[5 * 320]], [99, 10, 5]);
});

test('the strips draw both players\' names, counters and scores at the observed places', () => {
  const ofont = new Uint8Array(41 * 64).fill(7), lap = new Uint8Array(0x46ec + 90 * 10).fill(9), icons = new Uint8Array(0x10000);
  const fb = new Uint8Array(320 * 200); // the strip's own picture is not needed here: only what is drawn
  drawStrips(fb, { ofont, lap, icons }, [{ name: 'A', ammo: 3, score: 12, held: 0 }, { name: 'B', ammo: 0, score: 0, held: 0 }]);
  assert.ok(fb[101 * 320 + 4] !== 0 && fb[1 * 320 + 4] !== 0, 'the names at (4, 101) and (4, 1)');
  assert.equal(fb[100 * 320 + 154], 9); // the counter's first digit at (154, 100)
  assert.equal(fb[0 * 320 + 263], 9); // the score's first digit of the player two at (263, 0)
  const plain = new Uint8Array(320 * 200); drawStrips(plain, { ofont, lap, icons }, [{ name: 'A', ammo: 3, score: 12, held: 0 }, { name: 'B', ammo: 0, score: 0, held: 0 }], { shoot: false });
  assert.equal(plain[102 * 320 + 222], 46); // the two player race's box under the missing word has the strip's colour
});

test('the two players\' keys are the arrows, Alt, Ctrl, Down and Space for the first and D, F, A, S, G, H for the second', () => {
  const keys = versusKeys(code => ['ArrowLeft', 'KeyA', 'KeyS'].includes(code));
  assert.deepEqual(keys.p1, { left: true, right: false, accelerate: false, fire: false, brake: false, spin: false });
  assert.deepEqual(keys.p2, { left: false, right: false, accelerate: true, fire: true, brake: false, spin: false });
});

test('the winner screen names the player with the larger score, clamped to the hits, or the draw', () => {
  const won = winnerLayout([5, 3], 5, [7, 3]);
  assert.equal(won.lines[0].text, 'TIGI IS THE OVERALL WINNER!'); assert.deepEqual(won.cars, [{ slot: 7, x: 141, y: 86 }]);
  const drawn = winnerLayout([7, 5], 5, [7, 3]); // both clamped to 5
  assert.equal(drawn.lines[0].text, 'YOU HAVE BOTH DRAWN!'); assert.deepEqual(drawn.cars.map(c => c.x), [120, 160]);
  assert.equal(winnerLayout([1, 5], 5, [7, 3]).lines[0].text, 'PEGGLES IS THE OVERALL WINNER!');
  assert.deepEqual(won.lines[1], { text: 'PRESS FIRE', x: 120, y: 180 });
});

test('the second player\'s vehicle screen cannot choose the car the first player took', () => {
  let v = createVehicle({ player: 1, taken: 7 });
  for (let i = 0; i < 12; i++) v = stepVehicle(v, null).vehicle;
  assert.equal(selectedSlot(v), 7);
  assert.equal(stepVehicle(v, 'fire').vehicle.phase, 'idle'); // refused
  assert.equal(stepVehicle({ ...v, taken: null }, 'fire').vehicle.phase, 'chosen'); // the first player's pass has no exclusion
});

test('the main menu\'s third item is the shoot-out and PLAY FOR n HITS has four items', () => {
  const main = menuDef('main');
  assert.deepEqual(main.actions[2], { shoot: true });
  const hits = menuDef('hits');
  assert.deepEqual(hits.items, [' PLAY FOR 5  HITS ', ' PLAY FOR 10 HITS ', ' PLAY FOR 15 HITS ', ' PLAY FOR 20 HITS ']);
  assert.deepEqual(hits.actions.map(a => a.hits), [1, 2, 3, 4]);
});
