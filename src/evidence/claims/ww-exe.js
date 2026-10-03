// Facts about the user's WW.EXE (650437 bytes, sha1 ea41ea5e…). Citations are made against this
// build; docs/binaries.md records how to derive Ghidra and live DOSBox addresses from them.
export default [
  {
    id: 'ww.exe.layout', tag: 'PROVEN',
    statement: 'WW.EXE is a DOS/4G-bound LE program (cpu field 2, os field 1): the bound MZ is at file offset 157268 and its LE header at 168188; 82 pages of 4096 bytes (last 113) end exactly at EOF; obj1 (base 0x10000, vsize 0x4BE2E, flags 0x2045, 76 pages) and obj2 (base 0x60000, vsize 0x33100, flags 0x2043, 6 pages); entry at obj1+0x311A8; initial ESP at the end of obj2 (obj2+0x33100).',
    value: {
      size: 650437, mz: 157268, header: 168188, cpu: 2, os: 1, pages: 82, pageSize: 4096, lastPageSize: 113,
      eip: { object: 1, offset: 0x311a8 }, esp: { object: 2, offset: 0x33100 },
      objects: [
        { base: 0x10000, virtualSize: 0x4be2e, flags: 0x2045, pageIndex: 1, pageCount: 76 },
        { base: 0x60000, virtualSize: 0x33100, flags: 0x2043, pageIndex: 77, pageCount: 6 },
      ],
    },
    evidence: { checks: ['le-locate', 'le-pages', 'le-entry'] },
  },
  {
    id: 'ww.exe.entry-stub', tag: 'PROVEN',
    statement: 'The entry point obj1+0x311A8 is a 2-byte short jump (opcode 0xEB, rel8 0x78) over the ASCII banner "WATCOM C/C++32 Run-Time system…"; the banner starts right after the 2-byte jump and the jump target (entry+2+0x78) lies beyond the banner text.',
    value: { opcode: 0xeb, operand: 0x78, length: 0x02, banner: 'WATCOM C/C++32 Run-Time system' },
    evidence: { checks: ['le-entry'], at: ['WW.EXE:obj1+0x311a8 fp=12c4b465'] },
    leads: ['x86 JMP rel8 encoding; Watcom C/C++32 startup (cstart) places its copyright banner after the entry jump'],
  },
  {
    id: 'ww.exe.fixups', tag: 'PROVEN',
    statement: 'WW.EXE has 17430 fixups: 13701 with source 0x07/flags 0x10, 3728 with source 0x07/flags 0x00, and 1 with source 0x02.',
    value: { total: 17430, offset32Target32: 13701, offset32Target16: 3728, selector16: 1 },
    evidence: { checks: ['le-fixups'] },
  },
  {
    id: 'ww.exe.fixup-sites', tag: 'PROVEN',
    statement: 'At every source-0x07 fixup site in WW.EXE, the pre-fixup uint32 already equals the fixup\'s object-relative target offset. 13 records have a negative source offset (a site straddling into that page from the previous one).',
    value: { negativeSources: 13 },
    evidence: { checks: ['le-fixups'] },
  },
  {
    id: 'ww.exe.relocation', tag: 'PROVEN',
    statement: 'Observed in the running game (record load-2, dosbox-automation 0.84.0-vc1, game paused in a race): DOS/4G maps obj1 at linear 0x1EC000 and obj2 at 0x239000 (a property of that session, not of the file), and every one of 272 sampled 32-bit fixup sites in obj1 (every 64th) holds the target object\'s live base plus the target offset parsed in-process (ww.exe.fixups). Compared page by page with fixup sites masked, the live code object differs from the file in exactly one page, the page holding the entry point, while the data object differs in some pages and not in others; the record holds the live CRC of every stored page.',
    value: { obj1Base: 0x1ec000, obj2Base: 0x239000, sampleStride: 0x40 },
    evidence: { checks: ['obs-load'], obs: ['load-2'] },
  },
];
