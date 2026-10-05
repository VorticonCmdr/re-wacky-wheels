import test from 'node:test';
import assert from 'node:assert/strict';
import { pageLines, startCredits, startPage, stepCredits, stepTicks, stepMs, creditsModel } from '../src/game/credits.js';
import { renderCredits, loadCreditsArt } from '../src/render/credits.js';
import { menuDef, defaultSettings } from '../src/game/menus.js';

const run = (c, n, input = {}) => { for (let i = 0; i < n; i++) { const r = stepCredits(c, input); if (r.finished) return { finished: true, c }; c = r.state; } return { c }; };

test('the lines of a page are centred from the row 0x4c, 10 apart, with their last column', () => {
  const rows = pageLines(1);
  assert.equal(rows.length, 12);
  assert.deepEqual(rows[0], { text: 'PROGRAMMING AND DESIGN', x: 72, y: 76, end: 247 }); // 22 characters of 8: (320 - 176) / 2
  assert.deepEqual(rows[2], { text: '', x: 0, y: 96, end: 0 }); // a blank line records 0
  assert.equal(rows[11].y, 186);
});

test('the car goes right along the first line, then left along the next non-blank one', () => {
  let c = startCredits();
  assert.deepEqual(c.cells, [{ x: 72, y: 76 }]);
  c = run(c, 1).c;
  assert.equal(c.x, 80); assert.equal(c.frame, 1);
  c = run(c, 20).c; // the car's left edge ends at 240, the last column of the text being 247
  assert.equal(c.x, 240); assert.equal(c.line, 1); assert.equal(c.cells.length, 22);
  c = run(c, 1).c; // 248 is past the end: the second line, the other way, the next slot
  assert.equal(c.line, 2); assert.equal(c.dir, 0); assert.equal(c.slot, 1);
  assert.equal(c.x, 223 - 38); // the line's last column less the car's width
  assert.deepEqual(c.cells.at(-1), { x: 223, y: 86 }); // the cell at the car's right edge
});

test('a blank line is skipped and the page ends after its last line', () => {
  let c = startCredits(), seen = [1];
  for (let i = 0; i < 400 && c.phase === 'run'; i++) { c = stepCredits(c).state; if (seen.at(-1) !== c.line) seen.push(c.line); }
  assert.deepEqual(seen, [1, 2, 4, 5, 7, 8, 10, 11]);
  assert.equal(c.phase, 'tail');
});

test('the car leaves 0x10 past the end of the last line and runs its frames in place for 0x89 steps, then the next page starts with the slot kept', () => {
  let c = startCredits();
  while (c.phase === 'run') c = stepCredits(c).state;
  const last = c.line, dir = c.dir, slot = c.slot, x = c.x;
  assert.equal(last, 11); assert.equal(dir, 0); // the fourth line of text goes left
  let steps = 0;
  while (c.phase === 'tail') { const r = stepCredits(c); steps++; if (r.state?.phase === 'tail') { c = r.state; assert.equal(c.x, x); } else { c = r.state; break; } }
  assert.equal(steps, 0x89);
  assert.equal(c.page, 2); assert.equal(c.slot, slot); assert.equal(c.line, 1); assert.equal(c.frame, 0); assert.equal(c.dir, 1);
  assert.equal(c.cells.length, 1);
});

test('a key during the tail turns the page at once, Esc leaves at any step, and the fifth page ends the credits', () => {
  let c = startCredits();
  while (c.phase === 'run') c = stepCredits(c).state;
  assert.equal(stepCredits(c, { advance: true }).state.page, 2);
  assert.deepEqual(stepCredits(c, { escape: true }), { finished: true });
  assert.deepEqual(stepCredits(startCredits(), { escape: true }), { finished: true }, 'Esc leaves while the car drives');
  assert.equal(stepCredits(startCredits(), { advance: true }).state.phase, 'run', 'a key does nothing while the car drives');
  for (let page = 1; page <= 4; page++) { let p = startPage(page, 0); while (p.phase === 'run') p = stepCredits(p).state; assert.equal(stepCredits(p, { advance: true }).state.page, page + 1); }
  let p5 = startPage(5, 3); while (p5.phase === 'run') p5 = stepCredits(p5).state;
  assert.deepEqual(stepCredits(p5, { advance: true }), { finished: true });
});

test('the slots wrap after the eighth and the frames after the eighth', () => {
  let c = { ...startCredits(), slot: 7, frame: 7 };
  c = stepCredits(c).state; assert.equal(c.frame, 0);
  const end = { ...c, x: 1000 }; // past the line's end
  assert.equal(stepCredits(end).state.slot, 0);
});

test('a step lasts 5 ticks of the 136 Hz clock while the car drives and 13 while it waits', () => {
  assert.equal(stepTicks(startCredits()), 5);
  assert.equal(stepTicks({ ...startCredits(), phase: 'tail' }), 13);
});

test('the credits item of the Info menu opens the pages', () => {
  const def = menuDef('info', defaultSettings(1, false)), i = def.items.indexOf('CREDITS');
  assert.ok(i >= 0);
  assert.deepEqual(def.actions[i], { credits: true });
});

test('the render shows the passed cells from the text layer and the car over the picture', () => {
  const M = creditsModel(), picture = { indices: new Uint8Array(64000), vga: new Uint8Array(768) };
  const ofont = new Uint8Array(0x3d * 0x40).fill(7), cars = new Uint8Array(M.car.slots * M.car.slotBytes).fill(9);
  const art = loadCreditsArt({ title: picture }, new Map([['OFONT.SP', ofont], ['CARS.SP', cars]]));
  const fb = new Uint8Array(64000);
  renderCredits(fb, art, { ...startCredits() });
  assert.equal(fb[76 * 320 + 72], 9); // the car is drawn over the cell it just copied
  assert.equal(fb[93 * 320 + 72], 9, 'the car is 28 rows tall, starting 10 above the row: rows 66 to 93');
  assert.equal(fb[94 * 320 + 72], 0);
  const moved = { ...startCredits(), x: 200, cells: [{ x: 72, y: 76 }, { x: 80, y: 76 }] };
  renderCredits(fb, art, moved);
  assert.equal(fb[76 * 320 + 72], 7); assert.equal(fb[76 * 320 + 87], 7); assert.equal(fb[76 * 320 + 88], 0, 'only the cells passed are shown');
  assert.equal(fb[66 * 320 + 200], 9);
});

test('five ticks of the 136 Hz counter are about 36.8 ms', () => {
  assert.ok(Math.abs(stepMs(startCredits()) - 5000 / 136) < 1e-9);
});
