import { bytes, view, need, ascii } from './binary.js';

export function parseDat(data, source = 'WACKY.DAT') {
  const b = bytes(data), v = view(b);
  need(b, 0, 2, 'DAT');
  const count = v.getUint16(0, true);
  if (!count) throw new Error('DAT contains no entries');
  need(b, 2, count * 22, 'DAT directory');
  const entries = [], names = new Set();
  for (let i = 0; i < count; i++) {
    const p = 2 + i * 22, nameBytes = b.subarray(p, p + 14);
    if (nameBytes.some(c => c && (c < 32 || c > 126))) throw new Error('DAT filename is not ASCII');
    const name = ascii(nameBytes).toLowerCase(), size = v.getUint32(p + 14, true), offset = v.getUint32(p + 18, true) + 2;
    if (!name || /[\\/]/.test(name) || names.has(name)) throw new Error('Invalid or duplicate DAT filename');
    names.add(name);
    need(b, offset, size, `DAT entry ${name}`);
    if (size && offset < 2 + count * 22) throw new Error(`DAT entry ${name} overlaps the directory`);
    entries.push({ id: `${source}/${i}/${name}`, name, data: b.subarray(offset, offset + size), source, offset, size });
  }
  return entries;
}

export function parseAudioT(header, archive) {
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
