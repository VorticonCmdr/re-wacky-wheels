// The start-up screens before the main menu (boot.notice, boot.intro, STATIC): the version notice over CHECK.PCX, the Apogee scene (APOG1.PCX cut into tiles and laid on the
// floor, the camera driving and circling over it, the ACTION.SP strip coming in), BEAVIS.PCX and the WINTRO cars. The page steps the state with the time and the keys
// (stepBoot) and render/boot.js draws it; the songs and sounds the steps ask for are in the returned events.
import { K } from '../evidence/k.js';
import { frameMs } from './clock.js';
import { pivotOffset } from './car.js';

const NOTICE = () => K({ routine: 0x24458, introRoutine: 0x248f4, picture: 'CHECK.PCX', version: 'WACKY WHEELS VERSION 1.1', shareware: 'SHAREWARE RELEASE.', registered: 'THIS IS REGISTERED', upgraded: ' AND UPGRADED', end: '.', purchase: 'IF YOU DID NOT PURCHASE THIS COPY', ordering: 'THEN PLEASE SELECT ORDERING.', copyright: 'COPYRIGHT BEAVIS-SOFT 1994', fire: 'PRESS FIRE', upgradedLevel: 3, firstRow: 0x54, rowStep: 0x0a, copyrightRow: 0xa0, fireRow: 0xb8, screenWidth: 0x140, glyph: 8, timeout: 0x7d0, skipWord: 0x1ecbc, textRoutine: 0x48f4, fadeIn: 0x22cf8, release: 0x178c4 }, 'boot.notice');
const INTRO = () => K({ routine: 0x248f4, song: 'APOGEE', musicWord: 0x1ee46, extra: 'TABLES.DAT', fadeOut: 0xbf94, fadeStep: 4, clear: 0x27e23, logo: 'APOG1.PCX', modeWord: 0x1d998, introMode: 1, tile: 0x20, tileColumns: 10, tileRows: 6, table: 0x80, renderMode: 1, camera: { x: 0xbcc, y: 0x834, heading: 0x5a0 }, band: { top: 0x81, height: 1, step: 6, full: 0x82, sourceRow: 0x36 }, drive: 6, turn: 0x1e, wrap: 0x780, turnPasses: 4, warp: 0x0c, passWait: 6, endCounts: { music: 8, silent: 0x16 }, strip: { member: 'ACTION.SP', bytes: 0x5e2, sizes: '251X6.INF', column: 0x82, raise: 0x3c, raiseStep: 4, distance: 0x462, distanceStep: 0x64, nearest: 0x8c }, sizeBase: 0x7c, sizeStep: 0x46, maxSize: 9, songTable: 0x1c648, picture: 'BEAVIS.PCX', pictureTimeout: 0x110, title: 'WINTRO.PCX', titleWait: 0x3c, cars: { count: 8, records: 0xaa90, recordBytes: 0x68, member: 'CARS.SP', sizes: '38X28.INF', frame: 4, start: 0x3c, step: 0x1c, gap: 0x190, gone: 0x3e8, centre: 0xa0, maxRow: 0xc7 }, pass: 8, carWait: 8, keysAfter: 0x3c, effectsWord: 0x1ee4e, menuPicture: 'CHECK.PCX' }, 'boot.intro');
const EDITION = () => K({ lookupFn: 0x418c, callAt: 0x24479, callOpcode: 0xe8, movOpcode: 0xb8, movAt: [0x24471, 0x24489], namesAt: [0x1eb8, 0x1ec0], names: ['42.GAM', '20.GAM'], flagAt: 0x1e574, levelAt: 0x1eca0, lookupAt: 0x28bd6, storeOpcode: [0xc7, 0x05], stores: { at: [0x244ca, 0x244b4, 0x2449e], flags: [0, 0, 1], levels: [3, 2, 1] }, renameTo: { '42.GAM': '42.GAX', '20.GAM': '20.GAX' }, runs: [{ renamed: [], flag: 0, level: 3, lookup: 1 }, { renamed: ['42.GAM'], flag: 0, level: 2, lookup: 1 }, { renamed: ['42.GAM', '20.GAM'], flag: 1, level: 1, lookup: 0 }] }, 'archive.edition-probe');

export const introModel = () => INTRO();
export const noticeModel = () => NOTICE();

// ---- the notice
// The edition of an archive by the probe's names (archive.edition-probe): the first name found gives its level and flag, none gives the last (the shareware flag 1).
export function editionOf(members) {
  const E = EDITION(), k = E.names.findIndex(n => members.has(n)), at = k < 0 ? E.names.length : k;
  return { level: E.stores.levels[at], shareware: E.stores.flags[at] !== 0 };
}

// The notice's texts with their places (boot.notice): the version line and the edition's lines from the row 0x54 ten rows apart, the copyright and PRESS FIRE, each centred.
export function noticeLines(edition) {
  const N = NOTICE(), centred = text => Math.trunc((N.screenWidth - N.glyph * text.length) / 2); // @math half the free width, truncated as sar does for a positive value
  const lines = edition.shareware ? [N.version, N.shareware] : [N.version, N.registered + (edition.level === N.upgradedLevel ? N.upgraded : '') + N.end, N.purchase, N.ordering];
  return [...lines.map((text, k) => ({ text, x: centred(text), y: N.firstRow + N.rowStep * k })), { text: N.copyright, x: centred(N.copyright), y: N.copyrightRow }, { text: N.fire, x: centred(N.fire), y: N.fireRow }];
}

// ---- the Apogee scene
// The tile of the floor table at a world point (the 128 x 128 table of tile pointers): row r takes the tile row r mod 6, column c the tile column c mod 10; the pixel is the
// picture's at that tile. Returns the index in the 320-wide picture, or -1 outside the table.
export function logoPixelAt(x, y) {
  const I = INTRO(), col = x >> 5, row = y >> 5; // @math 32-unit cells (the tile shift of floor.render-loop)
  if (col >= I.table || row >= I.table) return -1;
  const tileX = (col % I.tileColumns) * I.tile + (x & (I.tile - 1)), tileY = (row % I.tileRows) * I.tile + (y & (I.tile - 1)); // @math the tile's own column and row
  return tileY * I.tileColumns * I.tile + tileX;
}

// The scene before its first pass: the band of APOG1's rows over the horizon, the camera, the strip (off) and the counts.
export function createScene() {
  const I = INTRO();
  return { pass: 0, top: I.band.top, height: I.band.height, x: I.camera.x, y: I.camera.y, heading: I.camera.heading, strip: false, raise: I.strip.raise, distance: I.strip.distance, count: 0, turns: 0 };
}

// Does the scene end after a pass (obj1+0x24cbd)? With music when the song has stopped and the count is 8 or more, without when the count is 0x16 or more.
export function sceneEnds(scene, music, songPlaying) {
  const E = INTRO().endCounts;
  return music ? !songPlaying && scene.count >= E.music : scene.count >= E.silent;
}

// What a pass changes after its frame (obj1+0x24d25 to +0x24e35): the strip comes nearer and up, the band grows by 6 rows a pass, then the camera turns about its pivot
// and every fourth turn the strip is on (the sound 0xc the first time). `world` holds TRIG.DAT and NDIST for the pivot. Returns the next scene and the sounds.
export function stepScene(scene, world) {
  const I = INTRO(), S = I.strip, B = I.band, sounds = [];
  let { top, height, x, y, heading, strip, raise, distance, count, turns } = scene;
  if (strip) {
    raise = Math.max(raise - S.raiseStep, 0);
    distance -= S.distanceStep;
    if (distance < S.nearest) { distance = S.nearest; count++; }
  }
  top -= B.step; height += B.step;
  if (top < 0) { height = B.full; top = 0; }
  if (height > B.full) { height = B.full; top = 0; }
  if (top === 0 && height === B.full) { // the camera moves by the pivot offset of the old heading less that of the new (car.turn-move's swing)
    const before = pivotOffset(world, heading);
    heading = (heading + I.turn) % I.wrap;
    const after = pivotOffset(world, heading);
    x = (x + before[0] - after[0]) & 0xffff; y = (y + before[1] - after[1]) & 0xffff; // @math 16-bit camera words
    turns++;
    if (turns >= I.turnPasses) { if (!strip) { strip = true; sounds.push(I.warp); } turns = 0; }
  } else y = (y + I.drive) & 0xffff; // @math 16-bit camera word
  return { scene: { pass: scene.pass + 1, top, height, x, y, heading, strip, raise, distance, count, turns }, sounds };
}

// The size class of a distance for the scaled pictures (the strip, the cars): (distance - 0x7c) / 0x46 truncated, 0 to 9.
export const sizeClass = d => { const I = INTRO(); return Math.min(Math.max(Math.trunc((d - I.sizeBase) / I.sizeStep), 0), I.maxSize); };

// ---- the WINTRO cars
const WAITING = 0, DRIVING = 1, GONE = 2; // @math the car record's state word: 0 waiting, 1 driving, 2 gone (boot.intro)
// Eight cars at the distance 0x3c, the first one started (the state 1) and `last` the last started.
export function createCars() {
  const C = INTRO().cars;
  return { list: Array.from({ length: C.count }, (_, k) => ({ state: k === 0 ? DRIVING : WAITING, d: C.start })), last: 0 };
}

// The draw's part of a pass (obj1+0x24208): a started car beyond 0x3e8 is gone (the state 2) and not drawn.
export const carDrawn = c => c.state === DRIVING;
export function markGone(cars) {
  const C = INTRO().cars;
  return { ...cars, list: cars.list.map(c => (c.state === DRIVING && c.d > C.gone ? { ...c, state: GONE } : c)) };
}

// The pass after the draw (obj1+0x2516f to +0x2520e): every started car goes 0x1c further; the car after the last started one starts with the sound 8 once the last is
// 0x190 or more away. `done` is the eighth car's state 2 as the pass found it (the end of the intro).
export function stepCars(cars) {
  const I = INTRO(), C = I.cars, list = cars.list.map(c => ({ ...c })), sounds = [];
  let last = cars.last, done = false;
  list.forEach((c, k) => {
    done = c.state === GONE;
    if (c.state !== WAITING) c.d += C.step;
    if (c.state === WAITING && k === last + 1 && Math.abs(c.d - list[last].d) >= C.gap) { sounds.push(I.pass); last++; c.state = DRIVING; }
  });
  return { cars: { list, last }, done, sounds };
}

// ---- the flow
// The stages in order, with how long each waits in counts of the 136 Hz counter or until what. Fades: `fadeStepMs` a step (the page's pace of the retrace).
// notice: fade in, wait for a key or 0x7d0; the intro: fade out, the scene (its passes), fade out, BEAVIS (fade in, a key or 0x110, fade out), WINTRO (fade in, 0x3c,
// the cars), then the menu.
export function createBoot(members) {
  return { stage: 'noticeIn', since: null, edition: editionOf(members), scene: null, cars: null, key: null, passAt: 0, carsAt: 0, extra: members.has(INTRO().extra) };
}

// The milliseconds of `counts` of the 136 Hz counter.
export const countsMs = counts => frameMs(counts);

// A step of the flow at `now` (ms). `input` is { key: 'fire' | 'escape' | null (a key pressed since the last step), music (a music device is on), songPlaying, menuSong,
// fadeInSteps, fadeOutSteps (the steps of the fades of the current pictures), fadeStepMs, world (TRIG and NDIST) }. Returns { boot, events } where events are { song: { name, loop } } or
// { sound: n }; the stage 'done' hands over to the menu.
export function stepBoot(boot, now, input) {
  const N = NOTICE(), I = INTRO(), events = [], b = { ...boot };
  if (b.since === null) b.since = now;
  const elapsed = now - b.since, key = b.key ?? input.key ?? null, next = stage => { b.stage = stage; b.since = now; b.key = null; };
  b.key = ['notice', 'scene', 'picture', 'cars'].includes(b.stage) ? key : null; // a key waits for the stage that reads it (the scene reads them at the end of a pass); the fades and the title's wait drop them
  const faded = steps => elapsed >= steps * input.fadeStepMs;
  switch (b.stage) {
    case 'noticeIn': if (faded(input.fadeInSteps)) next('notice'); break; // the keys are not read while the palette fades in, and the routine waits for every button to be up
    case 'notice': if (key || elapsed >= countsMs(N.timeout)) next('noticeOut'); break; // Enter, Space, a fire button or Esc, or the time-out
    case 'noticeOut': if (faded(input.fadeOutSteps)) { next('scene'); b.scene = createScene(); b.passAt = now; events.push({ song: { name: I.song, loop: false } }); } break; // the song starts with the first pass
    case 'scene': {
      const pass = countsMs(I.passWait + 1); // @math the pass waits until the counter is above the wait
      while (b.stage === 'scene' && now - b.passAt >= pass) {
        b.passAt += pass;
        if (sceneEnds(b.scene, input.music, input.songPlaying) || b.key) { next('sceneOut'); events.push({ song: { name: input.menuSong, loop: true } }); break; }
        const out = stepScene(b.scene, input.world); b.scene = out.scene; out.sounds.forEach(n => events.push({ sound: n }));
      }
      break;
    }
    case 'sceneOut': if (faded(input.fadeOutSteps)) next('pictureIn'); break;
    case 'pictureIn': if (faded(input.fadeInSteps)) next('picture'); break;
    case 'picture': if (key || elapsed >= countsMs(I.pictureTimeout)) next('pictureOut'); break;
    case 'pictureOut': if (faded(input.fadeOutSteps)) next('titleIn'); break;
    case 'titleIn': if (faded(input.fadeInSteps)) next('titleWait'); break;
    case 'titleWait': if (elapsed >= countsMs(I.titleWait)) { next('cars'); b.cars = markGone(createCars()); b.carsAt = now; b.passAt = now; events.push({ sound: I.pass }); } break;
    case 'cars': {
      const pass = countsMs(I.carWait + 1); // @math the pass waits until the counter is more than the wait above the pass's start
      if (key && now - b.carsAt >= countsMs(I.keysAfter)) { next('done'); break; }
      b.key = null; // before the counter reaches 0x3c the keys are not read
      while (b.stage === 'cars' && now - b.passAt >= pass) {
        b.passAt += pass;
        const out = stepCars(b.cars); out.sounds.forEach(n => events.push({ sound: n }));
        if (out.done) { next('done'); break; }
        b.cars = markGone(out.cars);
      }
      break;
    }
    default: break;
  }
  return { boot: b, events };
}

// The fade out (obj1+0xbf94): after `step` steps every colour byte is lower by 4 a step, not below 0; it takes as many steps as the brightest byte needs, and one more upload that
// changes nothing ends it.
export const fadedOut = (vga, step) => vga.map(v => Math.max(v - INTRO().fadeStep * step, 0));
export const fadeOutSteps = vga => Math.ceil(Math.max(...vga) / INTRO().fadeStep) + 1; // @math the steps that change something, and the one that finds nothing left

// The picture each stage shows: 'notice', 'scene', 'picture' (BEAVIS), 'title' (WINTRO) or null (the menu), and how its palette stands: 'in' (fading in from black), 'out'
// (fading out), 'full'.
export function stageView(stage) {
  const views = { noticeIn: ['notice', 'in'], notice: ['notice', 'full'], noticeOut: ['notice', 'out'], scene: ['scene', 'full'], sceneOut: ['scene', 'out'], pictureIn: ['picture', 'in'], picture: ['picture', 'full'], pictureOut: ['picture', 'out'], titleIn: ['title', 'in'], titleWait: ['title', 'full'], cars: ['title', 'full'] };
  const v = views[stage]; return v ? { picture: v[0], palette: v[1] } : null;
}
