import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseAtr } from '../../formats/atr.js';
import { loadTrack } from '../../game/track-data.js';
import { renderFloor } from '../../render/floor.js';
import { renderSky, renderHorizon } from '../../render/sky.js';
import { parseInf, blitPicture } from '../../render/sprites.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const IDS = ['fit-1', 'fit-2', 'fit-3', 'fit-4', 'fit-5', 'fit-6', 'fit-7', 'fit-8', 'fit-9'];
const values = () => ({ s: expected('sprite.model'), floor: expected('floor.model'), hz: expected('horizon.render-observed'), timer: expected('hud.timer-observed'), view: expected('view.model'), car: expected('cars.frames') });
const DRIVERS = ['AJ', 'PUF', 'SHARK', 'ELE', 'DIGGER', 'CAMEL', 'RINGO', 'MOOSE', 'PELICAN', 'TIGER', 'PANDA']; // the driver files of cars.frames

// The candidate source frames of the game: every frame of every catalogue sprite, and the 38 x 28 frames of CARS.SP and the driver files.
function frameBank(members, V) {
  const bank = [], atr = parseAtr(members.get('SPRITE.ATR'));
  for (const a of atr) { const data = members.get(a.name), size = a.width * a.height; if (data) for (let f = 0; f < a.frames; f++) bank.push({ name: a.name, f, len: size, data: data.subarray(f * size, (f + 1) * size) }); }
  const carBytes = V.car.frameBytes;
  for (const name of ['CARS', ...DRIVERS]) { const data = members.get(`${name}.SP`); if (data) for (let f = 0; f < Math.floor(data.length / carBytes); f++) bank.push({ name: `${name}.SP`, f, len: carBytes, data: data.subarray(f * carBytes, (f + 1) * carBytes) }); }
  for (const b of bank) b.crc = crc(b.data);
  return bank;
}

// Parts of the screen the HUD draws over (the banner, the minimap, the speedometer panel, the timer, the lap text): not compared.
const hud = (V, rect) => rect.y < 52 || (rect.x < 78 && rect.y < 112) || rect.x < 42 || (rect.x + rect.w > V.hz.timerColumns[0] && rect.x <= V.hz.timerColumns[1] && rect.y < 122 && rect.y + rect.h > 108); // @math the banner ends at row 52, the minimap is 78 columns by 50 rows at row 60, the timer sits at rows 112 to 120

function validate(dat, records, V, { noBlit = false, skew = 0 } = {}) {
  const S = V.s;
  assert.equal(S.maxRow, V.view.maxRow, 'the last drawable row is the one of view.model');
  assert.equal(S.height, S.maxRow + 1, 'the picture area has one row more than the last drawable row'); // @math rows are counted from 0
  assert.equal(S.headerBytes, S.headerWords * S.wordBytes, 'the header is its words');
  assert.deepEqual([S.width, S.height], [V.floor.width, V.floor.height], 'the picture area is the floor\'s screen');
  const members = new Map(parseDatDirectory(dat).map(e => [e.name.toUpperCase(), e.data])), bank = frameBank(members, V), infs = new Map();
  for (const [name, data] of members) if (name.endsWith('.INF')) infs.set(name, parseInf(data));
  let compared = 0, pictures = 0;
  for (const r of records) {
    assertArchive(r, dat);
    const F = r.fit, world = loadTrack(dat, F.track), fb = new Uint8Array(V.floor.width * V.floor.height);
    renderSky(world.sky, fb); renderHorizon(world.par, F.horizonPointer - V.hz.base, fb); renderFloor(world, { x: F.camera[0], y: F.camera[1], heading: F.heading }, F.mode, fb);
    const unknown = [];
    for (const rec of F.records) {
      let hit = null;
      if (rec.picCrc) for (const [name, pics] of infs) pics.forEach((p, k) => { if (crc(p.bytes) === rec.picCrc) hit = { name, k, p }; });
      // the player's car (type 0) is drawn with the largest picture whatever its class word says
      if (rec.picCrc) { assert.ok(hit, `${r.id}: the picture of the record is one of the INF pictures`); if (rec.type !== 0) assert.equal(hit.k, rec.sizeClass, `${r.id}: its place among the ten is the size class`); assert.deepEqual([hit.p.w, hit.p.h], [rec.w, rec.h], 'and its size is the record\'s'); pictures++; }
      const frames = Object.entries(rec.frameCrcs).flatMap(([len, c]) => bank.filter(b => b.len === Number(len) && b.crc === c));
      if (!hit || !frames.length) { unknown.push(rec); continue; }
      if (!noBlit) blitPicture(fb, hit.p, frames[0].data, rec.left + skew, rec.top);
    }
    for (const rec of F.records) {
      if (!rec.rect || hud(V, rec.rect) || unknown.some(u => u.left < rec.left + rec.w && u.left + u.w > rec.left && u.top < rec.top + rec.h && u.top + u.h > rec.top)) continue;
      const part = new Uint8Array(rec.rect.w * rec.rect.h);
      for (let j = 0; j < rec.rect.h; j++) for (let i = 0; i < rec.rect.w; i++) part[j * rec.rect.w + i] = fb[(rec.rect.y + j) * V.floor.width + rec.rect.x + i];
      assert.equal(crc(part), rec.rect.crc, `${r.id}: the screen rectangle of the sprite at ${rec.left}, ${rec.top} (class ${rec.sizeClass})`);
      compared++;
    }
  }
  return { compared, pictures };
}

export default {
  id: 'port-sprites',
  claims: ['sprite.model'],
  obs: IDS,
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const V = values(), got = validate(await ctx.open('WACKY.DAT'), IDS.map(id => ctx.obs(id)), V);
    assert.ok(got.compared >= 20 && got.pictures >= 30, `enough sprites compared (${JSON.stringify(got)})`); // @math the frames hold about 70 records
  },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), recs = IDS.map(id => ctx.obs(id)), V = values();
    return [
      { label: 'the sprites not drawn', fn: () => validate(dat, recs, V, { noBlit: true }) },
      { label: 'the sprites one column right', fn: () => validate(dat, recs, V, { skew: 1 }) }, // @math one column
    ];
  },
};
