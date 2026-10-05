import test from 'node:test';
import assert from 'node:assert/strict';
import { podiumGroups, startRostrum, rostrumPass } from '../src/game/rostrum.js';

const rows = [[9, 7], [9, 3], [6, 1], [6, 2], [6, 4], [3, 0], [0, 5], [0, 6]].map(([points, slot]) => ({ points, slot }));

test('the podium groups are the first three runs of equal points, the human outside them stands alone in a fourth group', () => {
  let out = podiumGroups(rows, 7);
  assert.deepEqual(out.groups.map(g => g.slots), [[7, 3], [1, 2, 4], [0]]); assert.equal(out.playerGroup, 1);
  assert.deepEqual(out.groups.map(g => [g.x, g.y]), [[142, 150], [85, 146], [197, 143]]);
  out = podiumGroups(rows, 5);
  assert.deepEqual([out.groups.length, out.playerGroup, out.groups[3]], [4, 0, { x: 10, y: 158, slots: [5], outside: 1 }]);
  out = podiumGroups(rows.map(r => ({ ...r, points: 1 })), 7); // all tied: one group of eight, the empty groups keep their places
  assert.deepEqual(out.groups.map(g => g.slots.length), [8, 0, 0]);
});

test('two racers make two groups, a head to head tie is one group of both humans and the cups are those of the two places', () => {
  const two = [{ points: 40, slot: 7 }, { points: 40, slot: 4 }];
  const out = podiumGroups(two, [7, 4]);
  assert.deepEqual(out.groups.map(g => g.slots), [[7, 4], []]); assert.equal(out.playerGroup, 1);
  const s = startRostrum(two, [7, 4], 5);
  assert.deepEqual(s.cups.map(c => [c.picture, c.x]), [[2, 153], [1, 96]]); // the gold and the silver cup of a grab of the running game, no bronze cup
  assert.ok(s.twoPlayer);
});

test('in the two player race no human is the pose figure and a human outside the groups shows the wobble rows round', () => {
  const eight = [[9, 7], [9, 3], [6, 1], [6, 2], [6, 4], [3, 0], [0, 5], [0, 6]].map(([points, slot]) => ({ points, slot }));
  let s = startRostrum(eight, [5, 6], 3); // both humans outside the three groups
  assert.deepEqual(s.groups.slice(3).map(g => [g.x, g.y, g.slots, g.outside]), [[10, 158, [5], 1], [272, 158, [6], 2]]);
  while (s.state === 1) s = rostrumPass(s).next;
  const pictures = [];
  for (let k = 0; k < 9; k++) { const out = rostrumPass(s); s = out.next; pictures.push(out.draws.filter(d => d.kind === 'car' && d.y === 158).map(d => d.picture.index - 5 * 12)); }
  assert.deepEqual(pictures.map(p => p[0]), [8, 9, 8, 4, 10, 11, 10, 4, 8]); // the wobble table of slot 5 (its frames are 60 + entry)
  const inGroup = rostrumPass(startRostrum(eight, [7, 6], 3)).draws; // the human in the first group is no pose
  assert.ok(inGroup.every(d => d.kind !== 'car' || d.picture.file === 'cars'));
});

test('the puffs show their frames for 4, 3, 3 and 3 passes, then the portraits start with the human in its pose row 5', () => {
  let s = startRostrum(rows, 7, 2), frames = [], passes = 0;
  while (s.state === 1) { const out = rostrumPass(s); frames.push(out.draws[0].frame); s = out.next; passes++; }
  assert.deepEqual(frames, [0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3]); assert.deepEqual([s.si, s.di, s.state], [5, 1, 2]); // the pass counter is reset in the pass and counted at its end
  const first = rostrumPass(s); // state 2: the wheel waits
  assert.deepEqual(first.draws.filter(d => d.kind === 'cup').map(d => [d.picture, d.x, d.y]), [[2, 153, 14], [1, 96, 14], [0, 208, 14]]); // the cups began to fall in the last pass of state 1 (the state is 2 when they are drawn): the first fall is 0xe
  assert.equal(first.draws.find(d => d.kind === 'car').picture.file, 'driver'); // the human's pose row 5 is the driver file's first finish frame
  assert.equal(first.draws.filter(d => d.kind === 'car').length, 6); // the racers of the three groups only
});

test('the cups land where their stacks end (and sound once), the wheel rolls in after 0x20 passes and stops 6 columns right of the first group', () => {
  let s = rostrumPass(startRostrum(rows, 7, 3)).next; // run through state 1 first
  while (s.state === 1) s = rostrumPass(s).next;
  const sounds = [], wheels = [], cupYs = [];
  for (let i = 0; i < 80; i++) { const out = rostrumPass(s); s = out.next; sounds.push(...out.sounds); const w = out.draws.find(d => d.kind === 'wheel'); if (w) wheels.push([w.piece, w.x, w.y]); cupYs.push(out.draws.filter(d => d.kind === 'cup').map(d => d.y)); }
  assert.deepEqual(sounds, [0x17, 0x17, 0x17]); // one landing each
  assert.deepEqual(s.cups.map(c => c.y), [150 - 28 - 11, 146 - 56 - 11, 143 - 0 - 11]); // 111, 79, 132
  assert.deepEqual(wheels[0], [4, 0, 170]); // the gold cup's wheel pieces are 4 and 5
  assert.equal(wheels.at(-1)[1], 148);
  assert.equal(wheels.length, 80 - 31); // the wheel starts when the pass counter reaches 0x20 (the check is made before the first pass counts)
  assert.equal(cupYs[0][0], 14); // the first pass drops it by 0xe
});
