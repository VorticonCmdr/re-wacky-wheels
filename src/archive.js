import { bytes, view, need, ascii } from './binary.js';
import { parseDatDirectory, directoryEnd } from './formats/dat.js';
import { parseAudioBank } from './formats/audio-bank.js';

// The viewer's and editor's archive reader: the directory itself is read by the traced parser
// (src/formats/dat.js, claims dat.*), then the checks a tool wants on top of it: printable ASCII
// names, no duplicates, no path separators, and no payload inside the directory. Names are lower-cased.
export function parseDat(data, source = 'WACKY.DAT') {
  const entries = [], names = new Set();
  for (const [i, e] of parseDatDirectory(data).entries()) {
    const field = bytes(data).subarray(e.entryAt, e.entryAt + e.name.length);
    if (field.some(c => c < 32 || c > 126)) throw new Error('DAT filename is not ASCII');
    const name = e.name.toLowerCase();
    if (/[\\/]/.test(name) || names.has(name)) throw new Error('Invalid or duplicate DAT filename');
    names.add(name);
    if (e.size && e.offset < directoryEnd(data)) throw new Error(`DAT entry ${name} overlaps the directory`);
    entries.push({ id: `${source}/${i}/${name}`, name, data: e.data, source, offset: e.offset, size: e.size });
  }
  if (!entries.length) throw new Error('DAT contains no entries');
  return entries;
}

// The sound bank: the traced strict parser (src/formats/audio-bank.js, claims audio.*) reads the bank the game
// ships; a bank with another shape (a mod, a test fixture) falls back to the lenient reader below, which keeps
// whatever its offsets describe. Both give the same entries for the shipped bank.
export function parseAudioT(header, archive) {
  let bank;
  try { bank = parseAudioBank(header, archive); } catch { return parseAudioTLenient(header, archive); }
  const body = bytes(archive), firstCount = bank.slots.filter(s => s.bank === 'first').length;
  return bank.slots.map(s => {
    const kind = s.bank === 'first' ? 'pcs' : 'adl', index = s.bank === 'first' ? s.index : s.index - firstCount;
    return { id: `audiot.fx/${s.index}`, name: `${kind}-${String(index).padStart(2, '0')}.${kind}`, data: body.subarray(s.start, s.start + s.size), size: s.size, source: 'audiot.fx', offset: s.start, slot: s.index, bankIndex: index };
  });
}

function parseAudioTLenient(header, archive) {
  const h = bytes(header), b = bytes(archive), v = view(h);
  if (h.length < 8 || h.length % 4) throw new Error('Invalid AUDIOHED offset table');
  const slots = h.length / 4 - 1;
  if (slots % 3) throw new Error('Cannot determine PC/AdLib bank boundaries for this AUDIOHED');
  const bankSize = slots / 3, entries = [];
  for (let i = 0; i < slots; i++) {
    const start = v.getUint32(i * 4, true), end = v.getUint32((i + 1) * 4, true);
    // Muse tags can be represented by out-of-order sentinel offsets.
    if (end < start) continue;
    need(b, start, end - start, 'AudioT chunk');
    if (end === start) continue;
    const data = b.subarray(start, end);
    const kind = i < bankSize ? 'pcs' : i < bankSize * 2 ? 'adl' : 'tag';
    if (kind !== 'tag') {
      need(data, 0, kind === 'pcs' ? 7 : 24, 'AudioT sound');
      need(data, kind === 'pcs' ? 6 : 23, view(data).getUint32(0, true), 'AudioT sound payload');
    }
    entries.push({ id: `audiot.fx/${i}`, name: `${kind === 'tag' ? 'tag' : kind + '-' + String(i % bankSize).padStart(2, '0')}.${kind}`, data, size: data.length, source: 'audiot.fx', offset: start, slot: i, bankIndex: i % bankSize });
  }
  return entries;
}
