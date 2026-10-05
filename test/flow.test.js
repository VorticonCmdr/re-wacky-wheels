import test from 'node:test';
import assert from 'node:assert/strict';
import { driverSlots } from '../src/game/drivers.js';
import { labelOf, pointsOf, messageOf } from '../src/game/finish.js';
import { boardRows, boardLayout, humanFrame } from '../src/game/leaderboard.js';
import { startCup, trackOf, cardText, bannerOf, fadeSteps, fadeLevel, previewName } from '../src/game/cup.js';
import { enterBoard, stepBoard, boardFiles } from '../src/game/cupboard.js';
import { createVehicle, stepVehicle, selectedSlot } from '../src/game/vehicle.js';
import { raceSong, soundOf, enginePitch } from '../src/game/sounds.js';
import { classOf, classSetup } from '../src/game/classes.js';

test('the driver table is a permutation with the human first, and the same seed gives the same one', () => {
  const a = driverSlots(12345, 7), b = driverSlots(12345, 7), c = driverSlots(54321, 7);
  assert.deepEqual(a, b);
  assert.equal(a[0], 7);
  assert.deepEqual([...a].sort(), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.notDeepEqual(a, c);
});

test('the first three finishers get a label, the points follow the class, the message the place and the race', () => {
  assert.deepEqual(labelOf(1), { text: '1ST', textX: 240, pictureX: 270, y: 4 });
  assert.equal(labelOf(3).y, 60);
  assert.equal(labelOf(4), null);
  assert.deepEqual([1, 2, 3, 4].map(p => pointsOf(1, p)), [9, 6, 3, 0]);
  assert.deepEqual([1, 2, 3].map(p => pointsOf(3, p)), [15, 12, 9]);
  assert.deepEqual(messageOf(1, 1, 3), { text: 'FANTASTIC PIECE OF DRIVING!', x: 52, y: 100 });
  assert.equal(messageOf(1, 4, 1), null);
  assert.equal(messageOf(4, 1, 1).text, 'TIMES HAVE BEEN RECORDED');
});

test('the leaderboard sorts by points with the game\'s exchange sort and lays the rows out in two columns', () => {
  const rows = boardRows([9, 0, 0, 6, 0, 3, 0, 0], [7, 3, 2, 1, 4, 0, 6, 5]);
  assert.deepEqual(rows.map(r => r.points), [9, 6, 3, 0, 0, 0, 0, 0]);
  assert.deepEqual(rows.slice(3).map(r => r.racer), [1, 4, 2, 6, 7]); // the exchange sort does not keep equal points in order
  const layout = boardLayout(rows, 7, 2);
  assert.equal(layout.title, ' LEADER BOARD AFTER RACE 2 ');
  assert.deepEqual([layout.rows[0].x, layout.rows[0].y, layout.rows[4].x, layout.rows[4].y], [2, 50, 170, 50]);
  assert.deepEqual([layout.rows[0].pointsX, layout.rows[0].pictureX], [74, 98]);
  assert.equal(layout.rows[0].points, '09');
  assert.equal(boardLayout(rows, 7, 5).title, ' LEADER BOARD AFTER FINAL ');
  assert.deepEqual([0, 11, 12, 95, 96].map(humanFrame), [0, 0, 1, 7, 0]);
});

test('the cup picks the track of the race, the card text and the preview', () => {
  const bronze = startCup(1, false), silver = startCup(2, false), bonus = startCup(1, true);
  assert.deepEqual([1, 2, 3, 4, 5].map(race => trackOf({ ...bronze, race })), [1, 2, 3, 4, 5]);
  assert.deepEqual([1, 5].map(race => trackOf({ ...silver, race })), [6, 10]);
  assert.deepEqual([1, 5].map(race => trackOf({ ...bonus, race })), [22, 26]);
  assert.equal(trackOf({ ...bronze, race: 5, bonusRace: true }), 7);
  assert.equal(cardText({ ...bronze, race: 2 }), ' LOADING RACE 2 ');
  assert.equal(cardText({ ...bronze, race: 5 }), ' LOADING FINAL ');
  assert.equal(previewName(12), 'SHRINK12.PCX');
  assert.deepEqual(bannerOf(' LOADING RACE 2 '), { x: 92, y: 92, width: 136, height: 16, margin: 4, border: 0x26, fill: 0x2c });
  assert.deepEqual([0, 1, 16].map(fadeLevel), [0, 4, 64]);
  assert.equal(fadeSteps(), 16);
});

test('the cup board hides the bars and labels, lights the selected bar and moves with Up and Down after a pause', () => {
  const palette = new Uint8Array(768).map((_, i) => (i % 251) + 1);
  let b = enterBoard(palette, 2);
  assert.deepEqual(Array.from(b.palette.slice(0xe9 * 3, 0xe9 * 3 + 3)), [palette[0], palette[1], palette[2]]); // hidden: the colour of entry 0
  assert.deepEqual(Array.from(b.palette.slice(0xec * 3, 0xec * 3 + 3)), Array.from(palette.slice(0xec * 3, 0xec * 3 + 3))); // the selected bar shows
  let out = stepBoard(b, { down: true }); assert.equal(out.board.cup, 2); // the key waits 20 counts first
  for (let i = 0; i < 3; i++) out = stepBoard(out.board, {});
  assert.equal(out.board.cup, 3);
  out = stepBoard(out.board, { fire: true });
  assert.deepEqual([out.leave, out.board.chosen], ['cup', 3]);
  assert.deepEqual(boardFiles(true).pictures, ['BSB1.PCX', 'BSB2.PCX', 'BSB3.PCX']);
});

test('the vehicle screen starts on Tigi and a key to the left moves the top right car down to the selected place', () => {
  let v = createVehicle(), out;
  for (let i = 0; i < 4; i++) v = stepVehicle(v, null).vehicle; // the intro's puffs
  assert.equal(v.phase, 'idle'); assert.equal(selectedSlot(v), 7);
  out = stepVehicle(v, 'left'); v = out.vehicle; assert.equal(v.phase, 'turn');
  for (let i = 0; i < 40 && (v.phase === 'turn' || v.phase === 'rest' || v.phase === 'rotate'); i++) v = stepVehicle(v, null).vehicle;
  assert.equal(v.phase, 'idle'); assert.equal(v.lastDir, 'left'); assert.equal(selectedSlot(v), 3);
  assert.deepEqual(v.entries.find(e => e.slot === 7), { slot: 7, x: 174, y: 114, frame: 2, facing: 0 });
  out = stepVehicle(v, 'fire'); assert.equal(out.sound, 3);
  v = out.vehicle; let leave = null; for (let i = 0; i < 30 && !leave; i++) { out = stepVehicle(v, null); v = out.vehicle; leave = out.leave; }
  assert.deepEqual(leave, { slot: 3 });
});

test('sounds: priorities, the final song of a cup and the engine pitch', () => {
  assert.deepEqual([soundOf(10).priority, soundOf(25).priority, soundOf(26).priority, soundOf(0xff).number], [17, 32, 9, 3]);
  assert.deepEqual([1, 2, 3, 4, 5].map(r => raceSong(2, 0, r)), ['STARBRAI', 'BASSATTK', 'KARD', 'STARBRAI', 'OVERDRIV']);
  assert.deepEqual([0, 40, 90].map(enginePitch), [-1800, -1000, 0]);
});

test('the class sets the level, the threshold and the kid mode', () => {
  assert.deepEqual(classSetup(1, 1), { threshold: 8, level: 89, trial: false });
  assert.deepEqual(classSetup(3, 2), { threshold: 1, level: 94, trial: false });
  assert.equal(classSetup(4, 1).trial, true);
  assert.deepEqual(classOf(5), { class: 1, child: true });
});

test('the bonus notice is offered once to a podium finisher of the champion class regular Bronze cup, in a box centred on the screen', async () => {
  const { bonusOffered, noticeLayout, startBonusRace, trackOf, cardText, startCup } = await import('../src/game/cup.js');
  const bronze = startCup(1, false);
  assert.equal(bonusOffered(bronze, 3, 1), true); assert.equal(bonusOffered(bronze, 3, 0), false); assert.equal(bonusOffered(bronze, 2, 1), false);
  assert.equal(bonusOffered(startCup(2, false), 3, 1), false); assert.equal(bonusOffered(startCup(1, true), 3, 1), false);
  const bonus = startBonusRace({ ...bronze, race: 5 });
  assert.equal(bonusOffered(bonus, 3, 1), false); assert.equal(trackOf(bonus), 7); assert.equal(cardText(bonus), ' LOADING BONUS! ');
  const n = noticeLayout();
  assert.deepEqual([n.x, n.y, n.width, n.height], [24, 82, 272, 35]); assert.deepEqual(n.lines.map(l => [l.x, l.y]), [[28, 86], [28, 95], [28, 104]]);
});

test('a saved cup keeps the driver, the setup, the cup and race, the points, the slots and what the car holds, and a restore sets them back', async () => {
  const { makeSave, restoreOf } = await import('../src/game/save.js');
  const record = makeSave({ humanSlot: 7, flow: { class: 3, laps: 2, races: 2, engine: 1 }, cup: { cup: 2, bonus: 3, race: 4, bonusRace: false }, totals: [30, 24, 18, 12, 6, 0, 0, 0], slots: [7, 2, 4, 5, 3, 6, 0, 1], carry: { counter: 12, held: 5 }, engine: 2 });
  assert.deepEqual(record, { slot: 7, classItem: 3, lapsItem: 2, cup: 2, bonus: 3, race: 4, points: [30, 24, 18, 12, 6, 0, 0, 0], slots: [7, 2, 4, 5, 3, 6, 0, 1], counter: 12, held: 5, engine: 2 });
  const r = restoreOf(JSON.parse(JSON.stringify(record)));
  assert.deepEqual(r.cup, { cup: 2, bonus: 3, race: 4, bonusRace: false }); assert.deepEqual(r.flow, { class: 3, laps: 2, races: 2, engine: 2 }); assert.deepEqual([r.humanSlot, r.carry, r.totals[0]], [7, { counter: 12, held: 5 }, 30]);
  assert.equal(makeSave({ humanSlot: 7, flow: { class: 1, laps: 1 }, cup: { cup: 1, bonus: 0, race: 1 }, totals: null, slots: [7, 0, 1, 2, 3, 4, 5, 6], carry: null, engine: 1 }).points.length, 8); // before any race the points are zero
});
