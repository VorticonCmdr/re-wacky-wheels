import test from 'node:test';
import assert from 'node:assert/strict';
import { demoSpec, demoKinds, demoModel, parseBmc, bmcStart, bmcStep, turnPage } from '../src/game/demo.js';
import { drawDemoSky, drawDemoLogo, drawDemoText } from '../src/render/demo.js';
import { menuDef, defaultSettings } from '../src/game/menus.js';

const le16 = n => [n & 255, (n >> 8) & 255];
const bmc = records => Uint8Array.from([...le16(records.length), ...records.flatMap(([d, a]) => [...le16(d & 0xffff), a])]);

test('the three demos play the tracks 7, 1 and 2 with their pages', () => {
  assert.deepEqual(demoKinds(), ['ordering', 'instructions', 'attract']);
  const o = demoSpec('ordering'), i = demoSpec('instructions'), a = demoSpec('attract');
  assert.equal(o.track, 7); assert.equal(o.mode, 2); assert.equal(o.pages.length, 11); assert.equal(o.pages[0], 'OR1.PCX'); assert.equal(o.pages[10], 'OR11.PCX');
  assert.equal(i.track, 1); assert.equal(i.mode, 2); assert.equal(i.pages.length, 8); assert.equal(i.pages[7], 'INT8.PCX');
  assert.equal(a.track, 2); assert.equal(a.mode, 3); assert.deepEqual(a.pages, ['OR1.PCX']);
  for (const s of [o, i, a]) { assert.equal(s.laps, 10); assert.equal(s.class, 1); assert.equal(s.engine, 1); assert.equal(s.detail, 2); }
});

test('a .BMC file is a count word and records of an int16 duration and an action byte', () => {
  const records = parseBmc(bmc([[37, 0], [7, 4], [-3, 5], [1, 0x40]]));
  assert.deepEqual(records, [{ duration: 37, action: 0 }, { duration: 7, action: 4 }, { duration: -3, action: 5 }, { duration: 1, action: 0x40 }]);
  assert.throws(() => parseBmc(Uint8Array.from([...le16(3), 1, 0, 0])), /BMC records|needs|out of range|truncated/i);
});

test('every frame takes the current record\'s action, a duration counts down and 0 or less lasts one frame', () => {
  let s = bmcStart(parseBmc(bmc([[3, 4], [0, 1], [-5, 2], [2, 0x40]])));
  const seen = [];
  for (let i = 0; i < 8; i++) { const r = bmcStep(s); seen.push(r.controls); s = r.state; if (r.controls.end) break; }
  assert.deepEqual(seen.map(c => (c.accelerate ? 'A' : '') + (c.left ? 'L' : '') + (c.right ? 'R' : '') + (c.end ? 'E' : '')), ['A', 'A', 'A', 'L', 'R', 'E']);
});

test('the action bits are left 1, right 2, accelerate 4, fire 8, brake 0x10, the hand brake turn 0x20 and the end flag 0x40', () => {
  const at = a => bmcStep(bmcStart(parseBmc(bmc([[5, a]])))).controls;
  assert.deepEqual(at(0x01), { left: true, right: false, accelerate: false, fire: false, brake: false, spin: false, end: false });
  assert.equal(at(0x02).right, true); assert.equal(at(0x04).accelerate, true); assert.equal(at(0x08).fire, true);
  assert.equal(at(0x10).brake, true); assert.equal(at(0x20).spin, true); assert.equal(at(0x40).end, true);
  const both = at(0x26); assert.equal(both.right, true); assert.equal(both.accelerate, true); assert.equal(both.spin, true); assert.equal(both.left, false);
});

test('past the last record the demo ends', () => {
  let s = bmcStart(parseBmc(bmc([[1, 4]])));
  const first = bmcStep(s); assert.equal(first.controls.accelerate, true); s = first.state;
  assert.equal(bmcStep(s).controls.end, true);
});

test('the slides turn forward while the page is not the last and back while it is not the first', () => {
  assert.equal(turnPage(1, 11, { next: true }), 2);
  assert.equal(turnPage(11, 11, { next: true }), 11);
  assert.equal(turnPage(5, 11, { previous: true }), 4);
  assert.equal(turnPage(1, 11, { previous: true }), 1);
  assert.equal(turnPage(5, 11, { next: true, previous: true }), 5, 'both keys go on and back');
  assert.equal(turnPage(11, 11, { next: true, previous: true }), 10, 'the last page: only the back key counts');
});

test('ORDERING INFO, ORDERING and INSTRUCTIONS start the demos', () => {
  const settings = defaultSettings(1, true), main = menuDef('main', settings), info = menuDef('info', settings);
  assert.deepEqual(main.actions[main.items.indexOf('ORDERING INFO')], { slides: 'ordering' });
  assert.deepEqual(info.actions[info.items.indexOf('ORDERING')], { slides: 'ordering' });
  assert.deepEqual(info.actions[info.items.indexOf('INSTRUCTIONS')], { slides: 'instructions' });
});

test('the page picture replaces rows 0 to 129 and leaves the floor alone', () => {
  const picture = { indices: new Uint8Array(64000).fill(5) }, fb = new Uint8Array(64000).fill(9);
  drawDemoSky(fb, picture);
  assert.equal(fb[129 * 320 + 319], 5); assert.equal(fb[130 * 320], 9); assert.equal(fb[0], 5);
});

test('the logo is 92 x 41 from the third piece of OFONT.SP, transparent, at (4, 155)', () => {
  const D = demoModel(), ofont = new Uint8Array(16444); ofont.fill(7, D.logo.offset, D.logo.offset + D.logo.width * D.logo.height);
  ofont[D.logo.offset] = 0; // the top left pixel is transparent
  const fb = new Uint8Array(64000).fill(1);
  drawDemoLogo(fb, ofont);
  assert.equal(fb[155 * 320 + 4], 1); assert.equal(fb[156 * 320 + 4], 7); assert.equal(fb[195 * 320 + 95], 7); assert.equal(fb[196 * 320 + 95], 1); assert.equal(fb[155 * 320 + 96], 1);
});

test('the attract mode writes DEMO MODE at (232, 6) in the small font', () => {
  const ofont = new Uint8Array(0x3d * 0x40).fill(7), fb = new Uint8Array(64000);
  drawDemoText(fb, ofont);
  assert.equal(fb[6 * 320 + 232], 7); assert.equal(fb[6 * 320 + 231], 0);
});
