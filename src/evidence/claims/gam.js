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
    id: 'gam.load-words', tag: 'PROVEN',
    statement: 'Observed in the running game (record gamload-1: an execute breakpoint at the exit of the .GAM parser, obj1+0x17499, in the first demo race, track 2): the words the parser has stored equal the track\'s own .GAM read from the archive: the value words at obj2+0x28b0a and +0x28b0e are lines 6 and 7 plus 0x0400; the two start tables at obj2+0x1d7cc (x) and +0x1d7e0 (y) hold all eight coordinate pairs of lines 9 to 24, each plus 0x03e0; the flag word at obj2+0x28b60 is the flag line (1 here); and the words at obj2+0x28b5a, +0x28b4e and +0x28b4c are lines 26, 27 and 28. The grid that later replaces the seven other table entries (racer.start-grid) is therefore written after the load.',
    value: { valueAt: [0x28b0a, 0x28b0e], valueBias: 0x0400, xTable: 0x1d7cc, yTable: 0x1d7e0, pairBias: 0x03e0, pairs: 0x08, flagAt: 0x28b60, extra: [0x28b5a, 0x28b4e, 0x28b4c] },
    evidence: { checks: ['obs-gamload'], obs: ['gamload-1'], at: ['WW.EXE:obj1+0x1733d fp=5564c40c', 'WW.EXE:obj1+0x173c9 fp=33a86f73', 'WW.EXE:obj1+0x173e3 fp=afa9fc88', 'WW.EXE:obj1+0x17436 fp=c5eb1d2b'] },
    leads: ['docs/gam.md'],
  },
  {
    id: 'gam.read-rest', tag: 'STATIC',
    statement: 'The same parser converts lines 6 and 7 to integers stored with 0x0400 added at obj2+0x28b0a and +0x28b0e, reads and drops line 8, converts lines 11 to 24 into the other seven coordinate pairs (each with 0x03e0 added, indexed 1 to 7 in the two tables), and stores line 25 at obj2+0x28b60, setting that word to 1 when it is non-zero. The stores of lines 6, 7, 9 to 24, 25 and 26 to 28 are observed in gam.load-words (the later rewrite is racer.start-grid); that line 8 is read and dropped and that the flag word is set to 1 only for a non-zero line 25 are read, not seen (the one recorded track has flag 1).',
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
    id: 'gam.trailing-space', tag: 'PROVEN',
    statement: 'Experiment in the running game (record gamslot-1: a copy of the user\'s archive with line 5 of 2.GAM edited to "back2.pcx " with a trailing space, rebuilt and hash-checked by the check; the first demo race, track 2): the game\'s copy of that line, in the slot at obj2+0xa4e0, is "BACK2.PCX " (upper-cased in place by the archive lookup) followed by a 0 byte. So the .GAM line reader keeps trailing spaces and ends the stored line with a NUL.',
    value: { skyLine: 0x04, skyText: 'back2.pcx ', caseDelta: 0x20, terminator: 0x00 },
    evidence: { checks: ['obs-gamslot'], obs: ['gamslot-1'], at: ['WW.EXE:obj1+0x16ff0 fp=c0013f8f', 'WW.EXE:obj1+0x17008 fp=d4d79688', 'WW.EXE:obj1+0x17020 fp=bbbe3968'] },
    leads: ['docs/gam.md'],
  },
  {
    id: 'gam.line-reader-tail', tag: 'STATIC',
    statement: 'The same line reader has no end-of-file test, so a file that ends without a CR makes it read past the end, and it writes its NUL over the position of the CR. Read in full in disassembly; gam.trailing-space shows the stored line keeps trailing spaces and ends in a NUL, but nothing was run that reads past the end of a file.',
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
    id: 'gam.numbers-use', tag: 'STATIC',
    statement: 'Read (the stores obj1+0x1734d and +0x1736a, the race set-up obj1+0x20521 to +0x20589 and the racer init obj1+0x6f94 to +0x7188; the sites are in the citations; resolves the earlier UNKNOWN_GAM_NUMBERS): what the numeric lines of a .GAM are for. Lines 6 and 7 (+0x0400) are the first values of the camera\'s world position words obj2+0x28b0a and +0x28b0e, the words the floor and the draw read (trig.use); the race set-up replaces them before the first frame with the x of racer 0 and its y less 0x7c (obj1+0x20527 and +0x20589: the camera starts 0x7c behind the car), and the intro puts them elsewhere (race.intro), so the file\'s two numbers are not seen in a race as far as the writers listed for the two words go (no other reader of them between the .GAM load and the set-up was looked for). The eight coordinate pairs (lines 9 to 24, +0x03e0) are racer start positions, racer n taking the pair n: the Wacky Duck Shoot (the dword obj2+0x1ec74 not 0) sets the x and y of all eight racers from them (obj1+0x6f94 to +0x7023); in every other race the racer init first rebuilds the table from pair 0 (x + 0x50 down to x - 0x3c in steps of 0x14, y the same, obj1+0x70b8 to +0x70f4, racer.start-grid) and the racers take their positions from the table (obj1+0x716a), except in the shoot-out (the word obj2+0x28be2 not 0), which skips the rebuild (obj1+0x70a9) so that its two racers start at the pairs 0 and 1. The line 25 and the lines 26 to 28 are the palette cycling flag and delays (palette.cycle-rules, palette.cycle-replay).',
    value: { viewpointWords: [0x28b0a, 0x28b0e], viewpointBias: 0x0400, setupX: 0x20527, setupY: 0x20589, behind: 0x7c, startPairs: 8, pairBias: 0x03e0, tables: [0x1d7cc, 0x1d7e0], duckBranch: 0x6f94, rebuildSkip: 0x70a9, rebuild: 0x70b8, takePair: 0x716a, duckWord: 0x1ec74, shootWord: 0x28be2 },
    evidence: { at: ['WW.EXE:obj1+0x1734d fp=bc8aaa9e', 'WW.EXE:obj1+0x1736a fp=9b355bd5', 'WW.EXE:obj1+0x20521 fp=3005400c', 'WW.EXE:obj1+0x20527 fp=ba62b45e', 'WW.EXE:obj1+0x20589 fp=8c8f7a43', 'WW.EXE:obj1+0x6f94 fp=e7332275', 'WW.EXE:obj1+0x7005 fp=18cb0cf4', 'WW.EXE:obj1+0x70a9 fp=a283d98e', 'WW.EXE:obj1+0x70b8 fp=ca2859c8', 'WW.EXE:obj1+0x716a fp=8353b37b'] },
    leads: ['docs/gam.md', 'docs/leads/duck-race.md', 'docs/leads/two-player-race.md'],
    todo: 'Observe a shoot-out start (racers at the pairs 0 and 1: seen in racer.start-grid for track 16) and the duck start; look for other readers of the camera words between the .GAM load and the race set-up.',
  },
  {
    id: 'palette.cycle-observed', tag: 'PROVEN',
    statement: 'Observed in the running game (record dac-1: a shootout race on track 16 of the plain archive, whose .GAM has the palette-cycling flag 1 and the delays 2, 4 and 3 like track 2; the VGA DAC entries 144 to 180 read through ports 0x3c7 and 0x3c9 at 40 pauses of 0.1 to 0.3 s, 535 to about 640 ticks): exactly 13 of the 37 entries change over time, the entries 148, 161 to 164 and 168 to 175, the sets that the wiki names for the cycling, and the other 24 never change (144 to 147, 149 to 160, 165 to 167 and 176 to 180); every colour the 13 entries take is one of the colours of the palette of BEACH.PCX (the palette the cycling uses, 6-bit values as the DAC holds them), the values at the entries 161 to 164 and 168 to 175 are the entries 0 to 76 of that palette in groups (the entries 1, 5, 10, 25, ..., 2, 6, 15, ..., 3, 7, 11, ... and so on are equal colours: the palette repeats its colours in a pattern) and the whole cycle of the group 148 and 161 to 164 comes round to the same colours about every 20 ticks. Not observed: the rule that picks the entries of BEACH.PCX at each step (the roles of the three delays 2, 4 and 3 are read in gam.read-rest), the effect on the picture, and the first palette load. A flag-1 track in a played race is reached through the two player shootout menu (zone 1 is track 16).',
    value: { track: 16, from: 144, to: 180, samples: 40, changing: [148, 161, 162, 163, 164, 168, 169, 170, 171, 172, 173, 174, 175], groupA: [148, 161, 162, 163, 164], stable: 24, delays: [2, 4, 3], palette: 'BEACH.PCX', minChanges: 15, returnTicks: [535, 555, 577, 595, 615, 636] },
    evidence: { checks: ['obs-dac'], obs: ['dac-1'] },
    leads: ['docs/gam.md'],
  },
  {
    id: 'palette.cycle-rules', tag: 'STATIC',
    statement: 'Read in full (the cycler obj1+0x18668 to +0x1876a, its two uploads obj1+0x27c43 and +0x27c84, the race set-up words obj1+0x20457 to +0x20475, the .GAM store obj1+0x173e3 to +0x17436 and the palette buffer set-up obj1+0x266e1 to +0x26743; the sites are in the citations): the palette cycling of the tracks whose .GAM has the flag 1 (6 of the 42: 2, 12, 16, 27, 33 and 42, all with the delays 2, 4 and 3). The cycler is called once per drawn frame, in the intro passes (obj1+0x208e8 in the loop obj1+0x20865 to +0x20a50) and in the frames of the countdown and the race (obj1+0x1f7a0; seen in palette.cycle-start-replay), and does nothing while the word obj2+0x28b60 is 0. That word is the line 25 (set to 1 when the line is not 0, obj1+0x173e3 to +0x17436) and the frame count of group B; the words obj2+0x28b50 (the frame count of group A), +0x28b38 (the position of group A, 0 to 3) and +0x28b3a (the state of group B, 0 to 8) are zeroed by the race set-up (obj1+0x20457, +0x2046a, +0x20475); the delays are the lines 26, 27 and 28 at obj2+0x28b5a (the steps of group B), +0x28b4e (the wait in the state 3) and +0x28b4c (the steps of group A). The colours come from the palette buffer obj2+0x1d758 (768 bytes of 6-bit values), which the race loader fills from the PCX named at obj2+0x232c, BEACH.PCX, whatever the track (obj1+0x26725 to +0x26743, with the name read from the executable\'s data). Each call: (1) when the frame count of group A is not below its delay (signed), the position goes up by one (back to 0 above 3), group A is uploaded from the buffer at 0x87 + 12 x position (obj1+0x186a0 to +0x186b6: the DAC entries 173 and 172 from the colours 0 and 1, 174 and 175 from the colours 2 and 3, then 168 to 171 from the colours 0 to 3 of the source 0x30 bytes on, obj1+0x27c84 to +0x27ce9), and its frame count is 0; (2) when the state of group B is 3 and the frame count of B is not below the wait, the state is 4, B is uploaded from the buffer at 0x3c, the count is 0; otherwise, when the count is not below the delay of B and the state is not 3, the state goes up by one (back to 0 above 8), B is uploaded from the buffer at 15 x state and the count is 0 (obj1+0x186c4 to +0x18756; the upload writes the DAC entries 161 to 164 from the colours 0 to 3 and then 148 from the colour 4, obj1+0x27c43 to +0x27c7d); (3) both counts go up by one (obj1+0x1875b to +0x18762). So group B takes 2 frames a state except 4 in the state 3 (a cycle of 20 frames) and group A 3 frames a position (a cycle of 12). The replay of the recorded DAC samples is palette.cycle-replay.',
    value: { routine: 0x18668, flagWord: 0x28b60, groupACountWord: 0x28b50, groupAPositionWord: 0x28b38, groupBStateWord: 0x28b3a, delayWords: [0x28b5a, 0x28b4e, 0x28b4c], paletteBuffer: 0x1d758, paletteName: 'BEACH.PCX', startCount: 1, groupA: { source: 0x87, step: 12, positions: 4, firstEntries: [173, 172, 174, 175], secondEntries: [168, 169, 170, 171], secondSource: 0x30 }, groupB: { entries: [161, 162, 163, 164, 148], step: 15, states: 9, hold: 3, resume: 4, resumeSource: 0x3c } },
    evidence: { at: ['WW.EXE:obj1+0x18668 fp=e1ea9fb2', 'WW.EXE:obj1+0x18677 fp=78dfb743', 'WW.EXE:obj1+0x18686 fp=29271909', 'WW.EXE:obj1+0x186a0 fp=314aa56e', 'WW.EXE:obj1+0x186c4 fp=b366c5df', 'WW.EXE:obj1+0x186dd fp=ebcbf1f7', 'WW.EXE:obj1+0x186fe fp=f83823f5', 'WW.EXE:obj1+0x1870d fp=2ce391eb', 'WW.EXE:obj1+0x18731 fp=82ab8c25', 'WW.EXE:obj1+0x1875b fp=20d336e4', 'WW.EXE:obj1+0x27c43 fp=de1fd0ec', 'WW.EXE:obj1+0x27c6b fp=3a6e05c3', 'WW.EXE:obj1+0x27c84 fp=f7195a6e', 'WW.EXE:obj1+0x27cad fp=940ff79d', 'WW.EXE:obj1+0x27cd4 fp=e22cd7c7', 'WW.EXE:obj1+0x266e1 fp=94fd8eed', 'WW.EXE:obj1+0x20457 fp=9d40df2b', 'WW.EXE:obj1+0x2046a fp=864d8f34', 'WW.EXE:obj1+0x20475 fp=4dea6311', 'WW.EXE:obj1+0x208e8 fp=c1bf9dad', 'WW.EXE:obj1+0x1f7a0 fp=f1eeaaed', 'WW.EXE:obj1+0x173e3 fp=afa9fc88', 'WW.EXE:obj1+0x17408 fp=a3584502', 'WW.EXE:obj1+0x17422 fp=1fe835f5', 'WW.EXE:obj1+0x17436 fp=c5eb1d2b', 'WW.EXE:obj1+0x1743f fp=3a56bfbb'] },
    leads: ['docs/gam.md'],
    todo: 'Read how the cycler and the palette fade of the race start share the DAC (the first 12 pauses of an intro show the fade), and whether a flag track\'s pause menu or finish screens keep the cycling.',
  },
  {
    id: 'palette.cycle-replay', tag: 'PROVEN',
    statement: 'The model of palette.cycle-rules (src/game/palette-cycle.js: the words, the delays 2, 4 and 3 of the .GAM of track 16, the colours of BEACH.PCX) reproduces the recorded DAC of dac-1 (palette.cycle-observed: a shoot-out race, so no intro and no countdown, 40 pauses at the counter values 535 to 636, the entries 144 to 180): after as many calls as the counter value plus 1 (the frame of the counter value has made its call) the cycled entries equal the sample in 37 samples, and in the other 3 (the counter values 561, 577 and 623) they equal the state one call earlier, which is a pause between the counter\'s step and the cycler\'s call; no other sample fits one call or two earlier or later. The delays swapped (3, 4, 2 or 4, 2, 3), the sources of group A or B moved by one colour, the wait of the state 3 as 2 and the start count 0 each fail the replay.',
    value: { track: 16, samples: 40, atCountPlusOne: 37, atCount: 3, atCountSamples: [561, 577, 623], startCount: 1 },
    evidence: { checks: ['port-palette'], obs: ['dac-1'] },
    leads: ['docs/gam.md'],
  },
  {
    id: 'palette.cycle-start-replay', tag: 'PROVEN',
    statement: 'The cycler runs in the intro\'s passes, the countdown and the race, once a drawn frame (palette.cycle-rules): the record dacrace-1 (the demo race on track 2, flag 1 and delays 2, 4 and 3; 150 pauses of the cycled DAC entries from the first passes of the intro: 44 in the intro, whose entries show the palette fade, 57 in the countdown and 49 in the race, the counter values 0 to 61) is replayed through the port\'s own race (startRace, the intro of race.intro, then one stepRace a frame): in the 106 pauses of the countdown and the race the entries equal the cycler\'s state after the intro\'s 19 passes plus the counter value plus 1 calls (98 pauses) or one call fewer (8 pauses: a pause between the counter\'s step and the cycler\'s call), none fits neither. The 19 are the port\'s intro (the camera swing of race.intro), so the number of passes that the intro takes agrees with the cycler\'s phase; without the intro\'s passes or one call off the replay fails.',
    value: { track: 2, class: 1, engine: 1, detail: 1, driver: 2, seed: 12345, laps: 3, intro: 19, modes: [44, 57, 49], atCallsPlusOne: 98, atCalls: 8 },
    evidence: { checks: ['port-palette'], obs: ['dacrace-1'] },
    leads: ['docs/gam.md'],
  },
];
