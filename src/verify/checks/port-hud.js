import assert from 'node:assert/strict';
import { archiveMembers, loadTrack } from '../../game/track-data.js';
import { loadHudArt, renderHud, placeBox, speedBox } from '../../render/hud.js';
import { stepSpeed, speedDigits, timerText } from '../../game/hud.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const SPEED_IDS = ['hud-1', 'hud-2', 'hud-3', 'hud-4', 'hud-5', 'hud-6'], TIMER_IDS = ['timer-1', 'timer-2', 'timer-3', 'timer-4', 'timer-5'];
const values = () => ({ hud: expected('hud.place-speed-observed'), timer: expected('hud.timer-observed'), rules: expected('hud.speed-rules') });
const SCREEN = { width: 320, height: 200 }; // @math the mode 13h screen the observations read
const GLYPHS = '0123456789:'; // @math the glyph order of GENEF.SP: the digits, then the colon (hud.timer-observed)

// The port's HUD pictures draw into a buffer filled with one colour that none of the pictures uses, so a missing, shifted or wrongly chosen picture shows.
// (The frames the game draws opaque hold no zero byte, and a record reads the screen under a glyph's non-zero pixels only, so the records cannot tell an
// opaque draw from a transparent one: that difference is not claimed.)
function background(art, V) {
  const used = new Set([...art.lap.subarray(V.hud.placeFramesAt, V.hud.placeFramesAt + 8 * V.hud.placeFrameBytes), ...art.icons.subarray(V.hud.panelAt, V.hud.digitsAt + 10 * V.hud.digitBytes), ...art.genef.subarray(V.timer.glyphsAt, V.timer.glyphsAt + V.timer.glyphs * V.timer.glyphBytes)]); // @math eight place frames and ten digit pictures
  const free = Array.from({ length: 255 }, (_, i) => i + 1).find(v => !used.has(v)); // @math the colours 1 to 255
  assert.notEqual(free, undefined, 'a colour the pictures do not use');
  return free;
}

const crop = (fb, [x, y, w, h]) => { const out = new Uint8Array(w * h); for (let j = 0; j < h; j++) out.set(fb.subarray((y + j) * SCREEN.width + x, (y + j) * SCREEN.width + x + w), j * w); return out; };
const blank = bg => new Uint8Array(SCREEN.width * SCREEN.height).fill(bg);

// The claims the port's HUD modules rest on agree with each other where they name the same words and steps.
function model(V) {
  assert.deepEqual(V.rules.steps.racing, { rise: V.hud.riseStep, fall: V.hud.fallStep }, 'hud.speed-rules steps of the racing mode are the observed ones');
  assert.deepEqual([V.rules.shownWord, V.rules.targetWord], [V.hud.speedShownWord, V.hud.speedTargetWord], 'the same speed words');
  assert.equal(V.rules.tickWord, V.timer.tickWord, 'the same tick word');
  assert.ok(V.hud.numbers.every(n => n >= V.rules.radix && n <= V.rules.cap), 'the samples neither pad a digit nor reach the cap: those are read, not observed');
}

// The speedometer and the place digit: the port's picture for the displayed number and place equals the rectangles of the record, and the port's step from
// that number toward the record's target gives the word the record read after the frame.
function replaySpeed(dat, records, V, { numbers = V.hud.numbers, swap = false, racing = true, placeShift = 0 } = {}) {
  const art = loadHudArt(archiveMembers(dat)), bg = background(art, V);
  assert.equal(records.length, V.hud.samples, 'the samples');
  // The port feeds the car's speed (the VEL.TAB entry of the throttle, as stepCar has it) as the target: it is the HUD's speed word in every record, and equals the table entry where the car is on the road.
  const world = loadTrack(dat, '1');
  let rising = 0, falling = 0, onRoad = 0;
  records.forEach((r, i) => {
    assertArchive(r, dat);
    const n = numbers[i], fb = blank(bg), digits = speedDigits(n);
    renderHud(fb, art, { place: r.hud.place + placeShift, speed: swap ? [...digits].reverse() : digits, timer: null });
    for (const box of [placeBox(), speedBox()]) {
      const recorded = r.rects.find(x => x.rect.join() === box.join());
      assert.ok(recorded, `${r.id}: the rectangle ${box} is in the record`);
      assert.equal(crc(crop(fb, box)), recorded.crc, `${r.id}: the port's picture equals the screen in the rectangle ${box}`);
    }
    assert.equal(r.carWords.speed, r.hud.speedTarget, `${r.id}: the car's speed word is the HUD's target word`);
    assert.ok(r.hud.speedTarget <= world.speeds[r.carWords.throttle], `${r.id}: the target is at most the table's speed for the throttle`);
    if (r.hud.speedTarget === world.speeds[r.carWords.throttle]) onRoad++;
    const next = stepSpeed(n, r.hud.speedTarget, racing);
    assert.deepEqual(next, { shown: n, word: r.hud.speedShown }, `${r.id}: the number drawn and the word after the easing`);
    if (next.word > n) rising++; else falling++;
  });
  assert.ok(onRoad > 0, 'some sample has the table speed for its throttle'); // @math at least one
  assert.equal(rising, V.hud.rising, 'the samples that rise');
  assert.equal(falling, V.hud.falling, 'the samples that fall');
}

// The timer: the text of the tick word the record read (or of the word less one) drawn at each place equals the screen under the glyph of that place.
function replayTimer(dat, records, V, { tickOffset = 0, glyphShift = 0 } = {}) {
  const art = loadHudArt(archiveMembers(dat)), bg = background(art, V), T = V.timer, [w, h] = T.glyphSize;
  assert.equal(records.length, T.samples, 'the samples');
  assert.equal(GLYPHS.indexOf(':'), T.colon, 'the colon is the last glyph');
  let exact = 0, behind = 0;
  const shows = (r, text) => {
    const fb = blank(bg);
    renderHud(fb, art, { place: null, speed: null, timer: text });
    return [...text].every((ch, place) => {
      const g = GLYPHS.indexOf(ch), s = r.sprites.find(q => q.tag === `${place}:${g}`);
      assert.ok(s, `${r.id}: the glyph ${ch} at place ${place} is in the record`);
      assert.deepEqual([s.member, s.at, s.x, s.y], ['GENEF.SP', T.glyphsAt + T.glyphBytes * g, T.x + T.advance * place, T.y], `${r.id}: the record's glyph entry`);
      const picked = [];
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (art.genef[s.at + glyphShift + i * h + j] !== 0) picked.push(fb[(s.y + j) * SCREEN.width + s.x + i]);
      return crc(Uint8Array.from(picked)) === s.crc;
    });
  };
  for (const r of records) {
    assertArchive(r, dat);
    const ticks = r.hud.ticks + tickOffset;
    if (shows(r, timerText(ticks))) exact++;
    else { assert.ok(shows(r, timerText(ticks - 1)), `${r.id}: the text of the tick word ${ticks}, or of the word less one, is on the screen`); behind++; } // @math one tick
  }
  assert.equal(exact, T.exact, 'the samples that agree exactly');
  assert.equal(behind, T.behind, 'the samples one tick behind');
}

export default {
  id: 'port-hud',
  claims: ['hud.place-speed-observed', 'hud.timer-observed'],
  obs: [...SPEED_IDS, ...TIMER_IDS],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT');
    model(V);
    replaySpeed(dat, SPEED_IDS.map(id => ctx.obs(id)), V);
    replayTimer(dat, TIMER_IDS.map(id => ctx.obs(id)), V);
  },
  async discriminate(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT'), speed = SPEED_IDS.map(id => ctx.obs(id)), timer = TIMER_IDS.map(id => ctx.obs(id));
    const edit = (records, i, patch) => records.map((r, k) => (k === i ? patch(r) : r));
    return [
      { label: 'the tens and units digit swapped', fn: () => replaySpeed(dat, speed, V, { swap: true }) },
      { label: 'a number one too high', fn: () => replaySpeed(dat, speed, V, { numbers: V.hud.numbers.map((n, i) => (i === 0 ? n + 1 : n)) }) }, // @math the first sample
      { label: 'the place frame before', fn: () => replaySpeed(dat, speed, V, { placeShift: -1 }) }, // @math one frame back
      { label: 'the steps of the other mode', fn: () => replaySpeed(dat, speed, V, { racing: false }) },
      { label: 'a recorded speedometer CRC altered', fn: () => replaySpeed(dat, edit(speed, 2, r => ({ ...r, rects: r.rects.map(x => ({ ...x, crc: '00000000' })) })), V) }, // @math the third sample
      { label: 'a recorded target altered', fn: () => replaySpeed(dat, edit(speed, 2, r => ({ ...r, hud: { ...r.hud, speedTarget: r.hud.speedTarget * 4 } })), V) }, // @math the third sample, one that falls: a target that turns the direction
      { label: 'the tick word one ahead', fn: () => replayTimer(dat, timer, V, { tickOffset: 1 }) }, // @math one tick
      { label: 'the glyph table one byte on', fn: () => replayTimer(dat, timer, V, { glyphShift: 1 }) }, // @math one byte
      { label: 'a recorded glyph CRC altered', fn: () => replayTimer(dat, edit(timer, 1, r => ({ ...r, sprites: r.sprites.map(s => ({ ...s, crc: '00000000' })) })), V) }, // @math the second sample
      { label: 'one archive byte changed', fn: () => replaySpeed(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), speed, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
