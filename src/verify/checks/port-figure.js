import assert from 'node:assert/strict';
import { archiveMembers, loadTrack } from '../../game/track-data.js';
import { loadHudArt, renderHud, drawTimer } from '../../render/hud.js';
import { parseMov, startFigure, stepFigure } from '../../game/figure.js';
import { createLaps, gridValue, stepLaps } from '../../game/laps.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ draw: expected('devil.draw-observed'), finish: expected('devil.finish-observed'), fig: expected('figure.rules'), lap: expected('lap.rules') });
const SCREEN = { width: 320, height: 200 }; // @math the mode 13h screen the observations read

// A buffer filled with one colour that no GIGGLES.SP frame uses.
function blank(art) {
  const used = new Set(art.giggles), free = Array.from({ length: 255 }, (_, i) => i + 1).find(v => !used.has(v)); // @math the colours 1 to 255
  assert.notEqual(free, undefined, 'a colour the frames do not use');
  return new Uint8Array(SCREEN.width * SCREEN.height).fill(free);
}

const under = (fb, data, at, [w, h], [x, y]) => {
  const picked = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (data[at + i * h + j] !== 0) picked.push(fb[(y + j) * SCREEN.width + x + i]);
  return [picked.length, crc(Uint8Array.from(picked))];
};

// devil-1: for every pause with the figure on, the figure state before the call (the words less one update) steps to the words the record read, and the
// picture the call draws, at the position of its entry, is what the screen showed (the claim's lag of one update).
function replayDraw(dat, r, V, { entryShift = 0, frameShift = 0, timerOnTop = false } = {}) {
  assertArchive(r, dat);
  const members = archiveMembers(dat), art = loadHudArt(members), mov = parseMov(members.get(V.draw.mov)), D = V.draw;
  assert.deepEqual([V.fig.xBase, V.fig.yBase, V.fig.driverWord, V.fig.frameWord, V.fig.stepWord, V.fig.phaseWord, V.fig.countWord], [D.columnBase, D.rowBase, D.driverWord, D.frameWord, D.stepWord, D.flagWord, 0x28b80], 'figure.rules and devil.draw-observed name the same words and base'); // @math the count word of static.read
  assert.equal(V.fig.frames, D.perDriver, 'a block of frames is the figure\'s cycle');
  let visible = 0, first = Infinity, last = 0;
  for (const s of r.samples) {
    const [, driver, phase, frame, step] = s.words;
    if (!(driver >= 1 && step >= 1)) continue; // @math the figure is on from step 1
    visible++; first = Math.min(first, step); last = Math.max(last, step);
    const before = { driver, phase, frame: (frame + V.fig.frames - 1 - frameShift) % V.fig.frames, step: step - 1 }; // @math the state before the call: one update less
    const out = stepFigure(before, mov.count);
    assert.deepEqual(out.fig, { driver, phase, frame, step }, `step ${step}: the call gives the words of the record`);
    const fb = blank(art), entry = mov.entries[out.draw.entry], drawn = mov.entries[out.draw.entry + entryShift]; // the picture is drawn at `drawn` and read where the entry puts it
    renderHud(fb, art, { timer: '00:00:0', figure: { draw: out.draw, entry: drawn } }); // the timer is under the figure (figure.rules): 77 of the 81 entries overlap its box
    if (timerOnTop) drawTimer(fb, art, '00:00:0');
    const at = out.draw.picture * D.frame[0] * D.frame[1], pos = [D.columnBase + entry.x, D.rowBase + entry.y];
    assert.deepEqual(under(fb, art.giggles, at, D.frame, pos), s.prev[out.draw.picture], `step ${step}: the port's frame ${out.draw.picture} equals the screen`);
  }
  assert.deepEqual([visible, first, last], [D.visibleSamples, D.firstStep, D.lastStep], 'the pauses with the figure on');
}

// finish-1: from the recorded car positions of a race on track 7 the port's grid lookup and lap step count the lap to the laps word at the recorded tick and
// start the figure there; then one call a tick takes the figure to the recorded step and frame (one call behind in the pauses that fell before the update).
function replayFinish(dat, r, V, { driver = V.lap.figureDriver, laps: total = V.finish.laps } = {}) {
  assertArchive(r, dat);
  const F = V.finish, c = Object.fromEntries(r.columns.map((n, i) => [n, i])), S = r.samples, members = archiveMembers(dat), mov = parseMov(members.get(V.draw.mov)), world = loadTrack(dat, '7');
  let laps = { ...createLaps(world.pos, S[0][c.x], S[0][c.y]), lap: F.startLap }, fig = null, crossTick = null, exact = 0, late = 0, on = 0;
  const states = [startFigure(driver)];
  for (let n = 0; states.at(-1) && n < F.lastStep + F.frameModulus; n++) states.push(stepFigure(states.at(-1), mov.count).fig); // @math enough calls to pass the recorded steps
  S.forEach((s, i) => {
    if (i > 0) {
      const out = stepLaps(laps, gridValue(world.pos, s[c.x], s[c.y]), world.pos.trailer, total);
      laps = out.laps;
      if (out.started) { assert.equal(crossTick, null, 'the figure starts once'); crossTick = s[c.tick]; fig = true; }
    }
    assert.equal(laps.lap, s[c.lap84c2], `sample ${i}: the lap word`);
    assert.equal(laps.shown ? 1 : 0, s[c.word84b4], `sample ${i}: the word that lets the lap text show`); // @math 1 when set, as the record has it
    assert.equal(fig ? driver : 0, s[c.driver84f4], `sample ${i}: the driver word`);
    if (!fig) return;
    on++;
    const calls = s[c.tick] - crossTick + 1, want = states[calls], behind = states[calls - 1]; // @math the first call is in the frame of the crossing
    if (want && s[c.step8508] === want.step && s[c.frame8504] === want.frame) exact++;
    else { assert.ok(behind && s[c.step8508] === behind.step && s[c.frame8504] === behind.frame, `sample ${i}: the step and frame words after ${calls} calls or one less`); late++; }
  });
  assert.equal(crossTick, F.crossTick, 'the lap word reaches the laps word at the recorded tick');
  assert.deepEqual([on, exact, late], [F.withFigure, F.withFigure - F.withFigureLate, F.withFigureLate], 'the pauses with the figure on');
}

// The figure's machine (read from the code, not observed): 81 entries of phase 0, then three calls of phase 1, then the end.
function machine(V) {
  const calls = [];
  let fig = startFigure(V.lap.figureDriver);
  for (let n = 0; fig && n < 200; n++) { const out = stepFigure(fig, 80); calls.push(out.draw.phase); fig = out.fig; } // @math the count word 80 of GIG.MOV and a bound on the calls
  assert.equal(fig, null, 'the figure ends');
  assert.deepEqual([calls.filter(p => p === 0).length, calls.filter(p => p === 1).length], [81, 3], 'phase 0 plays the 81 entries, phase 1 three calls'); // @math entries 0 to 80, then the frames 1 to 3
}

export default {
  id: 'port-figure',
  claims: ['devil.draw-observed', 'devil.finish-observed'],
  obs: ['devil-1', 'finish-1'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT');
    replayDraw(dat, ctx.obs('devil-1'), V);
    replayFinish(dat, ctx.obs('finish-1'), V);
    machine(V);
  },
  async discriminate(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT'), devil = ctx.obs('devil-1'), finish = ctx.obs('finish-1');
    const c = Object.fromEntries(finish.columns.map((n, i) => [n, i]));
    return [
      { label: 'the picture at the entry after', fn: () => replayDraw(dat, devil, V, { entryShift: 1 }) },
      { label: 'the timer drawn over the figure', fn: () => replayDraw(dat, devil, V, { timerOnTop: true }) },
      { label: 'the previous frame one more back', fn: () => replayDraw(dat, devil, V, { frameShift: 1 }) },
      { label: 'a recorded frame CRC altered', fn: () => replayDraw(dat, { ...devil, samples: devil.samples.map(s => (s.words[1] >= 1 && s.words.at(-1) === V.draw.firstStep ? { ...s, prev: s.prev.map(a => (a ? [a[0], '00000000'] : a)) } : s)) }, V) },
      { label: 'the driver 6', fn: () => replayFinish(dat, finish, V, { driver: V.lap.figureDriver - 1 }) }, // @math the driver before
      { label: 'a laps word of 9', fn: () => replayFinish(dat, finish, V, { laps: V.finish.laps - 1 }) }, // @math one lap fewer
      { label: 'a recorded step altered', fn: () => replayFinish(dat, { ...finish, samples: finish.samples.map((s, i) => (i === 70 ? s.map((x, k) => (k === c.step8508 ? x + 2 : x)) : s)) }, V) }, // @math a pause with the figure on, two steps off
      { label: 'one archive byte changed', fn: () => replayDraw(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), devil, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
