// npm run observe -- <scenario> --id <record-id> --moment "<what the game was doing>" [--game DIR]
// Reads the running game's memory through the dosbox-automation REST API and writes a numeric-only
// record to src/evidence/obs/<id>.json. The record is evidence only once a check in
// src/verify/checks/ cross-validates it; re-run this tool to refresh one.
//   load   object bases, per-page masked CRC-32s and relocated fixup samples
//   race   (--cfg PATH names the WACKY.CFG the game was started with) a track loaded: the directory table, tile buffer, per-cell pointer table, POS/SIN/RD data,
//          GAM words, a PCX stream and the palette buffer (game paused in a race)
//   audio  (game started with sound mode 2 or 7 in WACKY.CFG offset 0x786) the sound-bank buffer and the 26 sound records
//   vram   (game paused in a race) the 0x6400 bytes at video offset 0x7d00 read plane by plane
//   progress  (game paused in a race) 24 samples of every racer's position, lap, grid value and ranking keys, at random pauses
//   surface  (game paused in a race) 24 samples of the car record fields copied from the SDX record for the terrain value
//   buffers  (game paused in a race) whole-buffer CRC-32 of the regions the small data loaders fill
//   gamtext  (--edit N=text ... --member NAME) the words the game stored from a .GAM whose lines were edited in the run copy's archive
//   ctype  the character-class table as [character, class] pairs (any moment after start-up)
//   cmdline  (--args "words") the values left by the start-up code after the game was started as `WW words`
//   start  (as soon as a race has loaded) the start tables, every racer's first position, heading and route index, and the branch words of racer.init
//   aistate  (game paused in a race) 30 pauses of every racer's AI words (state, counters, speeds, route index)
//   gamslot  (--edit 4="back2.pcx ") the stored sky-name line and the sky picture the game loaded for it
//   voices  (game paused, sound mode 0 with a Sound Blaster, sounds playing) the rates, time constants and data CRCs of the library's voices
//   klm  (game paused, a KLM song playing through the AdLib driver) the driver's position in the song and its shadow tables
//   keys  (--held 75,56) (game paused after those scancodes were held) the keyboard handler's key table words, last code and fixed flag bytes
//   midi  (game paused, a MIDI song playing through the General MIDI sequencer) the sequencer's track records
//   image  (WWHELP.EXE running, --segment N --bytes N) page CRC-32s of the program image in memory
//   player  (a played race, paused; --script '[[frame,"KBD_x",true],...]' --stops N) consecutive stops at the player control routine's entry with the throttle and speed at each
//   drive  (a played race, paused; --phases '[[["KBD_leftalt"],10],...]') random-time samples of the player's car and the input words while key groups are held
//   terrain  60 samples of the terrain lookup's inputs and result, taken by resuming the paused race
//            for a short random time and pausing again (leaves the game paused)
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { openGameFolder } from '../../src/vfs/node.js';
import { locateLe } from '../../src/formats/le.js';
import { parseDatDirectory } from '../../src/formats/dat.js';
import { crc32, hex8 } from '../../src/evidence/crc32.js';
import { status, readMemory, sha1, locateObjects, maskedCrc, PAGE, API } from './live.mjs';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { ms: { type: 'string' }, phases: { type: 'string' }, extra: { type: 'boolean' }, extra2: { type: 'boolean' }, extra3: { type: 'boolean' }, extra4: { type: 'boolean' }, extra5: { type: 'boolean' }, poke: { type: 'string' }, armed: { type: 'boolean' }, script: { type: 'string' }, stops: { type: 'string' }, segment: { type: 'string' }, bytes: { type: 'string' }, held: { type: 'string' }, patch: { type: 'string' }, id: { type: 'string' }, moment: { type: 'string' }, game: { type: 'string' }, window: { type: 'string', default: '1048576,4194304' }, cfg: { type: 'string', default: 'analysis/dosbox/WACKY/WACKY.CFG' }, edit: { type: 'string', multiple: true, default: [] }, member: { type: 'string', default: '2.GAM' }, run: { type: 'string', default: 'analysis/dosbox/WACKY/WACKY.DAT' }, args: { type: 'string', default: '' } } });
const [scenario] = positionals;
if (!scenario || !values.id || !values.moment) { console.error('usage: observe <scenario> --id <id> --moment "<text>"'); process.exit(1); }

const vfs = await openGameFolder(values.game && resolve(values.game)), exeBytes = await vfs.open('WW.EXE'), { le } = locateLe(exeBytes);
const st = await status(), [wStart, wLen] = values.window.split(',').map(Number);
const window = await readMemory(wStart, wLen);
const datBytes = await vfs.open('WACKY.DAT');
const header = { id: values.id, tool: `dosbox-automation ${st.version}`, via: 'REST GET /api/v1/memory/{offset}/{len}', date: new Date().toISOString().slice(0, 10), exe: { name: 'WW.EXE', size: exeBytes.length, sha1: sha1(exeBytes) }, archive: { name: 'WACKY.DAT', size: datBytes.length, sha1: sha1(datBytes) }, moment: values.moment };

const scenarios = {
  async load() {
    const found = locateObjects(le, exeBytes, window, wStart), pageCrc = {};
    // The live masked CRC of every stored page: which pages equal the file is decided by the check, not here.
    le.objects.forEach((obj, oi) => {
      pageCrc[obj.number] = [];
      for (let p = 0; p * PAGE < obj.data.length; p++) {
        const a = p * PAGE, b = Math.min(a + PAGE, obj.data.length), at = found.bases[oi] + a - wStart;
        pageCrc[obj.number].push(maskedCrc(window.subarray(at, at + (b - a)), found.masks[oi].subarray(a, b)));
      }
    });
    const samples = found.sites.filter(s => s.type === 7 && s.object === 1).filter((_, i) => i % 64 === 0)
      .map(s => [s.object, s.offset, Buffer.from(window.buffer, window.byteOffset + found.bases[0] + s.offset - wStart, 4).readUInt32LE(0)]); // @math sample every 64th site, read as uint32
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), pageCrc, relocSamples: samples };
  },
  async terrain() {
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], post = p => fetch(`${API}/api/v1${p}`, { method: 'POST' });
    const sleep = ms => new Promise(r => setTimeout(r, ms)), i32 = async a => Buffer.from(await readMemory(a, 4)).readInt32LE(0), u32 = async a => Buffer.from(await readMemory(a, 4)).readUInt32LE(0);
    const cstr = async a => { const b = await readMemory(a, 40); const z = b.indexOf(0); return Buffer.from(b.subarray(0, z < 0 ? b.length : z)).toString('latin1'); };
    const samples = [];
    await post('/debug/pause');
    for (let k = 0; k < 60; k++) {
      await post('/debug/continue'); await sleep(120 + Math.random() * 380); await post('/debug/pause'); await sleep(50);
      samples.push([await i32(b2 + 0x1d7a8), await i32(b2 + 0x1d7a4), await u32(b2 + 0x1e568)]); // row, column, result
    }
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), names: { track: await cstr(b2 + 0x1d770) }, inputsObject: 2, rowOffset: 0x1d7a8, columnOffset: 0x1d7a4, resultOffset: 0x1e568, samples };
  },
  async audio() {
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], at = off => b2 + off;
    const u32 = async a => Buffer.from(await readMemory(a, 4)).readUInt32LE(0), i32 = async a => Buffer.from(await readMemory(a, 4)).readInt32LE(0), u16 = async a => Buffer.from(await readMemory(a, 2)).readUInt16LE(0);
    const cstr = async a => { const b = await readMemory(a, 40); const z = b.indexOf(0); return Buffer.from(b.subarray(0, z < 0 ? b.length : z)).toString('latin1'); };
    const bank = parseDatDirectory(datBytes).find(e => e.name === 'AUDIOT.FX'), bufferPointer = await u32(at(0x1eb14));
    // The 26 records of 0x18 bytes, raw: the pointer as a signed distance from the bank buffer, then the five other dwords.
    const records = [];
    for (let k = 0; k < 26; k++) {
      const a = at(0x1a9c8) + k * 0x18;
      records.push([(await i32(a)) - bufferPointer, await i32(a + 4), await i32(a + 8), await i32(a + 12), await i32(a + 16), await i32(a + 20)]);
    }
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), names: { headOffset: 0x224, head: await cstr(at(0x224)), bodyOffset: 0x230, body: await cstr(at(0x230)) }, modeOffset: 0x17404, mode: await i32(at(0x17404)), enableOffset: 0x1ee4e, enableWord: await u16(at(0x1ee4e)), bufferPointerOffset: 0x1eb14, bufferPointer, bankBytes: bank.size, bankCrc: hex8(crc32(await readMemory(bufferPointer, bank.size))), recordTableOffset: 0x1a9c8, recordBytes: 0x18, records };
  },
  async vram() {
    // Video memory is planar here: the read-map register (graphics controller index 4, port 0x3ce) picks which plane a read returns.
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], VRAM = 0xa0000, vramOffset = 0x7d00, bytes = 0x6400, planes = 4;
    const cstr = async a => { const b = await readMemory(a, 40); const z = b.indexOf(0); return Buffer.from(b.subarray(0, z < 0 ? b.length : z)).toString('latin1'); };
    const setPlane = p => fetch(`${API}/api/v1/io/port`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ port: 0x3ce, value: (p << 8) | 4, width: 2 }) }).then(r => { if (!r.ok) throw new Error(`port write failed: ${r.status}`); });
    const planeCrcs = [];
    for (let p = 0; p < planes; p++) { await setPlane(p); planeCrcs.push(hex8(crc32(await readMemory(VRAM + vramOffset, bytes / planes)))); }
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), names: { track: await cstr(b2 + 0x1d770) }, pointerOffset: 0x1eb54, bufferPointer: Buffer.from(await readMemory(b2 + 0x1eb54, 4)).readUInt32LE(0), videoBase: VRAM, vramOffset, bytes, planes, planeCrcs };
  },
  async progress() {
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], post = p => fetch(`${API}/api/v1${p}`, { method: 'POST' });
    const sleep = ms => new Promise(r => setTimeout(r, ms)), i16 = async a => Buffer.from(await readMemory(a, 2)).readInt16LE(0), i32 = async a => Buffer.from(await readMemory(a, 4)).readInt32LE(0);
    const cstr = async a => { const b = await readMemory(a, 40); const z = b.indexOf(0); return Buffer.from(b.subarray(0, z < 0 ? b.length : z)).toString('latin1'); };
    // Per racer, raw: x, y, lap word, grid-value word, key, second key. Racer 0 keeps its lap and value in other words than the rest.
    const layout = { xWord: 0xaaa6, yWord: 0xaaa8, racerStride: 0x68, aiLapWord: 0xaab2, aiValueWord: 0xaab4, humanLapWord: 0x84c2, humanValueWord: 0x84be, structStride: 0x104, keyWord: 0x843a, key2Word: 0x843e, flagWord: 0x84c0 };
    const count = (await i16(b2 + 0x28c40)) + 1, samples = [];
    await post('/debug/pause');
    for (let k = 0; k < 24; k++) {
      await post('/debug/continue'); await sleep(100 + Math.random() * 400); await post('/debug/pause'); await sleep(50);
      const racers = [];
      for (let i = 0; i < count; i++) {
        const lap = i === 0 ? layout.humanLapWord : layout.aiLapWord + layout.racerStride * i, value = i === 0 ? layout.humanValueWord : layout.aiValueWord + layout.racerStride * i;
        racers.push([await i16(b2 + layout.xWord + layout.racerStride * i), await i16(b2 + layout.yWord + layout.racerStride * i), await i16(b2 + lap), await i16(b2 + value), await i32(b2 + layout.keyWord + layout.structStride * i), await i32(b2 + layout.key2Word + layout.structStride * i)]);
      }
      samples.push({ flag: await i16(b2 + layout.flagWord), racers });
    }
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), names: { track: await cstr(b2 + 0x1d770) }, layout, countOffset: 0x28c40, countWord: count - 1, trailerOffset: 0x28ba2, trailerWord: await i16(b2 + 0x28ba2), samples };
  },
  async surface() {
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], post = p => fetch(`${API}/api/v1${p}`, { method: 'POST' });
    const sleep = ms => new Promise(r => setTimeout(r, ms)), u32 = async a => Buffer.from(await readMemory(a, 4)).readUInt32LE(0);
    const cstr = async a => { const b = await readMemory(a, 40); const z = b.indexOf(0); return Buffer.from(b.subarray(0, z < 0 ? b.length : z)).toString('latin1'); };
    // The car record that obj2+0x1d5b0 points to, raw: terrain value (+0x56), dword +0x36, word +0x3a, pointers +0x72 and +0x76, and the live SDX record it names (dword +0x120, word +0x124).
    const samples = [];
    await post('/debug/pause');
    for (let k = 0; k < 24; k++) {
      await post('/debug/continue'); await sleep(100 + Math.random() * 400); await post('/debug/pause'); await sleep(50);
      const car = await u32(b2 + 0x1d5b0), c = Buffer.from(await readMemory(car, 0x80)), t = c.readInt32LE(0x56), table = b2 + 0x141f8;
      const sdx = Buffer.from(await readMemory(table + t * 0x12e, 0x12e));
      samples.push([await u32(b2 + 0x1e568), t, c.readUInt32LE(0x36), c.readUInt16LE(0x3a), c.readUInt32LE(0x72), c.readUInt32LE(0x76), sdx.readUInt32LE(0x120), sdx.readUInt16LE(0x124)]);
    }
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), names: { track: await cstr(b2 + 0x1d770) }, resultOffset: 0x1e568, carPointerOffset: 0x1d5b0, tableOffset: 0x141f8, samples };
  },
  async buffers() {
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], members = new Map(parseDatDirectory(datBytes).map(e => [e.name, e]));
    // The regions the small data loaders fill from an archive member: the label is the member whose size the region has; the check compares the CRC-32 with that member.
    const regions = [['VEL.TAB', 0x1e8c4, 0x22f8], ['VEL2.TAB', 0x1e584, 0x2308], ['VIEW', 0xb7f8, 0x2314], ['SLP', 0xe858, 0x2324]], out = [];
    const cstr = async a => { const b = await readMemory(a, 24); const z = b.indexOf(0); return Buffer.from(b.subarray(0, z < 0 ? b.length : z)).toString('latin1'); };
    for (const [member, offset, nameOffset] of regions) { const bytes = members.get(member).size; out.push({ member, object: 2, offset, bytes, crc: hex8(crc32(await readMemory(b2 + offset, bytes))), nameOffset, liveName: await cstr(b2 + nameOffset) }); }
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), regions: out };
  },
  async gamtext() {
    // An experiment: the run copy's archive has edited lines in one .GAM (made by make-test-archive with the same --edit arguments);
    // the record holds the edits, the hash of the archive the game ran from, and the words the game stored.
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], u16 = async a => Buffer.from(await readMemory(a, 2)).readUInt16LE(0), u8 = async a => (await readMemory(a, 1))[0];
    const cstr = async a => { const b = await readMemory(a, 40); const z = b.indexOf(0); return Buffer.from(b.subarray(0, z < 0 ? b.length : z)).toString('latin1'); };
    const runDat = await readFile(resolve(values.run)), edits = values.edit.map(e => { const i = e.indexOf('='); return [Number(e.slice(0, i)), e.slice(i + 1)]; });
    const ctype = [];
    for (const c of [9, 10, 11, 12, 13, 32, 43, 45, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 65, 97, 120]) ctype.push([c, await u8(b2 + 0x3150 + ((c + 1) & 0xff))]);
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), names: { track: await cstr(b2 + 0x1d770) }, member: values.member, edits, modified: { size: runDat.length, sha1: sha1(runDat) },
      startWords: { xTable: 0x1d7cc, yTable: 0x1d7e0, x: await u16(b2 + 0x1d7cc), y: await u16(b2 + 0x1d7e0) },
      extraWords: { offsets: [0x28b5a, 0x28b4e, 0x28b4c], values: [await u16(b2 + 0x28b5a), await u16(b2 + 0x28b4e), await u16(b2 + 0x28b4c)] },
      ctypeTable: 0x3150, ctype };
  },
  async ctype() {
    // The game's character-class table (obj2+0x3150, indexed by the character plus 1 as the integer converter does), as [character, class byte] pairs for all 256 characters.
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], table = Buffer.from(await readMemory(b2 + 0x3150, 256 + 1)), pairs = [];
    for (let c = 0; c < 256; c++) pairs.push([c, table[(c + 1) & 0xff]]);
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), tableOffset: 0x3150, indexBias: 1, pairs };
  },
  async cmdline() {
    // An experiment: the game was started as `WW <args>`; the record holds those words and the values the start-up code left behind.
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], u32 = async a => Buffer.from(await readMemory(a, 4)).readUInt32LE(0), u16 = async a => Buffer.from(await readMemory(a, 2)).readUInt16LE(0);
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), args: values.args.split(' ').filter(Boolean),
      maskAt: 0x84f0, mask: await u32(b2 + 0x84f0), maskCopies: [await u32(b2 + 0x85f4), await u32(b2 + 0x1ed64), await u32(b2 + 0x1ed68)], maskCopyAt: [0x85f4, 0x1ed64, 0x1ed68],
      nowAt: 0x1ecbc, now: await u32(b2 + 0x1ecbc), classAt: 0x1ed08, class: await u32(b2 + 0x1ed08), debugAt: 0x28bea, debug: await u16(b2 + 0x28bea) };
  },
  async start() {
    // Taken as soon as possible after a race has loaded: the start tables, the first positions of all racers and the words that pick the branch of racer.init.
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], u16 = async a => Buffer.from(await readMemory(a, 2)).readUInt16LE(0), u32 = async a => Buffer.from(await readMemory(a, 4)).readUInt32LE(0);
    const cstr = async a => { const b = await readMemory(a, 40); const z = b.indexOf(0); return Buffer.from(b.subarray(0, z < 0 ? b.length : z)).toString('latin1'); };
    const count = (await u16(b2 + 0x28c40)) + 1, tables = { x: [], y: [] }, racers = [];
    for (let i = 0; i < 8; i++) { tables.x.push(await u16(b2 + 0x1d7cc + 2 * i)); tables.y.push(await u16(b2 + 0x1d7e0 + 2 * i)); }
    // Per racer, raw: x, y, heading (+0x1a), route index (+0x1c), then the AI words +0, +2, +4 (state), +6, +8, +0xa, +0xc, +0xe.
    for (let i = 0; i < count; i++) racers.push([await u16(b2 + 0xaaa6 + 0x68 * i), await u16(b2 + 0xaaa8 + 0x68 * i), await u16(b2 + 0xaaaa + 0x68 * i), await u16(b2 + 0xaaac + 0x68 * i), ...await Promise.all([0x00, 0x02, 0x04, 0x06, 0x08, 0x0a, 0x0c, 0x0e].map(o => u16(b2 + 0xaa90 + 0x68 * i + o)))]);
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), names: { track: await cstr(b2 + 0x1d770) }, branchAt: 0x1ec74, branch: await u32(b2 + 0x1ec74), gridFlagAt: 0x28be2, gridFlag: await u16(b2 + 0x28be2), twoPlayerAt: 0x28bdc, twoPlayer: await u16(b2 + 0x28bdc), countWord: count - 1, levelAt: 0x28b84, level: await u16(b2 + 0x28b84), tables, racers, routeCompass0: await u16(b2 + 0x12356) };
  },
  async aistate() {
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], post = p => fetch(`${API}/api/v1${p}`, { method: 'POST' });
    const sleep = ms => new Promise(r => setTimeout(r, ms)), u16 = async a => Buffer.from(await readMemory(a, 2)).readUInt16LE(0);
    const cstr = async a => { const b = await readMemory(a, 40); const z = b.indexOf(0); return Buffer.from(b.subarray(0, z < 0 ? b.length : z)).toString('latin1'); };
    // Per pause, per racer, the AI words +0, +2, +4 (state), +6, +8, +0xa, +0xc, +0xe, +0x10, +0x14 and the route index +0x1c, as raw words; plus the level word.
    const count = (await u16(b2 + 0x28c40)) + 1, words = [0x00, 0x02, 0x04, 0x06, 0x08, 0x0a, 0x0c, 0x0e, 0x10, 0x14, 0x1c], samples = [];
    await post('/debug/pause');
    for (let k = 0; k < 30; k++) {
      await post('/debug/continue'); await sleep(150 + Math.random() * 1500); await post('/debug/pause'); await sleep(50);
      const racers = [];
      for (let i = 0; i < count; i++) racers.push(await Promise.all(words.map(w => u16(b2 + 0xaa90 + 0x68 * i + w))));
      samples.push({ level: await u16(b2 + 0x28b84), steps: await u16(b2 + 0x28c24), racers });
    }
    const velBytes = parseDatDirectory(datBytes).find(e => e.name === 'VEL.TAB').size, velTable = { offset: 0x1e730, bytes: velBytes, crc: hex8(crc32(await readMemory(b2 + 0x1e730, velBytes))) };
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), names: { track: await cstr(b2 + 0x1d770) }, columns: words, countWord: count - 1, levelAt: 0x28b84, stepsAt: 0x28c24, velTable, samples };
  },
  async gamslot() {
    // An experiment with an edited sky-name line (make-test-archive with the same --edit arguments): what the game kept of the line, and what it loaded as the sky picture.
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], u32 = async a => Buffer.from(await readMemory(a, 4)).readUInt32LE(0);
    const cstr = async a => { const b = await readMemory(a, 40); const z = b.indexOf(0); return Buffer.from(b.subarray(0, z < 0 ? b.length : z)).toString('latin1'); };
    const runDat = await readFile(resolve(values.run)), edits = values.edit.map(e => { const i = e.indexOf('='); return [Number(e.slice(0, i)), e.slice(i + 1)]; });
    const slot = Buffer.from(await readMemory(b2 + 0xa4e0, 16)), members = new Map(parseDatDirectory(datBytes).map(e => [e.name, e]));
    const sky = members.get('BACK2.PCX'), skyPtr = await u32(b2 + 0xa978 + 4), bytes = sky.size - 0x380, live = Buffer.from(await readMemory(skyPtr, bytes)), foundAt = [];
    for (let at = -1; foundAt.length < 4 && (at = runDat.indexOf(live.subarray(0, 64), at + 1)) >= 0;) if (runDat.subarray(at, at + bytes).equals(live)) foundAt.push(at);
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), names: { track: await cstr(b2 + 0x1d770) }, member: values.member, edits, modified: { size: runDat.length, sha1: sha1(runDat) },
      slotOffset: 0xa4e0, slotBytes: [...slot], skyMember: 'BACK2.PCX', skyBytes: bytes, skyBufferCrc: hex8(crc32(live)), matchedOffsets: foundAt };
  },
  async speaker() {
    // The sound library's device word and the PC-speaker player's state, read at the title screen with sound mode 7 (the CFG dword at 0x786 set to 7 in the run copy).
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], at = off => b2 + off;
    const i32 = async a => Buffer.from(await readMemory(a, 4)).readInt32LE(0), table = Buffer.from(await readMemory(at(0x28ec4), 0x200));
    const words = {};
    for (const [name, off] of Object.entries({ device: 0x3fe8, error: 0x3fec, volume: 0x4330, handle: 0x4338, callback: 0x432c, byteMode: 0x290d0, priority: 0x290cc, remaining: 0x290c8, pointer: 0x4328, mode: 0x17404 })) words[name] = [off, await i32(at(off))];
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), cfg: { offset: 0x786, sha1: sha1(await readFile(resolve(values.cfg))) }, words, tableOffset: 0x28ec4, tableBytes: table.length, tableCrc: hex8(crc32(table)) };
  },
  async gate() {
    // Execute breakpoints at the sound-library check, its error stub, the init, its error stub, the bank-load routine and the bank loader, armed in protected mode (tools/dosbox/gate-run.mjs); read at the final stop.
    const found = locateObjects(le, exeBytes, window, wStart), b1 = found.bases[0], b2 = found.bases[1], i32 = async a => Buffer.from(await readMemory(a, 4)).readInt32LE(0);
    const list = await (await fetch(`${API}/api/v1/debug/breakpoints`)).json(), stop = (await (await fetch(`${API}/api/v1/debug/status`)).json()).stop;
    const words = {};
    for (const [name, off] of Object.entries({ mode: 0x17404, device: 0x3fe8, error: 0x3fec })) words[name] = [off, await i32(b2 + off)];
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), selector: stop.registers.cs, stoppedAt: stop.linear_eip - b1, words,
      breakpoints: list.breakpoints.filter(b => b.type === 'execute').map(b => [b.offset - b1, b.hit_count]).sort((a, b) => a[0] - b[0]) };
  },
  async tick() {
    // Samples of the PC-speaker tick handler (tools/dosbox/tick-run.mjs arms an execute breakpoint at obj1+0x371f8, the first instruction of the tone path, and waits for the first stop).
    const found = locateObjects(le, exeBytes, window, wStart), b1 = found.bases[0], b2 = found.bases[1], i32 = async a => Buffer.from(await readMemory(a, 4)).readInt32LE(0);
    const sleep = ms => new Promise(r => setTimeout(r, ms)), samples = [], bufferPointer = await i32(b2 + 0x1eb14);
    let last = 0; // @math no stop seen yet
    const waitStop = async since => { for (let i = 0; i < 1200; i++) { const d = await (await fetch(`${API}/api/v1/debug/status`)).json(); if (d.debugging && d.stop.stop_id > since) return d.stop; await sleep(100); } return null; };
    const first = await waitStop(0);
    if (!first) throw new Error('the emulator did not stop at the breakpoint');
    last = first.stop_id - 1; // @math the stop being sampled is not yet counted as seen
    for (let k = 0; k < 40; k++) { // @math number of stops sampled
      const stop = (await (await fetch(`${API}/api/v1/debug/status`)).json()).stop;
      samples.push([stop.linear_eip - b1, stop.registers.ebx, (await i32(b2 + 0x4328)) - bufferPointer, await i32(b2 + 0x290c8), await i32(b2 + 0x290cc), await i32(b2 + 0x4338)]);
      await fetch(`${API}/api/v1/debug/continue`, { method: 'POST' });
      last = stop.stop_id;
      if (!(await waitStop(last))) break;
    }
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), bufferPointerOffset: 0x1eb14, columns: ['eip', 'ebx', 'pointerFromBuffer', 'remaining', 'priority', 'handle'], samples };
  },
  async voices() {
    // (game paused with sound mode 0 and a Sound Blaster, while sounds play) the sound library's voice records at obj2+0x43b0 (0x8c bytes each, count at obj2+0x4394):
    // for every voice holding a rate, the rate (+0x24), the data pointer (+0x1c) and the VOC block header and CRC-32 of the data that the pointer points into.
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], u32 = async a => Buffer.from(await readMemory(a, 4)).readUInt32LE(0), mem = (a, n) => readMemory(a, n);
    const voicesAt = await u32(b2 + 0x43b0), count = await u32(b2 + 0x4394), voices = [];
    for (let i = 0; i < count; i++) {
      const rec = Buffer.from(await mem(voicesAt + i * 0x8c, 0x8c)), rate = rec.readUInt32LE(0x24), pointer = rec.readUInt32LE(0x1c);
      if (!rate) continue;
      const head = Buffer.from(await mem(pointer - 6, 6)), length = head[1] | head[2] << 8 | head[3] << 16, data = Buffer.from(await mem(pointer, length - 2));
      voices.push({ index: i, rate, type: head[0], blockLength: length, timeConstant: head[4], codec: head[5], dataCrc: hex8(crc32(data)) });
    }
    const patched = values.patch ? (([address, from, to]) => ({ address, from, to }))(values.patch.split(',').map(Number)) : null; // the one byte the observer wrote to a loaded sound before it was played again (address, old value, new value)
    return { ...header, patched, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), voicesPointerOffset: 0x43b0, countOffset: 0x4394, recordBytes: 0x8c, rateOffset: 0x24, dataPointerOffset: 0x1c, count, voices };
  },
  async klm() {
    // (game paused while the AdLib music driver plays a KLM song) the driver's song state and shadow tables at obj2+0x2b904.. and +0x3150c..: the song's start
    // offset, its position and pending delay, and the per-channel and per-operator values the driver keeps; the song itself is identified by CRC-32s of its header and the part consumed.
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], u32 = async a => Buffer.from(await readMemory(a, 4)).readUInt32LE(0);
    const word = async off => u32(b2 + off), list = async (off, n) => { const out = []; for (let i = 0; i < n; i++) out.push(await word(off + i * 4)); return out; };
    const tempo = await word(0x2b904), start = await word(0x2b908), instruments = await word(0x2b90c), position = await word(0x2b910), delay = await word(0x2b914);
    const base = instruments - 5, head = Buffer.from(await readMemory(base, start - base)), consumed = Buffer.from(await readMemory(start, position - start));
    const cache = (await list(0x31624, 11)).map(p => (p ? p - base : 0));
    const stateWords = { tempo: 0x2b904, start: 0x2b908, instruments: 0x2b90c, position: 0x2b910, delay: 0x2b914, playing: 0x43e4, loop: 0x43ec }, arrays = { low: 0x3150c, high: 0x314cc, cache: 0x31624, channelVolume: 0x31650, rhythm: 0x3167c, slotVolume: 0x3154c, level: 0x31594, ksl: 0x315dc }; // object 2 offsets the reads below use
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), stateWords, arrays, tempo, playing: await word(0x43e4), loop: await word(0x43ec), songAt: start - base, position: position - base, delay,
      headBytes: head.length, headCrc: hex8(crc32(head)), consumedBytes: consumed.length, consumedCrc: hex8(crc32(consumed)),
      low: await list(0x3150c, 11), high: await list(0x314cc, 11), cache, channelVolume: await list(0x31650, 11), rhythm: await word(0x3167c), slotVolume: await list(0x3154c, 18), level: await list(0x31594, 18), ksl: await list(0x315dc, 18) };
  },
  async keys() {
    // (game paused after the keys named by --held, a comma list of scancodes, had been held for a while; none = all released) the keyboard handler's state: the twelve
    // key table words at obj2+0x1b6d8 (the high byte of a word is the handler's down flag), the last scancode at +0x28cd0 and the fixed flag bytes it sets.
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], byteAt = async off => Buffer.from(await readMemory(b2 + off, 1))[0];
    const table = Buffer.from(await readMemory(b2 + 0x1b6d8, 24)), words = []; for (let i = 0; i < 12; i++) words.push(table.readUInt16LE(i * 2)); // @math twelve little-endian words
    const flagOffsets = { enterSpace: 0x28cce, f10: 0x28ccd, up: 0x28cdb, down: 0x28cd2 }, flags = {};
    for (const [name, off] of Object.entries(flagOffsets)) flags[name] = await byteAt(off);
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), tableOffset: 0x1b6d8, lastCodeOffset: 0x28cd0, flagOffsets, held: values.held ? values.held.split(',').map(Number) : [], words, lastCode: await byteAt(0x28cd0), flags };
  },
  async midi() {
    // (game paused while the General MIDI sequencer plays) the sequencer's track records (0x1c bytes each from the pointer at obj2+0x4430) and state words: for each track
    // its data start (+0x14), current pointer (+0x18), delta still to count (+0x08), active flag (+0x0c) and running status (+0x10), relative to the start of the file in memory; the file
    // is identified by its size and CRC-32.
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], u32 = async a => Buffer.from(await readMemory(a, 4)).readUInt32LE(0), word = off => u32(b2 + off);
    const first = await word(0x2b958), division = await word(0x2b964), activeTracks = await word(0x2b960), playing = await word(0x4434), loop = await word(0x443c);
    const records = [];
    const addresses = [];
    for (let r = first, n = 0; r && n < 64; r = await u32(r), n++) addresses.push(r - first), records.push({ start: await u32(r + 0x14), current: await u32(r + 0x18), delta: await u32(r + 0x8), active: await u32(r + 0xc), status: await u32(r + 0x10) });
    const base = records[0].start - 8 - 14, head = Buffer.from(await readMemory(base, 14)), last = records.at(-1), lastLength = Buffer.from(await readMemory(last.start - 4, 4)).readUInt32BE(0), size = last.start + lastLength - base;
    const file = Buffer.from(await readMemory(base, size));
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), firstTrackOffset: 0x2b958, divisionOffset: 0x2b964, activeOffset: 0x2b960, playingOffset: 0x4434, loopOffset: 0x443c,
      recordFields: { next: 0, delta: 0x8, active: 0xc, status: 0x10, start: 0x14, current: 0x18 }, recordAddresses: addresses, division, activeTracks, playing, loop, size, crc: hex8(crc32(file)), tracks: records.map(t => ({ start: t.start - base, current: t.current - base, delta: t.delta, active: t.active, status: t.status })) };
  },
  async image() {
    // (WWHELP.EXE running under DOSBox, --segment N the segment of its PSP from the DOS memory map, --bytes N the length of the decoded image) the CRC-32 of every 256-byte page of the
    // program image that starts 0x100 bytes (the PSP) into the block. This scenario reads real-mode memory by physical address and needs no WW.EXE bases.
    const pspAt = Number(values.segment) * 16, imageAt = 0x100, length = Number(values.bytes), pageBytes = 256, pageCrcs = [];
    const live = Buffer.from(await readMemory(pspAt + imageAt, length));
    for (let at = 0; at < length; at += pageBytes) pageCrcs.push(hex8(crc32(live.subarray(at, Math.min(at + pageBytes, length)))));
    const file = await readFile(resolve('analysis/dosbox/WACKY/WWHELP.EXE')); // the copy of the installed program that was run
    return { ...header, program: 'WWHELP.EXE', file: { size: file.length, sha1: sha1(file) }, segment: Number(values.segment), imageAt, pageBytes, bytes: length, pageCrcs };
  },
  async player() {
    // (a played race, paused) consecutive stops at the entry of the player control routine (obj1+0x190a0, claim car.speed-model) while keys are held and released through the input
    // interface: at each stop the throttle, speed, button words, boost words and terrain, then the next call's. Leaves the game paused at the last stop.
    const found = locateObjects(le, exeBytes, window, wStart), b1 = found.bases[0], b2 = found.bases[1], sleep = ms => new Promise(r => setTimeout(r, ms));
    const post = (path, body) => fetch(`${API}/api/v1${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) }), jget = async path => (await fetch(`${API}/api/v1${path}`)).json();
    const i16 = async a => Buffer.from(await readMemory(a, 2)).readInt16LE(0), u16 = async a => Buffer.from(await readMemory(a, 2)).readUInt16LE(0), i32 = async a => Buffer.from(await readMemory(a, 4)).readInt32LE(0);
    const ENTRY = 0x190a0, SELECTOR = 0x180, script = JSON.parse(values.script ?? '[]'), count = Number(values.stops ?? 200);
    // Execute breakpoints added after the race code has run are not honoured (translated blocks are cached): arm one before the race is entered and pass --armed.
    if (!values.armed) { await post('/debug/pause'); await fetch(`${API}/api/v1/debug/breakpoints`, { method: 'DELETE' }); await post('/debug/breakpoints', { type: 'execute', segment: SELECTOR, offset: b1 + ENTRY }); }
    const events = script.flatMap(([frame, key, pressed]) => ({ type: 'key', key, pressed, frame }));
    if (events.length) await post('/input/sequence', { events });
    const waitStop = async since => { for (let i = 0; i < 600; i++) { const d = await jget('/debug/status'); if (d.debugging && d.stop.stop_id > since) return d.stop; await sleep(50); } return null; };
    let last = values.armed ? (await jget('/debug/status')).stop.stop_id - 1 : (await jget('/debug/status')).stop?.stop_id ?? 0; // @math take the stop the game is already at when armed
    if (!values.armed) await post('/debug/continue');
    const samples = [];
    for (let k = 0; k < count; k++) {
      const stop = await waitStop(last); if (!stop) break; last = stop.stop_id;
      const car = await i32(b2 + 0x1d5b0);
      samples.push([stop.linear_eip - b1, await i16(car + 0x42), await i16(car + 0x26), await u16(b2 + 0x28b40), await u16(b2 + 0x28b44), await u16(b2 + 0x28be2), await i32(b2 + 0x1ec74), await i32(b2 + 0x1edb0), await i32(b2 + 0x1e568), await i16(car + 0xb4), await i16(car + 0xb6), await i16(b2 + 0x1e730 + 2 * (await i16(car + 0x42)))]);
      await post('/debug/continue');
    }
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), entry: ENTRY, script, columns: ['eip', 'throttle', 'speed', 'accelerate', 'brake', 'slowWord', 'modeDword', 'itemDword', 'terrain', 'boostActive', 'boostTimer', 'tableEntry'], samples };
  },
  async drive() {
    // (a played race, paused) samples of the player's car while keys are held through the input interface: --phases '[[["KBD_leftalt"],10],[["KBD_left"],6],...]' holds the listed keys
    // (releasing the previous group) for the given number of samples, each taken by resuming for a random 0.4 to 1.5 s and pausing again. Per sample: throttle, speed and the table entry for
    // the throttle, accelerate and brake words, terrain, boost words, the steering bytes and words, and the key table's high bytes.
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], sleep = ms => new Promise(r => setTimeout(r, ms));
    const post = (path, body) => fetch(`${API}/api/v1${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
    const i16 = async a => Buffer.from(await readMemory(a, 2)).readInt16LE(0), u16 = async a => Buffer.from(await readMemory(a, 2)).readUInt16LE(0), i32 = async a => Buffer.from(await readMemory(a, 4)).readInt32LE(0), u8 = async a => (await readMemory(a, 1))[0];
    const phases = JSON.parse(values.phases ?? '[]'), samples = [];
    let down = [];
    for (const [keys, n] of phases) {
      for (let k = 0; k < n; k++) {
        const events = [...(k ? [] : down.map(key => ({ type: 'key', key, pressed: false, frame: 1 }))), ...(k ? [] : keys.map(key => ({ type: 'key', key, pressed: true, frame: 2 })))];
        if (events.length) await post('/input/sequence', events.length ? { events } : undefined);
        await post('/debug/continue'); const [lo, hi] = (values.ms ?? '400,1500').split(',').map(Number); await sleep(lo + Math.floor(Math.random() * (hi - lo))); await post('/debug/pause'); await sleep(100); // @math a random run (default 0.4 to 1.5 s)
        const car = await i32(b2 + 0x1d5b0), throttle = await i16(car + 0x42), keyTable = Buffer.from(await readMemory(b2 + 0x1b6d8, 12)), highs = []; for (let i = 0; i < 6; i++) highs.push(keyTable[i * 2 + 1]); // @math six words of player 1's table
        samples.push([phases.indexOf(phases.find(p => p[0] === keys)), throttle, await i16(car + 0x26), await i16(b2 + 0x1e730 + 2 * throttle), await u16(b2 + 0x28b40), await u16(b2 + 0x28b44), await i32(b2 + 0x1e568), await i16(car + 0xb4), await i16(car + 0xb6),
          await u8(b2 + 0x28cd5), await u8(b2 + 0x28cdd), await u16(b2 + 0x28b8c), await u16(b2 + 0x28b98), await u16(b2 + 0x28b90), await u16(b2 + 0x28b92), await u16(b2 + 0x28c7c), await u16(b2 + 0x28c0c), await u16(b2 + 0x1ea58), await i32(car + 0x36), await i16(car + 0x56), await i32(b2 + 0x1d5d4), ...highs]);
      }
      down = keys;
    }
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), phases: phases.map(([keys, n]) => [keys.length, n]), columns: ['phase', 'throttle', 'speed', 'tableEntry', 'accelerate', 'brake', 'terrain', 'boostActive', 'boostTimer', 'leftByte', 'rightByte', 'leftWord', 'rightWord', 'rightAmount', 'leftAmount', 'rate', 'demoWord', 'engineWord', 'fraction', 'surface', 'angle', 'keyLeft', 'keyRight', 'keyAlt', 'keyCtrl', 'keyDown', 'keySpace'], samples };
  },
  async dac() {
    // The VGA palette over time in a running race: `--args` {count, ms: [lo, hi], from, to}. Per pause the tick counter obj2+0x1ec64 and the 6-bit DAC triples of the entries from..to (the read index written to port 0x3c7, then 3 reads of 0x3c9 an entry).
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], spec = JSON.parse(values.args || '{}'), sleep = ms => new Promise(r => setTimeout(r, ms));
    const post = path => fetch(`${API}/api/v1${path}`, { method: 'POST' });
    const io = (port, value, width) => fetch(`${API}/api/v1/io/port`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ port, value, width }) });
    const inPort = async port => (await (await fetch(`${API}/api/v1/io/port?port=${port}`)).json()).value;
    const from = spec.from ?? 0, to = spec.to ?? 255, samples = []; // @math the whole palette by default
    for (let n = 0; n < (spec.count ?? 30); n++) { // @math thirty pauses by default
      await post('/debug/continue'); const [lo, hi] = spec.ms ?? [100, 300]; await sleep(lo + Math.floor(Math.random() * (hi - lo))); await post('/debug/pause'); await sleep(30); // @math a random run of 0.1 to 0.3 s
      const tick = Buffer.from(await readMemory(b2 + 0x1ec64, 4)).readInt32LE(0), demo = Buffer.from(await readMemory(b2 + 0x28c0c, 2)).readInt16LE(0);
      await io(0x3c7, from, 1); const dac = []; for (let k = from; k <= to; k++) dac.push([await inPort(0x3c9), await inPort(0x3c9), await inPort(0x3c9)]);
      samples.push({ tick, demo, dac });
    }
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), from, to, samples };
  },
  async exit() {
    // The text screen the game leaves when it exits (after `LEAVE GAME`): the CRC-32 of the 4000 bytes at B800:0000 (80 x 25 cells of a character and an attribute), of the following 4000 bytes, the CRTC start address and the text mode check.
    const VRAM = 0xb8000, CELLS = 4000; // @math the colour text segment and 80 x 25 cells of 2 bytes
    const io = (port, value, width) => fetch(`${API}/api/v1/io/port`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ port, value, width }) });
    const inPort = async port => (await (await fetch(`${API}/api/v1/io/port?port=${port}`)).json()).value;
    await io(0x3d4, 0x0c, 1); const high = await inPort(0x3d5); await io(0x3d4, 0x0d, 1); const low = await inPort(0x3d5);
    const mem = Buffer.from(await readMemory(VRAM, 2 * CELLS + 96)); // @math two screens' worth, a little over
    return { ...header, textAt: VRAM, cells: CELLS, crtcStart: high * 256 + low, textCrc: hex8(crc32(mem.subarray(0, CELLS))), nextCrc: hex8(crc32(mem.subarray(CELLS, 2 * CELLS))) };
  },
  async shareflag() {
    // The registration probe of the game's start (obj1+0x24458): the flag dword obj2+0x1e574, the level dword +0x1eca0 and the result word +0x28bd6 of its last directory lookup, with the member names it looked for.
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1];
    const u16 = async a => Buffer.from(await readMemory(a, 2)).readUInt16LE(0), u32 = async a => Buffer.from(await readMemory(a, 4)).readUInt32LE(0);
    const cstr = async a => { const b = await readMemory(a, 16); const z = b.indexOf(0); return Buffer.from(b.subarray(0, z < 0 ? b.length : z)).toString('latin1'); }; // @math 16 bytes hold a name
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), flagAt: 0x1e574, flag: await u32(b2 + 0x1e574), levelAt: 0x1eca0, level: await u32(b2 + 0x1eca0), lookupAt: 0x28bd6, lookup: await u16(b2 + 0x28bd6), names: [await cstr(b2 + 0x1eb8), await cstr(b2 + 0x1ec0)] };
  },
  async demoinput() {
    // The attract-mode demo's control byte: `--args` {count, ms: [lo, hi]}. Per pause: the tick, the byte obj2+0x28cef, the bytes +0x28cd5 (left), +0x28cdd (right), +0x28cec, the words +0x28b40, +0x28b42, +0x28b44, +0x28b46 (the four buttons) and the word +0x28c0c.
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], spec = JSON.parse(values.args || '{}'), sleep = ms => new Promise(r => setTimeout(r, ms)), post = path => fetch(`${API}/api/v1${path}`, { method: 'POST' });
    const u8 = async a => (await readMemory(a, 1))[0], u16 = async a => Buffer.from(await readMemory(a, 2)).readUInt16LE(0), u32 = async a => Buffer.from(await readMemory(a, 4)).readUInt32LE(0);
    const [lo, hi] = spec.ms ?? [100, 300], samples = [];
    for (let i = 0; i < (spec.count ?? 60); i++) {
      await post('/debug/continue'); await sleep(lo + Math.floor(Math.random() * (hi - lo))); await post('/debug/pause'); await sleep(30);
      samples.push({ tick: await u32(b2 + 0x1ec64), byte: await u8(b2 + 0x28cef), left: await u8(b2 + 0x28cd5), right: await u8(b2 + 0x28cdd), flag: await u8(b2 + 0x28cec), buttons: [await u16(b2 + 0x28b40), await u16(b2 + 0x28b42), await u16(b2 + 0x28b44), await u16(b2 + 0x28b46)], demo: await u16(b2 + 0x28c0c) });
    }
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), byteAt: 0x28cef, samples };
  },
  async hscroll() {
    // The horizon strip's pointer and the steering words, pause by pause: `--args` {count, ms: [lo, hi]}. Per pause: the tick obj2+0x1ec64, the pointer obj2+0x1d860, the heading dword +0x1d5d4, the player car's words +0x52 and +0x54
    // (the car record is the one the dword obj2+0x1d5b0 points to), the left and right bytes +0x28cd5 and +0x28cdd, the amounts +0x28b92 and +0x28b90 and the mode word +0x28c42.
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], spec = JSON.parse(values.args || '{}'), sleep = ms => new Promise(r => setTimeout(r, ms)), post = path => fetch(`${API}/api/v1${path}`, { method: 'POST' });
    const rd = async (a, n) => { for (let k = 0; k < 20; k++) { try { return await readMemory(a, n); } catch { await sleep(25); } } throw new Error(`read failed at ${a}`); }; // @math retry a read that fails while the pause takes effect
    const u32 = async a => Buffer.from(await rd(a, 4)).readUInt32LE(0), i16 = async a => Buffer.from(await rd(a, 2)).readInt16LE(0), u8 = async a => (await rd(a, 1))[0];
    const [lo, hi] = spec.ms ?? [40, 80], samples = [];
    // With `--args` steer: the key table's high bytes (obj2+0x1b6d8 + 1 for the left key, + 3 for the right key, the state bytes of input.key-state) are written between the pauses: left, right or none for a random run of pauses.
    const put = async (a, v) => { for (let k = 0; k < 20; k++) { const r = await fetch(`${API}/api/v1/memory/${a}`, { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: Buffer.from([v]) }); if (r.ok) return; await sleep(25); } }; // @math retry while the pause takes effect
    let command = 'none', left = 0;
    for (let i = 0; i < (spec.count ?? 300); i++) {
      if (spec.steer && left-- <= 0) { command = ['left', 'right', 'none'][Math.floor(Math.random() * 3)]; left = 3 + Math.floor(Math.random() * 12); await put(b2 + 0x1b6d8 + 1, command === 'left' ? 1 : 0); await put(b2 + 0x1b6d8 + 3, command === 'right' ? 1 : 0); } // @math runs of 3 to 14 pauses
      await post('/debug/continue'); await sleep(lo + Math.floor(Math.random() * (hi - lo))); await post('/debug/pause'); await sleep(70);
      const car = await u32(b2 + 0x1d5b0);
      samples.push({ tick: await u32(b2 + 0x1ec64), pointer: await u32(b2 + 0x1d860), heading: await u32(b2 + 0x1d5d4), w52: await i16(car + 0x52), w54: await i16(car + 0x54), left: await u8(b2 + 0x28cd5), right: await u8(b2 + 0x28cdd), leftAmount: await i16(b2 + 0x28b92), rightAmount: await i16(b2 + 0x28b90), mode: await i16(b2 + 0x28c42), state: await i16(car + 0x18), frameWord: await i16(car + 0x1a), hop: await i16(car + 0x06), throttle: await i16(car + 0x42), speed: await i16(car + 0x26) });
    }
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), base: 0xa7d00, samples };
  },
  async tickrate() {
    // The game's counters against the clock, read while the game runs: `--args` {seconds}. At two moments about `seconds` apart (default 10): the frame counter obj2+0x1ec64, the 10 Hz timer +0x1e71c, the 136 Hz counter +0x1e720, the frame period words +0x1ed08 and +0x1ea5c, the PIT divisor +0x3fa4 and the mode word +0x28c0c, with the host clock in milliseconds.
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], spec = JSON.parse(values.args || '{}'), sleep = ms => new Promise(r => setTimeout(r, ms));
    await fetch(`${API}/api/v1/debug/continue`, { method: 'POST' }); await sleep(500);
    const i32 = async a => Buffer.from(await readMemory(b2 + a, 4)).readInt32LE(0), i16 = async a => Buffer.from(await readMemory(b2 + a, 2)).readInt16LE(0);
    const take = async () => { const at = Date.now(); const s = { frames: await i32(0x1ec64), tenths: await i32(0x1e71c), hundred36: await i32(0x1e720) }; return { ms: at, ...s }; };
    const first = await take(); await sleep((spec.seconds ?? 10) * 1000); const second = await take(); // @math ten seconds by default
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), elapsedMs: second.ms - first.ms, delta: { frames: second.frames - first.frames, tenths: second.tenths - first.tenths, hundred36: second.hundred36 - first.hundred36 }, words: { period: await i32(0x1ed08), active: await i32(0x1ea5c), divisor: await i32(0x3fa4), mode: await i16(0x28c0c), raceMode: await i16(0x28c44) } };
  },
  async spwtable() {
    // The 12-byte object records of the race (obj2+0x13938, the count in the word +0x28b8e) pause by pause: `--args` {count, ms: [lo, hi]}. Per pause: the tick obj2+0x1ec64 and the six words of every record.
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], spec = JSON.parse(values.args || '{}'), sleep = ms => new Promise(r => setTimeout(r, ms)), post = path => fetch(`${API}/api/v1${path}`, { method: 'POST' });
    const rd = async (a, n) => { for (let k = 0; k < 20; k++) { try { return Buffer.from(await readMemory(a, n)); } catch { await sleep(25); } } throw new Error(`read failed at ${a}`); }; // @math retry a read that fails while the pause takes effect
    const [lo, hi] = spec.ms ?? [40, 90], samples = [];
    for (let i = 0; i < (spec.count ?? 100); i++) {
      await post('/debug/continue'); await sleep(lo + Math.floor(Math.random() * (hi - lo))); await post('/debug/pause'); await sleep(70);
      const count = (await rd(b2 + 0x28b8e, 2)).readInt16LE(0), n = Math.min(Math.max(count, 0), 64), raw = await rd(b2 + 0x13938, 12 * n), records = []; // @math at most 64 records of 12 bytes
      for (let r = 0; r < n; r++) records.push(Array.from({ length: 6 }, (_, k) => raw.readInt16LE(r * 12 + 2 * k))); // @math six words of two bytes
      samples.push({ tick: (await rd(b2 + 0x1ec64, 4)).readInt32LE(0), count, records });
    }
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), tableAt: 0x13938, samples };
  },
  async menuframe() {
    // The main menu pause by pause: `--args` {count, ms: [lo, hi], keys: [[sampleIndex, 'KBD_down'], ...]}. Per pause the CRC-32 of the whole displayed page (mode X, read plane by plane) and the words the menu animation runs on:
    // the cursor (obj2+0x32f8c, 1 to 9), the idle counter (+0x32f74, also what +0x1ed0c counts), the animation phase (+0x32fa0), the car slot pair (+0x32fa4), the count in the phase (+0x32f88), the size class (+0x32fac), the selection icons' frame (+0x32f64), row (+0x32f68) and busy flag (+0x32f7c) the time of the last menu frame (+0x1ea70) and the 136 Hz counter (+0x1e720).
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], spec = JSON.parse(values.args || '{}'), sleep = ms => new Promise(r => setTimeout(r, ms)), post = path => fetch(`${API}/api/v1${path}`, { method: 'POST' });
    const io = (port, value, width) => fetch(`${API}/api/v1/io/port`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ port, value, width }) });
    const inPort = async port => (await (await fetch(`${API}/api/v1/io/port?port=${port}`)).json()).value;
    const rd = async (a, n) => { for (let k = 0; k < 20; k++) { try { return Buffer.from(await readMemory(a, n)); } catch { await sleep(25); } } throw new Error(`read failed at ${a}`); }; // @math retry a read that fails while the pause takes effect
    const W = 320, H = 200, LINE = 80, planes = 4; // @math the 320x200 mode-X picture, 80 bytes a line and plane
    const grab = async () => {
      await io(0x3d4, 0x0c, 1); const high = await inPort(0x3d5); await io(0x3d4, 0x0d, 1); const low = await inPort(0x3d5), start = high * 256 + low; // @math the start address registers 0x0c and 0x0d
      const plane = []; for (let p = 0; p < planes; p++) { await io(0x3ce, (p << 8) | 4, 2); plane.push(await rd(0xa0000 + start, LINE * H)); }
      const image = Buffer.alloc(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) image[y * W + x] = plane[x & 3][y * LINE + (x >> 2)];
      return image;
    };
    const tap = key => fetch(`${API}/api/v1/input/sequence`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ events: [{ type: 'key', key, pressed: true, frame: 2 }, { type: 'key', key, pressed: false, frame: 7 }] }) }); // @math press at frame 2, release 5 frames later
    const [lo, hi] = spec.ms ?? [30, 120], keys = new Map((spec.keys ?? []).map(([i, k]) => [i, k])), samples = [];
    for (let i = 0; i < (spec.count ?? 100); i++) {
      await post('/debug/continue'); if (keys.has(i)) await tap(keys.get(i)); await sleep(lo + Math.floor(Math.random() * (hi - lo))); await post('/debug/pause'); await sleep(70);
      const image = await grab(), state = await rd(b2 + 0x32f60, 0x50), i32 = off => state.readInt32LE(off - 0x32f60), t136 = (await rd(b2 + 0x1e720, 4)).readInt32LE(0), frameTime = (await rd(b2 + 0x1ea70, 4)).readInt32LE(0);
      samples.push({ frameTime, frameCrc: hex8(crc32(image)), cursor: i32(0x32f8c), idle: i32(0x32f74), lionFrame: i32(0x32f64), lionRow: i32(0x32f68), busy: i32(0x32f7c), phase: i32(0x32fa0), pair: i32(0x32fa4), count: i32(0x32f88), size: i32(0x32fac), t136 });
    }
    return { ...header, bases: Object.fromEntries(found.bases.map((b, k) => [k + 1, b])), keys: [...keys].map(([i, k]) => [i, k]), words: { cursor: 0x32f8c, idle: 0x32f74, phase: 0x32fa0, pair: 0x32fa4, count: 0x32f88, size: 0x32fac, lionFrame: 0x32f64, lionRow: 0x32f68, busy: 0x32f7c, frameTime: 0x1ea70 }, samples };
  },
  async devil() {
    // The driver reaction figure ("devil") of the race screen: `--args` {count, ms: [lo, hi], poke: [[offset, value32], ...]}. Per pause: the tick, the dwords obj2+0x84f4 (the driver, 0 = none), +0x8500, +0x8504 (the frame in its block)
    // and +0x8508 (the step of GIG.MOV), and for the entries step - 2, step - 1 and step of GIG.MOV (screen x 0xfa + the entry's x, row 0x78 + its y) the number and CRC-32 of the screen pixels under the non-zero
    // pixels of the 38 x 44 frames of GIGGLES.SP: all 28 at the entry step - 1, the 4 of the driver's block at the other two.
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], VRAM = 0xa0000, W = 320, H = 200, LINE = 80, planes = 4; // @math the 320x200 mode-X picture, 80 bytes a line and plane
    const spec = JSON.parse(values.args || '{}'), sleep = ms => new Promise(r => setTimeout(r, ms)), post = path => fetch(`${API}/api/v1${path}`, { method: 'POST' });
    const io = (port, value, width) => fetch(`${API}/api/v1/io/port`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ port, value, width }) });
    const inPort = async port => (await (await fetch(`${API}/api/v1/io/port?port=${port}`)).json()).value;
    const i32 = async a => Buffer.from(await readMemory(b2 + a, 4)).readInt32LE(0);
    const members = new Map(parseDatDirectory(datBytes).map(e => [e.name, e.data])), giggles = members.get('GIGGLES.SP'), mov = members.get('GIG.MOV'), dvm = new DataView(mov.buffer, mov.byteOffset), FW = 38, FH = 44; // @math the frame size of the report
    for (const [off, v] of spec.poke ?? []) { const b = Buffer.alloc(4); b.writeInt32LE(v); await fetch(`${API}/api/v1/memory/${b2 + off}`, { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: b }); }
    const samples = [];
    for (let n = 0; n < (spec.count ?? 30); n++) { // @math thirty pauses by default
      await post('/debug/continue'); const [lo, hi] = spec.ms ?? [150, 450]; await sleep(lo + Math.floor(Math.random() * (hi - lo))); await post('/debug/pause'); await sleep(50); // @math a random run of 0.15 to 0.45 s
      await io(0x3d4, 0x0c, 1); const high = await inPort(0x3d5); await io(0x3d4, 0x0d, 1); const low = await inPort(0x3d5), start = high * 256 + low; // @math the start address registers
      const plane = []; for (let p = 0; p < planes; p++) { await io(0x3ce, (p << 8) | 4, 2); plane.push(Buffer.from(await readMemory(VRAM + start, LINE * H))); }
      const image = Buffer.alloc(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) image[y * W + x] = plane[x & 3][y * LINE + (x >> 2)];
      const driver = await i32(0x84f4), step = await i32(0x8508), words = [await i32(0x1ec64), driver, await i32(0x8500), await i32(0x8504), step];
      const under = (k, entry) => { if (entry < 0) return null; const mx = dvm.getInt16(2 + 4 * entry, true), my = dvm.getInt16(4 + 4 * entry, true), picked = []; // @math the count word, then the x and y words of an entry
        for (let j = 0; j < FH; j++) for (let i = 0; i < FW; i++) { if (giggles[FW * FH * k + i * FH + j] === 0) continue; const X = 0xfa + mx + i, Y = 0x78 + my + j; picked.push(X >= 0 && X < W && Y >= 0 && Y < H ? image[Y * W + X] : 0); } // @math the screen x and row of the report
        return [picked.length, hex8(crc32(Buffer.from(picked)))]; };
      const block = Math.max(driver - 1, 0), at = {}; // the entries step - 2, step - 1 and step
      at.prev = Array.from({ length: 28 }, (_, k) => under(k, step - 1)); // @math all 28 frames
      at.before = Array.from({ length: 4 }, (_, k) => under(block * 4 + k, step - 2)); at.now = Array.from({ length: 4 }, (_, k) => under(block * 4 + k, step)); // @math the 4 frames of a block
      samples.push({ words, ...at });
    }
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), count: spec.count ?? 30, columns: ['tick', 'driver', 'flag', 'frame', 'step'], samples };
  },
  async steps() {
    // (a played race, paused) tick-resolution samples of the player's car while keys are held: --phases '[[["KBD_leftalt"],40],[[],40],...]' (keys, samples), --ms 'lo,hi' the random run in ms between the samples.
    // Per sample: the tick counter obj2+0x1ec64, the car's throttle +0x42 and speed +0x26, the player's world x and y (obj2+0xaaa6, +0xaaa8), the angle dword obj2+0x1d5d4, the accelerate and brake words
    // obj2+0x28b40 and +0x28b44, the steering amounts obj2+0x28b90 and +0x28b92, the collision-related car words +0x7c and +0x7e, and the terrain dword obj2+0x1e568.
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], sleep = ms => new Promise(r => setTimeout(r, ms));
    const post = (path, body) => fetch(`${API}/api/v1${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
    const i16 = async a => Buffer.from(await readMemory(a, 2)).readInt16LE(0), u16 = async a => Buffer.from(await readMemory(a, 2)).readUInt16LE(0), i32 = async a => Buffer.from(await readMemory(a, 4)).readInt32LE(0);
    const phases = JSON.parse(values.phases ?? '[]'), [lo, hi] = (values.ms ?? '60,120').split(',').map(Number), samples = []; // @math a random run of 60 to 120 ms by default
    if (values.poke) for (const [off, v] of JSON.parse(values.poke)) { const b = Buffer.alloc(2); b.writeInt16LE(v); await fetch(`${API}/api/v1/memory/${b2 + off}`, { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: b }); } // --poke '[[offset, value], ...]': 16-bit writes to obj2 words before the first phase (an experiment on the run copy)
    let down = [];
    await post('/debug/pause');
    for (const [keys, n] of phases) {
      for (let k = 0; k < n; k++) {
        const events = [...(k ? [] : down.map(key => ({ type: 'key', key, pressed: false, frame: 1 }))), ...(k ? [] : keys.map(key => ({ type: 'key', key, pressed: true, frame: 2 })))];
        if (events.length) await post('/input/sequence', { events });
        await post('/debug/continue'); await sleep(lo + Math.floor(Math.random() * (hi - lo))); await post('/debug/pause'); await sleep(30); // @math a short settle after the pause
        const car = await i32(b2 + 0x1d5b0);
        samples.push([phases.findIndex(p => p[0] === keys && p[1] === n), await i32(b2 + 0x1ec64), await i16(car + 0x42), await i16(car + 0x26), await u16(b2 + 0xaaa6), await u16(b2 + 0xaaa8), await i32(b2 + 0x1d5d4), await u16(b2 + 0x28b40), await u16(b2 + 0x28b44), await u16(b2 + 0x28b90), await u16(b2 + 0x28b92), await i16(car + 0x7c), await i16(car + 0x7e), await i32(b2 + 0x1e568), ...(values.extra ? [await i16(b2 + 0x28bae), await i16(b2 + 0x28b0a), await i16(b2 + 0x28b0e), ...(await (async () => { const out = []; for (const n of [1, 7]) out.push(await i16(b2 + 0xaaa6 + 0x68 * n), await i16(b2 + 0xaaa8 + 0x68 * n), await i16(b2 + 0xaa90 + 0x68 * n + 2), await i16(b2 + 0xaa90 + 0x68 * n + 4), await i16(b2 + 0x848c + 0x104 * n)); return out; })())] : []) , ...(values.extra2 ? await (async () => { const list = Buffer.from(await readMemory(b2 + 0x1f2b0, 0x22 * 0x3d)), active = []; for (let r = 0; r < 0x3d; r++) if (list.readInt16LE(r * 0x22 + 4) !== 0) active.push(r); const shot = k => (active[k] === undefined ? [0, 0, 0] : [list.readInt16LE(active[k] * 0x22 + 10), list.readInt16LE(active[k] * 0x22 + 12), list.readInt16LE(active[k] * 0x22 + 24)]); const hits = []; for (let n = 1; n <= 7; n++) hits.push(await i16(b2 + 0xaa90 + 0x68 * n + 0x58)); return [await i16(car + 0x16), active.length, ...shot(0), ...shot(1), ...shot(2), ...hits, await i32(b2 + 0xaa90 + 0x68 + 0x4c)]; })() : []), ...(values.extra3 ? [await i16(car + 0x44), await i16(car + 0x56), await i32(car + 0x36), await i32(car + 0x3a), await i16(car + 0xa), await i16(car + 0x18), await i16(car + 0x1a), await i16(car + 0x5a), await i16(car + 0x7e), await i16(car + 0xc), await i16(car + 0x10)] : []), ...(values.extra4 ? await (async () => { const out = []; for (let n = 1; n <= 7; n++) for (const off of [0xc, 0xa, 0x8]) out.push(await i16(b2 + 0xaa90 + 0x68 * n + off)); return out; })() : []), ...(values.extra5 ? [await i32(b2 + 0x84f4), await i32(b2 + 0x8500), await i32(b2 + 0x8504), await i32(b2 + 0x8508), await i16(b2 + 0x84c2), await i32(b2 + 0x84fc), await i16(b2 + 0x28b9c), await i16(b2 + 0x84b4)] : [])]); // @math --extra: the global collision word, the position words and, for the racers 1 and 7, x, y, word +2, state +4 and the contact flag
      }
      down = keys;
    }
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), phases: phases.map(([keys, n]) => [keys.length, n]), columns: ['phase', 'tick', 'throttle', 'speed', 'x', 'y', 'angle', 'accelerate', 'brake', 'rightAmount', 'leftAmount', 'collisionA', 'collisionB', 'terrain', ...(values.extra ? ['collisionWord', 'cameraX', 'cameraY', 'r1x', 'r1y', 'r1w2', 'r1state', 'r1flag', 'r7x', 'r7y', 'r7w2', 'r7state', 'r7flag'] : []), ...(values.extra2 ? ['held', 'shots', 'sAx', 'sAy', 'sAtravel', 'sBx', 'sBy', 'sBtravel', 'sCx', 'sCy', 'sCtravel', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'r1stamp'] : []), ...(values.extra3 ? ['state44', 'surface56', 'frac36', 'word3a', 'fall0a', 'anim18', 'frame1a', 'flag5a', 'crash7e', 'cnt0c', 'hop10'] : []), ...(values.extra4 ? [1, 2, 3, 4, 5, 6, 7].flatMap(n => [`w${n}c`, `w${n}a`, `w${n}8`]) : []), ...(values.extra5 ? ['driver84f4', 'flag8500', 'frame8504', 'step8508', 'lap84c2', 'word84fc', 'laps28b9c', 'word84b4'] : [])], samples };
  },
  async boost() {
    // The boost of the player's car (tools/dosbox/boost-run.mjs passes --args {build, forced, samples}): the run archive is the user's with one tile of track 1 given the terrain value in
    // `build` (tools/dosbox/make-test-sin.mjs) and laid over a strip of the map, and the boost's gate inputs (the car word +0xa and the heading range words) were written before the car
    // drove over the strip; the samples were taken between short runs.
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], runDat = await readFile(resolve(values.run));
    const cstr = async a => { const b = await readMemory(a, 40); const z = b.indexOf(0); return Buffer.from(b.subarray(0, z < 0 ? b.length : z)).toString('latin1'); };
    const A = JSON.parse(values.args);
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), names: { track: await cstr(b2 + 0x1d770) }, modified: { size: runDat.length, sha1: sha1(runDat) }, build: A.build, forced: A.forced, gateBefore: A.gateBefore, gateAfter: A.gateAfter,
      columns: ['boostActive', 'boostTimer', 'throttle', 'speed', 'terrain', 'row', 'fraction', 'surface', 'tableEntry', 'carWordA', 'heading'], samples: A.samples };
  },
  async strip() {
    // A strip of one terrain value laid over the map of track 1 in the run copy (tools/dosbox/strip-run.mjs passes --args {build, samples}); nothing is written into the game.
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], runDat = await readFile(resolve(values.run));
    const cstr = async a => { const b = await readMemory(a, 40); const z = b.indexOf(0); return Buffer.from(b.subarray(0, z < 0 ? b.length : z)).toString('latin1'); };
    const A = JSON.parse(values.args);
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), names: { track: await cstr(b2 + 0x1d770) }, modified: { size: runDat.length, sha1: sha1(runDat) }, build: A.build,
      columns: ['throttle', 'speed', 'column', 'row', 'heading', 'collision', 'carWordA', 'carWord7c', 'terrain', ...(A.wide ?? []), ...(A.object ?? []), ...(A.shots ?? [])], samples: A.samples, ...(A.stops ? { stopAt: A.stopAt, stops: A.stops } : {}), ...(A.lists ? { lists: A.lists, fireAt: A.fireAt, hold: A.hold } : {}), ...(A.laps ? { laps: A.laps } : {}), ...(A.racers ? { racers: A.racers, racerWords: A.racerWords, ticks: A.ticks } : {}) };
  },
  async projtable() {
    // The distance-to-screen-row table the race builds at obj2+0xbd00 (the routine at obj1+0x174a4): its CRC-32 over `--bytes` bytes (default 8194, 4097 words), read in a race.
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], n = Number(values.bytes ?? 8194), live = Buffer.from(await readMemory(b2 + 0xbd00, n)); // @math 4097 words of two bytes
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), tableAt: 0xbd00, bytes: n, crc: hex8(crc32(live)) };
  },
  async drawlist() {
    // The draw list of the race (view.draw-order): at 40 random pauses of a played race, the count word obj2+0x28b78 and the records from obj2+0x19a50 (0x28 bytes each, read as 20 words).
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], sleep = ms => new Promise(r => setTimeout(r, ms));
    const post = path => fetch(`${API}/api/v1${path}`, { method: 'POST' });
    const samples = [];
    await post('/debug/pause');
    for (let k = 0; k < 40; k++) { // @math forty pauses
      await post('/debug/continue'); await sleep(150 + Math.floor(Math.random() * 350)); await post('/debug/pause'); await sleep(50); // @math a random run of 0.15 to 0.5 s
      const count = Buffer.from(await readMemory(b2 + 0x28b78, 2)).readInt16LE(0), n = Math.min(Math.max(count, 0), 30), raw = Buffer.from(await readMemory(b2 + 0x19a50, 0x28 * n)), records = []; // @math at most 30 records
      for (let r = 0; r < n; r++) { const w = []; for (let i = 0; i < 20; i++) w.push(raw.readInt16LE(r * 0x28 + i * 2)); records.push(w); } // @math twenty words of two bytes in a record of 0x28 bytes
      samples.push({ count, records });
    }
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), listAt: 0x19a50, recordBytes: 0x28, samples };
  },
  async font() {
    // The glyph pointer table of the text routine obj1+0x48f4 (obj2+0xa778, 61 dwords) and the CRC-32 of the 0x40 bytes each pointer addresses, read from the live game.
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], TABLE = 0xa778, ENTRIES = 61, SLOT = 0x40; // @math the table the text routine reads (esi * 4 + 0xa778), 61 glyphs, and the glyph slot of 0x40 bytes
    const raw = Buffer.from(await readMemory(b2 + TABLE, 4 * ENTRIES)), pointers = [], crcs = [];
    for (let c = 0; c < ENTRIES; c++) { const p = raw.readUInt32LE(4 * c); pointers.push(p); crcs.push(hex8(crc32(Buffer.from(await readMemory(p, SLOT))))); }
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), tableAt: TABLE, entries: ENTRIES, slotBytes: SLOT, pointers, crcs };
  },
  async screen() {
    // The displayed page of a race, read from video memory plane by plane (read-map register of the graphics controller): the CRC-32 of the whole 320x200 picture and of each rectangle of `--rects` ([[x, y, w, h], ...]),
    // with the HUD words the picture was made from (the racer HUD record at obj2+0x8426: +0 held item, +0x10 and +0x12 the speed words, +0x54, +0x56 counters, +0x96 place), read while the game is paused.
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], VRAM = 0xa0000, W = 320, H = 200, LINE = 80, planes = 4; // @math the 320x200 mode-X picture, 80 bytes a line and plane
    const io = (port, value, width) => fetch(`${API}/api/v1/io/port`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ port, value, width }) });
    const inPort = async port => (await (await fetch(`${API}/api/v1/io/port?port=${port}`)).json()).value;
    await io(0x3d4, 0x0c, 1); const high = await inPort(0x3d5); await io(0x3d4, 0x0d, 1); const low = await inPort(0x3d5); const start = high * 256 + low; // @math the start address registers 0x0c and 0x0d
    const plane = [];
    for (let p = 0; p < planes; p++) { await io(0x3ce, (p << 8) | 4, 2); plane.push(Buffer.from(await readMemory(VRAM + start, LINE * H))); }
    const image = Buffer.alloc(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) image[y * W + x] = plane[x & 3][y * LINE + (x >> 2)];
    const spec = JSON.parse(values.args || '{}'), part = (x, y, w, h) => { const out = Buffer.alloc(w * h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out[j * w + i] = image[(y + j) * W + x + i]; return out; };
    const rects = (spec.rects ?? []).map(([x, y, w, h]) => ({ rect: [x, y, w, h], crc: hex8(crc32(part(x, y, w, h))) }));
    // Sprites drawn transparently (index 0 skipped): the CRC-32 of the screen pixels under the sprite's non-zero pixels (column-major frame at `at` in the member), in row order, leaving out the `exclude` rectangles.
    const members = new Map(parseDatDirectory(datBytes).map(e => [e.name, e.data]));
    const sprites = (spec.sprites ?? []).map(sp => { const data = members.get(sp.member), picked = []; for (let j = 0; j < sp.h; j++) for (let i = 0; i < sp.w; i++) { if (data[sp.at + i * sp.h + j] === 0) continue; const x = sp.x + i, y = sp.y + j; if ((sp.exclude ?? []).some(([ex, ey, ew, eh]) => x >= ex && x < ex + ew && y >= ey && y < ey + eh)) continue; picked.push(image[y * W + x]); } return { ...sp, pixels: picked.length, crc: hex8(crc32(Buffer.from(picked))) }; });
    // Tile fonts (`--args` field `tiles`: { member, w, h, count, positions: [{ x, y, tag }] }): for every position and every tile of the member (w x h pixels, column-major, tile k at byte w * h * k, zero pixels transparent) the number and the CRC-32 of the screen pixels under the tile's non-zero pixels.
    const tiles = (spec.tiles ?? []).map(tf => { const data = members.get(tf.member); return { ...tf, positions: tf.positions.map(pos => ({ ...pos, c: Array.from({ length: tf.count }, (_, k) => { const picked = []; for (let j = 0; j < tf.h; j++) for (let i = 0; i < tf.w; i++) { if (data[tf.w * tf.h * k + i * tf.h + j] === 0) continue; picked.push(image[(pos.y + j) * W + pos.x + i]); } return [picked.length, hex8(crc32(Buffer.from(picked)))]; }) })) }; });
    // Extra obj2 words by offset (`--args` field `words`: [offsets]), read while the game is paused.
    const words = spec.words ? Object.fromEntries(await Promise.all(spec.words.map(async off => [off, Buffer.from(await readMemory(b2 + off, 2)).readInt16LE(0)]))) : undefined;
    const i16 = async a => Buffer.from(await readMemory(b2 + a, 2)).readInt16LE(0), car = Buffer.from(await readMemory(b2 + 0x1d5b0, 4)).readUInt32LE(0), c16 = async off => Buffer.from(await readMemory(car + off, 2)).readInt16LE(0);
    const hud = {}; for (const [name, off] of Object.entries({ item: 0x8426, speedTarget: 0x8436, speedShown: 0x8438, counterA: 0x847a, counterB: 0x847c, place: 0x84bc })) hud[name] = await i16(off); // @math the racer HUD record words of the report
    const i32 = async a => Buffer.from(await readMemory(b2 + a, 4)).readInt32LE(0); hud.ticks = await i32(0x1e71c); hud.now = await i32(0x1ec64); hud.timerMode = await i16(0x28c44); // @math the timer word of the report, the tick counter and the mode word
    const hudWords = []; for (let k = 0; k < 130; k++) hudWords.push(await i16(0x8426 + 2 * k)); // @math the 0x104-byte record as 130 words
    const carWords = { speed: await c16(0x26), throttle: await c16(0x42) };
    // The floor (obj1+0x27e94): the CRC-32 of each of the 320 columns of the 70 rows 130 to 199 of the displayed page, with the camera words, the heading and the draw list of the same pause.
    let floor;
    if (spec.floor) {
      const columns = []; for (let c = 0; c < 320; c++) { const col = Buffer.alloc(70); for (let j = 0; j < 70; j++) col[j] = image[(130 + j) * W + c]; columns.push(hex8(crc32(col))); } // @math 320 columns of the 70 rows from row 130
      const count = await i16(0x28b78), raw = Buffer.from(await readMemory(b2 + 0x19a50, 0x28 * Math.min(Math.max(count, 0), 30))), list = []; // @math at most 30 draw-list records
      for (let r = 0; r < raw.length / 0x28; r++) { const w = []; for (let i = 0; i < 20; i++) w.push(raw.readInt16LE(r * 0x28 + i * 2)); list.push(w); } // @math twenty words in a record of 0x28 bytes
      const cstr = async a => { const b = await readMemory(a, 40); const z = b.indexOf(0); return Buffer.from(b.subarray(0, z < 0 ? b.length : z)).toString('latin1'); };
      floor = { columns, camera: [await i16(0x28b0a), await i16(0x28b0e)], heading: await i32(0x1d5d4), page: await i16(0x28b24), mode: await i16(0x28c20), drawList: list, track: await cstr(b2 + 0x1d770) };
    }
    // The horizon strip (obj1+0x27e94 copies 20 rows from video memory at the dword obj2+0x1d860): the CRC-32 of each of the 320 columns of the rows 110 to 129 of the displayed page, with that pointer, its bounds and the draw list.
    let horizon;
    if (spec.horizon) {
      const columns = []; for (let c = 0; c < 320; c++) { const col = Buffer.alloc(20); for (let j = 0; j < 20; j++) col[j] = image[(110 + j) * W + c]; columns.push(hex8(crc32(col))); } // @math 320 columns of the 20 rows from row 110
      const u32 = async a => Buffer.from(await readMemory(b2 + a, 4)).readUInt32LE(0), count2 = await i16(0x28b78), raw2 = Buffer.from(await readMemory(b2 + 0x19a50, 0x28 * Math.min(Math.max(count2, 0), 30))), list2 = []; // @math at most 30 draw-list records
      for (let r = 0; r < raw2.length / 0x28; r++) { const w = []; for (let i = 0; i < 20; i++) w.push(raw2.readInt16LE(r * 0x28 + i * 2)); list2.push(w); } // @math twenty words in a record of 0x28 bytes
      const cstr3 = async a => { const b = await readMemory(a, 40); const z = b.indexOf(0); return Buffer.from(b.subarray(0, z < 0 ? b.length : z)).toString('latin1'); };
      horizon = { columns, pointer: await u32(0x1d860), bounds: [await u32(0x1d824), await u32(0x1d828), await u32(0x1d82c), await u32(0x1d830)], heading: await i32(0x1d5d4), camera: { x: await i16(0x28b0a), y: await i16(0x28b0e), a: await i32(0x1d614), b: await i32(0x1d5e4), racers: await (async () => { const out = []; const n = (await i16(0x28c40)) + 1; for (let k = 0; k < n; k++) out.push([await i16(0xaaa6 + 0x68 * k), await i16(0xaaa8 + 0x68 * k), await i16(0xaaaa + 0x68 * k)]); return out; })(), box: [await i16(0x28c16), await i16(0x28c2a), await i16(0x28c18), await i16(0x28c2c)] }, drawList: list2, track: await cstr3(b2 + 0x1d770), mode: await u32(0x1d998) };
    }
    // The sprites of the draw list (spec.spritefit): per record the words (width, height, left, top, distance, skip, racer, size class, type), the picture and frame pointers, the CRC-32 of the picture (its two header words and the delta dwords, when the record is not cut), of the first bytes of the source frame
    // for the frame sizes of the shapes in `spec.frameLengths`, and of the displayed rectangle (left, top, width, height) clipped to the screen; with the camera words, the heading, the render mode and the horizon pointer.
    let fit;
    if (spec.spritefit) {
      const u32f = async a => Buffer.from(await readMemory(b2 + a, 4)).readUInt32LE(0), count3 = await i16(0x28b78), n3 = Math.min(Math.max(count3, 0), 30), raw3 = Buffer.from(await readMemory(b2 + 0x19a50, 0x28 * n3)), records = []; // @math at most 30 draw-list records
      for (let r = 0; r < n3; r++) {
        const o = r * 0x28, w = raw3.readUInt16LE(o), h = raw3.readUInt16LE(o + 2), left = raw3.readInt16LE(o + 4), top = raw3.readInt16LE(o + 6), pic = raw3.readUInt32LE(o + 8), frame = raw3.readUInt32LE(o + 12), skip = raw3.readUInt32LE(o + 0x14);
        const rec = { w, h, left, top, distance: raw3.readInt16LE(o + 0x10), skip, racer: raw3.readInt16LE(o + 0x18), sizeClass: raw3.readInt16LE(o + 0x1a), type: raw3.readInt16LE(o + 0x24), pic, frame }; // @math the words of the 0x28-byte record
        if (!skip) { const head = Buffer.from(await readMemory(pic - 4, 4)); const fw = head.readUInt16LE(0), fh = head.readUInt16LE(2); if (fw === w && fh === h) rec.picCrc = hex8(crc32(Buffer.from(await readMemory(pic - 4, 4 + (h + 1) * w * 4)))); } // @math the 4-byte header and (h + 1) x w delta dwords
        const src = Buffer.from(await readMemory(frame, Math.max(...(spec.frameLengths ?? [1])))); rec.frameCrcs = Object.fromEntries((spec.frameLengths ?? []).map(len => [len, hex8(crc32(src.subarray(0, len)))]));
        const x0 = Math.max(left, 0), y0 = Math.max(top, 0), x1 = Math.min(left + w, W), y1 = Math.min(top + h, H); if (x1 > x0 && y1 > y0) rec.rect = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, crc: hex8(crc32(part(x0, y0, x1 - x0, y1 - y0))) };
        records.push(rec);
      }
      const cstr4 = async a => { const b = await readMemory(a, 40); const z = b.indexOf(0); return Buffer.from(b.subarray(0, z < 0 ? b.length : z)).toString('latin1'); };
      fit = { records, count: count3, camera: [await i16(0x28b0a), await i16(0x28b0e)], heading: await i32(0x1d5d4), mode: await i16(0x28c20), horizonPointer: await u32f(0x1d860), track: await cstr4(b2 + 0x1d770), rowCrcs: Array.from({ length: H }, (_, y) => hex8(crc32(image.subarray(y * W, (y + 1) * W)))), player: await i16(0x28b7e) };
    }
    // The sky: the CRC-32 of each row of the rectangle spec.sky = [firstRow, lastRow, firstColumn, lastColumn] of the displayed page, with the heading and the sky name of the track.
    let sky;
    if (spec.sky) {
      const [r0, r1, c0, c1] = spec.sky, rows = [];
      for (let y = r0; y <= r1; y++) rows.push(hex8(crc32(image.subarray(y * W + c0, y * W + c1 + 1))));
      const cstr2 = async a => { const b = await readMemory(a, 40); const z = b.indexOf(0); return Buffer.from(b.subarray(0, z < 0 ? b.length : z)).toString('latin1'); };
      sky = { rect: spec.sky, rows, heading: await i32(0x1d5d4), track: await cstr2(b2 + 0x1d770) };
    }
    // The minimap (obj1+0x1a4ac): the 78 x 50 picture the routine redraws sits at the dword obj2+0x1eb3c (column by column); every screen pixel of its rectangle at (0, 60) that differs from it is a racer's dot.
    let minimap;
    if (spec.minimap) {
      const ptr = Buffer.from(await readMemory(b2 + 0x1eb3c, 4)).readUInt32LE(0), buf = Buffer.from(await readMemory(ptr, 78 * 50)), dots = []; // @math the 78 x 50 picture
      for (let i = 0; i < 78; i++) for (let j = 0; j < 50; j++) if (buf[i * 50 + j] !== image[(60 + j) * W + i]) dots.push([i, j, image[(60 + j) * W + i]]); // @math the rectangle's origin row is 60
      const racers = []; for (let n = 0; n < 8; n++) racers.push([await i16(0xaaa6 + n * 0x68), await i16(0xaaa8 + n * 0x68)]); // @math eight racer records of 0x68 bytes: the x and y words
      minimap = { dots, racers, count: await i16(0x28c40), mode: await i16(0x28c0c), pictureCrc: hex8(crc32(buf)), tables: { x: [0x202cc, hex8(crc32(Buffer.from(await readMemory(b2 + 0x202cc, 2048))))], y: [0x1faca, hex8(crc32(Buffer.from(await readMemory(b2 + 0x1faca, 2048))))] } }; // @math the two 2048-byte tables of the minimap
    }
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), startAddress: start, frameCrc: hex8(crc32(image)), hud, hudWords, carWords, rects, sprites, ...(tiles.length ? { tiles } : {}), ...(words ? { words } : {}), ...(minimap ? { minimap } : {}), ...(floor ? { floor } : {}), ...(fit ? { fit } : {}), ...(sky ? { sky } : {}), ...(horizon ? { horizon } : {}) };
  },
  async carframes() {
    // The player's car in the draw list under a schedule of keys (tools/dosbox/car-run.mjs passes --args {schedule, buffer, samples}); the CARS.SP buffer address is in the dword obj2+0x1d708.
    const found = locateObjects(le, exeBytes, window, wStart), A = JSON.parse(values.args), frameCrcs = {};
    for (const s of A.samples) { if (!s.own.length) continue; const ptr = ((s.own[6] & 0xffff) | ((s.own[7] & 0xffff) << 16)) >>> 0; if (!(ptr in frameCrcs)) frameCrcs[ptr] = hex8(crc32(Buffer.from(await readMemory(ptr, 38 * 28)))); } // @math the 38 x 28 byte frame the draw-list record points at
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), frameCrcs, schedule: A.schedule.map(s => [s.at, s.key, s.down]), buffer: A.buffer, carWords: ['stateWord', 'frameWord', 'fallWord', 'hopWord', 'turnWord', 'frameCount', 'framePointer', 'basePointer'], keyWords: ['leftByte', 'rightByte', 'accelerate', 'brake', 'handBrake'], samples: A.samples };
  },
  async boot() {
    // The start of the program (tools/dosbox/boot-run.mjs passes --args {taps, samples}): [seconds, chain-4, CRTC start, CRC-32 of the 320 x 200 picture, 1].
    const A = JSON.parse(values.args);
    return { ...header, columns: ['seconds', 'chain4', 'start', 'frameCrc', 'x'], taps: A.taps, samples: A.samples };
  },
  async miss() {
    // The archive lookup's not-found path (obj1+0x41b2, tools/dosbox/miss-run.mjs): the name asked for and the walk index word, read at the stop.
    // The run archive is the one made with the same --edit arguments (make-test-archive).
    const found = locateObjects(le, exeBytes, window, wStart), b1 = found.bases[0], b2 = found.bases[1], stop = (await (await fetch(`${API}/api/v1/debug/status`)).json()).stop;
    const cstr = async a => { const b = await readMemory(a, 40); const z = b.indexOf(0); return Buffer.from(b.subarray(0, z < 0 ? b.length : z)).toString('latin1'); };
    const runDat = await readFile(resolve(values.run)), edits = values.edit.map(e => { const i = e.indexOf('='); return [Number(e.slice(0, i)), e.slice(i + 1)]; });
    const bp = (await (await fetch(`${API}/api/v1/debug/breakpoints`)).json()).breakpoints.filter(b => b.type === 'execute').map(b => [b.offset - b1, b.hit_count]);
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), member: values.member, edits, modified: { size: runDat.length, sha1: sha1(runDat) }, stoppedAt: stop.linear_eip - b1,
      name: await cstr(stop.registers.ebx), walkIndex: [0x28b00, Buffer.from(await readMemory(b2 + 0x28b00, 2)).readInt16LE(0)], breakpoints: bp,
      table: await (async () => { const index = Buffer.from(await readMemory(b2 + 0x28b00, 2)).readInt16LE(0), size = 0x16, first = i => readMemory(b2 + 0x5080 + i * size, 4).then(b => [...Buffer.from(b)]); return { offset: 0x5080, entryBytes: size, lastLoaded: await first(index - 1), atIndex: await first(index), afterIndex: await first(index + 1) }; })() };
  },
  async clamp() {
    // Out-of-range inputs forced into the terrain lookup at its entry (tools/dosbox/clamp-run.mjs passes the samples: [row, column, result]).
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1];
    const cstr = async a => { const b = await readMemory(a, 40); const z = b.indexOf(0); return Buffer.from(b.subarray(0, z < 0 ? b.length : z)).toString('latin1'); };
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), names: { track: await cstr(b2 + 0x1d770) }, inputsObject: 2, rowOffset: 0x1d7a8, columnOffset: 0x1d7a4, resultOffset: 0x1e568, forced: true, samples: JSON.parse(values.args) };
  },
  async placement() {
    // The racer records after the first branch of racer.init ran with its gate (obj2+0x1ec74) forced to 1 (tools/dosbox/placement-run.mjs), read at that branch's ret.
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], u16 = async a => Buffer.from(await readMemory(a, 2)).readUInt16LE(0), u32 = async a => Buffer.from(await readMemory(a, 4)).readUInt32LE(0);
    const cstr = async a => { const b = await readMemory(a, 40); const z = b.indexOf(0); return Buffer.from(b.subarray(0, z < 0 ? b.length : z)).toString('latin1'); };
    const racers = [];
    for (let i = 0; i < 24; i++) { // @math the 24 racer records
      const raw = Buffer.from(await readMemory(b2 + 0xaa90 + i * 0x68, 0x68)), words = [];
      for (let k = 0; k < raw.length; k += 2) words.push(raw.readUInt16LE(k)); // @math little-endian words
      racers.push(words);
    }
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), names: { track: await cstr(b2 + 0x1d770) }, gate: [0x1ec74, await u32(b2 + 0x1ec74)], countWord: [0x28c40, await u16(b2 + 0x28c40)], sourceWord: [0x1ecb0, await u16(b2 + 0x1ecb0)],
      routeLast: [0x28b7a, await u16(b2 + 0x28b7a)], tableBase: [0x12350, await u32(b2 + 0x12350)], recordBase: 0xaa90, recordBytes: 0x68, racers };
  },
  async gamload() {
    // The words the .GAM parser (obj1+0x1717c) has stored at its exit (tools/dosbox/stop-run.mjs, breakpoint at obj1+0x17499): the two value words, the two start tables, the flag and the three extra words.
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], i16 = async a => Buffer.from(await readMemory(a, 2)).readInt16LE(0);
    const cstr = async a => { const b = await readMemory(a, 40); const z = b.indexOf(0); return Buffer.from(b.subarray(0, z < 0 ? b.length : z)).toString('latin1'); };
    const table = async off => { const out = []; for (let k = 0; k < 8; k++) out.push(await i16(b2 + off + k * 2)); return out; }; // @math eight entries of two bytes
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), names: { track: await cstr(b2 + 0x1d770) },
      values: [[0x28b0a, await i16(b2 + 0x28b0a)], [0x28b0e, await i16(b2 + 0x28b0e)]], xTable: [0x1d7cc, await table(0x1d7cc)], yTable: [0x1d7e0, await table(0x1d7e0)], flag: [0x28b60, await i16(b2 + 0x28b60)],
      extra: [[0x28b5a, await i16(b2 + 0x28b5a)], [0x28b4e, await i16(b2 + 0x28b4e)], [0x28b4c, await i16(b2 + 0x28b4c)]] };
  },
  async cars() {
    // The CARS.SP buffer and the eight slot pointer records after a race has loaded (paused race, no breakpoint).
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1], u32 = async a => Buffer.from(await readMemory(a, 4)).readUInt32LE(0);
    const bufferPointer = await u32(b2 + 0x1d708), bufferBytes = 0x18f00; // @math the loader's read size (cars.slots)
    const live = Buffer.from(await readMemory(bufferPointer, bufferBytes)), records = [];
    for (let k = 0; k < 8; k++) { // @math eight slots
      const raw = Buffer.from(await readMemory(b2 + 0x13c08 + k * 0x98, 0x98)), dwords = [];
      for (let i = 0; i < raw.length; i += 4) dwords.push(raw.readUInt32LE(i)); // @math little-endian dwords
      records.push(dwords.map(d => (d >= bufferPointer && d < bufferPointer + bufferBytes ? [d - bufferPointer] : d)));
    }
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), bufferPointerOffset: 0x1d708, bufferBytes, bufferCrc: hex8(crc32(live)), recordTableOffset: 0x13c08, recordBytes: 0x98, records };
  },
  async spwframe() {
    // Samples at obj1+0x4414, where the object-preparation routine stores the frame address (stop-run.mjs arms the breakpoint and waits for the first stop):
    // the address (eax), the branch register (ecx), the object index (dx), the object's 12-byte record and its catalogue entry (0x28 bytes).
    const found = locateObjects(le, exeBytes, window, wStart), b1 = found.bases[0], b2 = found.bases[1], i32 = async a => Buffer.from(await readMemory(a, 4)).readInt32LE(0), sleep = ms => new Promise(r => setTimeout(r, ms));
    const api = `${API}/api/v1/debug`, status = async () => (await (await fetch(`${api}/status`)).json()), samples = [], bufferPointer = await i32(b2 + 0x1d708);
    const waitStop = async since => { for (let i = 0; i < 1200; i++) { const d = await status(); if (d.debugging && d.stop.stop_id > since) return d.stop; await sleep(100); } return null; };
    let stop = await waitStop(0);
    if (!stop) throw new Error('no stop');
    for (let k = 0; k < 60; k++) { // @math number of stops sampled
      const dx = stop.registers.edx & 0xffff, index = (dx << 16) >> 16; // @math the routine uses dx as a signed word
      const record = Buffer.from(await readMemory(b2 + 0x13938 + index * 12, 12)), words = [];
      for (let i = 0; i < 12; i += 2) words.push(record.readInt16LE(i)); // @math the record's six words
      const id = words[0], entry = Buffer.from(await readMemory(b2 + 0x12998 + Math.max(id, 0) * 0x28, 0x28)), catalogue = [];
      for (let i = 0; i < 0x24; i += 2) catalogue.push(entry.readInt16LE(i)); // @math the catalogue words before the pointer
      catalogue.push(entry.readUInt32LE(0x24)); // @math the pointer dword
      samples.push([stop.linear_eip - b1, stop.registers.ecx | 0, stop.registers.eax >>> 0, index, words, catalogue]);
      await fetch(`${api}/continue`, { method: 'POST' });
      stop = await waitStop(stop.stop_id);
      if (!stop) break;
    }
    return { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])), recordTableOffset: 0x13938, recordBytes: 12, catalogueOffset: 0x12998, catalogueBytes: 0x28, carsBufferPointer: bufferPointer, carsRecordTable: 0x13c08, columns: ['eip', 'ecx', 'eax', 'index', 'recordWords', 'catalogueWords'], samples };
  },
  async race() {
    const found = locateObjects(le, exeBytes, window, wStart), b2 = found.bases[1];
    const at = off => b2 + off, mem = readMemory;
    const u32 = async a => Buffer.from(await mem(a, 4)).readUInt32LE(0), i32 = async a => Buffer.from(await mem(a, 4)).readInt32LE(0), u16 = async a => Buffer.from(await mem(a, 2)).readUInt16LE(0), i16 = async a => Buffer.from(await mem(a, 2)).readInt16LE(0);
    const cstr = async a => { const b = await mem(a, 40); const z = b.indexOf(0); return Buffer.from(b.subarray(0, z < 0 ? b.length : z)).toString('latin1'); };
    const crcOf = async (a, n) => hex8(crc32(await mem(a, n)));
    const out = { ...header, bases: Object.fromEntries(found.bases.map((b, i) => [i + 1, b])) };
    out.names = { track: await cstr(at(0x1d770)), paletteSource: await cstr(at(0x1d784)), tilesets: [await cstr(at(0x1eabc)), await cstr(at(0x1eaca))], masks: [await cstr(at(0x1eaa0)), await cstr(at(0x1eaae))], sky: await cstr(at(0xa4e0)) };
    // WACKY.DAT directory table, and what follows it.
    const dat = await vfs.open('WACKY.DAT'), count = Buffer.from(dat.buffer, dat.byteOffset, 2).readInt16LE(0);
    out.dat = { tableObject: 2, tableOffset: 0x5080, entries: count, tableCrc: await crcOf(at(0x5080), count * 22), trailingZeroBytes: (await mem(at(0x5080) + count * 22, 22)).every(v => v === 0) ? 22 : 0 };
    // Tile buffer (tilesets then masks) and the per-cell pointer table.
    const tilePtr = await u32(at(0x1d75c)), tileBytes = await u32(at(0x1d604));
    out.tiles = { pointer: tilePtr, bytes: tileBytes, crc: await crcOf(tilePtr, tileBytes) };
    const cellsPtr = await u32(at(0x1d6a4)), stride = await u32(at(0x1d648));
    const table = await mem(cellsPtr, 0x80 * 0x80 * 4), cells = [], padding = new Set();
    for (let r = 0; r < 0x80; r++) for (let c = 0; c < 0x80; c++) {
      const v = Buffer.from(table.buffer, table.byteOffset + (r * 0x80 + c) * 4, 4).readUInt32LE(0);
      if (r >= 0x20 && r < 0x60 && c >= 0x20 && c < 0x60) cells.push(v); else padding.add(v);
    }
    out.cells = { tablePointer: cellsPtr, rowCells: stride, mapRow: 0x20, mapColumn: 0x20, mapCrc: hex8(crc32(Buffer.from(Uint32Array.from(cells).buffer))), paddingCells: 0x80 * 0x80 - cells.length, paddingValues: [...padding] };
    // POS grid, trailer and its quarter.
    const gridPtr = await u32(at(0x1d5fc));
    out.pos = { gridPointer: gridPtr, gridCrc: await crcOf(gridPtr, 0x2000), trailer: await i16(at(0x28ba2)), quarter: await i16(at(0x28ba0)) };
    out.sin = { tableObject: 2, tableOffset: 0x1ad88, tableCrc: await crcOf(at(0x1ad88), 0x360) };
    const rdCount = await i16(at(0x28b7a)), words = [];
    for (let i = 0; i <= rdCount; i++) words.push(await u16(at(0x12350) + i * 8 + 6));
    out.rd = { countWord: rdCount, lastRecordCrc: await crcOf(at(0x1ee0c), 14), routeWord6Crc: hex8(crc32(Buffer.from(Uint16Array.from(words).buffer))), firstBiased: [await u16(at(0x28c04)), await u16(at(0x28c06))] };
    out.gam = { extraWords: [await u16(at(0x28b5a)), await u16(at(0x28b4e)), await u16(at(0x28b4c))], start0: [await u16(at(0x1d7cc)), await u16(at(0x1d7e0))] };
    const skyPtr = await u32(at(0xa978 + 4)), palPtr = await u32(at(0x1d718));
    const skyMember = parseDatDirectory(dat).find(e => e.name === out.names.sky.toUpperCase());
    if (!skyMember) throw new Error(`sky ${out.names.sky} is not in the archive`);
    const skyBytes = skyMember.size - 0x380; // the member without header and palette
    out.pcx = { skySlot: 1, skyPointer: skyPtr, skyStreamBytes: skyBytes, skyStreamCrc: await crcOf(skyPtr, skyBytes), afterStream: { bytes: 16, zero: (await mem(skyPtr + skyBytes, 16)).every(v => v === 0) }, paletteBuffer: palPtr, paletteCrc: await crcOf(palPtr, 0x300) };
    // Route table (stride 8: start pointer, point count, compass) and the point array it indexes.
    const entries = rdCount + 1, routeBytes = Buffer.from(await mem(at(0x12350), entries * 8)), pointers = [], pointCounts = [];
    for (let i = 0; i < entries; i++) { pointers.push(routeBytes.readUInt32LE(i * 8)); pointCounts.push(routeBytes.readUInt16LE(i * 8 + 4)); }
    const cursor = await u32(at(0x1ed10)), contiguous = pointers.every((p, i) => i + 1 === entries ? p + pointCounts[i] * 4 === cursor : p + pointCounts[i] * 4 === pointers[i + 1]);
    out.route = { tableObject: 2, tableOffset: 0x12350, entryBytes: 8, countOffset: 4, compassOffset: 6, pointBytes: 4, entries, contiguous, firstPointer: pointers[0], cursor, countsCrc: hex8(crc32(Buffer.from(Uint16Array.from(pointCounts).buffer))), pointsCrc: await crcOf(pointers[0], cursor - pointers[0]) };
    const members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data]));
    // Startup data tables.
    const xy = members.get('MAP.XY'), sdxFile = members.get('WACKY.SDX'), movFile = members.get('GIG.MOV');
    const sdxCount = Buffer.from(sdxFile.buffer, sdxFile.byteOffset, 2).readUInt16LE(0), sdxLive = Buffer.from(await mem(at(0x141f8), sdxCount * 0x12e));
    const sdxHeads = [], sdxTailCrcs = [];
    for (let i = 0; i < sdxCount; i++) {
      sdxHeads.push(sdxLive.subarray(i * 0x12e, i * 0x12e + 0x126));
      sdxTailCrcs.push(hex8(crc32(sdxLive.subarray(i * 0x12e + 0x126, (i + 1) * 0x12e)))); // the game writes some tails at run time: one CRC per record, no selection
    }
    const movCount = Buffer.from(movFile.buffer, movFile.byteOffset, 2).readUInt16LE(0);
    const viaPointer = async (offset, bytes) => ({ pointerOffset: offset, bytes, crc: await crcOf(await u32(at(offset)), bytes) });
    out.tables = {
      mapXy: { firstOffset: 0x202cc, secondOffset: 0x1faca, halfBytes: 0x800, firstCrc: await crcOf(at(0x202cc), 0x800), secondCrc: await crcOf(at(0x1faca), 0x800) },
      sdx: { countOffset: 0x28b7c, countWord: await i16(at(0x28b7c)), tableOffset: 0x141f8, recordBytes: 0x12e, tailFrom: 0x126, headCrc: hex8(crc32(Buffer.concat(sdxHeads))), tailCrcs: sdxTailCrcs },
      trig: await viaPointer(0x1d6a0, 0x3c00), ndist: await viaPointer(0x1d660, 0x15e00), cars: await viaPointer(0x1d708, 0x18f00),
      mov: { countOffset: 0x28b80, countWord: await i16(at(0x28b80)), tableOffset: 0x1b548, entryBytes: 4, extraBytes: 4, crc: await crcOf(at(0x1b548), movCount * 4 + 4) },
    };
    // Sprite catalogue and the sprites the loader read for this track.
    const atrFile = members.get('SPRITE.ATR'), atrCount = Buffer.from(atrFile.buffer, atrFile.byteOffset, 2).readInt16LE(0);
    const atrLive = Buffer.from(await mem(at(0x12998), atrCount * 40));
    const atrHeads = [], atrPointers = [];
    for (let i = 0; i < atrCount; i++) {
      atrHeads.push(atrLive.subarray(i * 40, i * 40 + 0x24));
      atrPointers.push(atrLive.readUInt32LE(i * 40 + 0x24)); // the dword the sprite loader writes: raw, for every record
    }
    const spStart = await u32(at(0x1eb20)), spCursor = await u32(at(0x1eb4c));
    out.sprites = {
      atr: { countOffset: 0x28b82, countWord: await i16(at(0x28b82)), tableOffset: 0x12998, pointerAt: 0x24, headCrc: hex8(crc32(Buffer.concat(atrHeads))), pointers: atrPointers },
      sp: { startOffset: 0x1eb20, cursorOffset: 0x1eb4c, trackedOffset: 0x1eda4, trackedType: 2, typeAt: 0, start: spStart, cursor: spCursor, tracked: await i32(at(0x1eda4)), pixelsCrc: await crcOf(spStart, spCursor - spStart) },
    };
    // SPW object table and the PAR buffer.
    const spwFile = members.get(`${out.names.track}.SPW`);
    const spwCount = Buffer.from(spwFile.buffer, spwFile.byteOffset, 2).readUInt16LE(0), live = Buffer.from(await mem(at(0x13938), spwCount * 12)), fileRec = i => Buffer.from(spwFile.buffer, spwFile.byteOffset + 2 + i * 12, 12);
    const stable = [], word2 = [], word10 = [];
    for (let i = 0; i < spwCount; i++) {
      for (const off of [0, 4, 6, 8]) stable.push(live.subarray(i * 12 + off, i * 12 + off + 2)); // the words the loader copies or biases
      word2.push(live.readUInt16LE(i * 12 + 2)); word10.push(live.readUInt16LE(i * 12 + 10)); // the words the game writes at run time: raw, for every record
    }
    out.spw = { countWord: await i16(at(0x28b8e)), tableObject: 2, tableOffset: 0x13938, stableWordsCrc: hex8(crc32(Buffer.concat(stable))), word2, word10 };
    const parPtr = await u32(at(0xa980));
    out.par = { slot: 2, bufferPointer: parPtr, bytes: 0x6400, crc: await crcOf(parPtr, 0x6400), pointerObject: 2, pointerOffset: 0x1eb54, pointerValue: await u32(at(0x1eb54)) };
    // The configuration file is read in three pieces (the reader near obj1+0x25f1b). The record names the file the game was
    // started with and holds the live CRC-32 of every 16-byte block of the three destinations; the check compares them with the file.
    const cfgFile = await readFile(resolve(values.cfg)), cfgParts = [[0x1ee1c, 0x492], [0x1b6d8, 0x18], [0x17128, 0x630]], cfgBlock = 16, cfgLive = [];
    for (const [offset, bytes] of cfgParts) {
      const live = Buffer.from(await mem(at(offset), bytes)), blockCrcs = [];
      for (let i = 0; i < bytes; i += cfgBlock) blockCrcs.push(hex8(crc32(live.subarray(i, Math.min(i + cfgBlock, bytes)))));
      cfgLive.push({ object: 2, offset, bytes, blockCrcs });
    }
    out.cfg = { file: { size: cfgFile.length, sha1: sha1(cfgFile) }, block: cfgBlock, parts: cfgLive };
    return out;
  },
};
if (!scenarios[scenario]) { console.error(`unknown scenario ${scenario}; known: ${Object.keys(scenarios).join(', ')}`); process.exit(1); }
const record = await scenarios[scenario]();
await mkdir(resolve('src/evidence/obs'), { recursive: true });
await writeFile(resolve(`src/evidence/obs/${record.id}.json`), JSON.stringify(record, null, 1) + '\n');
console.log(`observe: wrote src/evidence/obs/${record.id}.json (${Object.keys(record).join(', ')})`);
