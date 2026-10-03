// The three other executables in the user's install, so that nothing cites them without a layout.
// SETUP.EXE and MANUAL.EXE are DOS/4G-bound LE programs; WWHELP.EXE is a plain MZ program. What each
// program does is not analysed (docs/TODO.md); these claims record only where its parts are.
export default [
  {
    id: 'mz.dos-header', tag: 'PROVEN',
    statement: 'The 16-bit MZ header fields read at these offsets give the values recorded in wwhelp.exe.mz for WWHELP.EXE (checked against a program whose header is a real DOS header, not a stub); the field offsets themselves are the MS-DOS EXE format.',
    value: { lastPage: 0x02, pages: 0x04, relocations: 0x06, headerParagraphs: 0x08, minAlloc: 0x0a, maxAlloc: 0x0c, ss: 0x0e, sp: 0x10, ip: 0x14, cs: 0x16, relocTable: 0x18, size: 0x1c },
    evidence: { checks: ['other-exes'] },
    leads: ['Microsoft MS-DOS EXE header layout'],
  },
  {
    id: 'wwhelp.exe.mz', tag: 'PROVEN',
    statement: 'WWHELP.EXE is a 36353-byte plain MZ program: its header gives 375 bytes in the last page of 24 pages (an image of 12151 bytes), no relocations, a 2-paragraph header, minimum and maximum allocation 2079 and 0xffff paragraphs, SS:SP 1200:128, CS:IP 735:14 and a relocation table at 28; a second MZ signature sits at file offset 27230. It contains no DOS/4G stub and no LE header (located LE programs: none). Its contents are not analysed.',
    value: { size: 36353, fields: { lastPage: 375, pages: 24, relocations: 0, headerParagraphs: 2, minAlloc: 2079, maxAlloc: 0xffff, ss: 1200, sp: 128, ip: 14, cs: 735, relocTable: 28 }, secondMz: 27230 },
    evidence: { checks: ['other-exes'] },
  },
  {
    id: 'setup.exe.layout', tag: 'PROVEN',
    statement: 'SETUP.EXE is a 391343-byte DOS/4G-bound LE program with the same stub offsets as WW.EXE: bound MZ at file offset 157268, LE header at 168188, 42 pages of 4096 bytes (the last 2139), no overlay; obj1 (base 0x10000, vsize 0x242FE, flags 0x2045, pages 1 to 37), obj2 (base 0x40000, vsize 0x343C0, flags 0x2043, pages 38 to 42); entry at obj1+42216; initial ESP at the end of obj2. Its contents are not analysed.',
    value: { size: 391343, mz: 157268, header: 168188, pages: 42, lastPageSize: 2139, overlay: 0, eip: { object: 1, offset: 42216 }, esp: { object: 2, offset: 0x343c0 }, objects: [{ base: 0x10000, virtualSize: 0x242fe, flags: 0x2045, pageIndex: 1, pageCount: 37 }, { base: 0x40000, virtualSize: 0x343c0, flags: 0x2043, pageIndex: 38, pageCount: 5 }] },
    evidence: { checks: ['other-exes'] },
  },
  {
    id: 'manual.exe.layout', tag: 'PROVEN',
    statement: 'MANUAL.EXE is a 305676-byte DOS/4G-bound LE program: bound MZ at file offset 217764, LE header at 228412, 12 pages of 4096 bytes (the last 3312) followed by a 17016-byte overlay; obj1 (base 0x10000, vsize 0x9C30, flags 0x2005, pages 1 to 10), obj2 (base 0x20000, vsize 0x4330, flags 0x2003, pages 11 to 12); entry at obj1+7024; initial ESP at the end of obj2. What the overlay holds is not analysed.',
    value: { size: 305676, mz: 217764, header: 228412, pages: 12, lastPageSize: 3312, overlay: 17016, eip: { object: 1, offset: 7024 }, esp: { object: 2, offset: 0x4330 }, objects: [{ base: 0x10000, virtualSize: 0x9c30, flags: 0x2005, pageIndex: 1, pageCount: 10 }, { base: 0x20000, virtualSize: 0x4330, flags: 0x2003, pageIndex: 11, pageCount: 2 }] },
    evidence: { checks: ['other-exes'] },
  },
  {
    id: 'dos4g.stub-header', tag: 'PROVEN',
    statement: 'The MZ header at file offset 0 of WW.EXE, SETUP.EXE and MANUAL.EXE (the DOS/4G stub) is the same in all three: 116 bytes in the last page of 123 pages, 78 relocations, a 32-paragraph header, minimum and maximum allocation 1 and 0xffff paragraphs, SS:SP 289:832, CS:IP 445:9090 and a relocation table at 30.',
    value: { lastPage: 116, pages: 123, relocations: 78, headerParagraphs: 32, minAlloc: 1, maxAlloc: 0xffff, ss: 289, sp: 832, ip: 9090, cs: 445, relocTable: 30 },
    evidence: { checks: ['other-exes'] },
  },
];
