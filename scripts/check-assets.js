import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { parseDat, parseAudioT } from '../src/archive.js';
import { decodePcx } from '../src/pcx.js';
import { parseAtr, rawFrame } from '../src/sprites.js';
import { parseGam, composeTrack } from '../src/tracks.js';
import { decodeVoc, decodePcSpeaker, parseKlm, parseMidi } from '../src/audio.js';
import { inspectData, b800Cells } from '../src/data-formats.js';
import { renderOpl, renderMidi } from '../src/synthesis.js';

async function find(dir) {
  const files = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const file of files) {
    if (file.name.toLowerCase() === 'wacky.dat' && file.isFile()) return resolve(dir, file.name);
    if (file.isDirectory()) { const found = await find(resolve(dir, file.name)); if (found) return found; }
  }
}
const path = process.argv[2] ?? await find(resolve('game'));
if (!path) { console.error('No WACKY.DAT under game/. Pass a path: npm run check:assets -- /path/to/WACKY.DAT'); process.exit(1); }
const entries = parseDat(await readFile(path)), byName = new Map(entries.map(e => [e.name, e])), failures = [], counts = {};
const get = n => { const e = byName.get(n); if (!e) throw new Error('Missing ' + n); return e.data; };
const catalog = parseAtr(get('sprite.atr'));
for (const entry of entries) {
  const ext = entry.name.split('.').at(-1);
  try {
    if (ext === 'pcx') decodePcx(entry.data);
    else if (ext === 'voc') { const a = decodeVoc(entry.data); assert.ok(a.samples.length); assert.ok(a.samples.every(Number.isFinite)); }
    else if (ext === 'klm') parseKlm(entry.data);
    else if (ext === 'mid') parseMidi(entry.data);
    else if (ext === 'bin') b800Cells(entry.data);
    else if (ext === 'par') assert.equal(entry.size, 640 * 40);
    else if (ext === 'm') {
      const gam = parseGam(get(entry.name.replace(/\.m$/, '.gam')));
      const map = composeTrack(entry.data, decodePcx(get(gam.tiles[0])), decodePcx(get(gam.tiles[1]))); assert.equal(map.indices.length, 2048 * 2048);
    } else if (ext === 'sp') {
      const s = catalog.find(s => s.name === entry.name);
      if (s) { assert.equal(entry.size, s.width * s.height * s.frames); rawFrame(entry.data, s.width, s.height, s.frames - 1); }
    } else inspectData(entry.name, entry.data);
    counts[ext] = (counts[ext] ?? 0) + 1;
  } catch (e) { failures.push(`${entry.name}: ${e.message}`); }
}
const chunks = parseAudioT(get('audiohed.fx'), get('audiot.fx'));
for (const entry of chunks) {
  try { const a = entry.name.endsWith('.pcs') ? decodePcSpeaker(entry.data) : renderOpl(entry.data, 'adl', 5); assert.ok(a.samples.every(Number.isFinite)); }
  catch (e) { failures.push(`${entry.name}: ${e.message}`); }
}
for (const entry of entries.filter(e => /\.(klm|mid)$/.test(e.name))) {
  try { const a = entry.name.endsWith('.mid') ? renderMidi(entry.data, 2) : renderOpl(entry.data, 'klm', 2); assert.ok(a.samples.length && a.samples.some(s => Math.abs(s) > 1e-5), 'silent rendering'); }
  catch (e) { failures.push(`${entry.name}: ${e.message}`); }
}
console.log(`Checked ${entries.length} archive members, ${chunks.length} embedded sounds and music synthesis.`);
console.log('Format counts:', JSON.stringify(counts));
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('All documented decoders passed on the local archive. Unknown layouts are available through raw views.');
