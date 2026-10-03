import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { decodePcxMember } from '../../formats/pcx.js';
import { parseGam } from '../../formats/gam.js';
import { parseMap, parsePos, parseSin, parseRoute, parseSpw } from '../../formats/track-files.js';
import { parseMapXy, parseSdx, parseMov, parseTrig, parseNdist, parseCarsSp } from '../../formats/static-tables.js';
import { rasterSegment } from '../../formats/route.js';
import { parseAtr } from '../../formats/atr.js';
import { view } from '../../binary.js';
import { crc, concat, words16, dwords32, slice, lookupMember, assertArchive } from '../obs-helpers.js';
import { splitTiles } from '../../formats/pcx.js';
import { expected } from '../expect.js';

// The installed WACKY.CFG the game was started with: the record holds its SHA-1, and several installed copies may share a name.
async function findCfg(ctx, record) {
  for (const path of ctx.list().filter(p => /(^|\/)wacky\.cfg$/i.test(p))) {
    const bytes = await ctx.openPath(path);
    if (createHash('sha1').update(bytes).digest('hex') === record.cfg.file.sha1) return bytes;
  }
  throw new Error('no installed WACKY.CFG has the SHA-1 the record names; this is not the observed configuration');
}

// Every claim value this record is checked against, so a discriminator can change one at a time.
function values() {
  return {
    dat: expected('dat.directory-read'), datLayout: expected('dat.layout'), lookup: expected('dat.entry-lookup'), entrySize: expected('dat.entry-size'), rle: expected('pcx.rle-rule'), pcx: expected('pcx.layout'),
    split: expected('pcx.member-split'), scale: expected('pcx.palette-scale'), sheet: expected('tiles.sheet-split'), buffer: expected('tiles.buffer'),
    map: expected('m.read'), mapLayout: expected('m.layout'), pos: expected('pos.read'), posLayout: expected('pos.layout'),
    sin: expected('sin.read'), sinLayout: expected('sin.layout'), rd: expected('rd.read'), rdLayout: expected('rd.layout'), gam: expected('gam.read'),
    atrRead: expected('atr.read'), spRead: expected('sp.read'), atrLayout: expected('atr.layout'), statics: expected('static.read'), staticLayout: expected('static.layout'), route: expected('rd.route'), spw: expected('spw.read'), cfg: expected('cfg.read'), spwLayout: expected('spw.layout'), par: expected('par.read'), fileSet: expected('track.file-set'),
  };
}

function validate(dat, record, V, { masksFirst = false } = {}) {
  assertArchive(record, dat);
  const get = n => lookupMember(dat, n, V);
  const { dat: D, split: PM, scale: PS, sheet: S, buffer: B, map: M, pos: PR, sin: SN, rd: RD, gam: G } = V, r = record;
  const track = r.names.track, tileBase = r.tiles.pointer;

  // Names: the slots hold the .GAM lines, prefixed (gam.read).
  const g = parseGam(get(`${track}.GAM`));
  assert.equal(g.tilesets.length, G.tilesetSlots);
  assert.equal(g.masks.length, G.maskSlots);
  assert.deepEqual(r.names.tilesets, g.tilesets.map(n => G.prefix + n));
  assert.deepEqual(r.names.masks, g.masks.map(n => G.prefix + n));
  assert.equal(r.names.sky, g.sky.toUpperCase());
  assert.equal(r.names.paletteSource, (G.prefix + g.tilesets[0]).toUpperCase());
  assert.deepEqual(r.gam.extraWords, g.extra, 'lines 26 to 28 are stored as words');
  assert.equal(g.extra.length, G.extraLines);
  assert.deepEqual(r.gam.start0, [g.starts[0].x + G.startBias, g.starts[0].y + G.startBias], 'the first coordinate pair is stored with the bias added');

  // Directory table (dat.directory-read).
  const count = view(dat).getInt16(0, true);
  assert.equal(r.dat.entries, count);
  assert.equal(r.dat.tableObject, D.tableObject);
  assert.equal(r.dat.tableOffset, D.tableOffset);
  assert.equal(r.dat.tableCrc, crc(dat.subarray(D.countBytes, D.countBytes + count * D.entrySize)), 'the table is the directory entries after the count');
  assert.equal(r.dat.trailingZeroBytes, D.entrySize, 'the bytes after the table are zero, so the file sentinel is not loaded');
  assert.equal(D.countBytes, V.datLayout.countBytes);
  assert.equal(D.entrySize, V.datLayout.entrySize);

  // Tile buffer (tiles.buffer, tiles.sheet-split, pcx.rle-rule).
  const sheets = [...r.names.tilesets, ...r.names.masks].map(n => decodePcxMember(get(n)));
  assert.equal(S.size * S.size, B.tileBytes);
  assert.equal(B.totalBytes / B.sheetDivisor, S.count * B.tileBytes, 'a quarter of the buffer is one sheet of tiles');
  assert.equal(B.totalBytes / B.maskDivisor, B.sheets * S.count * B.tileBytes, 'the first half holds the tiles of every sheet');
  assert.equal(B.sheets, G.tilesetSlots);
  assert.equal(r.tiles.bytes, B.totalBytes);
  const parts = sheets.map(i => slice(i, S)), ordered = masksFirst ? [...parts.slice(B.sheets), ...parts.slice(0, B.sheets)] : parts;
  assert.equal(r.tiles.crc, crc(concat(ordered)), 'the live tile buffer is the split tilesets then the split masks');
  // The product splitTiles (claim values) agrees with the local slicing for the first sheet.
  assert.deepEqual(splitTiles(sheets[0]).map(t => Array.from(t)), Array.from({ length: S.count }, (_, t) => Array.from(slice(sheets[0], S).subarray(t * B.tileBytes, (t + 1) * B.tileBytes))));
  for (const key of ['runMask', 'countMask', 'width', 'height']) assert.equal(V.rle[key], V.pcx[key]);

  // Per-cell pointer table (m.read).
  const map = parseMap(get(`${track}.M`));
  assert.equal(map.rows, M.rows);
  assert.equal(map.columns, M.columns);
  assert.equal(M.tileBytes, B.tileBytes);
  assert.equal(r.cells.rowCells, M.tableCells);
  assert.equal(r.cells.mapRow, M.mapOrigin);
  assert.equal(r.cells.mapColumn, M.mapOrigin);
  assert.equal(r.cells.paddingCells, M.tableCells * M.tableCells - M.rows * M.columns);
  assert.deepEqual(r.cells.paddingValues, [tileBase], 'every padding cell points at tile 0');
  assert.equal(r.cells.mapCrc, crc(dwords32(Array.from(map.tiles, id => tileBase + id * M.tileBytes))), 'every map cell is tileBase + id * tile bytes');

  // POS (pos.read).
  const posFile = get(`${track}.POS`), pos = parsePos(posFile);
  assert.equal(PR.gridBytes, V.posLayout.gridBytes);
  assert.equal(PR.trailerBytes, V.posLayout.trailerBytes);
  assert.equal(r.pos.gridCrc, crc(posFile.subarray(0, PR.gridBytes)), 'the grid is read as it is in the file');
  assert.equal(r.pos.trailer, pos.trailer);
  assert.equal(r.pos.quarter, Math.trunc(pos.trailer / PR.trailerDivisor));

  // SIN (sin.read).
  const sinFile = get(`${track}.SIN`), recs = parseSin(sinFile), recordBytes = V.sinLayout.recordBytes;
  assert.equal(SN.skipped, V.sinLayout.skipped);
  assert.equal(SN.skipped + SN.kept, recordBytes);
  assert.equal(SN.tableBytes, recs.length * SN.kept);
  assert.equal(r.sin.tableObject, D.tableObject, 'the table is in the same object as the directory table');
  assert.equal(r.sin.tableCrc, crc(concat(recs.map((_, i) => sinFile.subarray(i * recordBytes + SN.skipped, (i + 1) * recordBytes)))), 'only the last bytes of each record are stored');

  // RD (rd.read).
  const rdFile = get(`${track}.RD`), route = parseRoute(rdFile), wb = V.rdLayout.wordBytes, last = route.at(-1);
  assert.equal(RD.countBytes, V.rdLayout.countBytes);
  assert.equal(RD.recordBytes, V.rdLayout.recordBytes);
  assert.equal(r.rd.countWord, route.length - 1, 'the loader decrements the count');
  assert.equal(r.rd.lastRecordCrc, crc(words16(Array.from(last))), 'the record buffer holds the last record');
  assert.equal(r.rd.routeWord6Crc, crc(words16(route.map(rec => rec[RD.tableWord / wb]))), 'the route table holds the file word at the table offset');
  assert.deepEqual(r.rd.firstBiased, RD.words.map(o => (route[0][o / wb] + RD.coordBias) % 0x10000), 'the first record\'s coordinates are stored with the bias added'); // @math 16-bit word wrap

  // SPW (spw.read): cleared, biased and copied words in the first 10 bytes of every record, the runtime word apart.
  const { spw: SP, spwLayout: SL } = V, spwRecs = parseSpw(get(`${track}.SPW`)), swb = SL.wordBytes;
  assert.deepEqual([SP.clearedWord, ...SP.biasedWords, ...SP.copiedWords, SP.runtimeWord].sort((x, y) => x - y), Array.from({ length: SL.words }, (_, i) => i * swb), 'the offsets spw.read names are exactly the record\'s words');
  assert.equal(r.spw.tableObject, SP.tableObject);
  assert.equal(r.spw.tableOffset, SP.tableOffset);
  assert.equal(r.spw.countWord, spwRecs.length);
  const stableOffsets = [...SP.copiedWords, ...SP.biasedWords].sort((x, y) => x - y);
  const stored = rec => stableOffsets.map(off => (SP.biasedWords.includes(off) ? rec[off / swb] + SP.coordBias : rec[off / swb]) % 0x10000); // @math 16-bit word wrap
  assert.equal(r.spw.stableWordsCrc, crc(words16(spwRecs.flatMap(stored))), 'the copied and biased words match in every record');
  // The words the game writes at run time (+2 and +0x0a) are recorded raw for every record. The file holds 0 in both, in every record,
  // so a non-zero live word is a write made after loading; the check finds which records those are, the record does not say.
  const words = [SP.clearedWord, SP.runtimeWord];
  spwRecs.forEach((rec, i) => words.forEach(off => assert.equal(rec[off / swb], 0, `the file's word at +${off} of record ${i} is 0`)));
  [r.spw.word2, r.spw.word10].forEach(list => {
    assert.equal(list.length, spwRecs.length, 'one live word per record');
    assert.ok(list.every(v => Number.isInteger(v) && v >= 0 && v <= 0xffff), 'live words are 16-bit values'); // @math uint16 range
  });
  const rewritten = spwRecs.map((_, i) => i).filter(i => r.spw.word2[i] !== 0 || r.spw.word10[i] !== 0);
  assert.ok(rewritten.length > 0, 'the game writes these words in some records after loading');

  // Sprite catalogue and loaded sprites (atr.read, sp.read).
  const { atrRead: AR, spRead: SPR, atrLayout: AL } = V, atr = parseAtr(get('SPRITE.ATR')), SA = r.sprites.atr, SS = r.sprites.sp;
  assert.equal(SA.countOffset, AR.countOffset);
  assert.equal(SA.tableOffset, AR.tableOffset);
  assert.equal(SA.pointerAt, AR.pointerAt);
  assert.equal(SA.countWord, atr.length);
  assert.equal(SA.headCrc, crc(concat(atr.map(a => a.raw.subarray(0, AR.pointerAt)))), 'the first bytes of every catalogue record are the file\'s');
  const used = [...new Set(spwRecs.map(rec => rec[0]))].filter(i => i < atr.length).sort((x, y) => x - y);
  // The pointer dword of every catalogue record is recorded raw. Where it differs from the file's the loader wrote it: the check derives
  // which records those are and requires them to be exactly the entries named by the .SPW records, laid out back to back from the start.
  assert.equal(SA.pointers.length, atr.length, 'one pointer per catalogue record');
  const written = atr.map(a => a.id).filter(i => SA.pointers[i] !== view(atr[i].raw).getUint32(AR.pointerAt, true));
  assert.deepEqual(written, used, 'the records the loader wrote are the catalogue entries named by the .SPW records');
  let cursor = SS.start;
  used.forEach(i => { assert.equal(SA.pointers[i], cursor, `sprite ${i} is contiguous with the previous`); cursor += atr[i].bytes; });
  assert.equal(SS.cursor, cursor, 'the cursor ends after the last sprite');
  assert.equal(SS.pixelsCrc, crc(concat(used.map(i => get(atr[i].name)))), 'the loaded buffers are the .SP files in index order');
  assert.equal(SS.startOffset, SPR.startOffset);
  assert.equal(SS.cursorOffset, SPR.cursorOffset);
  assert.equal(SS.trackedOffset, SPR.trackedOffset);
  assert.equal(SS.trackedType, SPR.trackedType);
  assert.equal(SS.typeAt, SPR.typeAt);
  assert.equal(SS.tracked, used.find(i => view(atr[i].raw).getInt16(SPR.typeAt, true) === SPR.trackedType) ?? -1, 'the first loaded entry of the tracked type is remembered');
  assert.equal(AL.recordBytes, atr[0].raw.length);

  // Configuration file (cfg.read): the three pieces the reader loads equal the installed file, block by block, except where the game writes.
  const { cfg: CF, cfgFile } = V;
  assert.equal(r.cfg.file.size, CF.size, 'the record names a file of the size the reader requires');
  assert.equal(cfgFile.length, CF.size, 'the installed file has the size the reader requires');
  assert.equal(r.cfg.block, CF.block);
  assert.deepEqual(r.cfg.parts.map(p => [p.object, p.offset, p.bytes]), CF.parts.map(p => [p.object, p.offset, p.bytes]), 'the three pieces and their destinations');
  assert.equal(CF.parts.reduce((n, p) => n + p.bytes, 0), CF.size, 'the three pieces tile the file');
  let cfgAt = 0;
  const cfgDiffering = [];
  r.cfg.parts.forEach(p => {
    assert.equal(p.blockCrcs.length, Math.ceil(p.bytes / CF.block), 'one live CRC per block');
    p.blockCrcs.forEach((live, k) => { const i = k * CF.block; if (crc(cfgFile.subarray(cfgAt + i, cfgAt + Math.min(i + CF.block, p.bytes))) !== live) cfgDiffering.push(cfgAt + i); });
    cfgAt += p.bytes;
  });
  assert.deepEqual(cfgDiffering, CF.differingAt, 'live memory equals the file except in the blocks the game writes');
  assert.equal(view(cfgFile).getUint16(CF.checkWord.at, true), CF.checkWord.value, 'the installed file holds the value the reader checks for');

  // PAR (par.read).
  const { par: PA, fileSet: FS } = V, parFile = get(`${track}.PAR`);
  assert.equal(PA.bytes, FS.parBytes);
  assert.equal(parFile.length, PA.bytes);
  assert.equal(r.par.slot, PA.slot);
  assert.equal(r.par.bytes, PA.bytes);
  assert.equal(r.par.crc, crc(parFile.subarray(0, PA.bytes)), 'the buffer holds the file unchanged');
  assert.equal(r.par.pointerObject, PA.pointerObject);
  assert.equal(r.par.pointerOffset, PA.pointerOffset);
  assert.equal(r.par.pointerValue, r.par.bufferPointer, 'the stored pointer is the buffer');

  // Startup data tables (static.read).
  const { statics: ST, staticLayout: SLY } = V, T = r.tables, xy = parseMapXy(get('MAP.XY')), sdx = parseSdx(get('WACKY.SDX')), mov = parseMov(get('GIG.MOV'));
  assert.equal(T.mapXy.firstOffset, ST.mapXy.firstOffset);
  assert.equal(T.mapXy.secondOffset, ST.mapXy.secondOffset);
  assert.equal(T.mapXy.halfBytes, ST.mapXy.halfBytes);
  assert.equal(xy.first.length, ST.mapXy.halfBytes);
  assert.equal(T.mapXy.firstCrc, crc(xy.first.subarray(0, ST.mapXy.halfBytes)), 'MAP.XY first half');
  assert.equal(T.mapXy.secondCrc, crc(xy.second.subarray(0, ST.mapXy.halfBytes)), 'MAP.XY second half');
  assert.equal(T.sdx.countOffset, ST.sdx.countOffset);
  assert.equal(T.sdx.tableOffset, ST.sdx.tableOffset);
  assert.equal(T.sdx.recordBytes, ST.sdx.recordBytes);
  assert.equal(T.sdx.tailFrom, ST.sdx.tailFrom);
  assert.equal(T.sdx.countWord, sdx.count - 1, 'the loader decrements the SDX count');
  assert.equal(T.sdx.headCrc, crc(concat(sdx.records.map(rec => rec.subarray(0, ST.sdx.tailFrom)))), 'every SDX record\'s first bytes are the file\'s');
  // One live CRC per record tail; the game rewrites some tails at run time, which the check finds by comparing with the file.
  assert.equal(T.sdx.tailCrcs.length, sdx.count, 'one tail CRC per record');
  const tailsRewritten = sdx.records.map((_, i) => i).filter(i => T.sdx.tailCrcs[i] !== crc(sdx.records[i].subarray(ST.sdx.tailFrom)));
  assert.ok(tailsRewritten.length > 0 && tailsRewritten.length < sdx.count, 'the game rewrites the tails of some records and leaves others');
  for (const [name, spec, parsed] of [['trig', ST.trig, parseTrig(get('TRIG.DAT'))], ['ndist', ST.ndist, parseNdist(get('NDIST'))], ['cars', ST.cars, parseCarsSp(get('CARS.SP'))]]) {
    assert.equal(T[name].pointerOffset, spec.pointerOffset, `${name} pointer offset`);
    assert.equal(T[name].bytes, spec.bytes, `${name} size`);
    assert.equal(T[name].crc, crc(parsed.subarray(0, spec.bytes)), `${name} is read whole`);
  }
  assert.equal(T.mov.countOffset, ST.mov.countOffset);
  assert.equal(T.mov.tableOffset, ST.mov.tableOffset);
  assert.equal(T.mov.entryBytes, ST.mov.entryBytes);
  assert.equal(T.mov.extraBytes, ST.mov.extraBytes);
  assert.equal(T.mov.countWord, mov.count, 'the MOV count is kept as read');
  assert.equal(T.mov.crc, crc(mov.table.subarray(0, mov.count * ST.mov.entryBytes + ST.mov.extraBytes)), 'the MOV entries and the bytes after them');
  assert.equal(ST.mapXy.halfBytes * 2, SLY.mapXyBytes); // @math MAP.XY is read as two halves
  assert.equal(ST.sdx.recordBytes, SLY.sdxRecordBytes);

  // Route table and point array (rd.route).
  const { route: RT } = V, points = route.map(rec => rasterSegment(...RT.coordWords.map(o => (rec[o / wb] + RT.coordBias) % 0x10000))); // @math 16-bit word wrap
  assert.equal(r.route.tableObject, RT.tableObject);
  assert.equal(r.route.tableOffset, RT.tableOffset);
  assert.equal(r.route.entryBytes, RT.entryBytes);
  assert.equal(r.route.countOffset, RT.countOffset);
  assert.equal(r.route.compassOffset, RT.compassOffset);
  assert.equal(r.route.pointBytes, RT.pointBytes);
  assert.equal(r.route.entries, route.length);
  assert.ok(r.route.contiguous, 'each segment\'s points follow the previous one\'s');
  assert.equal(r.route.countsCrc, crc(words16(points.map(p => p.length))), 'the point counts');
  assert.equal(r.route.cursor - r.route.firstPointer, points.reduce((n, p) => n + p.length, 0) * RT.pointBytes, 'the array ends at the cursor');
  assert.equal(r.route.pointsCrc, crc(words16(points.flatMap(p => p.flat()))), 'the live points are the rasterised segments');
  assert.equal(RT.coordBias, RD.coordBias);

  // Stream and palette (pcx.member-split, pcx.palette-scale).
  const sky = get(r.names.sky), skyStream = sky.subarray(PM.header, sky.length - PM.palette);
  assert.equal(PM.headerAndPalette, PM.header + PM.palette);
  assert.equal(r.pcx.skyStreamBytes, sky.length - PM.headerAndPalette);
  assert.equal(r.pcx.skyStreamBytes, skyStream.length);
  assert.equal(r.pcx.skyStreamCrc, crc(skyStream), 'the slot buffer holds the member between header and palette');
  assert.ok(r.pcx.afterStream.zero, 'the live bytes after the stream are zero');
  const after = sky.subarray(sky.length - PM.palette, sky.length - PM.palette + r.pcx.afterStream.bytes);
  assert.ok(after.some(v => v !== 0), 'the file bytes after the stream are not all zero, so a longer read would show');
  const tile0 = get(r.names.paletteSource), palette = tile0.subarray(tile0.length - PM.palette);
  assert.equal(PS.bytes, PM.palette);
  assert.equal(r.pcx.paletteCrc, crc(Uint8Array.from(palette, v => v >> PS.shift)), 'the palette buffer holds the last bytes shifted right');
}

export default {
  id: 'obs-race',
  claims: ['cfg.read', 'dat.directory-read', 'dat.entry-lookup', 'dat.entry-size', 'pcx.rle-rule', 'pcx.member-split', 'pcx.palette-scale', 'tiles.sheet-split', 'tiles.buffer', 'm.read', 'pos.read', 'sin.read', 'rd.read', 'rd.route', 'gam.read', 'spw.read', 'par.read', 'static.read', 'atr.read', 'sp.read'],
  obs: ['race-3'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { const record = ctx.obs('race-3'); validate(await ctx.open('WACKY.DAT'), record, { ...values(), cfgFile: await findCfg(ctx, record) }); },
  // Each parameter changed on its own must make the observation fail.
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), record = ctx.obs('race-3'), V = { ...values(), cfgFile: await findCfg(ctx, ctx.obs('race-3')) }, [cx1, cy1, cx2, cy2] = V.route.coordWords;
    const tweak = (label, key, patch, opts) => ({ label, fn: () => validate(dat, record, { ...V, [key]: { ...V[key], ...patch } }, opts) });
    return [
      tweak(`entry size ${V.dat.entrySize - 1}`, 'dat', { entrySize: V.dat.entrySize - 1 }),
      tweak(`entry size ${V.dat.entrySize + 1}`, 'dat', { entrySize: V.dat.entrySize + 1 }),
      tweak('directory read from the file start', 'dat', { countBytes: 0 }), // @math alternative: no count skipped
      tweak('member data at the stored offset without the bias', 'lookup', { seekBias: 0 }), // @math alternative: offsets from the file start
      tweak(`member data at the stored offset plus ${V.lookup.seekBias + 1}`, 'lookup', { seekBias: V.lookup.seekBias + 1 }),
      tweak('names at entry+1', 'lookup', { nameAt: V.lookup.nameAt + 1 }),
      tweak('member length from another field', 'entrySize', { sizeAt: V.entrySize.sizeAt - V.datLayout.countBytes }),
      { label: 'masks before tilesets', fn: () => validate(dat, record, V, { masksFirst: true }) },
      tweak(`${V.sheet.columns - 1} tiles per row`, 'sheet', { columns: V.sheet.columns - 1 }),
      tweak(`tile size ${V.sheet.size - 1}`, 'sheet', { size: V.sheet.size - 1 }),
      tweak(`palette shift ${V.scale.shift - 1}`, 'scale', { shift: V.scale.shift - 1 }),
      tweak(`palette shift ${V.scale.shift + 1}`, 'scale', { shift: V.scale.shift + 1 }),
      tweak(`header ${V.split.header - 1} bytes`, 'split', { header: V.split.header - 1 }),
      tweak(`header ${V.split.header + 1} bytes`, 'split', { header: V.split.header + 1 }),
      tweak('POS trailer divisor 3', 'pos', { trailerDivisor: V.pos.trailerDivisor - 1 }),
      tweak('POS trailer divisor 8', 'pos', { trailerDivisor: V.pos.trailerDivisor * 2 }), // @math alternative: divide by eight
      tweak('SIN skipping nothing', 'sin', { skipped: 0, kept: V.sin.kept + V.sin.skipped }), // @math alternative: keep whole records
      tweak('SIN keeping the first bytes', 'sin', { skipped: 0 }), // @math alternative: skip nothing, keep the first bytes
      tweak(`route coordinate bias ${V.rd.coordBias - 1}`, 'rd', { coordBias: V.rd.coordBias - 1 }),
      tweak('route table word +8', 'rd', { tableWord: V.rd.tableWord - V.rdLayout.wordBytes }),
      tweak('route words swapped', 'rd', { words: [...V.rd.words].reverse() }),
      tweak(`pointer table origin ${V.map.mapOrigin - 1}`, 'map', { mapOrigin: V.map.mapOrigin - 1 }),
      tweak(`tile bytes ${V.map.tileBytes / 2}`, 'map', { tileBytes: V.map.tileBytes / 2 }), // @math alternative: half-size tiles
      tweak(`start bias ${V.gam.startBias - 1}`, 'gam', { startBias: V.gam.startBias - 1 }),
      tweak('route x2 and y2 swapped', 'route', { coordWords: [cx1, cy1, cy2, cx2] }),
      tweak('route from (x1, x2) to (y1, y2)', 'route', { coordWords: [cx1, cx2, cy1, cy2] }),
      tweak(`route bias ${V.route.coordBias - 1}`, 'route', { coordBias: V.route.coordBias - 1 }),
      tweak('route points of 2 bytes', 'route', { pointBytes: V.route.pointBytes / 2 }), // @math alternative: byte-sized coordinates
      { label: `SDX tail from ${V.statics.sdx.tailFrom + 1}`, fn: () => validate(dat, record, { ...V, statics: { ...V.statics, sdx: { ...V.statics.sdx, tailFrom: V.statics.sdx.tailFrom + 1 } } }) },
      { label: `SDX tail from ${V.statics.sdx.tailFrom - 1}`, fn: () => validate(dat, record, { ...V, statics: { ...V.statics, sdx: { ...V.statics.sdx, tailFrom: V.statics.sdx.tailFrom - 1 } } }) },
      { label: 'MAP.XY halves of 0x7ff', fn: () => validate(dat, record, { ...V, statics: { ...V.statics, mapXy: { ...V.statics.mapXy, halfBytes: V.statics.mapXy.halfBytes - 1 } } }) },
      { label: 'MOV with no trailing bytes', fn: () => validate(dat, record, { ...V, statics: { ...V.statics, mov: { ...V.statics.mov, extraBytes: 0 } } }) }, // @math alternative: no extra bytes
      tweak('sprite tracked type 3', 'spRead', { trackedType: V.spRead.trackedType + 1 }),
      tweak('sprite type word at +2', 'spRead', { typeAt: V.spRead.typeAt + 2 }), // @math the word after the type
      tweak(`sprite pointer at +${V.atrRead.pointerAt - 4}`, 'atrRead', { pointerAt: V.atrRead.pointerAt - 4 }), // @math a dword earlier
      tweak(`SPW coordinate bias ${V.spw.coordBias - 1}`, 'spw', { coordBias: V.spw.coordBias - 1 }),
      tweak('SPW only x biased', 'spw', { biasedWords: [V.spw.biasedWords[0]], copiedWords: [...V.spw.copiedWords, V.spw.biasedWords[1]] }),
      tweak('SPW runtime word is +8', 'spw', { runtimeWord: V.spw.copiedWords[1] }),
      tweak(`PAR ${V.par.bytes - 1} bytes`, 'par', { bytes: V.par.bytes - 1 }),
      tweak('prefix "A-"', 'gam', { prefix: 'A-' }),
      tweak(`config size ${V.cfg.size - 1}`, 'cfg', { size: V.cfg.size - 1 }),
      tweak('config pieces of 0x491, 0x19 and 0x630 bytes', 'cfg', { parts: V.cfg.parts.map((p, i) => ({ ...p, bytes: p.bytes + (i === 0 ? -1 : i === 1 ? 1 : 0) })) }), // @math move one byte between the first two pieces
      tweak('config block 8', 'cfg', { block: V.cfg.block / 2 }), // @math half the block
      tweak('config check word 0xfb', 'cfg', { checkWord: { ...V.cfg.checkWord, value: V.cfg.checkWord.value + 1 } }),
      tweak('config with one more written block', 'cfg', { differingAt: [...V.cfg.differingAt, V.cfg.differingAt.at(-1) + V.cfg.block] }),
      tweak('config with one written block fewer', 'cfg', { differingAt: V.cfg.differingAt.slice(1) }),
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (b, i) => (i === dat.length - 1 ? b ^ 1 : b)), record, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
