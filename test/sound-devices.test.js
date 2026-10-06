import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultDevices, validDevices, loadDevices, saveDevices, speakerSlotOf, SOUND_MENU } from '../src/game/sound-devices.js';
import { menuDef, defaultSettings } from '../src/game/menus.js';
import { enterMenu, stepFrame } from '../src/game/menu.js';
import { decodePcSpeaker, speakerTicksPerSecond } from '../src/formats/pc-speaker.js';

const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const settled = menu => { let m = menu; for (let i = 0; i < 8; i++) m = stepFrame(m, null).menu; return m; }; // the icons settle after a cursor move

test('the lists hold what the page can play and the default is what the game plays with its installed files', () => {
  assert.deepEqual(defaultDevices(), { effects: 1, music: 1 });
  assert.deepEqual(SOUND_MENU.effects, ['SOUND BLASTER', 'PC SPEAKER', 'NO SOUND EFFECTS']);
  assert.deepEqual(SOUND_MENU.music, ['ADLIB', 'GENERAL MIDI', 'NO MUSIC']);
});

test('only item numbers inside the lists are valid, and a choice is kept in the browser', () => {
  assert.ok(validDevices({ effects: 3, music: 2 })); assert.ok(!validDevices({ effects: 4, music: 1 })); assert.ok(!validDevices({ effects: 1, music: 0 })); assert.ok(!validDevices(null)); assert.ok(!validDevices({ effects: 1.5, music: 1 }));
  const storage = memory(); assert.deepEqual(loadDevices(storage), defaultDevices());
  saveDevices({ effects: 2, music: 3 }, storage); assert.deepEqual(loadDevices(storage), { effects: 2, music: 3 });
  storage.setItem('wackywheels.sound', '{"effects":9,"music":1}'); assert.deepEqual(loadDevices(storage), defaultDevices());
  assert.deepEqual(loadDevices({ getItem() { throw new Error('blocked'); } }), defaultDevices());
});

test('GAME OPTIONS has KEYS AND SOUND only in the page\'s menu; it opens KEYBOARD CONTROLS and SOUND DEVICES, which opens the two lists', () => {
  assert.ok(!menuDef('options', defaultSettings()).items.includes('KEYS AND SOUND'));
  const settings = defaultSettings(1, true), options = menuDef('options', settings), at = options.items.indexOf('KEYS AND SOUND');
  assert.ok(at > 0 && options.items.at(-1) === 'LEAVE THIS MENU');
  assert.deepEqual(options.actions[at], { open: 'keysSound' });
  const keysSound = menuDef('keysSound', settings);
  assert.deepEqual(keysSound.items, ['KEYBOARD CONTROLS', SOUND_MENU.item, 'LEAVE THIS MENU']); assert.deepEqual(keysSound.actions, [{ open: 'keys' }, { open: 'sound' }, { back: true }]);
  const sound = menuDef('sound', settings);
  assert.deepEqual(sound.items, [...SOUND_MENU.items, 'LEAVE THIS MENU']); assert.deepEqual(sound.actions.slice(0, 2), [{ open: 'soundEffects' }, { open: 'soundMusic' }]);
  assert.deepEqual(menuDef('soundEffects', settings).items, SOUND_MENU.effects); assert.deepEqual(menuDef('soundMusic', settings).items, SOUND_MENU.music);
});

test('a device list opens on the current device and the item chosen sets it and goes back', () => {
  const settings = { ...defaultSettings(1, true), sound: { effects: 2, music: 3 } };
  const menu = enterMenu('soundEffects', [{ id: 'sound', cursor: 1 }], settings);
  assert.equal(menu.cursor, 2); // PC SPEAKER, the current one
  assert.equal(enterMenu('soundMusic', [{ id: 'sound', cursor: 2 }], settings).cursor, 3);
  const down = settled(stepFrame(menu, 'down').menu); assert.equal(down.cursor, 3);
  const out = stepFrame(down, 'enter').menu;
  assert.equal(out.id, 'sound'); assert.deepEqual(out.settings.sound, { effects: 3, music: 3 });
  assert.deepEqual(settings.sound, { effects: 2, music: 3 }); // the settings object of the menu before is not changed
});

test('the PC speaker plays the record of a sound number: slots 0 to 7 share record 20, NO is a copy of PUF, and a number beyond the records is quiet', () => {
  for (let n = 0; n < 8; n++) assert.equal(speakerSlotOf(n), 20, `driver voice ${n}`); // audio.alias
  for (let n = 8; n < 26; n++) assert.equal(speakerSlotOf(n), n);
  assert.equal(speakerSlotOf(26), 18); assert.equal(speakerSlotOf(27), null); assert.equal(speakerSlotOf(-1), null); assert.equal(speakerSlotOf(null), null); assert.equal(speakerSlotOf(1.5), null);
});

test('the PC speaker handler runs at the timer clock over the period the service stores: 1193182 / 8514 a second', () => {
  assert.equal(Math.floor(0x12305e / 0x8c), 8514); // @ the figures of audio.speaker-rate
  assert.ok(Math.abs(speakerTicksPerSecond() - 1193182 / 8514) < 1e-9);
  const tones = new Uint8Array(140), chunk = new Uint8Array([140, 0, 0, 0, 0, 0, ...tones]); // a chunk of 140 tone bytes: the length dword, 2 skipped bytes, the tones
  const audio = decodePcSpeaker(chunk, 22050), seconds = audio.samples.length / audio.sampleRate;
  assert.ok(Math.abs(seconds - 140 / speakerTicksPerSecond()) < 2 / 22050); // 140 bytes last 140 ticks: a little under one second, not exactly one
  assert.ok(seconds < 1); assert.match(audio.description, /140\.14 ticks/);
});
