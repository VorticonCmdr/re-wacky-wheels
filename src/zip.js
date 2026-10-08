// Zip archives for the asset garage's artwork packs (Stage 4: docs/artpacks.md): the pack templates it exports and the packs it imports. Page
// code (src/enhance never reads files): the writer stores every file as it is (no compression: the pack's PNGs are compressed already), the
// reader takes stored and deflated files (the platform's DecompressionStream('deflate-raw')), which is what the zip tools of the systems write.
// The sizes and checksums are read from the central directory, since a zip written as a stream (the macOS Finder's, bit 3 of the flags) leaves
// them zero in the local headers. Zip64 archives, encrypted files and other compression methods are refused with the reason.
import { crc32 } from './evidence/crc32.js';

const SIG = { local: 0x04034b50, central: 0x02014b50, end: 0x06054b50 };
const METHOD = { stored: 0, deflated: 8 };
const UTF8 = 0x800; // the flag bit of names in UTF-8

// The DOS time and date words of a Date (two-second steps, from 1980).
function dosTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((Math.max(date.getFullYear(), 1980) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

// A zip of `files` ([{ name, data }], the names with '/' between folders), each stored. `date` stamps them all (by default now).
export function writeZip(files, { date = new Date() } = {}) {
  const encoder = new TextEncoder(), { time, day } = dosTime(date), locals = [], centrals = [];
  let offset = 0;
  for (const f of files) {
    const name = encoder.encode(f.name), data = f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data), crc = crc32(data);
    const local = new Uint8Array(30 + name.length), lv = new DataView(local.buffer);
    lv.setUint32(0, SIG.local, true); lv.setUint16(4, 20, true); lv.setUint16(6, UTF8, true); lv.setUint16(8, METHOD.stored, true); lv.setUint16(10, time, true); lv.setUint16(12, day, true);
    lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true); lv.setUint16(26, name.length, true); lv.setUint16(28, 0, true); local.set(name, 30);
    const central = new Uint8Array(46 + name.length), cv = new DataView(central.buffer);
    cv.setUint32(0, SIG.central, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, UTF8, true); cv.setUint16(10, METHOD.stored, true); cv.setUint16(12, time, true); cv.setUint16(14, day, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true); central.set(name, 46);
    locals.push(local, data); centrals.push(central);
    offset += local.length + data.length;
  }
  const centralSize = centrals.reduce((n, c) => n + c.length, 0), end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, SIG.end, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + centralSize + end.length);
  let at = 0;
  for (const part of [...locals, ...centrals, end]) { out.set(part, at); at += part.length; }
  return out;
}

// A deflated file's bytes, at most `limit` of them (null when the data inflates past it): the stream is read piece by piece and given up there,
// so a file whose few kilobytes inflate to gigabytes never fills the memory.
async function inflateRaw(bytes, limit) {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(), parts = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.length;
    if (n > limit) { await reader.cancel().catch(() => {}); return null; }
    parts.push(value);
  }
  const out = new Uint8Array(n);
  parts.reduce((o, p) => { out.set(p, o); return o + p.length; }, 0);
  return out;
}

// The files of a zip: [{ name, data }] in the central directory's order, folders left out. Throws with the reason for what it cannot read.
// `maxBytes` is the largest file it reads: a file whose directory says more is refused before it is read, and a deflated file is inflated no
// further than its directory's size.
export async function readZip(input, { maxBytes = Infinity } = {}) {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input), v = new DataView(b.buffer, b.byteOffset, b.byteLength), decoder = new TextDecoder();
  let end = -1;
  for (let at = b.length - 22; at >= Math.max(0, b.length - 22 - 0xffff); at--) if (v.getUint32(at, true) === SIG.end) { end = at; break; } // the end record, before a comment of up to 64 KB
  if (end < 0) throw new Error('not a zip archive (no end record)');
  const count = v.getUint16(end + 10, true), centralAt = v.getUint32(end + 16, true);
  if (count === 0xffff || centralAt === 0xffffffff) throw new Error('a zip64 archive: save the pack as an ordinary zip');
  const files = [];
  for (let k = 0, at = centralAt; k < count; k++) {
    if (at + 46 > b.length || v.getUint32(at, true) !== SIG.central) throw new Error('the zip\'s central directory is damaged');
    const flags = v.getUint16(at + 8, true), method = v.getUint16(at + 10, true), crc = v.getUint32(at + 16, true), packed = v.getUint32(at + 20, true), size = v.getUint32(at + 24, true);
    const nameLength = v.getUint16(at + 28, true), extra = v.getUint16(at + 30, true), comment = v.getUint16(at + 32, true), local = v.getUint32(at + 42, true);
    const name = decoder.decode(b.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + extra + comment;
    if (name.endsWith('/')) continue; // a folder
    if (flags & 1) throw new Error(`${name} is encrypted`);
    if (local + 30 > b.length || v.getUint32(local, true) !== SIG.local) throw new Error(`the zip's local header of ${name} is damaged`);
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    if (start + packed > b.length) throw new Error(`${name} runs past the end of the zip`);
    if (size > maxBytes) throw new Error(`${name} is ${size} bytes: a pack's file is at most ${maxBytes} bytes`);
    const raw = b.subarray(start, start + packed);
    let data;
    if (method === METHOD.stored) data = raw.slice();
    else if (method === METHOD.deflated) { data = await inflateRaw(raw, size); if (!data) throw new Error(`${name} inflates to more than the ${size} bytes its directory says`); }
    else throw new Error(`${name} is compressed by method ${method}: save the pack stored or deflated`);
    if (data.length !== size) throw new Error(`${name} is ${data.length} bytes, its directory says ${size}`);
    if (crc32(data) !== crc) throw new Error(`${name} is damaged (its CRC)`);
    files.push({ name, data });
  }
  return files;
}
