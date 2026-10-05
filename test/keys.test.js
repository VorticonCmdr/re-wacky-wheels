import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultKeys, keyName, scancodeOf, codesOf, inputOf, namesOf, rebind, validKeys, loadKeys, saveKeys, SLOTS } from '../src/game/keys.js';
import { versusKeys } from '../src/game/versus-keys.js';

test('the default layout is the game\'s key table with the names SETUP.EXE gives', () => {
  const keys = defaultKeys();
  assert.deepEqual(namesOf(keys, 0), ['LEFT CURSOR', 'RIGHT CURSOR', 'ALT', 'CTRL', 'DOWN CURSOR', 'SPACE']);
  assert.deepEqual(namesOf(keys, 1), ['D', 'F', 'A', 'S', 'G', 'H']);
  assert.ok(validKeys(keys));
});

test('a browser key is a scancode only where SETUP.EXE offers the key', () => {
  assert.equal(scancodeOf('ArrowLeft'), scancodeOf('Numpad4'));
  assert.equal(scancodeOf('AltRight'), scancodeOf('AltLeft'));
  assert.equal(keyName(scancodeOf('KeyQ')), 'Q');
  assert.equal(scancodeOf('F1'), null);
  assert.equal(scancodeOf('Escape'), null);
});

test('a player\'s keys read from the held browser keys, with the page\'s alternatives only on the default accelerate and brake', () => {
  const keys = defaultKeys(), held = new Set(['ArrowUp', 'ArrowLeft']);
  assert.deepEqual(inputOf(k => held.has(k), keys, 0), { left: true, right: false, accelerate: true, fire: false, brake: false, spin: false });
  const moved = rebind(keys, 0, SLOTS.indexOf('accelerate'), scancodeOf('KeyW')).keys;
  assert.ok(!codesOf(moved, 0, SLOTS.indexOf('accelerate')).includes('ArrowUp'));
  assert.equal(inputOf(k => k === 'KeyW', moved, 0).accelerate, true);
  assert.equal(versusKeys(k => k === 'KeyD', keys).p2.left, true);
});

test('a key a player already has, or the other player has, is a conflict; the key of the slot itself changes nothing', () => {
  const keys = defaultKeys();
  assert.equal(rebind(keys, 0, 0, keys[0][1]).conflict, 'you');
  assert.equal(rebind(keys, 0, 0, keys[1][0]).conflict, 'other');
  assert.equal(rebind(keys, 0, 0, keys[0][0]).keys, keys);
  const next = rebind(keys, 1, 2, scancodeOf('KeyJ')).keys;
  assert.deepEqual(namesOf(next, 1), ['D', 'F', 'J', 'S', 'G', 'H']);
  assert.deepEqual(keys[1], defaultKeys()[1], 'the old table is untouched');
});

test('a stored layout is used only when it is whole and valid', () => {
  const store = { data: null, getItem() { return this.data; }, setItem(_, v) { this.data = v; } };
  assert.deepEqual(loadKeys(store), defaultKeys());
  const next = rebind(defaultKeys(), 0, 0, scancodeOf('KeyJ')).keys;
  saveKeys(next, store);
  assert.deepEqual(loadKeys(store), next);
  store.data = JSON.stringify([[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]]);
  assert.deepEqual(loadKeys(store), defaultKeys(), 'scancodes SETUP.EXE does not offer');
  store.data = '{broken';
  assert.deepEqual(loadKeys(store), defaultKeys());
  assert.deepEqual(loadKeys({ getItem() { throw new Error('blocked'); } }), defaultKeys());
});
