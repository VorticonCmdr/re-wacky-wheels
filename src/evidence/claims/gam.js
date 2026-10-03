// .GAM track configuration: how the parser reads it (STATIC, Ghidra FUN_0002717c = obj1+0x717c, the
// only GAM reader found so far) and what the archive's files contain (PROVEN, gam-files check).
// Sites are object-relative and pre-fixup. The line reader it calls (obj1+0x16ff0) and the integer
// parser (obj1+0x33199) are identified from argument use only; their bodies are unread.
export default [
  {
    id: 'gam.read', tag: 'PROVEN',
    statement: 'Observed in the running game (record race-3, track 2): Ghidra FUN_0002717c (obj1+0x717c) reads "<track>.GAM" (suffix ".GAM" at obj2+0x153c) line by line, and afterwards lines 1 and 2 are in the 14-byte slots obj2+0x1eabc and +0x1eaca, lines 3 and 4 in obj2+0x1eaa0 and +0x1eaae, each rewritten as "A_" (string at obj2+0x1544) followed by the line; line 5 is in obj2+0xa4e0; the first tileset\'s name, upper-cased, is the palette source (obj2+0x1d784); lines 26 to 28 are words at obj2+0x28b5a, +0x28b4e and +0x28b4c; and the first coordinate pair (lines 9 and 10) is in the word tables obj2+0x1d7cc and +0x1d7e0 with 0x03e0 added.',
    value: { prefix: 'A_', tilesetSlots: 0x02, maskSlots: 0x02, startBias: 0x03e0, extraLines: 0x03 },
    evidence: { checks: ['obs-race'], obs: ['race-3'], at: ['WW.EXE:obj1+0x171ac fp=22ed2e2a', 'WW.EXE:obj1+0x171fa fp=5b695d28', 'WW.EXE:obj1+0x1720a fp=8fe4abd7', 'WW.EXE:obj1+0x1721a fp=faccc4bd', 'WW.EXE:obj1+0x1722a fp=7c807c54', 'WW.EXE:obj1+0x1723a fp=5ca53337', 'WW.EXE:obj1+0x1726b fp=d425b1e8', 'WW.EXE:obj1+0x17370 fp=d69d4a6a', 'WW.EXE:obj1+0x17396 fp=fc9d2b63', 'WW.EXE:obj1+0x173a0 fp=e2c1d308'] },
    leads: ['docs/gam.md (ModdingWiki: lines 1-2 tilesets, 3-4 masks, 5 sky, 9-10 start X,Y, 25 cycling flag, 26-28 delays; 25 or 28 lines)'],
  },
  {
    id: 'gam.read-rest', tag: 'STATIC',
    statement: 'The same parser converts lines 6 and 7 to integers stored with 0x0400 added at obj2+0x28b0a and +0x28b0e, reads and drops line 8, converts lines 11 to 24 into the other seven coordinate pairs (each with 0x03e0 added, indexed 1 to 7 in the two tables), and stores line 25 at obj2+0x28b60, setting that word to 1 when it is non-zero. Not observed: in the running game the two value words differ from the file lines plus 0x0400, the seven other table entries hold a derived start grid (x stepping by 20 from the first pair, y equal) and the flag word is 2, so the game rewrites all of these after loading; their load-time contents are not confirmed.',
    value: { valueBias: 0x0400, startPairs: 0x08 },
    evidence: { at: ['WW.EXE:obj1+0x1733d fp=5564c40c', 'WW.EXE:obj1+0x173c9 fp=33a86f73', 'WW.EXE:obj1+0x173e3 fp=afa9fc88', 'WW.EXE:obj1+0x17436 fp=c5eb1d2b'] },
  },
  {
    id: 'gam.layout', tag: 'PROVEN',
    statement: 'Every .GAM member (42) is text with CRLF line separators: five name lines (two tilesets, two masks, one sky picture), two integer lines, one further line, sixteen integer lines (8 pairs), one flag line that is 0 or 1, and three more integer lines exactly when the flag is 1; any lines after that are blank. For every track, "A_" plus each of lines 1 to 4 (upper-cased) and line 5 (upper-cased) name PCX members of WACKY.DAT. Agrees with gam.read.',
    value: { separator: '\r\n', tilesets: 0x02, masks: 0x02, sky: 0x01, values: 0x02, skipped: 0x01, startPairs: 0x08, extraLines: 0x03 },
    evidence: { checks: ['gam-files'] },
    leads: ['docs/gam.md'],
  },
  {
    id: 'tiles.mask-values', tag: 'PROVEN',
    statement: 'In every mask sheet named by lines 3 and 4 of a .GAM (16 distinct sheets), the pixels of the 54 tile slots tiles.sheet-split uses are all 0 or 1 (both occur), and every other pixel (slots 54 to 59 and the bottom 8 rows) is 255. This is independent byte evidence for 54 tiles per sheet, and shows lines 3 and 4, not lines 1 and 2, are the mask images. Agrees with tiles.buffer.',
    value: { values: [0x00, 0x01], filler: 0xff },
    evidence: { checks: ['gam-files'] },
    leads: ['docs/pcx.md (a_ma* are per-pixel property masks with indices 0/1)', 'docs/sin.md (property choices for mask indices 0/1)'],
  },
  {
    id: 'gam.line-reader', tag: 'PROVEN',
    statement: 'Experiment in the running game (records gamtext-1 to gamtext-4: copies of the user\'s archive with edited lines in 2.GAM, rebuilt and hash-checked by the check): the .GAM line reader (Ghidra FUN_00026ff0, obj1+0x6ff0) ends a line at a CR (0x0d) and then skips exactly one more byte, whatever it is. With line 26 (1-based) edited to "4" CR "7" the three extra words became 4, 0 and 8 (not 4, 4, 3): the byte "7" after the CR was swallowed, the rest of the original CRLF made an empty line, and an LF inside the next edited line ("8" LF "9") did not end it. The reader code and the remaining properties (trailing spaces kept, no end-of-file test, a NUL written over the CR) are gam.line-reader-tail.',
    value: { terminator: 0x0d, consumed: 0x01 },
    evidence: { checks: ['obs-gamtext'], obs: ['gamtext-1', 'gamtext-2', 'gamtext-3', 'gamtext-4'], at: ['WW.EXE:obj1+0x16ff0 fp=c0013f8f', 'WW.EXE:obj1+0x17008 fp=d4d79688', 'WW.EXE:obj1+0x17020 fp=bbbe3968'] },
    leads: ['docs/gam.md'],
  },
  {
    id: 'gam.line-reader-tail', tag: 'STATIC',
    statement: 'The same line reader writes a NUL over the position of the CR, keeps trailing spaces in the line and has no end-of-file test, so a file that ends without a CR makes it read past the end. Read in full in disassembly; the experiment of gam.line-reader did not isolate these properties.',
    value: { terminated: 0x00 },
    evidence: { at: ['WW.EXE:obj1+0x16ff0 fp=c0013f8f', 'WW.EXE:obj1+0x17008 fp=d4d79688', 'WW.EXE:obj1+0x17020 fp=bbbe3968'] },
    leads: ['docs/gam.md'],
  },

  {
    id: 'gam.atoi', tag: 'PROVEN',
    statement: 'Experiment in the running game (records gamtext-1 to gamtext-4, see gam.line-reader): the integer converter the .GAM parser uses (Ghidra FUN_00043199, obj1+0x33199) skips leading characters whose entry in the game\'s character-class table (obj2+0x3150, indexed by the character plus 1) has bit 0x02 (in the recorded table exactly tab, LF, VT, FF, CR and space), accepts one optional + or - (0x2b, 0x2d), accumulates decimal digits (class bit 0x20, set in the recorded table for exactly the characters 0 to 9) and stops at the first other character. The stored value is a 16-bit word. Planted lines and the words the game stored: " 12" gave 12; "+7" 7; "-5" 65531; "9xyz" 9; "12 34" 12; "0x10" 0; "70000" 4464; an empty line 0; TAB "3" 3; "- 5" 0; "++5" 0; "5-3" 5; "007" 7; "+-3" 0; two spaces "-42" 65494 (each also with the file\'s bias of 0x03e0 where the line is a coordinate).',
    value: { plus: 0x2b, minus: 0x2d, ctypeSpace: 0x02, ctypeDigit: 0x20, wordBits: 0x10, ctypeTable: 0x3150, ctypeIndexBias: 0x01 },
    evidence: { checks: ['obs-gamtext'], obs: ['gamtext-1', 'gamtext-2', 'gamtext-3', 'gamtext-4', 'ctype-1'], at: ['WW.EXE:obj1+0x33199 fp=d8caa07c', 'WW.EXE:obj1+0x331af fp=cbfdba90'] },
    leads: ['docs/gam.md'],
  },

  {
    id: 'UNKNOWN_GAM_NUMBERS', tag: 'UNKNOWN',
    statement: 'What the numeric lines mean is not established: lines 6 and 7 (1250 and 1500 in track 2, stored +0x0400), the 8 coordinate pairs (stored +0x03e0; the wiki calls only the first pair the start position; they land in the word tables obj2+0x1d7cc / +0x1d7e0, from which racer.init sets the racers\' start positions, and in one branch racer.start-grid rebuilds seven of the eight from pair 0, so the file\'s other pairs are overwritten there; which branch the real game takes, and what the first pair is relative to the grid, is not established), the flag on line 25 (the wiki says palette cycling) and lines 26 to 28 (the wiki says delays; they are read into three words).',
    evidence: {},
    leads: ['docs/gam.md'],
    todo: 'Find the readers of obj2+0x28b0a/+0x28b0e, the word tables obj2+0x1d7cc/+0x1d7e0, obj2+0x28b60 and obj2+0x28b5a/+0x28b4e/+0x28b4c.',
  },
];
