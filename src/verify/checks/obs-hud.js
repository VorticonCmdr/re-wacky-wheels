import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ hud: expected('hud.place-speed-observed') });
const IDS = ['hud-1', 'hud-2', 'hud-3', 'hud-4', 'hud-5', 'hud-6'];

// A frame of an .SP member (sp.draw: column by column, `height` bytes a column) as rows of a `width` x `height` picture.
function picture(data, at, width, height) {
  const out = new Uint8Array(width * height);
  for (let i = 0; i < width; i++) for (let j = 0; j < height; j++) out[j * width + i] = data[at + i * height + j];
  return out;
}

function speedPicture(icons, H, tens, units) {
  const [pw, ph] = H.panelSize, [dw, dh] = H.digitSize, img = picture(icons, H.panelAt, pw, ph);
  const put = (digit, column) => { const g = picture(icons, H.digitsAt + H.digitBytes * digit, dw, dh); for (let j = 0; j < dh; j++) for (let i = 0; i < dw; i++) img[(H.digitRow + j) * pw + column + i] = g[j * dw + i]; };
  put(tens, H.digitColumns[0]); put(units, H.digitColumns[1]);
  return img;
}

const word = (r, H, offset) => r.hudWords[(offset - H.hudBase) / 2]; // @math the record holds consecutive words of two bytes from its base

function validate(dat, records, V, { digitsAt = V.hud.digitsAt, placeFramesAt = V.hud.placeFramesAt } = {}) {
  const H = { ...V.hud, digitsAt }, members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])), lap = members.get('LAP.SP'), icons = members.get('ICONS.SP');
  assert.equal(records.length, H.samples, 'the samples');
  const numbers = []; let rising = 0, falling = 0;
  for (const r of records) {
    assertArchive(r, dat);
    const rect = at => r.rects.find(x => x.rect.join() === at.join())?.crc;
    // The place digit.
    const place = word(r, H, H.placeWord), shown = word(r, H, H.speedShownWord), target = word(r, H, H.speedTargetWord);
    assert.deepEqual([place, shown, target], [r.hud.place, r.hud.speedShown, r.hud.speedTarget], 'the named words are those words of the record');
    assert.ok(place >= 1, 'a place');
    assert.equal(crc(picture(lap, placeFramesAt + H.placeFrameBytes * (place - 1), ...H.placeFrameSize)), rect(H.placeRect), 'the place digit is the LAP.SP frame of the place');
    // The speedometer: the one number whose two digits give the recorded rectangle.
    const found = [];
    for (let n = 0; n < 100; n++) if (crc(speedPicture(icons, H, Math.floor(n / 10), n % 10)) === rect(H.speedRect)) found.push(n); // @math decimal digits of a number below 100
    assert.equal(found.length, 1, 'one number matches the speedometer');
    const n = found[0];
    numbers.push(n);
    if (n < 2 * target) { rising++; assert.equal(shown, n + H.riseStep, 'rising by the rise step'); } // @math twice the target
    else { falling++; assert.equal(shown, n - H.fallStep, 'falling by the fall step'); }
  }
  assert.deepEqual(numbers, H.numbers, 'the numbers shown');
  assert.equal(rising, H.rising, 'the samples where the number rises');
  assert.equal(falling, H.falling, 'the samples where it falls');
  assert.deepEqual(records.map(r => word(r, H, H.placeWord)), records.map(() => word(records[0], H, H.placeWord)), 'the same place in every sample');
}

export default {
  id: 'obs-hud',
  claims: ['hud.place-speed-observed'],
  obs: IDS,
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), IDS.map(id => ctx.obs(id)), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), records = IDS.map(id => ctx.obs(id)), V = values(), h = patch => ({ hud: { ...V.hud, ...patch } });
    const edit = (i, patch) => records.map((r, k) => (k === i ? patch(r) : r));
    return [
      { label: 'the digits one picture further', fn: () => validate(dat, records, V, { digitsAt: V.hud.digitsAt + V.hud.digitBytes }) },
      { label: 'the place frames one byte on', fn: () => validate(dat, records, V, { placeFramesAt: V.hud.placeFramesAt + 1 }) }, // @math one byte
      { label: 'a place of 7 for the frame', fn: () => validate(dat, edit(0, r => ({ ...r, hud: { ...r.hud, place: r.hud.place - 1 }, hudWords: r.hudWords.map((v, i) => (i === (V.hud.placeWord - V.hud.hudBase) / 2 ? v - 1 : v)) })), V) }, // @math the frame before
      { label: 'a rise step of 4', fn: () => validate(dat, records, h({ riseStep: V.hud.riseStep * 2 })) }, // @math twice the step
      { label: 'a fall step of 2', fn: () => validate(dat, records, h({ fallStep: V.hud.fallStep / 2 })) }, // @math half the step
      { label: 'the digits one column left', fn: () => validate(dat, records, h({ digitColumns: [V.hud.digitColumns[0] - 1, V.hud.digitColumns[1]] })) },
      { label: 'the digits one row down', fn: () => validate(dat, records, h({ digitRow: V.hud.digitRow + 1 })) },
      { label: 'a speed word read for the target', fn: () => validate(dat, edit(2, r => ({ ...r, hud: { ...r.hud, speedTarget: r.hud.speedTarget * 4 }, hudWords: r.hudWords.map((v, i) => (i === (V.hud.speedTargetWord - V.hud.hudBase) / 2 ? v * 4 : v)) })), V) }, // @math a target that turns the direction
      { label: 'another panel offset', fn: () => validate(dat, records, h({ panelAt: V.hud.panelAt - 1 })) },
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), records, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
