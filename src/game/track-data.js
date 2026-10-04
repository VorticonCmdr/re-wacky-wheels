// A track as the port's renderer and simulation use it, decoded in-process from the user's own
// archive (nothing is pre-extracted): the two tile sheets, the map, the palette, the TRIG and NDIST
// tables, the speed table and the .GAM. Every constant is a claim value (floor.model).
import { K } from '../evidence/k.js';
import { parseDatDirectory } from '../formats/dat.js';
import { parseGam } from '../formats/gam.js';
import { parseMap, parseRoute } from '../formats/track-files.js';
import { decodePcxMember, splitTiles } from '../formats/pcx.js';
import { parseAtr } from '../formats/atr.js';
import { parseSpw } from '../formats/track-files.js';
import { parseInf } from '../render/sprites.js';
import { buildRowTable } from './view.js';

const MODEL = () => K({ columns: 320, steps: 70, angleBias: 160, wrap: 1920, bottomRow: 199, trigEntryBytes: 8, fixedBits: 16, groupDwords: 70, ndistDwordBytes: 4, mapRows: 64, mapColumns: 64, mapOrigin: 32, tileShift: 5, tileMask: 31, tileBytes: 1024, sheetCount: 54, sheetSize: 32, sheetColumns: 10, columnSteps: [1, 2, 4], resetTo: 0, gamPrefix: 'A_', width: 320, height: 200 }, 'floor.model');
const CAR = () => K({ accelStep: 10, coastStep: 4, brakeStep: 8, cap: 100, rounding: 32768, fixedBits: 16, steerStep: 40, spinStep: 120, turn: 1920, velEntryBytes: 2, trigEntryBytes: 8, cameraBehind: 124, startBias: 992 }, 'car.model');

const START = () => K({ headingAt: 120276, heading: 480, startSites: [132008, 132479], finishSite: 132994, finishHeading: 960, secondAt: 120284, secondHeading: 1440, secondSite: 132517, cameraXAt: 132385, cameraYAt: 132461, cameraSubAt: 132476, cameraYStoreAt: 132489, carWords: [43686, 43688], cameraWords: [166666, 166670], cameraBehind: 124 }, 'race.start-heading');

const OBJECT_BIAS = 1024; // @math the map-to-world origin of the object words (view.object-column-observed worldOffset)

const upper = new Map();

export function archiveMembers(dat) {
  if (!upper.has(dat)) upper.set(dat, new Map(parseDatDirectory(dat).map(e => [e.name.toUpperCase(), e.data])));
  return upper.get(dat);
}

const member = (members, name) => {
  const data = members.get(name.toUpperCase());
  if (!data) throw new Error(`${name} is not in the archive`);
  return data;
};

const asView = data => new DataView(data.buffer, data.byteOffset, data.byteLength);

// `name` is the track's member stem ("1" to "42", "16" for the first shootout zone).
export function loadTrack(dat, name, engine = 1) {
  const F = MODEL(), C = CAR(), members = archiveMembers(dat);
  const gam = parseGam(member(members, `${name}.GAM`)), map = parseMap(member(members, `${name}.M`)), route = parseRoute(member(members, `${name}.RD`));
  const images = gam.tilesets.map(n => decodePcxMember(member(members, F.gamPrefix + n)));
  const sheets = images.map(image => { const out = new Uint8Array(F.sheetCount * F.tileBytes); splitTiles(image).forEach((tile, i) => out.set(tile, i * F.tileBytes)); return out; });
  const tab = engine === 1 ? 'VEL.TAB' : 'VEL2.TAB'; // @math the engine choice is 1 (12 hp) or 2 (6 hp), setup.race-options
  const vel = asView(member(members, tab)), speeds = Array.from({ length: vel.byteLength / C.velEntryBytes }, (_, i) => vel.getInt16(i * C.velEntryBytes, true));
  const atr = parseAtr(member(members, 'SPRITE.ATR')), shapes = new Map(), sprites = atr.map(a => ({ ...a, data: members.get(a.name.toUpperCase()), kind: a.raw[0], shape: a.raw[12] })); // @math the catalogue words +0 (kind) and +0xc (shape code)
  for (const a of sprites) if (!shapes.has(a.shape)) shapes.set(a.shape, parseInf(member(members, `${a.width}X${a.height}.INF`)));
  const spw = parseSpw(member(members, `${name}.SPW`)), objects = Array.from(spw, o => ({ id: o[0], consumed: o[1], x: o[2] + OBJECT_BIAS, y: o[3] + OBJECT_BIAS, counter: o[4], frame: o[5] })); // @math the .SPW words: sprite id, consumed, x, y, counter, frame
  return {
    sprites, shapes, objects, carFrames: { cars: member(members, 'CARS.SP'), driver: member(members, 'TIGER.SP') }, slp: asView(member(members, 'SLP')), view: asView(member(members, 'VIEW')), rows: buildRowTable(), carShape: parseInf(member(members, '38X28.INF')),
    name, gam, route, tiles: map.tiles, sheets, palette: images[0].vga,
    sky: decodePcxMember(member(members, gam.sky)).indices, par: member(members, `${name}.PAR`),
    trig: asView(member(members, 'TRIG.DAT')), ndist: asView(member(members, 'NDIST')), speeds,
    // the car's start position: the first start pair plus the bias (gam.read, racer.start-grid)
    start: { x: gam.starts[0].x + C.startBias, y: gam.starts[0].y + C.startBias, heading: START().heading },
  };
}

// The 8-bit RGB of the game's 6-bit palette buffer: each value is scaled to the full range.
export function rgbaPalette(vga) {
  const out = new Uint8ClampedArray((vga.length / 3) * 4); // @math three components in, four (with alpha) out
  for (let i = 0; i < vga.length / 3; i++) { // @math three components an entry
    for (let k = 0; k < 3; k++) { const v = vga[i * 3 + k]; out[i * 4 + k] = (v << 2) | (v >> 4); } // @math 6 bits widened to 8 by repeating the top bits
    out[i * 4 + 3] = 255; // @math opaque
  }
  return out;
}
