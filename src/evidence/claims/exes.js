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
  {
    id: 'manual.xview', tag: 'PROVEN',
    statement: 'MANUAL.EXE is a script viewer called Xview, not a game program: its second LE object (the data) holds the script words Loadpcx, Fade, Display, nomove, bounce, help, Echo and Waitkey (eight bytes apart from obj2+0x8), the default script name commands.txt (obj2+0x2d0), the banner "Xview.exe : ", "copyright (c)1997 Apogee Software Ltd." and "by Allen H. Blum III", the usage "use : Xview [infile]" with "infile = commands.txt", and the key help "left/right arrow = change page : up/down arrow = scroll page :ESC = quit". The 17016-byte overlay after its pages (manual.exe.layout) is a symbol table of the program: it names the source file C:\\WORK\\XVIEW\\xview.c at overlay+0x2d. The shipped COMMANDS.TXT is such a script: its 10 command lines (the // lines are comments) all have the form `Loadpcx <file>.pcx Display help` or `... Display nomove`, using only words of that table, and name 10 distinct page files that are installed next to it (the front cover, pages 1 to 8 and the back cover). What each word does (the parser and the display code of MANUAL.EXE) is not read here, and the table\'s order is not shown to be a token numbering.',
    value: { dataObject: 2, keywords: ['Loadpcx', 'Fade', 'Display', 'nomove', 'bounce', 'help', 'Echo', 'Waitkey'], comment: '//', commandLines: 10, pages: 10, sourcePathAt: 0x2d, sourcePath: 'C:\\WORK\\XVIEW\\xview.c', strings: [
      { at: 0x8, text: 'Loadpcx', keyword: true },
      { at: 0x10, text: 'Fade', keyword: true },
      { at: 0x18, text: 'Display', keyword: true },
      { at: 0x20, text: 'nomove', keyword: true },
      { at: 0x28, text: 'bounce', keyword: true },
      { at: 0x30, text: 'help', keyword: true },
      { at: 0x38, text: 'Echo', keyword: true },
      { at: 0x40, text: 'Waitkey', keyword: true },
      { at: 0x2d0, text: 'commands.txt' },
      { at: 0x2e1, text: 'Xview.exe : ' },
      { at: 0x2f0, text: 'copyright (c)1997 Apogee Software Ltd.' },
      { at: 0x318, text: 'by Allen H. Blum III' },
      { at: 0x330, text: 'use : Xview [infile]' },
      { at: 0x34e, text: 'infile = commands.txt' },
      { at: 0x392, text: 'left/right arrow = change page : up/down arrow = scroll page :ESC = quit' },
    ] },
    evidence: { checks: ['manual-xview'] },
    leads: ['docs/binaries.md'],
  },
  {
    id: 'wwhelp.packed', tag: 'PROVEN',
    statement: 'WWHELP.EXE (wwhelp.exe.mz) is a program image of 12151 bytes (the MZ header\'s 24 pages of 512 bytes with 375 in the last) followed by 24202 appended bytes, and its header\'s relocation table position (offset 28, there being no relocations) holds the four characters LZ91, the signature that the LZEXE 0.91 packer writes there, so the image is a packed program; that identification as LZEXE is a lead from the packer\'s format, not a check here. The appended data holds, at file offset 0x8c91 (35985), the plain text "WWHELP.EXE  Wacky Wheels v1.1 Technical Help       Apogee Software, Ltd." (once), the title of the help it shows; the rest of the appended data, among it the second MZ signature at 27230 of wwhelp.exe.mz, and the packed program\'s code are not decoded. Seen by hand, not part of the check: text fragments such as "his version of S" and "imply Doc" (file offsets 0x2c55 to 0x2cd4) sit among other bytes, which suggests the help text is stored compressed.',
    value: { pageBytes: 512, signature: 'LZ91', imageBytes: 12151, appendedBytes: 24202, titleAt: 0x8c91, title: 'WWHELP.EXE  Wacky Wheels v1.1 Technical Help       Apogee Software, Ltd.' },
    evidence: { checks: ['wwhelp-packed'] },
    leads: ['docs/binaries.md'],
  },
  {
    id: 'lzexe.decode', tag: 'PROVEN',
    statement: 'The rules by which the packed program image of WWHELP.EXE (wwhelp.packed; wwhelp.image gives the numbers) decompresses, the LZEXE 0.91 decoder\'s: the stream starts at the end of the MZ header (the header size in paragraphs is the word at offset 8, times 16) and is 16-bit words whose bits are taken from the lowest up and whose next word is read as soon as the last bit of one is used; a 1 bit is a literal byte; 0 then 0 is a copy of 2 to 5 bytes (two length bits, then a byte that gives the offset as 0xff00 plus the byte, negative); 0 then 1 is a copy whose offset is a byte and the high bits of a second byte (0xe000 plus those bits shifted by 5 plus the first byte, negative) and whose length is the low three bits of that second byte plus 2, or, when they are 0, a following byte that ends the stream when 0, is a segment-change mark that is skipped when 1 (that branch never occurs in this stream, so it is the packer\'s rule, not shown here) and is otherwise the length plus 1. They are proven by the result: wwhelp.image shows that this decoder reproduces the running program.',
    value: { headerParasAt: 0x08, paragraph: 0x10, wordBits: 0x10, shortSpanHigh: 0xff00, longSpanHigh: 0xe000, spanHighMask: 0x07, spanHighShift: 0x05, lengthBias: 0x02, extendedBias: 0x01, endMark: 0x00 },
    evidence: { checks: ['obs-wwhelp'], obs: ['wwhelp-1'] },
    leads: ['docs/binaries.md'],
  },
  {
    id: 'wwhelp.image', tag: 'PROVEN',
    statement: 'The packed program image of WWHELP.EXE (wwhelp.packed; MZ header of 2 paragraphs, the packed stream from file offset 0x20 to 0x2e06, the stub with the packer\'s variables from 0x2e10) decompresses with the rules of lzexe.decode to 18538 bytes, the stream ending with its end mark at file offset 0x2e06, and those bytes are the program as it runs: in the DOSBox run of the installed program (record wwhelp-1, taken while it showed its first help page; the record holds the size and SHA-1 of the copy that was run, which is the installed file; the memory block of its PSP read, the image starting 0x100 bytes into it) 62 of the 73 pages of 256 bytes of the decoded image are byte for byte the live image, and the 11 others (offsets 0x2100, 0x2300, 0x2900, 0x3300 and 0x4100 to 0x4800) differ (the check compares pages by CRC-32; a byte comparison made by hand found 526 differing bytes, 15 of them in the first four pages, at the places where the loader applies the program\'s segment relocations, which the packer stores separately, and 511 in the last seven, the program\'s own variables and buffers). The program is SimpleWare\'s document viewer "Simply Docs" modified for Apogee, as its strings show when it runs (seen on its screen and in the memory dump, not part of the check); the text of the help is not in the decoded image (the 24202 appended bytes hold it); only its viewer is.',
    value: { packedStart: 0x20, packedEnd: 0x2e06, imageBytes: 18538, pageBytes: 256, imageAt: 0x100, pages: 73, equalPages: 62 },
    evidence: { checks: ['obs-wwhelp'], obs: ['wwhelp-1'] },
    leads: ['docs/binaries.md'],
  },

  {
    id: 'manual.script', tag: 'STATIC',
    statement: 'Read in MANUAL.EXE (Xview): how it reads and runs a script such as COMMANDS.TXT. The words are looked up by obj1+0xe60 in the table of 11 dword pointers at obj2+0x580 (the strings at obj2+0x4 "//", +0x8 Loadpcx, +0x10 Fade, +0x18 Display, +0x20 nomove, +0x28 bounce, +0x30 help, +0x38 Echo, +0x40 Waitkey, +0x48 "/?" and +0x4c "-h"), by comparing the word with each in turn (obj1+0x1ab0); the index is the word\'s number, and 0xff means unknown. A word is read by obj1+0xe90, which skips spaces and line ends (counting lines in the dword obj2+0x57c) and takes characters up to the next space or line end, at most 0x40. The parser (obj1+0xa60) opens the file (the argument of the program, else the name commands.txt of obj2+0x2d0), and fills records of 0x48 bytes at obj2+0x1d00, counted in the dword obj2+0x5cc: a dword command number at +0, up to 0x40 bytes of text from +4 and a dword at +0x44. For the numbers 0 (a // comment) and 7 (Echo) it reads the rest of the line as the text (obj1+0xb1f); for 1 (Loadpcx) it reads the next word as the text, the file name (obj1+0xb8e); for 3 (Display) it reads the next word and, when that is 4, 5 or 6 (nomove, bounce or help), stores its number at +0x44 (obj1+0xb9a to +0xbde); the numbers 2, 4, 5, 6 and 8 take no argument; an unknown word (0xff) prints a message with the line number and the word ("error(L%d): command (%s) unknown.", obj1+0xc1b and +0xc62) and sets the error flag at obj2+0x53c, which stops the run. The runner (obj1+0xcc0) then walks the records from the dword obj2+0x540: it skips comments, loads a page picture for 1 (obj1+0xd98), displays for 3 (obj1+0xdd1), for 7 switches to the text mode once and prints the text (obj1+0xd42) and waits for a key for 8 (obj1+0xe1f). So the script words Loadpcx, Display, nomove, bounce, help, Echo, Fade and Waitkey of manual.xview are numbered 1 to 8 here; what the loader and the display code do with a page, and what Fade and bounce do, are not read. Not observed at run time.',
    value: { keywordTableAt: 0x580, keywords: ['//', 'Loadpcx', 'Fade', 'Display', 'nomove', 'bounce', 'help', 'Echo', 'Waitkey', '/?', '-h'], unknown: 0xff, wordBytes: 0x40, recordsAt: 0x1d00, recordBytes: 0x48, textAt: 4, optionAt: 0x44, lineCountAt: 0x57c, recordCountAt: 0x5cc, errorFlagAt: 0x53c, runIndexAt: 0x540, ids: { comment: 0, loadpcx: 1, fade: 2, display: 3, nomove: 4, bounce: 5, help: 6, echo: 7, waitkey: 8 } },
    evidence: { at: ['MANUAL.EXE:obj1+0xe60 fp=acd2da4f', 'MANUAL.EXE:obj1+0xa60 fp=7370b62f', 'MANUAL.EXE:obj1+0xade fp=a41035e8', 'MANUAL.EXE:obj1+0xb1f fp=36cfc372', 'MANUAL.EXE:obj1+0xb9a fp=8ffe8b3d', 'MANUAL.EXE:obj1+0xcc5 fp=69fe16da', 'MANUAL.EXE:obj1+0xd00 fp=a989bc65', 'MANUAL.EXE:obj1+0xd42 fp=946735f6'] },
    leads: ['docs/binaries.md'],
  },
];
