import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultVolumes, startVolume, stepVolume, stepPreview, layoutOf, iconAt, frameWait, volumeModel } from '../src/game/volume.js';
import { renderVolume, loadVolumeArt } from '../src/render/volume.js';
import { menuDef, defaultSettings } from '../src/game/menus.js';

test('the game starts with the effects at 240, the music at 250 and the engine at 100', () => {
  assert.deepEqual(defaultVolumes(), { music: 250, effects: 240, engine: 100 });
});

test('a bar is 4 columns for every 5 of the volume, from column 98, 2 rows under its label', () => {
  const rows = layoutOf({ music: 210, effects: 220, engine: 105 }); // the volumes of the capture whose bars were measured
  assert.deepEqual(rows.map(r => r.bar), [{ x: 98, y: 92, width: 168, height: 5 }, { x: 98, y: 112, width: 176, height: 5 }, { x: 98, y: 132, width: 84, height: 5 }]);
  assert.deepEqual(rows.map(r => r.end), [266, 274, 182]);
});

test('a bar is at most 0x33 units wide', () => {
  assert.equal(layoutOf({ music: 255, effects: 255, engine: 255 })[0].bar.width, 204);
  assert.equal(layoutOf({ music: 300, effects: 0, engine: 3 })[0].bar.width, 204);
  assert.equal(layoutOf({ music: 300, effects: 0, engine: 3 })[1].bar.width, 0);
});

test('the icon sits at the selected bar\'s end less 2, 8 rows above its label, and jumps 2 back and 2 down on the other frame', () => {
  const s = startVolume({ music: 210, effects: 220, engine: 105 });
  assert.deepEqual(iconAt(s), { x: 264, y: 82 });
  assert.deepEqual(iconAt({ ...s, wobble: 1 }), { x: 262, y: 84 });
  assert.deepEqual(iconAt({ ...s, cursor: 3 }), { x: 180, y: 122 });
});

test('the icon alternates every frame and a key press resets it', () => {
  let s = startVolume(defaultVolumes());
  s = stepVolume(s, {}).state; assert.equal(s.wobble, 1);
  s = stepVolume(s, {}).state; assert.equal(s.wobble, 0);
  s = stepVolume(s, {}).state; assert.equal(s.wobble, 1);
  assert.equal(stepVolume(s, { down: true }).state.wobble, 0);
  assert.equal(stepVolume(s, { right: true }).state.wobble, 0);
});

test('left and right change the selected volume by 5 within 5 and 255 and report the change even when the clamp holds', () => {
  let s = startVolume({ music: 250, effects: 240, engine: 100 });
  let r = stepVolume(s, { right: true }); assert.equal(r.state.volumes.music, 255); assert.equal(r.changed, 'music');
  r = stepVolume(r.state, { right: true }); assert.equal(r.state.volumes.music, 255); assert.equal(r.changed, 'music');
  s = { ...startVolume({ music: 7, effects: 240, engine: 100 }) };
  r = stepVolume(s, { left: true }); assert.equal(r.state.volumes.music, 5);
  r = stepVolume(r.state, { left: true }); assert.equal(r.state.volumes.music, 5);
  assert.equal(stepVolume(s, {}).changed, null);
});

test('up and down move the selection between the three bars and stop at the ends', () => {
  let s = startVolume(defaultVolumes());
  assert.equal(stepVolume(s, { up: true }).state.cursor, 1);
  s = stepVolume(s, { down: true }).state; assert.equal(s.cursor, 2);
  s = stepVolume(s, { down: true }).state; assert.equal(s.cursor, 3);
  s = stepVolume(s, { down: true }).state; assert.equal(s.cursor, 3);
  assert.equal(stepVolume(s, { right: true }).changed, 'engine');
});

test('Esc leaves', () => {
  assert.equal(stepVolume(startVolume(defaultVolumes()), { escape: true }).done, true);
});

test('the clang preview plays at once, then 0x13 frames after it ended', () => {
  let p = { phase: 'idle', frames: 0 }, r = stepPreview(p, false);
  assert.equal(r.play, true); p = r.preview;
  assert.equal(stepPreview(p, true).play, false); // still sounding
  p = stepPreview(p, false).preview; assert.equal(p.phase, 'waiting');
  for (let i = 0; i < 18; i++) { r = stepPreview(p, false); assert.equal(r.preview.phase, 'waiting'); p = r.preview; }
  r = stepPreview(p, false); assert.equal(r.preview.phase, 'idle');
  assert.equal(stepPreview(r.preview, false).play, true);
});

test('a frame lasts 14 counts of the 136 Hz counter', () => {
  assert.ok(Math.abs(frameWait() - 14000 / 136) < 1e-9);
});

test('VOLUME LEVELS of the Game Options menu opens the screen', () => {
  const def = menuDef('options', defaultSettings(1, false)), i = def.items.indexOf('VOLUME LEVELS');
  assert.ok(i >= 0); assert.deepEqual(def.actions[i], { volume: true });
});

test('the render draws the title, the labels, the bars and the icon over the picture', () => {
  const M = volumeModel(), picture = { indices: new Uint8Array(64000), vga: new Uint8Array(768) };
  const ofont = new Uint8Array(0x3d * 0x40).fill(7), genef = new Uint8Array(20000).fill(9);
  const art = loadVolumeArt({ title: picture }, new Map([['OFONT.SP', ofont], ['GENEF.SP', genef]]));
  const fb = new Uint8Array(64000), s = startVolume({ music: 210, effects: 220, engine: 105 });
  renderVolume(fb, art, s);
  assert.equal(fb[92 * 320 + 98], M.bar.border); // the bar's top left corner
  assert.equal(fb[94 * 320 + 100], M.bar.fill);
  assert.equal(fb[96 * 320 + 265], M.bar.border);
  assert.equal(fb[90 * 320 + 10], 7); // the first label's first glyph (a full block in this font)
  assert.equal(fb[70 * 320 + 108], 7); // the title, centred: 13 characters start at column 108
  assert.equal(fb[82 * 320 + 264], 9); // the icon
});
