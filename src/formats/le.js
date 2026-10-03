// DOS/4G-bound LE executables (WW.EXE). Locates the bound program, assembles each object from its
// pages as pre-fixup bytes (the form citations are made against), and parses fixup records
// separately. Layout constants are external-spec facts (leads) asserted by src/verify/checks/le-*.
import { bytes, view, need } from '../binary.js';
import { K } from '../evidence/k.js';

const MZ = () => K({ magic: 'MZ', lfanew: 0x3c }, 'mz.header');
const LE = () => K({
  magic: 'LE', cpu: 0x08, os: 0x0a, pages: 0x14, eipObject: 0x18, eip: 0x1c,
  espObject: 0x20, esp: 0x24, pageSize: 0x28, lastPageSize: 0x2c, objectTable: 0x40, objectCount: 0x44,
  pageMap: 0x48, fixupPageTable: 0x68, fixupRecordTable: 0x6c, dataPages: 0x80, fixupPageEntry: 0x04,
}, 'le.header');
const OBJ = () => K({ size: 0x18, virtualSize: 0x00, base: 0x04, flags: 0x08, pageIndex: 0x0c, pageCount: 0x10 }, 'le.object-entry');
const PAGE = () => K({ size: 0x04, numberBytes: 0x03 }, 'le.page-map-entry');
const FIX = () => K({
  source: { offset32: 0x07, selector16: 0x02 }, flags: { target16: 0x00, target32: 0x10 },
  at: { flags: 0x01, source: 0x02, object: 0x04 }, header: 0x05, target16: 0x02, target32: 0x04,
}, 'le.fixup-record');

const ascii2 = (b, o) => String.fromCharCode(b[o], b[o + 1]); // @math two-character signature

export function mzLfanew(data, at) {
  const b = bytes(data), mz = MZ();
  need(b, at, mz.lfanew + 4, 'MZ header'); // @math e_lfanew is a uint32
  if (ascii2(b, at) !== mz.magic) throw new Error(`No MZ signature at ${at}`);
  return view(b).getUint32(at + mz.lfanew, true);
}

// Parse the LE program whose MZ header starts at file offset `at` (DOS/4G binds the LE behind its
// own stub, so offsets in the LE header are relative to that inner MZ, not to the file).
export function parseLe(data, at) {
  const b = bytes(data), dv = view(b), le = LE();
  const head = at + mzLfanew(b, at);
  need(b, head, Math.max(le.cpu, le.os, le.pages, le.eipObject, le.eip, le.espObject, le.esp, le.pageSize, le.lastPageSize, le.objectTable, le.objectCount, le.pageMap, le.fixupPageTable, le.fixupRecordTable, le.dataPages) + 4, 'LE header'); // @math every field read is a uint32 at most
  if (ascii2(b, head) !== le.magic) throw new Error(`No LE header at ${head}`);
  const u32 = o => dv.getUint32(head + o, true), u16 = o => dv.getUint16(head + o, true);
  const h = {
    mz: at, header: head, cpu: u16(le.cpu), os: u16(le.os), pages: u32(le.pages),
    eip: { object: u32(le.eipObject), offset: u32(le.eip) }, esp: { object: u32(le.espObject), offset: u32(le.esp) },
    pageSize: u32(le.pageSize), lastPageSize: u32(le.lastPageSize), dataPages: at + u32(le.dataPages),
    fixupPageTable: head + u32(le.fixupPageTable), fixupRecordTable: head + u32(le.fixupRecordTable),
  };
  const ot = OBJ(), pm = PAGE(), count = u32(le.objectCount), table = head + u32(le.objectTable), map = head + u32(le.pageMap);
  need(b, table, count * ot.size, 'LE object table');
  need(b, map, h.pages * pm.size, 'LE page map');
  h.pageMap = Array.from({ length: h.pages }, (_, i) => {
    const o = map + i * pm.size;
    let number = 0;
    for (let k = 0; k < pm.numberBytes; k++) number = number << 8 | b[o + k]; // @math big-endian page number bytes
    return { number, flags: b[o + pm.numberBytes] };
  });
  const pageBytes = (p) => { // logical page number, 1-based
    const length = p === h.pages ? h.lastPageSize : h.pageSize, offset = h.dataPages + (p - 1) * h.pageSize;
    need(b, offset, length, `LE page ${p}`);
    return b.subarray(offset, offset + length);
  };
  h.objects = Array.from({ length: count }, (_, i) => {
    const o = table + i * ot.size, r = k => dv.getUint32(o + k, true);
    const obj = { number: i + 1, virtualSize: r(ot.virtualSize), base: r(ot.base), flags: r(ot.flags), pageIndex: r(ot.pageIndex), pageCount: r(ot.pageCount) };
    if (obj.pageIndex < 1 || obj.pageIndex + obj.pageCount - 1 > h.pages) throw new Error(`LE object ${obj.number} pages are out of range`);
    // Pre-fixup image: the stored pages in order. Bytes past them up to the virtual size are zero
    // (objectBytes supplies them), so a corrupt size cannot force a huge allocation.
    const pages = Array.from({ length: obj.pageCount }, (_, k) => {
      const entry = h.pageMap[obj.pageIndex - 1 + k];
      if (entry.flags !== 0) throw new Error(`LE page ${obj.pageIndex + k} has unsupported flags ${entry.flags}`);
      return pageBytes(entry.number);
    });
    obj.data = new Uint8Array(Math.min(obj.virtualSize, pages.reduce((n, p) => n + p.length, 0)));
    pages.reduce((at, p) => { obj.data.set(p.subarray(0, Math.max(0, obj.data.length - at)), at); return at + p.length; }, 0);
    return obj;
  });
  return h;
}

// Every fixup record, per logical page. Only the encodings WW.EXE is shown to use are accepted
// (internal reference, single int16 source offset, 8-bit object number); any other source or flags
// byte throws as not established rather than being decoded from the spec alone.
export function parseFixups(data, le) {
  const b = bytes(data), dv = view(b), f = FIX(), entry = LE().fixupPageEntry, out = [];
  need(b, le.fixupPageTable, (le.pages + 1) * entry, 'LE fixup page table'); // one offset per page, plus the end
  const starts = Array.from({ length: le.pages + 1 }, (_, i) => dv.getUint32(le.fixupPageTable + i * entry, true));
  for (let p = 0; p < le.pages; p++) {
    let o = le.fixupRecordTable + starts[p];
    const end = le.fixupRecordTable + starts[p + 1];
    while (o < end) {
      need(b, o, f.header, 'LE fixup record');
      const at = o, type = b[o], flags = b[o + f.at.flags];
      if (type !== f.source.offset32 && type !== f.source.selector16) throw new Error(`LE fixup source byte ${type} at ${at} is not established`);
      if (flags !== f.flags.target16 && flags !== f.flags.target32) throw new Error(`LE fixup flags byte ${flags} at ${at} is not established`);
      const source = dv.getInt16(o + f.at.source, true), object = b[o + f.at.object];
      o += f.header;
      let target = 0;
      if (type === f.source.offset32) {
        target = flags === f.flags.target32 ? dv.getUint32(o, true) : dv.getUint16(o, true);
        o += flags === f.flags.target32 ? f.target32 : f.target16;
      }
      out.push({ page: p + 1, source, type, flags, object, target });
    }
    if (o !== end) throw new Error(`LE fixups for page ${p + 1} overrun their table entry`);
  }
  return out;
}

// Locate the bound LE program: the one MZ header whose e_lfanew reaches an LE header whose data pages
// lie inside the file. Bytes after the last page are an overlay (returned, and zero for WW.EXE).
// Returns every candidate so checks can show the others fail.
export function locateLe(data) {
  const b = bytes(data), mz = MZ(), candidates = [];
  for (let at = 0; at + mz.lfanew + 4 <= b.length; at++) { // @math e_lfanew is a uint32
    if (ascii2(b, at) !== mz.magic) continue;
    let reason = null, le = null;
    try {
      le = parseLe(b, at);
      const last = le.dataPages + (le.pages - 1) * le.pageSize + le.lastPageSize;
      if (last > b.length) { reason = `data pages end at ${last}, past the end of the ${b.length}-byte file`; le = null; } else le.overlay = b.length - last;
    } catch (e) { reason = e.message; le = null; }
    candidates.push({ at, le, reason });
  }
  const hits = candidates.filter(c => c.le);
  if (hits.length !== 1) throw new Error(`Expected exactly one bound LE program, found ${hits.length}`);
  return { le: hits[0].le, candidates, overlay: hits[0].le.overlay };
}

// Object-relative citation helpers. Ghidra addresses use the LE-declared object bases.
export function objectBytes(le, number, offset, length) {
  const obj = le.objects[number - 1];
  if (!obj) throw new Error(`No object ${number}`);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset + length > obj.virtualSize) throw new Error(`obj${number}+${offset} is outside the object`);
  if (offset + length <= obj.data.length) return obj.data.subarray(offset, offset + length);
  const out = new Uint8Array(length); // zero-filled tail beyond the stored pages
  out.set(obj.data.subarray(offset, offset + length));
  return out;
}
export const toGhidra = (le, number, offset) => le.objects[number - 1].base + offset;
export function fromGhidra(le, address) {
  const obj = le.objects.find(o => address >= o.base && address < o.base + o.virtualSize);
  if (!obj) throw new Error(`Address ${address.toString(16)} is outside every object`); // @math hex
  return { object: obj.number, offset: address - obj.base };
}

// Fixups as object-relative sites: which object and offset holds the 32-bit (or 16-bit selector)
// field, and the flat target (object base + target offset) a loader would write there.
export function objectFixups(le, fixups) {
  return fixups.map(f => {
    const obj = le.objects.find(o => f.page >= o.pageIndex && f.page < o.pageIndex + o.pageCount);
    if (!obj) throw new Error(`Fixup on page ${f.page} belongs to no object`);
    return { object: obj.number, offset: (f.page - obj.pageIndex) * le.pageSize + f.source, type: f.type, flags: f.flags, targetObject: f.object, target: f.target };
  });
}

// Bytes a loader rewrites: 32-bit fixup sites (2 bytes for the selector site), as one 0/1 mask per
// object, so file and live memory can be compared whatever base the loader chose.
export function siteMasks(le, exe) {
  const sites = objectFixups(le, parseFixups(exe, le)), masks = le.objects.map(o => new Uint8Array(o.data.length));
  for (const s of sites) for (let k = 0; k < (s.type === 2 ? 2 : 4); k++) if (s.offset + k < masks[s.object - 1].length) masks[s.object - 1][s.offset + k] = 1; // @math selector sites are 2 bytes, offset sites 4
  return { sites, masks };
}
