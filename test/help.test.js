import { test } from 'node:test';
import assert from 'node:assert/strict';
import { helpLines, helpBox } from '../src/game/help.js';
import { createVehicle, stepVehicle } from '../src/game/vehicle.js';
import { buttonCodes } from '../src/game/versus-keys.js';

test('the controls screen of the first player lists the six keys of the configuration', () => {
  const lines = helpLines({});
  assert.equal(lines[0].text, 'PLAYER 1 CONTROLS');
  assert.equal(lines[0].x, 92); // @math centred in 320
  assert.deepEqual(lines.slice(1, 3).map(l => [l.y, l.x]), [[20, 12], [30, 28]]);
  const keys = lines.filter(l => l.text.includes(' - '));
  assert.equal(keys.length, 6);
  assert.equal(keys[0].text, 'STEER LEFT      - LEFT CURSOR');
  assert.equal(keys[5].text, 'HAND BRAKE TURN - SPACE');
  assert.deepEqual(keys.map(l => l.y), [76, 86, 96, 106, 116, 126]);
  assert.ok(!lines.some(l => /GIGGLE/.test(l.text)), 'the single player screen has no giggle line');
  assert.equal(lines.at(-1).text, 'PRESS FIRE TO LEAVE HELP');
});

test('the two player screens add the giggle keys line of their player and the second player has D F A S G H', () => {
  const one = helpLines({ player: 0, versus: true }), two = helpLines({ player: 1, versus: true });
  assert.equal(one.find(l => /GIGGLE/.test(l.text)).text, 'F1 - F6 ARE YOUR GIGGLE KEYS!');
  assert.equal(two.find(l => /GIGGLE/.test(l.text)).text, '1  - 6  ARE YOUR GIGGLE KEYS!');
  assert.equal(two[0].text, 'PLAYER 2 CONTROLS');
  assert.deepEqual(two.filter(l => l.text.includes(' - ') && !/GIGGLE/.test(l.text)).map(l => l.text.at(-1)), ['D', 'F', 'A', 'S', 'G', 'H']);
  assert.deepEqual(helpBox(), { x: 0, y: 0, width: 320, height: 200, border: 38, fill: 44 });
});

test('F1 on the resting ring asks for the controls screen and leaves the ring as it was', () => {
  let v = createVehicle();
  for (let i = 0; i < 12 && v.phase !== 'idle'; i++) v = stepVehicle(v, null).vehicle;
  const out = stepVehicle(v, 'help');
  assert.equal(out.help, true);
  assert.equal(out.vehicle.phase, 'idle');
  assert.equal(out.leave, null);
  assert.equal(stepVehicle(createVehicle(), 'help').help, undefined, 'not while the puffs of the intro show');
});

test('the controls screen ends with Enter, Space or one of the player\'s four buttons, and not with Escape', () => {
  assert.deepEqual(buttonCodes(0), ['Enter', 'AltLeft', 'AltRight', 'ArrowUp', 'ControlLeft', 'ControlRight', 'ArrowDown', 'Numpad2', 'KeyZ', 'Space']);
  assert.deepEqual(buttonCodes(1), ['Enter', 'KeyA', 'KeyS', 'KeyG', 'KeyH']);
  assert.ok(!buttonCodes(0).includes('Escape') && !buttonCodes(1).includes('Escape'));
});
