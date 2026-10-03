// Test inputs for experiments in the running game: a copy of the user's archive with one member
// replaced, built identically by tools/dosbox/make-test-archive.mjs (which writes it to the run copy)
// and by the checks (which rebuild it from the user's own archive and compare hashes). Only the
// proven layouts are used: the directory entry's size and offset fields (dat.layout) and the CRLF
// line separator (gam.layout). The new member is appended; everything else stays byte for byte.
import { parseDatDirectory } from '../formats/dat.js';
import { expected } from './expect.js';
import { view } from '../binary.js';

export function replaceMember(dat, name, data) {
  const L = expected('dat.layout'), entry = parseDatDirectory(dat).find(e => e.name === name);
  if (!entry) throw new Error(`the archive has no ${name}`);
  const out = new Uint8Array(dat.length + data.length), dv = view(out);
  out.set(dat);
  dv.setUint32(entry.entryAt + L.sizeAt, data.length, true);
  dv.setUint32(entry.entryAt + L.offsetAt, dat.length - L.offsetBias, true);
  out.set(data, dat.length);
  return out;
}

// `edits`: [[zero-based line index, new text], ...]. Lines are separated by the GAM's CRLF; text is written as Latin-1.
export function editLines(bytes, edits) {
  const sep = expected('gam.layout').separator, lines = Buffer.from(bytes).toString('latin1').split(sep);
  for (const [index, text] of edits) {
    if (!Number.isInteger(index) || index < 0 || index >= lines.length) throw new Error(`line ${index} does not exist`);
    lines[index] = text;
  }
  return Uint8Array.from(Buffer.from(lines.join(sep), 'latin1'));
}
