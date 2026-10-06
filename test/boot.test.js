// The start-up screens (boot.notice, boot.intro): the notice's lines by the edition, the Apogee scene's passes, the WINTRO cars and the flow of the stages, on synthetic data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editionOf, noticeLines, logoPixelAt, createScene, stepScene, sceneEnds, sizeClass, createCars, markGone, stepCars, createBoot, stepBoot, stageView, fadedOut, fadeOutSteps, countsMs } from '../src/game/boot.js';
import { renderTitle, renderScene } from '../src/render/boot.js';

// TRIG.DAT and NDIST stand-ins: 1920 headings of zero vectors and one NDIST group, so the pivot never moves the camera.
const world = { trig: new DataView(new ArrayBuffer(1920 * 8)), ndist: new DataView(new ArrayBuffer(320 * 70 * 4)) };
const members = names => new Map(names.map(n => [n, new Uint8Array(1)]));

test('the notice has the version line and the edition\'s lines from row 84, ten rows apart, then the copyright and PRESS FIRE, all centred', () => {
  assert.deepEqual(editionOf(members(['42.GAM'])), { level: 3, shareware: false });
  assert.deepEqual(editionOf(members(['20.GAM'])), { level: 2, shareware: false });
  assert.deepEqual(editionOf(members([])), { level: 1, shareware: true });
  const full = noticeLines(editionOf(members(['42.GAM'])));
  assert.deepEqual(full.map(l => l.text), ['WACKY WHEELS VERSION 1.1', 'THIS IS REGISTERED AND UPGRADED.', 'IF YOU DID NOT PURCHASE THIS COPY', 'THEN PLEASE SELECT ORDERING.', 'COPYRIGHT BEAVIS-SOFT 1994', 'PRESS FIRE']);
  assert.deepEqual(full.map(l => l.y), [84, 94, 104, 114, 160, 184]);
  assert.equal(full[0].x, (320 - 8 * 24) / 2);
  assert.equal(full[2].x, Math.trunc((320 - 8 * 33) / 2));
  assert.equal(noticeLines(editionOf(members(['20.GAM'])))[1].text, 'THIS IS REGISTERED.');
  assert.deepEqual(noticeLines(editionOf(members([]))).map(l => l.text), ['WACKY WHEELS VERSION 1.1', 'SHAREWARE RELEASE.', 'COPYRIGHT BEAVIS-SOFT 1994', 'PRESS FIRE']);
});

test('the floor table repeats APOG1\'s 10 x 6 tiles of 32 x 32', () => {
  assert.equal(logoPixelAt(0, 0), 0);
  assert.equal(logoPixelAt(5, 3), 3 * 320 + 5);
  assert.equal(logoPixelAt(320 + 7, 0), 7); // the eleventh column of cells is the first tile column again
  assert.equal(logoPixelAt(0, 192 + 2), 2 * 320); // the seventh row of cells is the first tile row again
  assert.equal(logoPixelAt(33, 65), 65 * 320 + 33);
  assert.equal(logoPixelAt(4096, 0), -1); // outside the 128 x 128 table
});

test('the band grows by 6 rows a pass while the camera drives on, then the camera turns and the strip comes in on the fourth turn', () => {
  let s = createScene();
  assert.deepEqual([s.top, s.height, s.x, s.y, s.heading, s.strip], [129, 1, 0xbcc, 0x834, 0x5a0, false]);
  let sounds = [], pass = 0;
  for (; pass < 21; pass++) { const out = stepScene(s, world); s = out.scene; sounds.push(...out.sounds); }
  assert.deepEqual([s.top, s.height, s.y, s.heading], [3, 127, 0x834 + 6 * 21, 0x5a0]);
  s = stepScene(s, world).scene; // the top falls below 0: the band is whole and the first turn is in the same pass
  assert.deepEqual([s.top, s.height, s.heading, s.turns], [0, 130, (0x5a0 + 0x1e) % 0x780, 1]);
  for (let k = 0; k < 2; k++) s = stepScene(s, world).scene;
  const fourth = stepScene(s, world);
  assert.deepEqual([fourth.scene.strip, fourth.sounds, fourth.scene.turns], [true, [0x0c], 0]);
  s = fourth.scene;
  assert.deepEqual([s.raise, s.distance], [60, 1122]); // the first strip frame is drawn before it moves
  for (let k = 0; k < 9; k++) s = stepScene(s, world).scene;
  assert.deepEqual([s.raise, s.distance, s.count], [24, 222, 0]);
  s = stepScene(s, world).scene;
  assert.deepEqual([s.raise, s.distance, s.count], [20, 140, 1]);
  for (let k = 0; k < 7; k++) s = stepScene(s, world).scene;
  assert.equal(s.count, 8);
  for (let k = 0; k < 4; k++) assert.deepEqual(stepScene(s, world).sounds, []); // the strip comes on once
});

test('the scene ends with the song and 8 counts, or without music after 22 counts', () => {
  const s = { ...createScene(), count: 8 };
  assert.equal(sceneEnds(s, true, true), false);
  assert.equal(sceneEnds(s, true, false), true);
  assert.equal(sceneEnds(s, false, false), false);
  assert.equal(sceneEnds({ ...s, count: 22 }, false, false), true);
  assert.equal(sceneEnds({ ...s, count: 7 }, true, false), false);
});

test('the size class of a distance is (d - 124) / 70, 0 to 9', () => {
  assert.deepEqual([60, 124, 193, 194, 263, 1122, 4000].map(sizeClass), [0, 0, 0, 1, 1, 9, 9]);
});

test('the cars start one after another 400 apart with the sound 8, drive 28 a pass and are gone beyond 1000; the eighth gone ends the intro', () => {
  let cars = markGone(createCars()), passes = 0, sounds = [], done = false;
  assert.deepEqual(cars.list.map(c => c.state), [1, 0, 0, 0, 0, 0, 0, 0]);
  const starts = [];
  while (!done && passes < 1000) { const out = stepCars(cars); sounds.push(...out.sounds); done = out.done; if (out.cars.last !== cars.last) starts.push(passes); cars = markGone(out.cars); passes++; }
  assert.equal(done, true);
  assert.deepEqual(starts, [14, 29, 44, 59, 74, 89, 104]); // 60 + 28 x 15 = 480, 420 from the next car's 60
  assert.deepEqual(sounds, Array(7).fill(8));
  assert.equal(passes, 140); // the eighth car passes 1000 after 34 passes of its own and is found gone in the next
});

test('the flow: the notice fades in and waits, the scene starts its song, a key ends it with the menu song, BEAVIS, WINTRO and its cars, then the menu', () => {
  const input = over => ({ key: null, music: true, songPlaying: true, menuSong: 'MAINMENU', fadeInSteps: 16, fadeOutSteps: 17, fadeStepMs: 10, world, ...over });
  let b = createBoot(members(['42.GAM'])), t = 0, events = [];
  const step = (dt, over = {}) => { t += dt; const out = stepBoot(b, t, input(over)); b = out.boot; events.push(...out.events); return b.stage; };
  step(0); assert.equal(b.stage, 'noticeIn');
  step(100, { key: 'fire' }); assert.equal(step(70), 'notice'); // the key in the fade is dropped
  assert.equal(step(1000), 'notice');
  assert.equal(step(10, { key: 'fire' }), 'noticeOut');
  assert.equal(step(170), 'scene');
  assert.deepEqual(events, [{ song: { name: 'APOGEE', loop: false } }]);
  step(20, { key: 'escape' }); assert.equal(b.stage, 'scene'); // read at the end of the pass
  assert.equal(step(countsMs(7)), 'sceneOut');
  assert.deepEqual(events.at(-1), { song: { name: 'MAINMENU', loop: true } });
  step(170); step(160); assert.equal(b.stage, 'picture');
  assert.equal(step(countsMs(0x110)), 'pictureOut');
  step(170); step(160); assert.equal(b.stage, 'titleWait');
  assert.equal(step(countsMs(0x3c), { key: 'fire' }), 'cars'); // the wait does not read the keys
  assert.deepEqual(events.at(-1), { sound: 8 });
  assert.equal(step(100, { key: 'fire' }), 'cars'); // not before the counter reaches 0x3c
  assert.equal(step(countsMs(0x3c), { key: 'fire' }), 'done');
  assert.equal(stageView('done'), null);
});

test('the notice ends by itself after 0x7d0 counts and the scene without a key when the song has ended', () => {
  const input = over => ({ key: null, music: true, songPlaying: true, menuSong: 'MAINMENU', fadeInSteps: 1, fadeOutSteps: 1, fadeStepMs: 1, world, ...over });
  let b = createBoot(members([])), t = 0;
  const step = (dt, over) => { t += dt; b = stepBoot(b, t, input(over)).boot; return b.stage; };
  step(0); step(1);
  assert.equal(step(countsMs(0x7d0) - 1), 'notice');
  assert.equal(step(2), 'noticeOut');
  step(1); assert.equal(b.stage, 'scene');
  assert.equal(step(countsMs(7) * 60), 'scene'); // the song still plays
  assert.equal(step(countsMs(7), { songPlaying: false }), 'sceneOut');
});

test('the fades: in from black is the picture cut at the level, out is 4 less a step down to 0, with one upload more', () => {
  assert.deepEqual([...fadedOut(Uint8Array.from([63, 10, 0]), 3)], [51, 0, 0]);
  assert.equal(fadeOutSteps(Uint8Array.from([63, 1])), 17);
  assert.equal(fadeOutSteps(Uint8Array.from([4])), 2);
  assert.deepEqual(stageView('pictureOut'), { picture: 'picture', palette: 'out' });
});

test('the drawing: the scene clears the page, the band holds APOG1\'s rows from 54 and the floor below; the title draws only the started cars', () => {
  const logo = { indices: new Uint8Array(64000).map((_, i) => 1 + (Math.floor(i / 320) % 200)) };
  const sizes = Array.from({ length: 10 }, () => ({ w: 2, h: 2, deltas: Int32Array.from([0, 1, 1, 2, 1, 1]) }));
  const art = { logo, rows: new Uint16Array(4096).fill(150), world, strip: new Uint8Array(1506).fill(9), stripSizes: sizes, title: { indices: new Uint8Array(64000).fill(4) }, cars: new Uint8Array(102144).fill(7), carSizes: sizes };
  const fb = renderScene(new Uint8Array(64000).fill(99), art, { ...createScene(), top: 100, height: 30 });
  assert.equal(fb[99 * 320], 0); // above the band: cleared
  assert.equal(fb[100 * 320 + 5], logo.indices[54 * 320 + 5]);
  assert.equal(fb[129 * 320], logo.indices[83 * 320]);
  assert.equal(fb[199 * 320], logo.indices[logoPixelAt(0xbcc, 0x834)]); // the stand-in TRIG and NDIST put every ray on the camera's point
  assert.equal(fb[130 * 320 + 77], logo.indices[logoPixelAt(0xbcc, 0x834)]);
  const title = renderTitle(new Uint8Array(64000), art, { list: [{ state: 1, d: 100 }, { state: 0, d: 60 }, { state: 2, d: 1100 }, ...Array(5).fill({ state: 0, d: 60 })], last: 0 });
  assert.equal(title[148 * 320 + 159], 7); // the first car: top 150 - 2, left 160 - 1
  assert.equal(title.filter(v => v === 7).length, 4);
});
