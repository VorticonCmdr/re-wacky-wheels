import test from 'node:test';
import assert from 'node:assert/strict';
import { hitDuck, duckSlots, walkRoute, createDuckAi, stepDuckAi, animateDucks, roundOver, gone, skipped, crateObjects, duckTrack, duckRules } from '../src/game/duck.js';
import { createChooser, stepChooser, chooserPalette, defaultTable, qualifies, insertScore, shooterRow, introLayout, endLayout, duckSong } from '../src/game/duckflow.js';

// A synthetic zone: two route records (the words are without the 0x400 bias), a speed table whose entry 50 is 14 and two start pairs.
const world = () => ({
  route: [[0, 0, 600, 0, 0, 2, 0], [600, 0, 600, 600, 0, 3, 0]], aiSpeeds: Array.from({ length: 200 }, (_, i) => (i === 50 ? 14 : 0)),
  gam: { starts: [{ x: 100, y: 200 }, { x: 140, y: 240 }] }, start: { x: 100 + 0x3e0, y: 200 + 0x3e0 },
});
const fixed = v => () => v;

test('the duck slots are the two lowest drivers that are not the player\'s', () => {
  assert.deepEqual(duckSlots(7), { plain: 0, helmeted: 1 });
  assert.deepEqual(duckSlots(0), { plain: 1, helmeted: 2 });
  assert.deepEqual(duckSlots(1), { plain: 0, helmeted: 2 });
});

test('the zone tracks are 16 to 21 and, with the bonus pack, 37 to 42', () => {
  assert.deepEqual([1, 6].map(z => duckTrack(z)), [16, 21]);
  assert.deepEqual([1, 6].map(z => duckTrack(z, true)), [37, 42]);
});

test('the route walker reads points one at a time and goes on to the next entry, the entry after the last being the first', () => {
  const entries = [{ points: [[0, 0], [1, 0], [2, 0]], compass: 1 }, { points: [[5, 5], [6, 5]], compass: 2 }];
  assert.deepEqual(walkRoute(entries, { entry: 0, index: 0 }, 2), { entry: 0, index: 2, x: 1, y: 0 });
  assert.deepEqual(walkRoute(entries, { entry: 0, index: 0 }, 3), { entry: 1, index: 0, x: 2, y: 0 });
  assert.deepEqual(walkRoute(entries, { entry: 0, index: 1 }, 6), { entry: 0, index: 2, x: 1, y: 0 }); // 1, 2 | 5, 6 | 0, 1: the sixth point is the point 1 of the entry 0, the cursor then at the point 2
  assert.deepEqual(walkRoute(entries, { entry: 1, index: 1 }, 1), { entry: 0, index: 0, x: 6, y: 5 });
});

test('the ducks of a round: 7 racers 260 route points apart from the drawn entry, the helmeted ones first, the speed word of the table entry 50', () => {
  const w = world(), ai = createDuckAi(w, { round: 0, rng: fixed(0), player: 7 });
  assert.equal(ai.racers.length, 8);
  assert.deepEqual(ai.racers.slice(1).map(r => r.helmeted), [true, false, false, false, false, false, false]); // the round 0 has one helmeted duck
  assert.deepEqual(ai.racers.slice(1).map(r => r.slot), [1, 0, 0, 0, 0, 0, 0]);
  assert.ok(ai.racers.slice(1).every(r => r.level === 14 && r.state === 2 && r.hp === 1 && !r.crashed));
  assert.deepEqual([ai.racers[1].entry, ai.racers[1].index], [0, 0]); // racer 1 at the start of the entry
  assert.deepEqual([ai.racers[2].entry, ai.racers[2].index, ai.racers[2].x, ai.racers[2].y], [0, 260, 1024 + 259, 1024]); // racer 2: 260 points on, standing on the 260th
  assert.deepEqual([ai.racers[3].entry, ai.racers[3].index], [0, 520]);
  assert.deepEqual([ai.racers[4].entry, ai.racers[4].index], [1, 179]); // the entry 0 has 601 points: 780 - 601 into the second
  assert.equal(createDuckAi(w, { round: 3, rng: fixed(0), player: 7 }).racers.slice(1).filter(r => r.helmeted).length, 4);
  assert.equal(createDuckAi(w, { round: 40, rng: fixed(0), player: 7 }).racers.slice(1).every(r => r.helmeted), true);
  assert.equal(createDuckAi(w, { round: 0, rng: fixed(0.999), player: 7 }).racers[1].entry, 1); // the drawn entry
});

test('a duck walks 14 route points a frame and a touch of the car is found along the walk', () => {
  const ai = createDuckAi(world(), { rng: fixed(0), player: 7 }), at = ai.racers[2];
  const out = stepDuckAi(ai, { human: { x: at.x + 20, y: at.y }, tick: 1, score: 0 });
  assert.equal(out.ai.racers[2].index, at.index + 14);
  assert.deepEqual(out.contacts, [2]); // the walk's points come within 14 of the car's point
});

test('a stunned duck explodes 4 frames after the hit: BOOM, the crash pictures, 1 point for a plain duck and 2 for a helmeted one, at most 99', () => {
  let ai = createDuckAi(world(), { rng: fixed(0), player: 7 }), score = 0, sounds = [];
  ai.racers[1] = { ...ai.racers[1], hit: 1, hitStamp: 10, hitSpin: 3 }; ai.racers[2] = { ...ai.racers[2], hit: 1, hitStamp: 10, hitSpin: 0 };
  for (let tick = 11; tick <= 13; tick++) { const o = stepDuckAi(ai, { human: null, tick, score }); ai = o.ai; score = o.score; assert.equal(o.score, 0); assert.ok(ai.racers[1].hit === 1 && !ai.racers[1].crashed); }
  assert.deepEqual([ai.racers[1].hitSpin, ai.racers[2].hitSpin], [6, 3]); // the spin goes on a frame a step
  const o = stepDuckAi(ai, { human: null, tick: 14, score }); sounds = o.sounds; ai = o.ai;
  assert.deepEqual([o.score, sounds], [3, [13, 13]]); // the helmeted duck's 2 and the plain duck's 1
  assert.deepEqual([ai.racers[1].crashed, ai.racers[1].crashPic, ai.racers[1].hit], [true, 0, 0]);
  assert.equal(stepDuckAi(ai, { human: null, tick: 15, score: 98 }).score, 98); // nothing more from crashed racers
  const capped = createDuckAi(world(), { rng: fixed(0), player: 7 });
  capped.racers[1] = { ...capped.racers[1], hit: 1, hitStamp: 0 };
  assert.equal(stepDuckAi(capped, { human: null, tick: 4, score: 98 }).score, 99); // the score stops at 99
});

test('the crash pictures go on while they are not above 3 and a racer with the picture 4 is gone; the flicker toggles for a duck with no hit points left; the round is over when every duck is gone', () => {
  let ai = createDuckAi(world(), { rng: fixed(0), player: 7 });
  ai.racers = ai.racers.map(r => (r.n === 0 ? r : { ...r, crashed: true, crashPic: 0 }));
  assert.equal(roundOver(ai), false);
  for (let k = 0; k < 4; k++) ai = animateDucks(ai);
  assert.equal(ai.racers[1].crashPic, 4);
  assert.ok(gone(ai.racers[1]) && roundOver(ai));
  ai = animateDucks(ai); assert.equal(ai.racers[1].crashPic, 4); // stays
  const flicker = { ...createDuckAi(world(), { rng: fixed(0), player: 7 }) };
  flicker.racers[1] = { ...flicker.racers[1], hp: 0, flicker: 1 };
  assert.ok(skipped(flicker.racers[1]));
  assert.equal(skipped(animateDucks(flicker).racers[1]), false);
});

test('the pickups of the kinds 3 to 7 become the first kind 2 sprite of the zone (the hog crate)', () => {
  const sprites = [{ kind: 0 }, { kind: 3 }, { kind: 2 }, { kind: 5 }, { kind: 2 }];
  const objects = [{ id: 0 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 2 }];
  assert.deepEqual(crateObjects({ sprites }, objects).map(o => o.id), [0, 2, 2, 4, 2]); // the lowest kind 2 id present is 2
  assert.deepEqual(crateObjects({ sprites }, [{ id: 0 }, { id: 1 }]).map(o => o.id), [0, 1]); // no kind 2 object in the zone: nothing is rewritten
});

test('the zone chooser: the bar blinks every 13 passes, a move shows the new bar at once, the zones wrap and fire chooses with the sound 0x12', () => {
  let c = createChooser(1);
  for (let k = 0; k < 12; k++) c = stepChooser(c, null).chooser;
  assert.equal(c.visible, true);
  c = stepChooser(c, null).chooser; assert.equal(c.visible, false); assert.equal(c.passes, 0);
  const up = stepChooser(c, 'up'); assert.deepEqual([up.chooser.zone, up.chooser.visible, up.wait], [6, true, 8 + 20]);
  assert.equal(stepChooser(createChooser(6), 'down').chooser.zone, 1);
  const fire = stepChooser(createChooser(3), 'fire'); assert.deepEqual([fire.chosen, fire.sound, fire.escape], [3, 0x12, false]);
  assert.equal(stepChooser(createChooser(3), 'escape').escape, true);
});

test('the chooser\'s palette blacks out the label bars but the selected one while it is shown', () => {
  const vga = new Uint8Array(768).fill(9);
  const shown = chooserPalette(vga, createChooser(2)), hidden = chooserPalette(vga, { ...createChooser(2), visible: false });
  assert.deepEqual([5, 6, 7, 8, 9, 10].map(k => shown[k * 3]), [0, 9, 0, 0, 0, 0]);
  assert.deepEqual([5, 6, 7, 8, 9, 10].map(k => hidden[k * 3]), [0, 0, 0, 0, 0, 0]);
  assert.equal(shown[4 * 3], 9); assert.equal(shown[11 * 3], 9);
});

test('the top shooters: a score enters when it is not below the last entry, above the first it is not below; ties go above', () => {
  const t = defaultTable();
  assert.deepEqual(t.map(e => e.score), [16, 12, 8, 6]);
  assert.equal(qualifies(t, 5), false); assert.equal(qualifies(t, 6), true);
  assert.deepEqual(insertScore(t, 'ME', 12).map(e => e.name), ['SHAUN', 'ME', 'ANDY', 'NUGGET']);
  assert.deepEqual(insertScore(t, 'ME', 99).map(e => e.name), ['ME', 'SHAUN', 'ANDY', 'NUGGET']);
  assert.deepEqual(insertScore(t, 'ME', 6).map(e => e.name), ['SHAUN', 'ANDY', 'NUGGET', 'ME']);
  assert.equal(insertScore(t, 'ME', 5), t);
  assert.equal(shooterRow({ name: 'ANDY', score: 8 }), 'ANDY             08');
});

test('the intro and end screens\' layouts: the texts at the places the code draws them, the end screen with the score\'s digits', () => {
  const intro = introLayout(defaultTable()), end = endLayout(7, defaultTable());
  assert.deepEqual(intro.lines.slice(0, 3).map(l => [l.text, l.x, l.y]), [['THE WACKY DUCK SHOOT', 50, 10], ['YOU HAVE TWO MINUTES TO', 68, 30], ['BLAST AS MANY DUCKS AS YOU CAN!', 36, 40]]);
  assert.deepEqual(intro.lines.slice(-4).map(l => [l.x, l.y]), [[84, 130], [84, 140], [84, 150], [84, 160]]);
  assert.deepEqual(intro.ducks.map(d => [d.x, d.y, d.helmeted, d.frame]), [[76, 60, false, 7], [205, 60, true, 1]]);
  assert.equal(end.lines[0].text, 'YOUR DUCK SCORE'); assert.equal(end.digits.text, '07'); assert.equal(end.lines.at(-1).text, 'PRESS FIRE');
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(duckSong), ['BANSHI', 'KARD', 'TURBO', 'BRICWALL', 'STARBRAI', 'FLIGHT']);
  assert.equal(duckRules().timer, 1200); // two minutes of tenths of a second
});

test('a shot that reaches a duck: a plain duck is stunned at once, a helmeted one absorbs the first hit (flickering) and is stunned by the second', () => {
  assert.deepEqual(hitDuck({ helmeted: false, hp: 1, frame: 5 }, 40), { hit: 1, hitSpin: 5, hitStamp: 40 });
  const first = hitDuck({ helmeted: true, hp: 1, frame: 2 }, 40);
  assert.deepEqual(first, { flicker: 1, hp: 0 }); // absorbed: no stun
  assert.deepEqual(hitDuck({ helmeted: true, hp: 0, frame: 2, flicker: 1 }, 50), { flicker: 1, hp: -1, hit: 1, hitSpin: 2, hitStamp: 50 });
});
