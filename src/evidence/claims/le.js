// Executable-container layout. These are facts of the MZ/LE formats (external specifications),
// so they carry leads; they become PROVEN only through the checks that parse WW.EXE with them.
const LE_SPEC = 'IBM/Microsoft "LE/LX Linear eXecutable Module Format" and Watcom/Tenberry DOS/4G linker documentation (lead only; not read into this repo)';

export default [
  {
    id: 'mz.header', tag: 'PROVEN',
    statement: 'An MZ header starts with "MZ"; the uint32 at +0x3C (e_lfanew) is the new-header offset relative to that MZ header.',
    value: { magic: 'MZ', lfanew: 0x3c },
    evidence: { checks: ['le-locate'] },
    leads: ['Microsoft MS-DOS EXE header layout'],
  },
  {
    id: 'le.header', tag: 'PROVEN',
    statement: 'LE header field offsets (relative to the LE signature) used by src/formats/le.js. dataPages is relative to the inner MZ, not the LE header. The fixup page table holds uint32 entries (fixupPageEntry bytes each), one per page plus an end marker.',
    value: {
      magic: 'LE', cpu: 0x08, os: 0x0a, pages: 0x14, eipObject: 0x18, eip: 0x1c,
      espObject: 0x20, esp: 0x24, pageSize: 0x28, lastPageSize: 0x2c, objectTable: 0x40, objectCount: 0x44,
      pageMap: 0x48, fixupPageTable: 0x68, fixupRecordTable: 0x6c, dataPages: 0x80, fixupPageEntry: 0x04,
    },
    evidence: { checks: ['le-locate', 'le-pages', 'le-entry', 'le-fixups'] },
    leads: [LE_SPEC],
  },
  {
    id: 'le.object-entry', tag: 'PROVEN',
    statement: 'LE object-table entries are 24 bytes: virtual size, base address, flags, 1-based first page index, page count (uint32 each).',
    value: { size: 0x18, virtualSize: 0x00, base: 0x04, flags: 0x08, pageIndex: 0x0c, pageCount: 0x10 },
    evidence: { checks: ['le-pages', 'le-entry'] },
    leads: [LE_SPEC],
  },
  {
    id: 'le.page-map-entry', tag: 'PROVEN',
    statement: 'LE object page-map entries are 4 bytes: a 3-byte big-endian logical page number followed by a flags byte.',
    value: { size: 0x04, numberBytes: 0x03 },
    evidence: { checks: ['le-pages'] },
    leads: [LE_SPEC],
  },
  {
    id: 'le.fixup-record', tag: 'PROVEN',
    statement: 'WW.EXE fixup records use exactly these encodings: source byte 0x07 (32-bit offset) or 0x02 (16-bit selector); flags byte 0x00 (16-bit target offset) or 0x10 (32-bit target offset); then int16 source offset at +2, uint8 object number at +4 (5-byte record header), and the target offset of 2 or 4 bytes (absent for 0x02). Other spec encodings (source lists, 16-bit object numbers, imports) are not exercised and are rejected.',
    value: {
      source: { offset32: 0x07, selector16: 0x02 }, flags: { target16: 0x00, target32: 0x10 },
      at: { flags: 0x01, source: 0x02, object: 0x04 }, header: 0x05, target16: 0x02, target32: 0x04,
    },
    evidence: { checks: ['le-fixups'] },
    leads: [LE_SPEC],
  },
];
